import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import en from './locales/en.json';
import hi from './locales/hi.json';
import bn from './locales/bn.json';
import ta from './locales/ta.json';
import te from './locales/te.json';
import mr from './locales/mr.json';
import kn from './locales/kn.json';
import gu from './locales/gu.json';
import pa from './locales/pa.json';
import ml from './locales/ml.json';

const savedLanguage = localStorage.getItem('ecokids-language') || 'en';

i18n
  .use(initReactI18next)
  .init({
    resources: {
      en: { translation: en },
      hi: { translation: hi },
      bn: { translation: bn },
      ta: { translation: ta },
      te: { translation: te },
      mr: { translation: mr },
      kn: { translation: kn },
      gu: { translation: gu },
      pa: { translation: pa },
      ml: { translation: ml },
    },
    lng: savedLanguage,
    fallbackLng: 'en',
    interpolation: { escapeValue: false },
  });

i18n.on('languageChanged', (lng) => {
  localStorage.setItem('ecokids-language', lng);
  document.documentElement.lang = lng;
});

document.documentElement.lang = i18n.language || savedLanguage;

export default i18n;