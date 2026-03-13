import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { motion, AnimatePresence } from 'framer-motion';
import Navbar from '../components/layout/Navbar';
import { useTranslation } from 'react-i18next';
import { apiRequest } from '../utils/api';
import useContentTranslation from '../hooks/useContentTranslation';

const getSafetyColor = (safety) => {
  switch (safety?.toLowerCase()) {
    case 'solo': return 'var(--g1)';
    case 'friend': return 'var(--amber)';
    case 'adult': return 'var(--red)';
    default: return 'var(--g1)';
  }
};

const getSafetyLabel = (safety) => {
  switch (safety?.toLowerCase()) {
    case 'solo': return '🟢 Solo OK';
    case 'friend': return '🟡 With a friend';
    case 'adult': return '🔴 Adult supervision';
    default: return '🟢 Solo OK';
  }
};

const ExperimentDetail = () => {
  const { slug } = useParams();
  const { i18n } = useTranslation();
  const { user, isAuthenticated } = useSelector(state => state.auth);

  const [experiment, setExperiment] = useState(null);
  const [loading, setLoading] = useState(true);

  // Photo Submission State
  const [showSubmission, setShowSubmission] = useState(false);
  const [photos, setPhotos] = useState([]);
  const [observations, setObservations] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);

  const {
    content: translatedDescription,
    isTranslating: isDescriptionTranslating,
  } = useContentTranslation(experiment?.description || '', `${experiment?._id || slug}:description`);

  const instructionsSource = (experiment?.steps || [])
    .map((step, index) => `${index + 1}. ${step.instruction || ''}`)
    .join('\n');

  const {
    content: translatedInstructions,
    isTranslating: isInstructionsTranslating,
  } = useContentTranslation(instructionsSource, `${experiment?._id || slug}:instructions`);

  const {
    content: translatedScienceExplanation,
    isTranslating: isScienceTranslating,
  } = useContentTranslation(experiment?.scienceExplanation || '', `${experiment?._id || slug}:science`);

  const translatedStepLines = translatedInstructions
    .split(/\n+/)
    .map((line) => line.replace(/^\d+\.\s*/, '').trim())
    .filter(Boolean);

  useEffect(() => {
    fetchExperiment();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug]);

  const fetchExperiment = async () => {
    setLoading(true);
    try {
      const response = await apiRequest(`/experiments/${slug}`);
      if (response && response.data) {
        setExperiment(response.data);
      }
    } catch (error) {
      console.error('Error fetching experiment:', error);
      // Hardcoded mock data if API fails to load
      setExperiment({
        _id: '1',
        title: 'Seed Sprouting Race',
        minGrade: 1,
        maxGrade: 3,
        safety: 'solo',
        estimatedTimeMinutes: 15,
        ecoPointsReward: 40,
        description: 'Plant 3 seeds in different conditions (dark/light/no water). Observe for 7 days.',
        materials: [
          '3 identical clear plastic cups or small pots',
          'Cotton wool or soil',
          '3 bean or gram seeds',
          'Water',
          'A dark cupboard and a sunny window'
        ],
        steps: [
          { instruction: 'Label your three cups: 1. Sun+Water, 2. Dark+Water, 3. Sun+No Water.', timeEstimate: '5 min' },
          { instruction: 'Place a similar amount of cotton wool or soil in each cup.', timeEstimate: '2 min' },
          { instruction: 'Place one seed in each cup, pressing it gently into the soil/cotton.', timeEstimate: '2 min' },
          { instruction: 'Add water to cup 1 and cup 2 so the soil is damp but not flooded. Leave cup 3 completely dry.', timeEstimate: '2 min' },
          { instruction: 'Place cup 1 and 3 on a sunny windowsill. Place cup 2 in a dark place where no light reaches.', timeEstimate: '2 min' },
          { instruction: 'Check every day for 7 days. Add small amounts of water to cups 1 and 2 to keep them damp.', timeEstimate: '3 min/day' },
          { instruction: 'Record which seed sprouts first and which grows the tallest.', timeEstimate: '5 min' }
        ],
        scienceExplanation: 'Plants need sunlight and water for photosynthesis. Without water, the seed cannot begin the germination process. Without light, a seed may sprout (using stored energy) but will be yellow and weak.',
      });
    } finally {
      setLoading(false);
    }
  };

  const handlePhotoUpload = (e) => {
    if (e.target.files && e.target.files.length > 0) {
      const newPhotos = Array.from(e.target.files);
      setPhotos([...photos, ...newPhotos]);
    }
  };

  const removePhoto = (index) => {
    setPhotos(photos.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (photos.length === 0) {
      alert("Please upload at least one photo of your experiment.");
      return;
    }
    setSubmitting(true);

    try {
      // Create FormData to send files
      const formData = new FormData();
      formData.append('observations', observations);
      photos.forEach((photo) => {
        formData.append('photos', photo);
      });

      // Simulated API delay
      await new Promise(resolve => setTimeout(resolve, 1500));
      // await apiRequest(`/experiments/${experiment._id}/submit`, { method: 'POST', body: formData });

      setSuccess(true);
    } catch (error) {
      console.error('Submission failed:', error);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[var(--bg)] pt-[72px] flex justify-center items-center">
        <div className="w-10 h-10 rounded-full border-2 border-dashed border-[var(--amber)] border-t-transparent animate-spin" />
      </div>
    );
  }

  if (!experiment) {
    return (
      <div className="min-h-screen bg-[var(--bg)] pt-[72px] flex justify-center items-center">
        <h2 className="font-display text-2xl text-[var(--t1)]">Experiment not found.</h2>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[var(--bg)] pt-[72px] pb-24">
      <Navbar />

      <div className="max-w-[800px] mx-auto px-6">

        {/* Back Link */}
        <div className="py-6">
          <Link to="/experiments" className="font-ui font-bold text-sm text-[var(--v2)] hover:text-[var(--v1)] flex items-center gap-2">
            ← Back to Labs
          </Link>
        </div>

        {/* Header Header */}
        <div className="mb-10 text-center">
          <div className="flex flex-wrap justify-center items-center gap-3 mb-4">
            <span className="font-mono text-[11px] font-bold text-[var(--t1)] px-3 py-1 rounded-full bg-[var(--s2)] border border-[var(--b2)]">
              Class {experiment.minGrade}–{experiment.maxGrade}
            </span>
            <span className="font-ui text-[11px] font-bold tracking-wider px-3 py-1 rounded-full bg-[rgba(0,0,0,0.3)] border border-[var(--b1)]" style={{ color: getSafetyColor(experiment.safety) }}>
              {getSafetyLabel(experiment.safety)}
            </span>
            <span className="font-mono text-[11px] font-bold text-[var(--t2)] px-3 py-1 rounded-full bg-[var(--s2)] border border-[var(--b2)]">
              ⏱️ {experiment.estimatedTimeMinutes} min
            </span>
            <span className="font-mono text-[11px] font-bold text-[var(--amber)] px-3 py-1 rounded-full border border-[rgba(255,215,0,0.3)] bg-[rgba(255,215,0,0.1)]">
              +{experiment.ecoPointsReward} EP
            </span>
          </div>

          <h1 className="font-display text-5xl text-[var(--t1)] mb-4">{experiment.title}</h1>
          {!isDescriptionTranslating && i18n.language !== 'en' && (
            <span className="inline-block mb-3 text-xs text-green-600 bg-green-50 px-2 py-1 rounded-full">
              AI Translated
            </span>
          )}
          {isDescriptionTranslating ? (
            <div className="animate-pulse space-y-3 max-w-xl mx-auto">
              <div className="h-4 bg-gray-200 rounded w-3/4 mx-auto"></div>
              <div className="h-4 bg-gray-200 rounded w-full"></div>
            </div>
          ) : (
            <p className="font-body text-[16px] text-[var(--t2)] whitespace-pre-wrap">
              {i18n.language === 'en' ? experiment.description : translatedDescription}
            </p>
          )}
        </div>

        {/* Materials Card */}
        <div className="bg-[var(--s1)] border border-[var(--b2)] rounded-[20px] p-6 md:p-8 mb-10 shadow-[0_10px_30px_rgba(0,0,0,0.5)]">
          <h3 className="font-display text-2xl text-[var(--t1)] mb-4 flex items-center gap-3">
            <span className="text-3xl text-[var(--amber)]">📦</span> Materials Needed
          </h3>
          <ul className="space-y-3">
            {experiment.materials?.map((mat, i) => (
              <li key={i} className="flex items-start gap-3">
                <span className="text-[var(--amber)] text-lg mt-0.5">•</span>
                <span className="font-body text-[15px] text-[var(--t1)]">{mat}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* Steps Stack */}
        <div className="mb-14 space-y-6">
          <h3 className="font-display text-3xl text-[var(--t1)] mb-6">Procedure</h3>

          {experiment.steps?.map((step, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
              className="bg-[var(--bg)] border border-[var(--b1)] rounded-[16px] p-6 flex items-start gap-6 relative overflow-hidden group hover:border-[var(--b2)] hover:bg-[var(--s1)] transition-colors"
            >
              {/* Left Number Badge */}
              <div className="w-12 h-12 rounded-2xl bg-[var(--s2)] border border-[var(--b2)] flex items-center justify-center font-display text-2xl text-[var(--t3)] group-hover:text-[var(--g1)] group-hover:border-[var(--g1)] transition-colors flex-shrink-0">
                {index + 1}
              </div>

              {/* Right Content */}
              <div className="flex-1 pt-1.5">
                {isInstructionsTranslating && i18n.language !== 'en' ? (
                  <div className="animate-pulse space-y-2">
                    <div className="h-4 bg-gray-200 rounded w-11/12"></div>
                    <div className="h-4 bg-gray-200 rounded w-4/5"></div>
                  </div>
                ) : (
                  <p className="font-ui text-[16px] text-[var(--t1)] leading-relaxed mb-2 whitespace-pre-wrap">
                    {i18n.language === 'en' ? step.instruction : (translatedStepLines[index] || step.instruction)}
                  </p>
                )}
                {step.timeEstimate && (
                  <div className="font-mono text-[11px] text-[var(--t3)]">
                    ⌛ {step.timeEstimate}
                  </div>
                )}
              </div>
            </motion.div>
          ))}
        </div>

        {/* The Science Card */}
        {experiment.scienceExplanation && (
          <div className="bg-gradient-to-br from-[var(--s1)] to-[var(--bg)] border border-[var(--b1)] rounded-[20px] p-6 md:p-8 mb-14 relative overflow-hidden">
            {/* Glow */}
            <div className="absolute top-0 right-0 w-64 h-64 bg-[var(--c1)] rounded-full blur-[100px] opacity-10 pointer-events-none" />

            <h3 className="font-display text-2xl text-[var(--c1)] mb-4 relative z-10">The Science Behind It</h3>
            {isScienceTranslating && i18n.language !== 'en' ? (
              <div className="animate-pulse space-y-2 relative z-10">
                <div className="h-4 bg-gray-200 rounded w-full"></div>
                <div className="h-4 bg-gray-200 rounded w-5/6"></div>
              </div>
            ) : (
              <p className="font-body text-[15px] text-[var(--t2)] leading-relaxed relative z-10 whitespace-pre-wrap">
                {i18n.language === 'en' ? experiment.scienceExplanation : translatedScienceExplanation}
              </p>
            )}
          </div>
        )}

        {/* Photo Submission Area */}
        <div id="submit" className="bg-[var(--s2)] border border-[var(--b2)] rounded-[24px] p-6 md:p-10 text-center relative overflow-hidden">

          {success ? (
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="py-10"
            >
              <div className="w-20 h-20 rounded-full bg-[rgba(0,255,136,0.1)] border border-[var(--g1)] flex items-center justify-center text-4xl text-[var(--g1)] mx-auto mb-6">
                ✓
              </div>
              <h3 className="font-display text-4xl text-[var(--g1)] mb-4">Verification Submitted!</h3>
              <p className="font-ui text-[var(--t2)] mb-8">
                Your experiment results are being analyzed. You earned <strong className="text-[var(--amber)]">+{experiment.ecoPointsReward} EP</strong>!
              </p>
              <Link to="/experiments" className="px-8 py-3 rounded-full font-ui font-bold text-sm uppercase tracking-widest text-[#03050a] bg-[var(--g1)] hover:bg-[#00cc6a] transition-colors">
                Back to Labs
              </Link>
            </motion.div>
          ) : !showSubmission ? (
            <div className="py-6">
              <h3 className="font-display text-3xl text-[var(--t1)] mb-4">Experiment Complete?</h3>
              <p className="font-ui text-[var(--t2)] mb-8 max-w-lg mx-auto">
                Submit a photo of your results to prove completion and claim your Eco Points!
              </p>
              <button
                onClick={() => setShowSubmission(true)}
                className="px-8 py-4 rounded-full font-ui font-bold text-sm uppercase tracking-widest text-[#03050a] bg-[var(--amber)] shadow-[0_0_20px_rgba(255,215,0,0.3)] hover:scale-105 transition-transform"
              >
                Submit Evidence
              </button>
            </div>
          ) : (
            <motion.form
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              onSubmit={handleSubmit}
              className="text-left"
            >
              <h3 className="font-display text-2xl text-[var(--t1)] mb-6 border-b border-[var(--b1)] pb-4">
                Field Report Submission
              </h3>

              {/* Photo Upload Zone */}
              <div className="mb-6">
                <label className="block font-ui font-bold text-sm text-[var(--t2)] mb-2">Photographic Evidence *</label>

                <div
                  className="border-2 border-dashed border-[var(--b2)] rounded-[16px] p-8 text-center bg-[var(--s1)] cursor-pointer hover:border-[var(--v2)] transition-colors relative focus:outline-none focus:ring-2 focus:ring-[var(--g1)]"
                  onClick={() => document.getElementById('file-upload').click()}
                  onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && document.getElementById('file-upload').click()}
                  role="button"
                  tabIndex={0}
                  aria-label="Select Photos"
                >
                  <div className="text-4xl mb-4">📸</div>
                  <p className="font-ui text-[var(--t3)] font-bold mb-2">Tap to Select Photos</p>
                  <p className="font-ui text-[11px] text-[var(--t3)]">Max 3 images (JPG, PNG)</p>
                  <input
                    id="file-upload"
                    type="file"
                    className="hidden"
                    accept="image/*"
                    multiple
                    onChange={handlePhotoUpload}
                  />
                </div>

                {/* Photo Previews */}
                {photos.length > 0 && (
                  <div className="flex flex-wrap gap-4 mt-4">
                    {photos.map((p, i) => (
                      <div key={i} className="relative w-24 h-24 rounded-xl overflow-hidden border border-[var(--b1)]">
                        <img src={URL.createObjectURL(p)} alt="Upload preview" className="w-full h-full object-cover" />
                        <button
                          type="button"
                          onClick={() => removePhoto(i)}
                          className="absolute top-1 right-1 w-6 h-6 rounded-full bg-black/60 text-white flex items-center justify-center text-xs backdrop-blur-md border border-white/20"
                        >
                          ×
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Text Area */}
              <div className="mb-8">
                <label className="block font-ui font-bold text-sm text-[var(--t2)] mb-2">Observations (Optional)</label>
                <textarea
                  rows="3"
                  value={observations}
                  onChange={e => setObservations(e.target.value)}
                  className="w-full bg-[var(--bg)] border border-[var(--b1)] rounded-[16px] p-4 font-ui text-[14px] text-[var(--t1)] placeholder:text-[var(--t3)] focus:outline-none focus:border-[var(--v2)] transition-colors resize-none"
                  placeholder="What did you observe? Did it work as expected?"
                />
              </div>

              <div className="flex gap-4">
                <button
                  type="button"
                  onClick={() => setShowSubmission(false)}
                  className="flex-1 py-3.5 rounded-xl font-ui font-bold text-[13px] uppercase tracking-wider border border-[var(--b2)] text-[var(--t2)] hover:bg-[var(--s1)] transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex-1 py-3.5 rounded-xl font-ui font-bold text-[13px] uppercase tracking-wider bg-[var(--amber)] text-[#03050a] hover:bg-[#ffcc00] transition-colors disabled:opacity-50"
                >
                  {submitting ? 'Uploading...' : 'Confirm Upload'}
                </button>
              </div>

            </motion.form>
          )}
        </div>

      </div>
    </div>
  );
};

export default ExperimentDetail;