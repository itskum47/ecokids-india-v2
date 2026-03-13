import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { fetchTopicById } from '../store/slices/topicsSlice';
import { updateProgress } from '../store/slices/progressSlice';
import Skeleton from '../components/common/Skeleton';
import { useTranslation } from 'react-i18next';
import useContentTranslation from '../hooks/useContentTranslation';

const TopicDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const dispatch = useDispatch();

  const { currentTopic, loading, error } = useSelector(state => state.topics);
  const { isAuthenticated } = useSelector(state => state.auth);
  const { i18n } = useTranslation();

  const [readingProgress, setReadingProgress] = useState(0);
  const [startTime] = useState(Date.now());
  const { content: translatedContent, isTranslating } = useContentTranslation(currentTopic?.content || '', currentTopic?._id || id);

  useEffect(() => {
    if (id) {
      dispatch(fetchTopicById(id));
    }
  }, [dispatch, id]);

  if (!id) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-800 mb-4">Invalid Topic</h2>
          <button
            onClick={() => navigate('/topics')}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            Back to Topics
          </button>
        </div>
      </div>
    );
  }

  useEffect(() => {
    const handleScroll = () => {
      const scrollTop = window.pageYOffset;
      const docHeight = document.documentElement.scrollHeight - window.innerHeight;
      const scrollPercent = (scrollTop / docHeight) * 100;

      setReadingProgress(Math.min(scrollPercent, 100));
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const handleComplete = () => {
    if (isAuthenticated && currentTopic) {
      const timeSpent = Math.floor((Date.now() - startTime) / 1000);
      dispatch(updateProgress({
        type: 'topic',
        topicId: currentTopic._id,
        completed: true,
        timeSpent,
        readingProgress: 100
      }));
    }
    navigate('/topics');
  };

  if (loading) return (
    <div className="min-h-screen bg-[var(--bg)] pb-24 md:pb-10 pt-20 px-4">
      <div className="max-w-4xl mx-auto space-y-6">
        <Skeleton height="300px" className="rounded-3xl" />
        <Skeleton height="40px" width="60%" className="rounded-xl" />
        <Skeleton height="20px" width="100%" className="rounded-md" />
        <Skeleton height="20px" width="80%" className="rounded-md" />
      </div>
    </div>
  );

  if (error) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <h2 className="text-red-800 font-semibold">Error Loading Topic</h2>
          <p className="text-red-600">{error}</p>
          <button
            onClick={() => navigate('/topics')}
            className="mt-4 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
          >
            Back to Topics
          </button>
        </div>
      </div>
    );
  }

  if (!currentTopic) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-800 mb-4">Topic Not Found</h2>
          <button
            onClick={() => navigate('/topics')}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            Back to Topics
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Progress Bar */}
      <div className="fixed top-0 left-0 w-full h-1 bg-gray-200 z-50">
        <div
          className="h-full bg-green-500 transition-all duration-300"
          style={{ width: `${readingProgress}%` }}
        />
      </div>

      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="bg-[var(--s1)] rounded-lg shadow-lg p-6 mb-8">
          <div className="flex items-center justify-between mb-4">
            <button
              onClick={() => navigate('/topics')}
              className="flex items-center text-blue-600 hover:text-blue-800"
            >
              <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
              Back to Topics
            </button>

            <div className="flex items-center space-x-4">
              <span className="text-sm text-gray-600">
                {Math.round(readingProgress)}% Complete
              </span>
              <span className={`px-3 py-1 rounded-full text-sm ${currentTopic.difficulty === 'easy' ? 'bg-green-100 text-green-800' :
                currentTopic.difficulty === 'medium' ? 'bg-yellow-100 text-yellow-800' :
                  'bg-red-100 text-red-800'
                }`}>
                {currentTopic.difficulty}
              </span>
            </div>
          </div>

          <h1 className="text-3xl font-bold text-gray-800 mb-4">{currentTopic.title}</h1>

          {!isTranslating && i18n.language !== 'en' && (
            <span className="inline-block mb-4 text-xs text-green-600 bg-green-50 px-2 py-1 rounded-full">
              AI Translated
            </span>
          )}

          {currentTopic.description && (
            <p className="text-gray-600 text-lg mb-6">{currentTopic.description}</p>
          )}

          <div className="flex flex-wrap gap-4 text-sm text-gray-600">
            <div className="flex items-center">
              <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.99 1.99 0 013 12V7a4 4 0 014-4z" />
              </svg>
              {currentTopic.category}
            </div>
            {currentTopic.estimatedTime && (
              <div className="flex items-center">
                <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                {currentTopic.estimatedTime} min read
              </div>
            )}
          </div>
        </div>

        {/* Content */}
        <div className="bg-[var(--s1)] rounded-lg shadow-lg p-8 mb-8">
          {isTranslating ? (
            <div className="animate-pulse space-y-3">
              <div className="h-4 bg-gray-200 rounded w-3/4"></div>
              <div className="h-4 bg-gray-200 rounded w-full"></div>
              <div className="h-4 bg-gray-200 rounded w-5/6"></div>
              <div className="h-4 bg-gray-200 rounded w-2/3"></div>
            </div>
          ) : i18n.language === 'en' ? (
            <div
              className="prose prose-lg max-w-none"
              dangerouslySetInnerHTML={{ __html: currentTopic.content }}
            />
          ) : (
            <div className="prose prose-lg max-w-none whitespace-pre-wrap">
              {translatedContent}
            </div>
          )}
        </div>

        {/* Key Points */}
        {currentTopic.keyPoints && currentTopic.keyPoints.length > 0 && (
          <div className="bg-blue-50 rounded-lg p-6 mb-8">
            <h3 className="text-xl font-semibold text-gray-800 mb-4">Key Points</h3>
            <ul className="space-y-2">
              {currentTopic.keyPoints.map((point, index) => (
                <li key={index} className="flex items-start">
                  <svg className="w-5 h-5 text-blue-600 mr-2 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                  {point}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Complete Button */}
        <div className="bg-[var(--s1)] rounded-lg shadow-lg p-6 text-center">
          <h3 className="text-xl font-semibold text-gray-800 mb-4">
            Ready to mark as complete?
          </h3>
          <p className="text-gray-600 mb-6">
            You've read {Math.round(readingProgress)}% of this topic.
            {readingProgress >= 80 ? " Great job!" : " Keep reading to learn more!"}
          </p>
          <button
            onClick={handleComplete}
            disabled={readingProgress < 80}
            className={`px-8 py-3 rounded-lg font-semibold transition-colors ${readingProgress >= 80
              ? 'bg-green-600 text-white hover:bg-green-700'
              : 'bg-gray-300 text-gray-500 cursor-not-allowed'
              }`}
          >
            {readingProgress >= 80 ? 'Mark as Complete' : 'Continue Reading'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default TopicDetail;