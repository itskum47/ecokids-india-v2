require('./utils/tracing'); // Must be absolute top for full APM instrumentation
const express = require('express');
const dotenv = require('dotenv');

// Load environment variables BEFORE Sentry
dotenv.config();

// Sentry initialization (must be early)
const Sentry = require('@sentry/node');
if (process.env.NODE_ENV === 'production' && process.env.SENTRY_DSN) {
  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    environment: process.env.NODE_ENV,
    tracesSampleRate: 0.1,
    integrations: [
      Sentry.httpIntegration({ tracing: true }),
      Sentry.mongooseIntegration(),
      Sentry.nodeContextIntegration()
    ]
  });
  console.log('[Sentry] Initialized for production');
}

const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const mongoSanitize = require('express-mongo-sanitize');
const { cspNonceMiddleware, getCSPConfig } = require('./middleware/cspPolicy');
const { globalLimiter } = require('./middleware/distributedRateLimiter');
const colors = require('colors');
const { v4: uuidv4 } = require('uuid');
const logger = require('./utils/logger');
const pinoHttp = require('pino-http');
const cookieParser = require('cookie-parser');
const connectDB = require('./config/database');
const { metricsMiddleware, metricsHandler } = require('./services/metricsService');
const { protect } = require('./middleware/auth');
const { requireRole } = require('./middleware/requireRole');
const { ROLES } = require('./constants/roles');
const { dataLocalizationGuard } = require('./middleware/dataLocalization');
const { dataAccessLogger } = require('./middleware/dataAccessLogger');
const schoolIsolation = require('./middleware/schoolIsolation');
const securityHeaders = require('./middleware/securityHeaders');
const { initializeWeeklySmsJob } = require('./jobs/weeklySmsJob');

// Connect to database
connectDB();
initializeWeeklySmsJob().catch((err) => {
  console.error('[WeeklySmsJob] init failed:', err.message);
});

const app = express();

// Assign UUID Correlation ID to every incoming request
app.use((req, res, next) => {
  req.id = uuidv4();
  next();
});

// CSP nonce middleware (must be before Helmet)
app.use(cspNonceMiddleware);

// BOOST-7: CERT-In Security Headers
app.use(securityHeaders);

// Security middleware
app.use(helmet({
  contentSecurityPolicy: getCSPConfig(),
  crossOriginEmbedderPolicy: false,
  frameguard: { action: 'deny' },
  hidePoweredBy: true,
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true
  },
  noSniff: true,
  referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
  permissionsPolicy: {
    features: {
      geolocation: ['self'],
      camera: ['self'],
      microphone: ['none']
    }
  }
}));

// India-only data residency signaling and runtime guardrails.
app.use(dataLocalizationGuard);

// GZIP Compression
app.use(compression());

// Redis-distributed rate limiting (replaces in-memory)
app.use(globalLimiter);

// CORS
const getAllowedOrigins = () => {
  if (process.env.NODE_ENV === 'production') {
    return process.env.ALLOWED_ORIGINS
      ? process.env.ALLOWED_ORIGINS.split(',')
      : [];
  }
  return ['http://localhost:5173', 'http://localhost:3000'];
};

app.use(cors({
  origin: getAllowedOrigins(),
  credentials: true
}));

// Body parser middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// NoSQL injection protection
app.use(mongoSanitize({
  replaceWith: '_',
  onSanitize: ({ req, key }) => {
    logger.warn({ key, ip: req.ip }, 'NoSQL injection attempt sanitized');
  }
}));

// Cookie parser
app.use(cookieParser());

// Logging middleware (Pino HTTP)
app.use(pinoHttp({
  logger,
  genReqId: (req) => req.id,
  customLogLevel: (req, res, err) => {
    if (res.statusCode >= 500 || err) return 'error';
    if (res.statusCode >= 400) return 'warn';
    return 'info';
  }
}));

// Log access to sensitive data endpoints for compliance audits.
app.use(dataAccessLogger);

// Static files
app.use('/uploads', express.static('uploads'));

// Prometheus metrics
if (process.env.METRICS_ENABLED !== 'false') {
  app.use(metricsMiddleware);
  app.get('/metrics', metricsHandler);
}

