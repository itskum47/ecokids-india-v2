import axios from 'axios';
import toast from 'react-hot-toast';

const getAdaptiveTimeout = () => {
  const conn = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
  if (!conn) return 10000;

  const isSlowNetwork = ['slow-2g', '2g', '3g'].includes(conn.effectiveType);
  if (conn.saveData || isSlowNetwork) {
    return 18000;
  }

  return 10000;
};

// Create axios instance
const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '/api/v1',
  timeout: getAdaptiveTimeout(),
  headers: {
    'Content-Type': 'application/json',
  },
});

// Keep explicit name for compatibility with existing references and docs.
const apiClient = api;

// Request interceptor
api.interceptors.request.use(
  (config) => {
    config.timeout = getAdaptiveTimeout();

    // Preserve existing /v1/... callers while using /api/v1 as the shared base URL.
    if (typeof config.url === 'string' && config.url.startsWith('/v1/')) {
      config.url = config.url.replace(/^\/v1/, '');
    }

    // Don't add Authorization header for public auth routes
    const publicRoutes = ['/auth/login', '/auth/register', '/auth/forgot-password'];
    const isPublicRoute = publicRoutes.some(route => config.url.includes(route));

    if (!isPublicRoute) {
      const token = localStorage.getItem('token');
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor
api.interceptors.response.use(
  (response) => {
    return response;
  },
  async (error) => {
    const { response } = error;

    if (response) {
      const { status, data } = response;

      switch (status) {
        case 401:
          // Unauthorized: clear client token state and force a fresh login session.
          localStorage.removeItem('token');
          delete api.defaults.headers.common['Authorization'];

          try {
            let storeModule = null;
            let authModule = null;

            if (typeof require === 'function') {
              try {
                storeModule = require('../store/index');
              } catch (storeError) {
                storeModule = require('../store/store');
              }
              authModule = require('../store/slices/authSlice');
            } else {
              storeModule = await import('../store/store');
              authModule = await import('../store/slices/authSlice');
            }

            const reduxStore = storeModule.default || storeModule.store;
            const logoutAction = authModule.logout;
            if (reduxStore && typeof logoutAction === 'function') {
              reduxStore.dispatch(logoutAction());
            }
          } catch (dispatchError) {
            console.warn('Failed to dispatch logout on 401:', dispatchError);
          }

          if (window.location.pathname !== '/login') {
            toast.error('Session expired. Please login again.');
            window.location.href = '/login?session=expired';
          }
          break;

        case 403:
          // Forbidden
          toast.error(data?.message || 'Access denied');
          break;

        case 404:
          // Avoid global toast spam for API 404s; route-level 404 UI handles navigation misses.
          console.warn(data?.message || 'Resource not found');
          break;

        case 422:
          // Validation errors
          if (data?.errors && Array.isArray(data.errors)) {
            data.errors.forEach(err => {
              toast.error(`${err.field}: ${err.message}`);
            });
          } else {
            toast.error(data?.message || 'Validation failed');
          }
          break;

        case 429:
          // Rate limit exceeded
          toast.error('Too many requests. Please try again later.');
          break;

        case 500:
          // Server error
          toast.error('Server error. Please try again later.', { id: 'err_500' });
          break;

        default:
          // Generic error
          toast.error(data?.message || 'An error occurred', { id: data?.message || 'err_generic' });
      }
    } else if (error.code === 'ECONNABORTED') {
      // Timeout - silent for EcoBot, logged only
      console.warn('Request timeout:', error);
    } else if (error.message === 'Network Error') {
      // Network error - silent for EcoBot, logged only
      console.warn('Network error:', error);
    } else {
      // Unknown error - silent for EcoBot, logged only
      console.warn('Unexpected error:', error);
    }

    return Promise.reject(error);
  }
);

// API endpoints
export const authAPI = {
  register: (userData) => api.post('/v1/auth/register', userData),
  login: (credentials) => api.post('/v1/auth/login', credentials),
  logout: () => api.post('/v1/auth/logout'),
  getMe: () => api.get('/v1/auth/me'),
  updateProfile: (profileData) => api.put('/v1/auth/profile', profileData),
  updatePassword: (passwordData) => api.put('/v1/auth/password', passwordData),
  forgotPassword: (email) => api.post('/v1/auth/forgot-password', { email }),
  resetPassword: (token, password) => api.put(`/v1/auth/reset-password/${token}`, { password }),
  deleteAccount: (password) => api.delete('/v1/auth/account', { data: { password } }),
};

export const topicsAPI = {
  getTopics: (params) => api.get('/v1/topics', { params }),
  getTopic: (id) => api.get(`/v1/topics/${id}`),
  createTopic: (topicData) => api.post('/v1/topics', topicData),
  updateTopic: (id, topicData) => api.put(`/v1/topics/${id}`, topicData),
  deleteTopic: (id) => api.delete(`/v1/topics/${id}`),
  getTopicsByCategory: (category, params) => api.get(`/v1/topics/category/${category}`, { params }),
  getPopularTopics: (limit) => api.get('/v1/topics/popular', { params: { limit } }),
  searchTopics: (query, params) => api.get('/v1/topics/search', { params: { query, ...params } }),
  likeTopic: (id) => api.post(`/v1/topics/${id}/like`),
  completeTopic: (id, score) => api.post(`/v1/topics/${id}/complete`, { score }),
};

export const gamesAPI = {
  getGames: (params) => api.get('/v1/games', { params }),
  getGame: (id) => api.get(`/v1/games/${id}`),
  createGame: (gameData) => api.post('/v1/games', gameData),
  updateGame: (id, gameData) => api.put(`/v1/games/${id}`, gameData),
  deleteGame: (id) => api.delete(`/v1/games/${id}`),
  getGamesByCategory: (category, params) => api.get(`/v1/games/category/${category}`, { params }),
  getPopularGames: (limit) => api.get('/v1/games/popular', { params: { limit } }),
  submitGameScore: (id, scoreData) => api.post(`/v1/games/${id}/score`, scoreData),
  getGameLeaderboard: (id, params) => api.get(`/v1/games/${id}/leaderboard`, { params }),
  rateGame: (id, rating) => api.post(`/v1/games/${id}/rate`, { rating }),
};

export const experimentsAPI = {
  getExperiments: (params) => api.get('/v1/experiments', { params }),
  getExperiment: (id) => api.get(`/v1/experiments/${id}`),
  createExperiment: (experimentData) => api.post('/v1/experiments', experimentData),
  updateExperiment: (id, experimentData) => api.put(`/v1/experiments/${id}`, experimentData),
  deleteExperiment: (id) => api.delete(`/v1/experiments/${id}`),
  getExperimentsByCategory: (category, params) => api.get(`/v1/experiments/category/${category}`, { params }),
  getPopularExperiments: (limit) => api.get('/v1/experiments/popular', { params: { limit } }),
  submitExperimentResult: (id, resultData) => api.post(`/v1/experiments/${id}/submit`, resultData),
  getExperimentSubmissions: (id, params) => api.get(`/v1/experiments/${id}/submissions`, { params }),
  rateExperiment: (id, rating) => api.post(`/v1/experiments/${id}/rate`, { rating }),
};

export const quizzesAPI = {
  getQuizzes: (params) => api.get('/v1/quizzes', { params }),
  getQuiz: (id) => api.get(`/v1/quizzes/${id}`),
  createQuiz: (quizData) => api.post('/v1/quizzes', quizData),
  updateQuiz: (id, quizData) => api.put(`/v1/quizzes/${id}`, quizData),
  deleteQuiz: (id) => api.delete(`/v1/quizzes/${id}`),
  getQuizzesByTopic: (topicId, params) => api.get(`/v1/quizzes/topic/${topicId}`, { params }),
  startQuizAttempt: (id) => api.post(`/v1/quizzes/${id}/start`),
  submitQuizAnswer: (id, answerData) => api.post(`/v1/quizzes/${id}/answer`, answerData),
  completeQuizAttempt: (id, completionData) => api.post(`/v1/quizzes/${id}/complete`, completionData),
  getQuizResults: (id, params) => api.get(`/v1/quizzes/${id}/results`, { params }),
  getQuizAnalytics: (id) => api.get(`/v1/quizzes/${id}/analytics`),
};

export const progressAPI = {
  getUserProgress: () => api.get('/v1/progress'),
  updateProgress: (progressData) => api.put('/v1/progress', progressData),
  getProgressAnalytics: () => api.get('/v1/progress/analytics'),
  getStreakInfo: () => api.get('/v1/progress/streak'),
  updateStreak: () => api.put('/v1/progress/streak'),
  getAchievements: () => api.get('/v1/progress/achievements'),
  awardBadge: (userId, badgeData) => api.post(`/v1/progress/badge/${userId}`, badgeData),
};

export const habitsAPI = {
  logHabit: (habitData) => api.post('/v1/habits/log', habitData),
  getMyHabits: () => api.get('/v1/habits/me'),
  getMyStreak: () => api.get('/v1/habits/streak')
};

export const activityAPI = {
  submitActivity: (activityData) => {
    const { idempotencyKey, ...data } = activityData;
    return api.post('/v1/activity/submit', data, {
      headers: idempotencyKey ? { 'Idempotency-Key': idempotencyKey } : {}
    });
  },
  getMySubmissions: () => api.get('/v1/activity/my'),
  getPendingSubmissions: () => api.get('/v1/activity/pending'),
  verifyActivity: (submissionId, verifyData) => api.put(`/v1/activity/${submissionId}/verify`, verifyData)
};

export const usersAPI = {
  getUsers: (params) => api.get('/v1/users', { params }),
  getUser: (id) => api.get(`/v1/users/${id}`),
  updateUser: (id, userData) => api.put(`/v1/users/${id}`, userData),
  deleteUser: (id) => api.delete(`/v1/users/${id}`),
  getUserProgress: () => api.get('/v1/users/progress'),
  getUserAchievements: () => api.get('/v1/users/achievements'),
  getLeaderboard: (params) => api.get('/v1/users/leaderboard', { params }),
  updateUserRole: (id, role) => api.put(`/v1/users/${id}/role`, { role }),
};

export const adminAPI = {
  getDashboardStats: () => api.get('/v1/admin/dashboard'),
  getContentManagement: (params) => api.get('/v1/admin/content', { params }),
  getUserManagement: (params) => api.get('/v1/admin/users', { params }),
  getAnalytics: (params) => api.get('/v1/admin/analytics', { params }),
  getSystemHealth: () => api.get('/v1/admin/system-health'),
  moderateContent: (type, id, action) => api.put(`/v1/admin/content/${type}/${id}/moderate`, { action }),
  bulkOperations: (operations) => api.post('/v1/admin/content/bulk', { operations }),
};

export const uploadAPI = {
  uploadImage: (formData) => api.post('/v1/upload/image', formData, {
    headers: { 'Content-Type': 'multipart/form-data' }
  }),
  uploadVideo: (formData) => api.post('/v1/upload/video', formData, {
    headers: { 'Content-Type': 'multipart/form-data' }
  }),
  uploadDocument: (formData) => api.post('/v1/upload/document', formData, {
    headers: { 'Content-Type': 'multipart/form-data' }
  }),
  uploadMultiple: (formData) => api.post('/v1/upload/multiple', formData, {
    headers: { 'Content-Type': 'multipart/form-data' }
  }),
  getUploadedFiles: (params) => api.get('/v1/upload/files', { params }),
  deleteFile: (publicId) => api.delete(`/v1/upload/files/${publicId}`),
};

export const storeAPI = {
  getItems: () => api.get('/v1/store/items'),
  redeemItem: (payload) => api.post('/v1/store/redeem', payload),
  getMyRedemptions: () => api.get('/v1/store/redemptions/me'),
  updateRedemptionStatus: (id, payload) => api.patch(`/v1/store/redemptions/${id}/status`, payload)
};

export const feedAPI = {
  getSchoolFeed: (cursor, limit = 10) => {
    const params = { limit };
    if (cursor) params.cursor = cursor;
    return api.get('/v1/feed/school', { params });
  },
  createPost: (payload) => api.post('/v1/feed/school', payload),
  getPost: (postId) => api.get(`/v1/feed/${postId}`),
  toggleReaction: (postId, payload) => api.post(`/v1/feed/${postId}/react`, payload),
  addComment: (postId, payload) => api.post(`/v1/feed/${postId}/comment`, payload)
};

export const challengesAPI = {
  getAllChallenges: (params) => api.get('/v1/challenges/school-challenges', { params }),
  getChallengeById: (id) => api.get(`/v1/challenges/school-challenges/${id}`),
  getActiveChallenges: () => api.get('/v1/challenges/school-challenges/active'),
  getSchoolChallenges: (schoolId) => api.get(`/v1/challenges/school-challenges/school/${schoolId}`),
  createChallenge: (payload) => api.post('/v1/challenges/school-challenges', payload),
  updateChallengeStatus: (id, payload) => api.patch(`/v1/challenges/school-challenges/${id}/status`, payload),
  updateChallengeScores: (id) => api.post(`/v1/challenges/school-challenges/${id}/update-scores`),
  finalizeChallenge: (id) => api.post(`/v1/challenges/school-challenges/${id}/finalize`),
  deleteChallenge: (id) => api.delete(`/v1/challenges/school-challenges/${id}`)
};

// Generic API request function
export const apiRequest = async (...args) => {
  let method = 'get';
  let url = '';
  let data = undefined;
  let config = {};

  // Case 1: apiRequest(method, url, data, config) -> Explicit axios style
  if (args.length >= 2 && typeof args[0] === 'string' && ['get', 'post', 'put', 'patch', 'delete'].includes(args[0].toLowerCase())) {
    method = args[0].toLowerCase();
    url = args[1];
    data = args.length > 2 ? args[2] : undefined;
    config = args[3] || {};
  }
  // Case 2: apiRequest(url, fetchOptions) -> Fetch style or Axios config style
  else if (args.length > 0 && typeof args[0] === 'string') {
    url = args[0];
    if (args[1] && typeof args[1] === 'object') {
      const options = args[1];
      method = (options.method || 'get').toLowerCase();

      // Handle both fetch-style (body) and axios-style (data) payloads
      if (options.body) {
        try {
          data = typeof options.body === 'string' ? JSON.parse(options.body) : options.body;
        } catch (e) {
          data = options.body;
        }
      } else if (options.data !== undefined) {
        data = options.data;
      }

      // Collect the remaining options as config
      config = { ...options };
      delete config.method;
      delete config.body;
      delete config.data;
    }
  }

  try {
    const response = await api({
      method,
      url,
      data,
      ...config,
    });
    return response.data;
  } catch (error) {
    throw error;
  }
};

export { apiClient };
export default apiClient;