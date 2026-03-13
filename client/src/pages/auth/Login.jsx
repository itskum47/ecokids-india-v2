import React, { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { motion, AnimatePresence } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { FaEnvelope, FaLock, FaEye, FaEyeSlash, FaMobileAlt } from 'react-icons/fa';
import axios from 'axios';
import { login } from '../../store/slices/authSlice';

const Login = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const dispatch = useDispatch();
  const { t } = useTranslation();
  const { isLoading, error } = useSelector(state => state.auth);

  const [activeTab, setActiveTab] = useState('email');
  const [formData, setFormData] = useState({ email: '', password: '' });
  const [phoneData, setPhoneData] = useState({ phone: '', otp: '' });
  const [qrToken, setQrToken] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [otpLoading, setOtpLoading] = useState(false);
  const [otpError, setOtpError] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [sessionExpired, setSessionExpired] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    setSessionExpired(params.get('session') === 'expired');
  }, [location.search]);

  const destinationForRole = (role) => {
    if (role === 'teacher') return '/teacher/dashboard';
    if (role === 'school_admin') return '/school-admin/dashboard';
    if (role === 'district_admin') return '/district-admin/dashboard';
    if (role === 'state_admin') return '/state-admin/dashboard';
    if (role === 'admin') return '/admin';
    return '/student-dashboard';
  };

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const result = await dispatch(login(formData));
    if (result.type === 'auth/login/fulfilled') {
      navigate(destinationForRole(result.payload?.user?.role));
    }
  };

  const sendOtp = async () => {
    if (!phoneData.phone) return;
    setOtpLoading(true);
    setOtpError('');
    try {
      await axios.post('/api/v1/auth/send-otp', { phone: phoneData.phone });
      setOtpSent(true);
    } catch (err) {
      setOtpError(err?.response?.data?.message || 'Could not send OTP. Please check your phone number and try again.');
    } finally {
      setOtpLoading(false);
    }
  };

  const verifyOtp = async () => {
    if (!phoneData.phone || !phoneData.otp) return;
    setOtpLoading(true);
    setOtpError('');
    try {
      const response = await axios.post('/api/v1/auth/verify-otp', {
        phone: phoneData.phone,
        otp: phoneData.otp
      });

      const role = response.data?.user?.role || 'student';
      if (response.data?.token) {
        localStorage.setItem('token', response.data.token);
      }
      navigate(destinationForRole(role));
    } catch (err) {
      setOtpError(err?.response?.data?.message || 'Invalid OTP');
    } finally {
      setOtpLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-12" style={{ background: 'linear-gradient(135deg, #f0fdf4 0%, #e8f5e9 50%, #f1f8e9 100%)' }}>

      {/* Decorative blobs */}
      <div className="absolute top-0 left-0 w-72 h-72 rounded-full opacity-30 pointer-events-none" style={{ background: 'radial-gradient(circle, #a5d6a7, transparent 70%)', transform: 'translate(-30%, -30%)' }} />
      <div className="absolute bottom-0 right-0 w-96 h-96 rounded-full opacity-20 pointer-events-none" style={{ background: 'radial-gradient(circle, #c8e6c9, transparent 70%)', transform: 'translate(30%, 30%)' }} />

      <motion.div
        initial={{ opacity: 0, y: 24, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.45, ease: 'easeOut' }}
        className="w-full max-w-md relative z-10"
      >
        {/* Card */}
        <div className="bg-white rounded-3xl shadow-xl border border-green-100 p-8 sm:p-10">

          {/* Logo + Title */}
          <div className="text-center mb-8">
            <motion.div
              initial={{ scale: 0, rotate: -20 }}
              animate={{ scale: 1, rotate: 0 }}
              transition={{ type: 'spring', stiffness: 260, damping: 18, delay: 0.1 }}
              className="w-16 h-16 mx-auto rounded-2xl flex items-center justify-center mb-4 shadow-md"
              style={{ background: 'linear-gradient(135deg, #2e7d32, #43a047)' }}
            >
              <span className="text-3xl">🌿</span>
            </motion.div>
            <h1 className="text-3xl font-black text-gray-900 mb-1" style={{ fontFamily: "'Nunito', sans-serif" }}>
              {t('auth.login_title') || 'Welcome Back! 🌿'}
            </h1>
            <p className="text-sm text-gray-500">
              {t('auth.login_subtitle') || 'Log in to continue your eco journey'}
            </p>
          </div>

          {/* Error Banner */}
          <AnimatePresence>
            {sessionExpired && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="mb-6 px-4 py-3 rounded-xl text-sm flex items-center gap-2 text-amber-800"
                style={{ background: '#fffbeb', border: '1px solid #fcd34d' }}
              >
                <span>⏰</span>
                <span>Your session expired. Please log in again.</span>
              </motion.div>
            )}
          </AnimatePresence>

          <AnimatePresence>
            {error && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="mb-6 px-4 py-3 rounded-xl text-sm flex items-center gap-2 text-red-700"
                style={{ background: '#fef2f2', border: '1px solid #fecaca' }}
              >
                <span>⚠️</span>
                <span>{t('errors.loginFailed') || 'Login failed. Please check your email and password.'}</span>
              </motion.div>
            )}
          </AnimatePresence>

          <div className="mb-5 rounded-xl border border-green-100 p-1 bg-green-50/60 grid grid-cols-3 gap-1">
            <button
              type="button"
              onClick={() => setActiveTab('email')}
              className={`py-2 rounded-lg text-sm font-bold transition ${activeTab === 'email' ? 'bg-white text-green-700 shadow-sm' : 'text-gray-500'}`}
            >
              <span className="inline-flex items-center gap-2"><FaEnvelope /> Login with Email</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('phone')}
              className={`py-2 rounded-lg text-sm font-bold transition ${activeTab === 'phone' ? 'bg-white text-green-700 shadow-sm' : 'text-gray-500'}`}
            >
              <span className="inline-flex items-center gap-2"><FaMobileAlt /> Login with Phone</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('qr')}
              className={`py-2 rounded-lg text-sm font-bold transition ${activeTab === 'qr' ? 'bg-white text-green-700 shadow-sm' : 'text-gray-500'}`}
            >
              <span className="inline-flex items-center gap-2">📷 Scan QR</span>
            </button>
          </div>

          {/* Form */}
          {activeTab === 'email' ? (
          <form onSubmit={handleSubmit} className="space-y-5">

            {/* Email */}
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-1.5">
                {t('auth.email') || 'Email Address'}
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-gray-400">
                  <FaEnvelope size={15} />
                </div>
                <input
                  type="email"
                  name="email"
                  value={formData.email}
                  onChange={handleChange}
                  placeholder={t('auth.emailPlaceholder') || 'you@example.com'}
                  required
                  className="w-full pl-11 pr-4 py-3 rounded-xl border-2 border-gray-200 text-gray-800 text-sm font-medium placeholder-gray-400 transition-all outline-none focus:border-green-400 focus:ring-2 focus:ring-green-100"
                />
              </div>
            </div>

            {/* Password */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-sm font-bold text-gray-700">
                  {t('auth.password') || 'Password'}
                </label>
                <Link
                  to="/forgot-password"
                  className="text-xs font-semibold text-green-600 hover:text-green-800 transition-colors"
                >
                  {t('auth.forgotPassword') || 'Forgot password?'}
                </Link>
              </div>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-gray-400">
                  <FaLock size={14} />
                </div>
                <input
                  type={showPassword ? 'text' : 'password'}
                  name="password"
                  value={formData.password}
                  onChange={handleChange}
                  placeholder="••••••••"
                  required
                  className="w-full pl-11 pr-12 py-3 rounded-xl border-2 border-gray-200 text-gray-800 text-sm font-medium placeholder-gray-400 transition-all outline-none focus:border-green-400 focus:ring-2 focus:ring-green-100"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  tabIndex={-1}
                  className="absolute inset-y-0 right-0 pr-4 flex items-center text-gray-400 hover:text-gray-700 transition-colors"
                >
                  {showPassword ? <FaEyeSlash size={16} /> : <FaEye size={16} />}
                </button>
              </div>
            </div>

            {/* Submit Button */}
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.97 }}
              type="submit"
              disabled={isLoading}
              className="w-full py-3.5 rounded-xl font-black text-white text-base shadow-md hover:shadow-lg transition-all disabled:opacity-60 disabled:cursor-not-allowed mt-2"
              style={{ background: isLoading ? '#81c784' : 'linear-gradient(135deg, #2e7d32, #43a047)' }}
            >
              {isLoading ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  {t('loading.default') || 'Logging in...'}
                </span>
              ) : (
                t('auth.loginBtn') || 'Log In'
              )}
            </motion.button>
          </form>
          ) : activeTab === 'phone' ? (
            <div className="space-y-5">
              {otpError && (
                <div className="text-red-600 text-sm bg-red-50 px-3 py-2 rounded-lg border border-red-100">
                  {otpError}
                </div>
              )}

              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1.5">Phone Number</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-gray-400">
                    <FaMobileAlt size={14} />
                  </div>
                  <input
                    type="tel"
                    value={phoneData.phone}
                    onChange={(e) => setPhoneData({ ...phoneData, phone: e.target.value })}
                    placeholder="9876543210"
                    className="w-full pl-11 pr-4 py-3 rounded-xl border-2 border-gray-200 text-gray-800 text-sm font-medium placeholder-gray-400 transition-all outline-none focus:border-green-400 focus:ring-2 focus:ring-green-100"
                  />
                </div>
              </div>

              {otpSent && (
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-1.5">OTP</label>
                  <input
                    type="text"
                    value={phoneData.otp}
                    onChange={(e) => setPhoneData({ ...phoneData, otp: e.target.value })}
                    placeholder="Enter 6-digit OTP"
                    className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 text-gray-800 text-sm font-medium placeholder-gray-400 transition-all outline-none focus:border-green-400 focus:ring-2 focus:ring-green-100"
                  />
                </div>
              )}

              {!otpSent ? (
                <button
                  type="button"
                  onClick={sendOtp}
                  disabled={otpLoading}
                  className="w-full py-3.5 rounded-xl font-black text-white text-base shadow-md hover:shadow-lg transition-all disabled:opacity-60"
                  style={{ background: otpLoading ? '#81c784' : 'linear-gradient(135deg, #2e7d32, #43a047)' }}
                >
                  {otpLoading ? 'Sending OTP...' : 'Send OTP'}
                </button>
              ) : (
                <button
                  type="button"
                  onClick={verifyOtp}
                  disabled={otpLoading}
                  className="w-full py-3.5 rounded-xl font-black text-white text-base shadow-md hover:shadow-lg transition-all disabled:opacity-60"
                  style={{ background: otpLoading ? '#81c784' : 'linear-gradient(135deg, #2e7d32, #43a047)' }}
                >
                  {otpLoading ? 'Verifying...' : 'Verify OTP'}
                </button>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              <p className="text-sm text-gray-600">
                On mobile, scan your student QR card. On desktop, paste token from a QR URL.
              </p>
              <input
                type="text"
                value={qrToken}
                onChange={(e) => setQrToken(e.target.value)}
                placeholder="Paste QR token"
                className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 text-gray-800 text-sm font-medium placeholder-gray-400 transition-all outline-none focus:border-green-400 focus:ring-2 focus:ring-green-100"
              />
              <button
                type="button"
                onClick={async () => {
                  if (!qrToken) return;
                  setOtpLoading(true);
                  try {
                    const response = await axios.get(`/api/v1/auth/qr-login?token=${encodeURIComponent(qrToken)}`);
                    const role = response.data?.user?.role || 'student';
                    navigate(destinationForRole(role));
                  } catch (err) {
                    alert(err?.response?.data?.message || 'This QR code has expired. Ask your teacher for a new one.');
                  } finally {
                    setOtpLoading(false);
                  }
                }}
                disabled={otpLoading}
                className="w-full py-3.5 rounded-xl font-black text-white text-base shadow-md hover:shadow-lg transition-all disabled:opacity-60"
                style={{ background: otpLoading ? '#81c784' : 'linear-gradient(135deg, #2e7d32, #43a047)' }}
              >
                {otpLoading ? 'Verifying...' : 'Continue with QR'}
              </button>
            </div>
          )}

          {/* Divider */}
          <div className="mt-8 pt-6 border-t border-gray-100 text-center">
            <p className="text-sm text-gray-500">
              {t('auth.noAccount') || "Don't have an account?"}{' '}
              <Link
                to="/register"
                className="font-black text-green-600 hover:text-green-800 transition-colors underline underline-offset-2 decoration-green-300 hover:decoration-green-600"
              >
                {t('auth.signupLink') || 'Sign up free'}
              </Link>
            </p>
          </div>

          {/* Trust Badges */}
          <div className="mt-5 flex items-center justify-center gap-4 flex-wrap">
            {['🔒 Secure Login', '🌱 EcoKids India', '✅ NCERT Aligned'].map(badge => (
              <span key={badge} className="text-xs text-gray-400 font-medium">{badge}</span>
            ))}
          </div>
        </div>
      </motion.div>
    </div>
  );
};

export default Login;