// Health check & metrics endpoints (Phase 5 Monitoring)
app.use('/api/v1/health', require('./routes/health'));

// Phase 6: Queue Monitoring Dashboard (Bull Board)
const { createBullBoard } = require('@bull-board/api');
const { BullMQAdapter } = require('@bull-board/api/bullMQAdapter');
const { ExpressAdapter } = require('@bull-board/express');

const serverAdapter = new ExpressAdapter();
serverAdapter.setBasePath('/admin/queues');

const gamificationQueue = require('./queues/gamificationQueue').gamificationQueue;
createBullBoard({
  queues: [new BullMQAdapter(gamificationQueue)],
  serverAdapter
});

// Fix #3: Protect Bull Board — only STATE_ADMIN can access queue dashboard
app.use('/admin/queues', protect, requireRole(ROLES.STATE_ADMIN), serverAdapter.getRouter());

// Deep Kubernetes Health Checks (P0 Integrity)
// Do not report 200 OK if critical backend layers are dead
app.get('/health', async (req, res) => {
  const checks = {
    api: true,
    mongodb: false,
    redis: false,
    workerQueue: false
  };

  try {
    const mongoose = require('mongoose');
    if (mongoose.connection.readyState === 1) {
      await mongoose.connection.db.admin().ping();
      checks.mongodb = true;
    }
  } catch (err) {
    logger.error('[HealthCheck] MongoDB ping failed', err);
  }

  try {
    const { cacheService } = require('./services/cacheService');
    if (cacheService && cacheService.redisClient) {
      await cacheService.redisClient.ping();
      checks.redis = true;
    }
  } catch (err) {
    logger.error('[HealthCheck] Redis ping failed', err);
  }

  try {
    const { gamificationQueue } = require('./queues/gamificationQueue');
    if (gamificationQueue) {
      await gamificationQueue.getWaitingCount();
      checks.workerQueue = true;
    }
  } catch (err) {
    logger.error('[HealthCheck] Queue ping failed', err);
  }

  const healthy = Object.values(checks).every(Boolean);

  if (healthy) {
    return res.status(200).json(checks);
  } else {
    // 503 Service Unavailable triggers K8s to pull this pod out of the load balancer rotation
    logger.error('[HealthCheck] Unhealthy probe detected', checks);
    return res.status(503).json(checks);
  }
});

// NOTE: Prometheus metrics are served by metricsService at line ~90.
// Duplicate registration removed to avoid route shadowing.

// API Routes
app.use('/api/v1/auth', require('./routes/auth'));
app.use('/api/v1/qr', require('./routes/qr'));  // QR code login (Phase 6 School Rollout)
app.use('/api/v1/users', require('./routes/users'));
app.use('/api/v1/config', require('./routes/config'));
app.use('/api/v1/notifications', require('./routes/notifications'));
app.use('/api/v1/topics', require('./routes/topics'));
app.use('/api/v1/games', require('./routes/games'));
app.use('/api/v1/experiments', require('./routes/experiments'));
app.use('/api/v1/quizzes', require('./routes/quizzes'));
app.use('/api/v1/gamification', require('./routes/gamification'));
app.use('/api/v1/progress', require('./routes/progress'));
app.use('/api/v1/admin', require('./routes/admin'));
app.use('/api/v1/admin-cleanup', require('./routes/adminCleanup'));
app.use('/api/v1/teacher', protect, schoolIsolation, require('./routes/teacher'));  // Phase 6: School isolation
app.use('/api/v1/school-admin', protect, schoolIsolation, require('./routes/schoolAdmin'));  // Phase 6: School isolation
app.use('/api/v1/district-admin', require('./routes/districtAdmin'));
app.use('/api/v1/state-admin', require('./routes/stateAdmin'));
app.use('/api/v1/schools', require('./routes/schools'));
app.use('/api/v1/integration', require('./routes/integration')); // Added integration route
app.use('/api/v1/upload', require('./routes/upload'));
app.use('/api/v1/proxy', require('./routes/proxy'));
app.use('/api/v1/audit', require('./routes/auditRoutes'));
app.use('/api/v1/consent', require('./routes/consentRoutes'));
app.use('/api/v1/privacy', require('./routes/privacy'));
app.use('/api/v1/udise', require('./routes/udise'));
app.use('/api/v1/nep', require('./routes/nep'));
app.use('/api/v1/sdg', require('./routes/sdg'));
app.use('/api/v1/safety', require('./routes/safety'));
app.use('/api/v1/certin', require('./routes/certIn'));
app.use('/api/v1/compliance', require('./routes/compliance'));
app.use('/api/v1/fraud', require('./routes/fraud'));
app.use('/api/v1/school-onboarding', require('./routes/schoolOnboarding'));
app.use('/api/v1/reporting', protect, schoolIsolation, require('./routes/reporting'));  // Phase 6: School isolation
app.use('/api/v1/content', require('./routes/content'));
app.use('/api/v1/subscriptions', require('./routes/subscription'));
app.use('/api/v1/rewards', require('./routes/rewards'));
app.use('/api/v1/store', require('./routes/store'));
app.use('/api/v1/reports', require('./routes/reports'));
app.use('/api/v1/challenges', require('./routes/challenges'));
app.use('/api/v1/events', require('./routes/events'));

