import React, { useState, useEffect } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { motion, AnimatePresence } from 'framer-motion';
import { FaEdit, FaSave, FaTimes, FaCamera, FaMedal, FaTrophy, FaFire, FaLeaf, FaChevronRight } from 'react-icons/fa';
import Navbar from '../components/layout/Navbar';
import { useTranslation } from 'react-i18next';
import api from '../utils/api';
import { updateProfile } from '../store/slices/authSlice';
import LevelRing from '../components/dashboard/LevelRing';

const Profile = () => {
  const dispatch = useDispatch();
  const { user, isAuthenticated } = useSelector(state => state.auth);

  const [activeTab, setActiveTab] = useState('overview');
  const [editMode, setEditMode] = useState(false);
  const [editedProfile, setEditedProfile] = useState({});
  const [loading, setLoading] = useState(true);

  const [gamification, setGamification] = useState(null);
  const [allBadges, setAllBadges] = useState([]);

  useEffect(() => {
    if (isAuthenticated && user) {
      setEditedProfile({
        firstName: user.firstName || '',
        lastName: user.lastName || '',
        email: user.email || '',
        profile: {
          grade: user.profile?.grade || '',
          school: user.profile?.school || '',
          city: user.profile?.city || '',
          state: user.profile?.state || '',
          bio: user.profile?.bio || ''
        }
      });
      fetchProfileData();
    }
  }, [isAuthenticated, user]);

  const fetchProfileData = async () => {
    try {
      setLoading(true);
      const [gamificationRes, badgesRes] = await Promise.all([
        api.get('/v1/gamification/me'),
        api.get('/v1/gamification/badges')
      ]);

      setGamification(gamificationRes.data.data);
      setAllBadges(badgesRes.data.data || []);
    } catch (error) {
      console.error('Error fetching profile data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (field, value) => {
    if (field.includes('.')) {
      const [parent, child] = field.split('.');
      setEditedProfile(prev => ({
        ...prev,
        [parent]: {
          ...prev[parent],
          [child]: value
        }
      }));
    } else {
      setEditedProfile(prev => ({ ...prev, [field]: value }));
    }
  };

  const handleSaveProfile = async () => {
    try {
      setLoading(true);
      const response = await api.put('/v1/users/profile', editedProfile);
      dispatch(updateProfile(response.data.data));
      setEditMode(false);
    } catch (error) {
      console.error('Failed to update profile', error);
    } finally {
      setLoading(false);
    }
  };

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-center eco-card p-10 max-w-sm w-full mx-4">
          <div className="text-6xl mb-4">🔒</div>
          <h2 className="text-2xl font-display text-[var(--t1)] mb-4">Access Denied</h2>
          <p className="text-[var(--t2)] font-ui">Please log in to view your profile.</p>
        </div>
      </div>
    );
  }

  const ecoPoints = gamification?.ecoPoints ?? user?.gamification?.ecoPoints ?? 0;
  const level = gamification?.level ?? user?.gamification?.level ?? 1;
  const streak = user?.gamification?.streak?.current ?? 0;

  const earnedBadges = gamification?.badges || [];
  const earnedBadgeIds = new Set(earnedBadges.map(b => b.badgeId));

  // Generate mock heatmap data for Github-style contribution graph
  const generateHeatmap = () => {
    const days = 7;
    const weeks = 12;
    const matrix = [];
    for (let w = 0; w < weeks; w++) {
      const col = [];
      for (let d = 0; d < days; d++) {
        // Random intensity 0-4
        col.push(Math.floor(Math.random() * 5));
      }
      matrix.push(col);
    }
    return matrix;
  };

  const heatmapData = generateHeatmap();

  return (
    <div className="min-h-screen bg-white pb-24 md:pb-10 overflow-x-hidden relative">
      <Navbar />

      {/* Decorative Orbs */}
      <div className="absolute top-0 left-0 w-[500px] h-[500px] rounded-full bg-[var(--c1)] blur-[120px] opacity-[0.05] pointer-events-none -translate-x-1/2 -translate-y-1/2" />
      <div className="absolute top-40 right-0 w-[600px] h-[600px] rounded-full bg-[var(--v1)] blur-[150px] opacity-[0.05] pointer-events-none translate-x-1/3" />

      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-8 md:py-12 relative z-10">

        {/* Profile Header Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 md:gap-8 mb-8">

          {/* Identity Card */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="lg:col-span-8 eco-card p-6 md:p-10 relative overflow-hidden"
            style={{
              background: 'linear-gradient(135deg, var(--s2) 0%, var(--s1) 100%)',
              borderColor: 'var(--b2)',
              boxShadow: 'var(--shadow-glow-v), inset 0 0 40px rgba(108,71,255,0.05)'
            }}
          >
            <div className="absolute top-0 right-0 w-[300px] h-[300px] bg-gradient-to-bl from-[var(--v1)] to-transparent opacity-10 blur-[80px]" />

            <div className="flex flex-col md:flex-row gap-8 items-center md:items-start relative z-10">

              {/* Avatar Container */}
              <div className="relative group shrink-0">
                <div className="w-32 h-32 md:w-40 md:h-40 rounded-3xl bg-gradient-to-tr from-[var(--v1)] to-[var(--p1)] p-1 shadow-[0_0_30px_rgba(108,71,255,0.3)]">
                  <div className="w-full h-full rounded-[22px] bg-[var(--s1)] flex items-center justify-center text-4xl md:text-5xl font-display font-bold text-[var(--t1)] overflow-hidden">
                    {user?.profile?.avatar ? (
                      <img src={user.profile.avatar} alt="Avatar" className="w-full h-full object-cover" />
                    ) : (
                      `${user.firstName?.[0] || ''}${user.lastName?.[0] || ''}`
                    )}
                  </div>
                </div>
                <button className="absolute -bottom-3 -right-3 w-10 h-10 bg-[var(--s2)] border border-[var(--v1)] rounded-full flex items-center justify-center text-[var(--v1)] hover:bg-[var(--v1)] hover:text-white transition-colors shadow-lg z-20">
                  <FaCamera size={14} />
                </button>
              </div>

              {/* User Details */}
              <div className="flex-1 text-center md:text-left w-full">
                {editMode ? (
                  <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2">
                    <div className="grid grid-cols-2 gap-4">
                      <input type="text" value={editedProfile.firstName} onChange={(e) => handleInputChange('firstName', e.target.value)} placeholder="First Name" className="w-full bg-[var(--s1)] border border-[var(--b2)] rounded-xl px-4 py-3 text-[var(--t1)] font-ui focus:border-[var(--v1)] outline-none" />
                      <input type="text" value={editedProfile.lastName} onChange={(e) => handleInputChange('lastName', e.target.value)} placeholder="Last Name" className="w-full bg-[var(--s1)] border border-[var(--b2)] rounded-xl px-4 py-3 text-[var(--t1)] font-ui focus:border-[var(--v1)] outline-none" />
                    </div>
                    <input type="email" value={editedProfile.email} onChange={(e) => handleInputChange('email', e.target.value)} placeholder="Email" className="w-full bg-[var(--s1)] border border-[var(--b2)] rounded-xl px-4 py-3 text-[var(--t1)] font-ui focus:border-[var(--v1)] outline-none" disabled />
                    <div className="grid grid-cols-2 gap-4">
                      <input type="text" value={editedProfile.profile.school} onChange={(e) => handleInputChange('profile.school', e.target.value)} placeholder="School" className="w-full bg-[var(--s1)] border border-[var(--b2)] rounded-xl px-4 py-3 text-[var(--t1)] font-ui focus:border-[var(--v1)] outline-none" />
                      <input type="text" value={editedProfile.profile.grade} onChange={(e) => handleInputChange('profile.grade', e.target.value)} placeholder="Grade" className="w-full bg-[var(--s1)] border border-[var(--b2)] rounded-xl px-4 py-3 text-[var(--t1)] font-ui focus:border-[var(--v1)] outline-none" />
                    </div>
                    <textarea value={editedProfile.profile.bio} onChange={(e) => handleInputChange('profile.bio', e.target.value)} placeholder="Bio: Tell the world your eco mission!" rows={2} className="w-full bg-[var(--s1)] border border-[var(--b2)] rounded-xl px-4 py-3 text-[var(--t1)] font-ui focus:border-[var(--v1)] outline-none resize-none" />
                    <div className="flex gap-3 justify-center md:justify-start pt-2">
                      <button onClick={handleSaveProfile} disabled={loading} className="btn-primary py-2 px-6">
                        <FaSave className="mr-2" /> Save
                      </button>
                      <button onClick={() => setEditMode(false)} className="btn-ghost py-2 px-6">
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="animate-in fade-in flex flex-col items-center md:items-start h-full justify-center">
                    <div className="flex items-center gap-3 mb-2">
                      <h1 className="text-4xl md:text-5xl font-display tracking-tight text-[var(--t1)]">
                        {user.firstName} {user.lastName}
                      </h1>
                      <button onClick={() => setEditMode(true)} className="w-8 h-8 rounded-full bg-[var(--s2)] border border-[var(--b2)] flex items-center justify-center text-[var(--t3)] hover:text-[var(--v1)] hover:border-[var(--v1)] transition-colors">
                        <FaEdit size={12} />
                      </button>
                    </div>

                    <div className="font-mono text-xs text-[var(--t2)] mb-4">{user.email}</div>

                    {user.profile?.bio && (
                      <p className="text-sm font-ui text-[var(--t2)] mb-5 max-w-lg leading-relaxed border-l-2 border-[var(--v1)] pl-4">
                        "{user.profile.bio}"
                      </p>
                    )}

                    <div className="flex flex-wrap items-center justify-center md:justify-start gap-2 mt-auto">
                      {user.profile?.school && (
                        <span className="px-3 py-1.5 rounded-md bg-[rgba(108,71,255,0.1)] border border-[rgba(108,71,255,0.2)] text-[var(--v2)] font-ui font-bold text-[10px] uppercase tracking-wider flex items-center gap-1.5">
                          📚 {user.profile.school}
                        </span>
                      )}
                      {user.profile?.grade && (
                        <span className="px-3 py-1.5 rounded-md bg-[var(--s2)] border border-[var(--b2)] text-[var(--t2)] font-ui font-bold text-[10px] uppercase tracking-wider">
                          Grade {user.profile.grade}
                        </span>
                      )}
                      {user.profile?.city && (
                        <span className="px-3 py-1.5 rounded-md bg-[var(--s2)] border border-[var(--b2)] text-[var(--t2)] font-ui font-bold text-[10px] uppercase tracking-wider">
                          📍 {user.profile.city}
                        </span>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </motion.div>

          {/* Quick Stats Panel */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="lg:col-span-4 eco-card p-6 md:p-8 flex flex-col justify-between relative overflow-hidden"
          >
            <div className="absolute -top-10 -right-10 w-40 h-40 bg-[var(--amber)] blur-[80px] opacity-10" />

            <h3 className="font-ui font-bold text-[10px] uppercase tracking-widest text-[var(--t3)] mb-6 text-center lg:text-left">Hero Stats</h3>

            <div className="grid grid-cols-2 gap-4 flex-1">
              <div className="flex flex-col items-center justify-center p-4 bg-[var(--s1)] border border-[var(--b1)] rounded-2xl relative overflow-hidden group">
                <div className="text-[var(--amber)] text-xl mb-1 group-hover:scale-125 transition-transform"><FaMedal /></div>
                <div className="font-mono text-2xl font-bold text-[var(--t1)]">{ecoPoints}</div>
                <div className="font-ui text-[9px] uppercase tracking-widest text-[var(--t3)]">EcoPoints</div>
              </div>
              <div className="flex flex-col items-center justify-center p-4 bg-[var(--s1)] border border-[var(--b1)] rounded-2xl relative overflow-hidden group">
                <div className="text-[var(--v1)] text-xl mb-1 group-hover:scale-125 transition-transform"><FaLeaf /></div>
                <div className="font-mono text-2xl font-bold text-[var(--t1)]">{level}</div>
                <div className="font-ui text-[9px] uppercase tracking-widest text-[var(--t3)]">Level</div>
              </div>
              <div className="flex flex-col items-center justify-center p-4 bg-[var(--s1)] border border-[var(--b1)] rounded-2xl relative overflow-hidden group">
                <div className="text-[var(--orange)] text-xl mb-1 group-hover:scale-125 transition-transform"><FaFire /></div>
                <div className="font-mono text-2xl font-bold text-[var(--t1)]">{streak}</div>
                <div className="font-ui text-[9px] uppercase tracking-widest text-[var(--t3)]">Day Streak</div>
              </div>
              <div className="flex flex-col items-center justify-center p-4 bg-[var(--s1)] border border-[var(--b1)] rounded-2xl relative overflow-hidden group">
                <div className="text-[var(--g1)] text-xl mb-1 group-hover:scale-125 transition-transform"><FaTrophy /></div>
                <div className="font-mono text-2xl font-bold text-[var(--t1)]">{earnedBadges.length}</div>
                <div className="font-ui text-[9px] uppercase tracking-widest text-[var(--t3)]">Badges</div>
              </div>
            </div>
          </motion.div>
        </div>

        {/* Gamification Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 md:gap-8">

          {/* Main Content Area (Heatmap & Badges) */}
          <div className="lg:col-span-8 flex flex-col gap-6 md:gap-8">

            {/* Github Style Activity Heatmap */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="eco-card p-6 md:p-8"
            >
              <div className="flex items-center justify-between mb-6">
                <h3 className="font-ui font-bold text-sm tracking-widest uppercase text-[var(--t1)]">Activity Graph</h3>
                <span className="font-mono text-xs text-[var(--g1)] bg-[rgba(0,255,136,0.1)] px-2 py-1 rounded border border-[rgba(0,255,136,0.2)]">
                  74 Contributions this year
                </span>
              </div>

              <div className="overflow-x-auto pb-4">
                <div className="flex gap-2 min-w-max">
                  {heatmapData.map((week, w) => (
                    <div key={w} className="flex flex-col gap-2">
                      {week.map((intensity, d) => {
                        let bgClass = "bg-[var(--s2)] border-[var(--b2)]"; // 0
                        if (intensity === 1) bgClass = "bg-[rgba(0,255,136,0.2)] border-[rgba(0,255,136,0.3)]";
                        if (intensity === 2) bgClass = "bg-[rgba(0,255,136,0.4)] border-[rgba(0,255,136,0.5)]";
                        if (intensity === 3) bgClass = "bg-[rgba(0,255,136,0.7)] border-[rgba(0,255,136,0.8)]";
                        if (intensity === 4) bgClass = "bg-[var(--g1)] border-[var(--g2)] shadow-[0_0_10px_rgba(0,255,136,0.5)]";

                        return (
                          <div
                            key={d}
                            className={`w-4 h-4 rounded-sm border ${bgClass} transition-colors hover:border-white cursor-pointer`}
                            title={`${intensity} contributions`}
                          />
                        );
                      })}
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 mt-4 text-[10px] font-ui text-[var(--t3)] uppercase tracking-wider">
                <span>Less</span>
                <div className="w-3 h-3 rounded-sm bg-[var(--s2)] border border-[var(--b2)]"></div>
                <div className="w-3 h-3 rounded-sm bg-[rgba(0,255,136,0.2)] border border-[rgba(0,255,136,0.3)]"></div>
                <div className="w-3 h-3 rounded-sm bg-[rgba(0,255,136,0.5)] border border-[rgba(0,255,136,0.6)]"></div>
                <div className="w-3 h-3 rounded-sm bg-[var(--g1)] border border-[var(--g2)]"></div>
                <span>More</span>
              </div>
            </motion.div>

            {/* Neon Badge Showcase */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="eco-card p-6 md:p-8"
            >
              <div className="flex items-center justify-between mb-8">
                <div>
                  <h3 className="font-ui font-bold text-sm tracking-widest uppercase text-[var(--t1)] mb-1">Badge Case</h3>
                  <p className="text-xs font-ui text-[var(--t2)]">{earnedBadges.length} of {allBadges.length || 20} Unlocked</p>
                </div>
                <div className="w-10 h-10 rounded-full bg-[var(--s1)] border border-[var(--b1)] flex items-center justify-center text-[var(--t3)] hover:text-[var(--t1)] hover:border-[var(--v1)] cursor-pointer transition-colors">
                  <FaChevronRight size={12} />
                </div>
              </div>

              {loading ? (
                <div className="flex justify-center p-10"><div className="w-8 h-8 rounded-full border-4 border-[var(--s2)] border-t-[var(--v1)] animate-spin"></div></div>
              ) : allBadges.length === 0 ? (
                <div className="text-center p-10 bg-[var(--s1)] rounded-2xl border border-[var(--b1)] border-dashed text-[var(--t2)] text-sm font-ui border-white/5">
                  Complete missions to earn your first badge!
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                  {allBadges.slice(0, 8).map((badge, index) => {
                    const isEarned = earnedBadgeIds.has(badge._id);

                    // Style determination based on rarity
                    let badgeColor = 'var(--t3)'; // locked
                    let badgeBg = 'var(--s2)';
                    let glow = 'none';

                    if (isEarned) {
                      if (badge.rarity === 'common') { badgeColor = 'var(--t1)'; badgeBg = 'rgba(255,255,255,0.05)'; glow = '0 0 15px rgba(255,255,255,0.1)'; }
                      if (badge.rarity === 'rare') { badgeColor = 'var(--c1)'; badgeBg = 'rgba(0,229,255,0.1)'; glow = '0 0 20px rgba(0,229,255,0.3)'; }
                      if (badge.rarity === 'epic') { badgeColor = 'var(--v1)'; badgeBg = 'rgba(108,71,255,0.1)'; glow = '0 0 25px rgba(108,71,255,0.4)'; }
                      if (badge.rarity === 'legendary') { badgeColor = 'var(--amber)'; badgeBg = 'rgba(255,204,0,0.1)'; glow = '0 0 30px rgba(255,204,0,0.5)'; }
                    }

                    return (
                      <div
                        key={badge._id}
                        className={`group relative flex flex-col items-center justify-center p-6 rounded-2xl border transition-all duration-300 ${isEarned ? 'cursor-pointer hover:-translate-y-2' : 'opacity-40 grayscale blur-[1px]'}`}
                        style={{
                          backgroundColor: badgeBg,
                          borderColor: isEarned ? badgeColor : 'var(--b1)',
                          boxShadow: glow
                        }}
                      >
                        <div className="text-4xl mb-3" style={{ opacity: isEarned ? 1 : 0.5 }}>{badge.icon || '🏆'}</div>
                        <h4 className="font-ui font-bold text-xs uppercase text-center tracking-wider mb-1" style={{ color: isEarned ? badgeColor : 'var(--t2)' }}>
                          {badge.name}
                        </h4>

                        {isEarned && (
                          <div className="absolute inset-0 rounded-2xl border border-white opacity-0 group-hover:opacity-20 pointer-events-none transition-opacity"></div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </motion.div>

          </div>

          {/* Right Column (Level Arc & Info) */}
          <div className="lg:col-span-4 flex flex-col gap-6 md:gap-8">
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.4 }}
              className="eco-card p-6 flex flex-col items-center text-center sticky top-24"
            >
              <h2 className="text-[var(--t1)] font-ui font-bold text-lg mb-6">Level Progression</h2>

              <LevelRing
                level={level}
                currentXP={ecoPoints}
                nextLevelXP={level * 100}
                levelName={
                  level >= 7 ? 'Eco Champion' :
                    level >= 5 ? 'Planet Protector' :
                      level >= 3 ? 'Green Guardian' :
                        'Eco Explorer'
                }
              />

              <div className="mt-8 w-full border-t border-[var(--b1)] pt-6">
                <h3 className="text-[var(--t2)] font-ui font-bold text-xs tracking-wider uppercase mb-4 text-left">Level Perks</h3>

                <div className="space-y-3 text-left">
                  <div className="flex items-start gap-3 p-3 rounded-lg bg-[var(--s2)] border border-[var(--b2)]">
                    <div className="text-[var(--v1)] mt-0.5"><FaMedal /></div>
                    <div>
                      <div className="font-ui font-bold text-xs text-[var(--t1)] uppercase tracking-wider mb-0.5">Title Unlocked</div>
                      <div className="text-[10px] text-[var(--t2)] font-ui">You now have the exclusive "Green Guardian" title globally.</div>
                    </div>
                  </div>
                  <div className="flex items-start gap-3 p-3 rounded-lg bg-[var(--s2)] border border-[var(--b2)] opacity-50">
                    <div className="text-[var(--t3)] mt-0.5">🔒</div>
                    <div>
                      <div className="font-ui font-bold text-xs text-[var(--t3)] uppercase tracking-wider mb-0.5">Next Tier: Planet Protector</div>
                      <div className="text-[10px] text-[var(--t3)] font-ui">Unlocks at Level 5. Earn +{level * 100 - ecoPoints} XP to claim.</div>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>

        </div>
      </main>
    </div>
  );
};

export default Profile;