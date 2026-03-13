import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import toast from 'react-hot-toast';
import { apiRequest } from '../utils/api';

const normalizeLanguage = (language) => String(language || 'en').split('-')[0].toLowerCase();

const buildLocalKey = (articleId, originalContent) => {
  if (articleId && String(articleId).trim()) return String(articleId).trim();
  const text = String(originalContent || '');
  return `adhoc_${text.length}_${text.slice(0, 20)}`;
};

const useContentTranslation = (originalContent, articleId) => {
  const { i18n } = useTranslation();
  const [translations, setTranslations] = useState({});
  const [isTranslating, setIsTranslating] = useState(false);

  const language = useMemo(() => normalizeLanguage(i18n.language), [i18n.language]);
  const source = String(originalContent || '');
  const cacheKey = useMemo(() => buildLocalKey(articleId, source), [articleId, source]);

  useEffect(() => {
    setTranslations({});
    setIsTranslating(false);
  }, [cacheKey]);

  useEffect(() => {
    let isCancelled = false;

    const translate = async () => {
      if (!source || language === 'en') {
        setIsTranslating(false);
        return;
      }

      if (translations[language]) {
        return;
      }

      setIsTranslating(true);
      try {
        const response = await apiRequest('post', '/v1/translate', {
          text: source,
          targetLanguage: language,
          articleId: cacheKey,
        });

        if (isCancelled) return;

        if (response?.error === 'limit') {
          toast.error('Translation limit reached', { id: 'translation_limit_reached' });
          return;
        }

        if (response?.translatedText) {
          setTranslations((prev) => ({ ...prev, [language]: response.translatedText }));
        }
      } catch (error) {
        if (isCancelled) return;
      } finally {
        if (!isCancelled) {
          setIsTranslating(false);
        }
      }
    };

    translate();

    return () => {
      isCancelled = true;
    };
  }, [source, language, translations, cacheKey]);

  const content = language === 'en' ? source : (translations[language] || source);

  return { content, isTranslating };
};

export default useContentTranslation;