// Phase 1: Environmental Education Routes
app.use('/api/v1/environmental-lessons', require('./routes/environmentalLessons'));
app.use('/api/v1/eco-points', require('./routes/ecoPoints'));
app.use('/api/v1/impact', require('./routes/impact'));
app.use('/api/v1/habits', require('./routes/habits'));
app.use('/api/v1/missions', require('./routes/missions'));

// Phase 3: Competition Engine
app.use('/api/v1/competition', require('./routes/competition'));
app.use('/api/v1/teams', require('./routes/teams'));

// Phase 3: AI Features (EcoBot, Learning Path, Quiz Generator, Photo Verification)
app.use('/api/v1/ai', protect, require('./routes/ai'));
app.use('/api/v1/translate', require('./routes/translate'));

// Phase 4: Activity Verification
app.use('/api/v1/activity', protect, schoolIsolation, require('./routes/activity'));  // Phase 6: School isolation

// Phase 5: Social Proof Activity Feed
app.use('/api/v1', require('./routes/feedRoutes'));

// Feature 8: Mobile App Integration
app.use('/api/v1/mobile', require('./routes/mobile'));

// Feature 9-10: Sustainability Habits & Government Integration
app.use('/api/v1/habits', require('./routes/habits')); // Updated with sustainability tracking
app.use('/api/v1/government', require('./routes/government')); // NEP 2020 compliance & reporting

// Feature 11: Parent Report Cards
app.use('/api/v1/parent-reports', require('./routes/parentReports')); // Parent progress tracking & reporting

// Feature 12: Eco-Club Hub
app.use('/api/v1/eco-clubs', require('./routes/ecoClubs')); // Teacher eco-club management

// Additional required routes (consolidated)
app.use('/api/v1/leaderboards', protect, schoolIsolation, require('./routes/leaderboards'));  // Phase 6: School isolation
app.use('/api/v1/lessons', require('./routes/lessons'));
app.use('/api/v1/buddies', require('./routes/buddies'));
app.use('/api/v1/student', protect, require('./routes/student'));
app.use('/api/v1/school-challenges', protect, require('./routes/schoolChallenges'));
app.use('/api/v1/feed', protect, require('./routes/feed'));

// Sentry request handler (must be after routes)
if (process.env.NODE_ENV === 'production' && process.env.SENTRY_DSN) {
  app.use(Sentry.Handlers.errorHandler());
}

// Error handling middleware
app.use(require('./middleware/errorHandler'));

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    message: 'Route not found'
  });
});

const PORT = process.env.PORT || 5001;

const server = app.listen(PORT, () => {
  console.log(`Server running in ${process.env.NODE_ENV} mode on port ${PORT}`.yellow.bold);
});

