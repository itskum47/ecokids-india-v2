const axios = require('axios');
const crypto = require('crypto');
const { redisClient } = require('../services/cacheService');

const INVOKE_URL = 'https://integrate.api.nvidia.com/v1/chat/completions';
const MODEL = 'meta/llama-3.1-8b-instruct';
const TRANSLATION_TTL_SECONDS = 24 * 60 * 60;
const RATE_LIMIT_MAX = 20;
const RATE_LIMIT_WINDOW_SECONDS = 60 * 60;

const LANGUAGE_NAMES = {
  hi: 'Hindi',
  bn: 'Bengali',
  ta: 'Tamil',
  te: 'Telugu',
  mr: 'Marathi',
  kn: 'Kannada',
  gu: 'Gujarati',
  pa: 'Punjabi',
  ml: 'Malayalam',
  en: 'English',
};

const normalizeLanguage = (languageCode) => String(languageCode || 'en').split('-')[0].toLowerCase();

const buildCacheArticleId = (articleId, text) => {
  if (articleId && String(articleId).trim()) return String(articleId).trim();
  const hash = crypto.createHash('sha1').update(String(text || '')).digest('hex').slice(0, 16);
  return `adhoc_${hash}`;
};

exports.translateContent = async (req, res) => {
  const { text = '', targetLanguage = 'en', articleId = '' } = req.body || {};
  const normalizedLanguage = normalizeLanguage(targetLanguage);
  const languageName = LANGUAGE_NAMES[normalizedLanguage] || 'English';
  const sourceText = String(text || '');

  if (!sourceText.trim()) {
    return res.json({ error: true });
  }

  if (normalizedLanguage === 'en') {
    return res.json({ translatedText: sourceText, fromCache: true, language: normalizedLanguage });
  }

  const userId = req.user?._id ? String(req.user._id) : 'anonymous';
  const countKey = `translate_count:${userId}`;
  const safeArticleId = buildCacheArticleId(articleId, sourceText);
  const cacheKey = `translation:${safeArticleId}:${normalizedLanguage}`;

  try {
    const requestCount = await redisClient.incr(countKey);
    if (requestCount === 1) {
      await redisClient.expire(countKey, RATE_LIMIT_WINDOW_SECONDS);
    }

    if (requestCount > RATE_LIMIT_MAX) {
      return res.json({ error: 'limit', message: 'Translation limit reached. Try again in an hour.' });
    }

    const cached = await redisClient.get(cacheKey);
    if (cached) {
      return res.json({ translatedText: cached, fromCache: true, language: normalizedLanguage });
    }

    const response = await axios.post(
      INVOKE_URL,
      {
        model: MODEL,
        messages: [
          {
            role: 'system',
            content: `You are a professional translator. Translate the following text to ${languageName}. Preserve all formatting including markdown bold (**text**), bullet points, and line breaks. Return ONLY the translated text with no explanation or preamble.`,
          },
          { role: 'user', content: sourceText },
        ],
        max_tokens: 2000,
        temperature: 0.3,
        stream: false,
      },
      {
        headers: {
          Authorization: `Bearer ${process.env.NVIDIA_API_KEY}`,
          Accept: 'application/json',
          'Content-Type': 'application/json',
        },
        timeout: 15000,
      }
    );

    const translatedText = response?.data?.choices?.[0]?.message?.content?.trim();
    if (!translatedText) {
      return res.json({ error: true });
    }

    await redisClient.setex(cacheKey, TRANSLATION_TTL_SECONDS, translatedText);
    return res.json({ translatedText, fromCache: false, language: normalizedLanguage });
  } catch (error) {
    console.error('[Translation] Error:', error.message);
    return res.json({ error: true });
  }
};
