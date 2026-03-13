const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const { requireRole } = require('../middleware/requireRole');
const { ROLES } = require('../constants/roles');
const logger = require('../utils/logger');

// GET /api/v1/student/dashboard (requires auth)
// Get student's personal dashboard data
router.get('/dashboard', protect, async (req, res) => {
  try {
    const userId = req.user.id;
    const User = require('../models/User');
    const Activity = require('../models/Activity');
    const Gamification = require('../models/Gamification');
    const Habit = require('../models/Habit');

    const user = await User.findById(userId);
    const gamification = await Gamification.findOne({ userId });
    const activities = await Activity.find({ userId }).sort({ createdAt: -1 }).limit(10);
    const habits = await Habit.find({ userId });

    res.json({
      success: true,
      dashboard: {
        user: {
          name: user.firstName,
          email: user.email,
          role: user.role,
          ecoPoints: gamification?.ecoPoints || 0,
          level: gamification?.level || 1,
          streak: gamification?.streak || 0,
        },
        stats: {
          activitiesCompleted: activities.length,
          habitsTracked: habits.length,
          badges: gamification?.badges?.length || 0,
        },
        recentActivities: activities,
      },
    });
  } catch (error) {
    logger.error('Error fetching student dashboard', error);
    res.status(500).json({ error: 'Failed to fetch dashboard' });
  }
});

// GET /api/v1/student/assignments (requires student auth)
// Get assignments for the current student with per-assignment status
router.get('/assignments', protect, requireRole(ROLES.STUDENT), async (req, res) => {
  try {
    const Assignment = require('../models/Assignment');
    const User = require('../models/User');

    const student = await User.findById(req.user.id).select('profile.school profile.grade');
    if (!student) {
      return res.status(404).json({ success: false, message: 'Student not found' });
    }

    const studentGrade = String(student?.profile?.grade || '').trim();
    const school = student?.profile?.school;

    const assignments = await Assignment.find({
      isActive: true,
      grade: studentGrade,
      schoolId: school
    }).sort({ dueDate: 1, createdAt: -1 }).lean();

    const data = assignments.map((assignment) => {
      const recipient = Array.isArray(assignment.recipients)
        ? assignment.recipients.find((item) => String(item.studentId) === String(req.user.id))
        : null;

      return {
        _id: assignment._id,
        title: assignment.title,
        description: assignment.description,
        dueDate: assignment.dueDate || assignment.deadline,
        fileUrl: assignment.fileUrl || '',
        status: recipient?.status === 'submitted' ? 'Submitted' : 'Pending'
      };
    });

    res.json({ success: true, data });
  } catch (error) {
    logger.error('Error fetching student assignments', error);
    res.status(500).json({ success: false, message: 'Failed to fetch assignments' });
  }
});

// GET /api/v1/student/profile
router.get('/profile', protect, requireRole(ROLES.STUDENT), async (req, res) => {
  try {
    const User = require('../models/User');
    const user = await User.findById(req.user.id).select('-password').lean();
    if (!user) {
      return res.status(404).json({ success: false, message: 'Student not found' });
    }

    return res.json({ success: true, data: user });
  } catch (error) {
    logger.error('Error fetching student profile', error);
    return res.status(500).json({ success: false, message: 'Failed to fetch profile' });
  }
});

// PATCH /api/v1/student/onboarding
router.patch('/onboarding', protect, requireRole(ROLES.STUDENT), async (req, res) => {
  try {
    const User = require('../models/User');
    const avatar = String(req.body.avatar || 'leaf');
    const user = await User.findByIdAndUpdate(
      req.user.id,
      { $set: { avatar, firstLogin: false, 'gamification.onboardingCompleted': true } },
      { new: true }
    ).select('-password');

    return res.json({ success: true, data: user });
  } catch (error) {
    logger.error('Error updating onboarding', error);
    return res.status(500).json({ success: false, message: 'Failed to update onboarding' });
  }
});

// GET /api/v1/student/progress
router.get('/progress', protect, requireRole(ROLES.STUDENT), async (req, res) => {
  try {
    const User = require('../models/User');
    const user = await User.findById(req.user.id).lean();
    if (!user) {
      return res.status(404).json({ success: false, message: 'Student not found' });
    }

    const data = [
      { name: 'Topics', completed: user?.progress?.topicsCompleted?.length || 0 },
      { name: 'Games', completed: user?.progress?.gamesPlayed?.length || 0 },
      { name: 'Experiments', completed: user?.progress?.experimentsCompleted?.length || 0 },
      { name: 'Quizzes', completed: user?.progress?.quizzesTaken?.length || 0 }
    ];

    return res.json({ success: true, data });
  } catch (error) {
    logger.error('Error fetching student progress', error);
    return res.status(500).json({ success: false, message: 'Failed to fetch progress' });
  }
});

// GET /api/v1/student/my-activities (requires auth)
// Get user's eco activities
router.get('/my-activities', protect, async (req, res) => {
  try {
    const userId = req.user.id;
    const Activity = require('../models/Activity');

    const activities = await Activity.find({ userId }).sort({ createdAt: -1 });
    res.json({
      success: true,
      activities,
      total: activities.length,
    });
  } catch (error) {
    logger.error('Error fetching student activities', error);
    res.status(500).json({ error: 'Failed to fetch activities' });
  }
});

// GET /api/v1/student/my-badges (requires auth)
// Get user's earned badges
router.get('/my-badges', protect, async (req, res) => {
  try {
    const userId = req.user.id;
    const Gamification = require('../models/Gamification');

    const gamification = await Gamification.findOne({ userId });
    if (!gamification) {
      return res.json({
        success: true,
        badges: [],
      });
    }

    res.json({
      success: true,
      badges: gamification.badges || [],
    });
  } catch (error) {
    logger.error('Error fetching student badges', error);
    res.status(500).json({ error: 'Failed to fetch badges' });
  }
});

// GET /api/v1/student/my-progress (requires auth)
// Get user's overall progress
router.get('/my-progress', protect, async (req, res) => {
  try {
    const userId = req.user.id;
    const User = require('../models/User');
    const Gamification = require('../models/Gamification');
    const Activity = require('../models/Activity');

    const user = await User.findById(userId);
    const gamification = await Gamification.findOne({ userId });
    const activitiesCount = await Activity.countDocuments({ userId });

    res.json({
      success: true,
      progress: {
        ecoPoints: gamification?.ecoPoints || 0,
        level: gamification?.level || 1,
        streak: gamification?.streak || 0,
        activitiesCompleted: activitiesCount,
        badges: gamification?.badges?.length || 0,
        joinedDate: user.createdAt,
      },
    });
  } catch (error) {
    logger.error('Error fetching student progress', error);
    res.status(500).json({ error: 'Failed to fetch progress' });
  }
});

// GET /api/v1/student/my-profile (requires auth)
// Get user's full profile
router.get('/my-profile', protect, async (req, res) => {
  try {
    const userId = req.user.id;
    const User = require('../models/User');

    const user = await User.findById(userId).select('-password');
    res.json({
      success: true,
      profile: user,
    });
  } catch (error) {
    logger.error('Error fetching student profile', error);
    res.status(500).json({ error: 'Failed to fetch profile' });
  }
});

module.exports = router;