// Phase 2.5: Automated Pilot Telemetry (Daily Digest)
const cron = require('node-cron');
const { sendDailyDigest } = require('./scripts/dailyDigest');
const { scheduleDailyChallengeJob } = require('./jobs/generateDailyChallenge');
const { scheduleSeasonalEventJob } = require('./jobs/seasonalEventManager');
const { scheduleWeeklyMissionJob } = require('./jobs/generateWeeklyMissions');

// Run every morning at 8:00 AM
cron.schedule('0 8 * * *', () => {
  logger.info('⏰ Triggering Daily Digest Cron Job...');
  sendDailyDigest();
}, {
  scheduled: true,
  timezone: "Asia/Kolkata"
});

scheduleDailyChallengeJob().catch((err) => {
  logger.error('Failed to register Daily Challenge cron job', err);
});

scheduleWeeklyMissionJob().catch((err) => {
  logger.error('Failed to register Weekly Mission cron job', err);
});

// Phase 7: Real-Time Socket.io Integration
const { Server } = require("socket.io");
const { createAdapter } = require("@socket.io/redis-adapter");
const { redisClient } = require("./services/cacheService");

const io = new Server(server, {
  cors: {
    origin: getAllowedOrigins(),
    credentials: true,
  }
});

// Configure Redis Adapter for Horizontal Scaling (P5 Blocker)
const pubClient = redisClient;
const subClient = pubClient.duplicate();
io.adapter(createAdapter(pubClient, subClient));

// Integrate Socket.io multi-room architecture (W4)
const setupSocketRooms = require('./socketSetup');
setupSocketRooms(io);

global.io = io;

// Note: Socket room handlers are now in socketSetup.js
// Additional error handling for Socket.io can be added here
io.on('error', (error) => {
  logger.error('[Socket] Server error:', error);
});

// Distributed Hook: Subscribe to Redis for emissions triggered by the standalone Gamification Worker
// (Using the already created duplicate subClient from the adapter)
subClient.subscribe("socket-events", (err) => {
  if (err) logger.error("Failed to subscribe to socket-events:", err);
  else logger.info("Server subscribed to Redis socket-events channel.");
});

subClient.on("message", (channel, message) => {
  if (channel === "socket-events") {
    try {
      const { event, data } = JSON.parse(message);
      io.emit(event, data); // Instantly beam to all connected clients
    } catch (e) {
      logger.error("Socket emit parsing error:", e);
    }
  }
});

// Phase 5: Graceful Shutdown Handling
// Prevents Docker or Kubernetes from killing the server and corrupting operations mid-flight
const gracefulShutdown = async (signal) => {
  logger.info(`Received ${signal}. Starting graceful shutdown...`);
  server.close(async () => {
    logger.info('HTTP server closed.');
    try {
      const mongoose = require('mongoose');
      await mongoose.disconnect();
      logger.info('MongoDB disconnected.');

      const { cacheService, bullmqRedisClient } = require('./services/cacheService');
      await cacheService.quit();
      if (bullmqRedisClient) await bullmqRedisClient.quit();
      logger.info('Redis connections disconnected.');

      // Disconnect BullMQ queues
      try {
        const { gamificationQueue } = require('./queues/gamificationQueue');
        if (gamificationQueue) await gamificationQueue.close();
        logger.info('BullMQ Queues closed gracefully.');
      } catch (e) {
        logger.error('Error closing queues', e);
      }

      // Close Websocket connections
      if (global.io) {
        global.io.close();
        logger.info('Socket.io server closed.');
      }

      logger.info('Graceful shutdown completed successfully.');
      process.exit(0);
    } catch (err) {
      logger.error('Error during graceful shutdown:', err);
      process.exit(1);
    }
  });

  // Force shutdown after 10 seconds if connections are hanging
  setTimeout(() => {
    logger.error('Could not close connections in time, forcefully shutting down');
    process.exit(1);
  }, 10000);
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Handle unhandled promise rejections
process.on('unhandledRejection', (err, promise) => {
  console.log(`❌ Error: ${err.message}`.red);
  // Close server & exit process
  server.close(() => {
    process.exit(1);
  });
});

// Handle uncaught exceptions
process.on('uncaughtException', (err) => {
  console.log(`❌ Uncaught Exception: ${err.message}`.red);
  process.exit(1);
});

module.exports = app;