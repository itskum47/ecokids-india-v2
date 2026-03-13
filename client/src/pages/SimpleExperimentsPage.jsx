import React from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import Navbar from '../components/layout/Navbar';
import useContentTranslation from '../hooks/useContentTranslation';

function TranslatedDescription({ experiment, language }) {
  const { content, isTranslating } = useContentTranslation(experiment.description, `simple_exp_${experiment.id}`);

  if (isTranslating && language !== 'en') {
    return (
      <div className="animate-pulse space-y-2 mb-4">
        <div className="h-3 bg-gray-200 rounded w-full"></div>
        <div className="h-3 bg-gray-200 rounded w-5/6"></div>
      </div>
    );
  }

  return (
    <>
      {language !== 'en' && (
        <span className="inline-block mb-2 text-[10px] text-green-600 bg-green-50 px-2 py-0.5 rounded-full">
          AI Translated
        </span>
      )}
      <p className="text-[12px] text-gray-700 line-clamp-3 mb-4 leading-relaxed whitespace-pre-wrap">
        {language === 'en' ? experiment.description : content}
      </p>
    </>
  );
}

const SimpleExperimentsPage = () => {
  const { i18n } = useTranslation();
  const language = String(i18n.language || 'en').split('-')[0].toLowerCase();

  const experiments = [
    {
      id: 1,
      title: 'Water Quality Testing',
      description: 'Learn how to test water quality using simple household items.',
      difficulty: 'Beginner',
      colorKey: 'green',
      url: 'https://www.epa.gov/water-research/water-quality-testing-and-monitoring'
    },
    {
      id: 2,
      title: 'Air Quality Monitor',
      description: 'Build your own air quality monitoring device.',
      difficulty: 'Advanced',
      colorKey: 'blue',
      url: 'https://www.airnow.gov/education/students/'
    },
    {
      id: 3,
      title: 'Soil pH Testing',
      description: 'Discover how to test soil acidity and alkalinity.',
      difficulty: 'Intermediate',
      colorKey: 'purple',
      url: 'https://www.nrcs.usda.gov/conservation-basics/natural-resource-concerns/soils/soil-health'
    }
  ];

  const getColorStyles = (colorKey) => {
    switch (colorKey) {
      case 'green': return { bg: 'bg-green-50', border: 'border-green-200', title: 'text-green-800', text: 'text-green-700', badgeBg: 'bg-green-200', badgeText: 'text-green-800' };
      case 'blue': return { bg: 'bg-blue-50', border: 'border-blue-200', title: 'text-blue-800', text: 'text-blue-700', badgeBg: 'bg-blue-200', badgeText: 'text-blue-800' };
      case 'purple': return { bg: 'bg-purple-50', border: 'border-purple-200', title: 'text-purple-800', text: 'text-purple-700', badgeBg: 'bg-purple-200', badgeText: 'text-purple-800' };
      default: return { bg: 'bg-gray-50', border: 'border-gray-200', title: 'text-gray-800', text: 'text-gray-700', badgeBg: 'bg-gray-200', badgeText: 'text-gray-800' };
    }
  };

  const openTranslatedPopup = (experiment) => {
    const targetLang = i18n.language || 'en';
    const translateUrl = `https://translate.google.com/translate?sl=auto&tl=${targetLang}&u=${encodeURIComponent(experiment.url)}`;

    // Open as a centered popup window
    const width = 1024;
    const height = 768;
    const left = window.screen.width / 2 - width / 2;
    const top = window.screen.height / 2 - height / 2;

    window.open(
      translateUrl,
      'EcoKidsExperimentWindow',
      `toolbar=no,location=no,status=no,menubar=no,scrollbars=yes,resizable=yes,width=${width},height=${height},top=${top},left=${left}`
    );
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      <div className="max-w-6xl mx-auto px-4 py-8">
        <h1 className="text-4xl font-bold text-center mb-8 text-gray-800">
          🧪 Environmental Experiments
        </h1>

        <div className="bg-[var(--s1)] rounded-xl shadow-lg p-8 mb-8">
          <h2 className="text-2xl font-semibold mb-4">Explore Real-World Eco Experiments 🌱</h2>
          <p className="text-gray-600 mb-8">
            Discover hands-on environmental activities you can try at home or school.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {experiments.map((exp) => {
              const colors = getColorStyles(exp.colorKey);
              return (
                <div key={exp.id} className={`${colors.bg} p-6 rounded-xl border ${colors.border} flex flex-col justify-between hover:shadow-md transition-shadow duration-300`}>
                  <div>
                    <h3 className={`text-lg font-bold ${colors.title} mb-2`}>{exp.title}</h3>
                    <TranslatedDescription experiment={exp} language={language} />
                    <span className={`inline-block px-3 py-1 ${colors.badgeBg} ${colors.badgeText} rounded-full text-xs font-semibold`}>
                      {exp.difficulty}
                    </span>
                  </div>
                  <div className="mt-8">
                    <button
                      onClick={() => openTranslatedPopup(exp)}
                      className={`inline-flex items-center justify-center w-full px-4 py-2 border border-transparent text-sm font-medium rounded-lg text-white ${exp.colorKey === 'green' ? 'bg-green-600 hover:bg-green-700' :
                          exp.colorKey === 'blue' ? 'bg-blue-600 hover:bg-blue-700' :
                            'bg-purple-600 hover:bg-purple-700'
                        } cursor-pointer transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 ${exp.colorKey === 'green' ? 'focus:ring-green-500' :
                          exp.colorKey === 'blue' ? 'focus:ring-blue-500' :
                            'focus:ring-purple-500'
                        }`}
                    >
                      Learn More (Translated)
                      <svg className="ml-2 w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                      </svg>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="text-center">
          <Link
            to="/"
            className="inline-flex items-center px-6 py-3 bg-gray-800 text-white rounded-lg hover:bg-gray-900 transition-colors font-medium cursor-pointer focus:outline-none focus:ring-2 focus:ring-gray-900 focus:ring-offset-2"
          >
            ← Back to Home
          </Link>
        </div>
      </div>
    </div>
  );
};

export default SimpleExperimentsPage;