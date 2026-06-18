import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import en from './en.json';
import fr from './fr.json';
import ar from './ar.json';

export const LANGUAGES = [
  { code: 'en', label: 'English', flag: '🇬🇧' },
  { code: 'fr', label: 'Français', flag: '🇫🇷' },
  { code: 'ar', label: 'الدارجة', flag: '🇲🇦' },
] as const;

const stored = typeof localStorage !== 'undefined' ? localStorage.getItem('jmaa-lang') : null;

/** Keep the document direction/lang in sync (Arabic reads right-to-left). */
function applyDir(code: string) {
  if (typeof document === 'undefined') return;
  document.documentElement.lang = code;
  document.documentElement.dir = code === 'ar' ? 'rtl' : 'ltr';
}

i18n.use(initReactI18next).init({
  resources: {
    en: { translation: en },
    fr: { translation: fr },
    ar: { translation: ar },
  },
  lng: stored ?? 'en',
  fallbackLng: 'en',
  interpolation: { escapeValue: false },
});

applyDir(stored ?? 'en');

export function setLanguage(code: string) {
  i18n.changeLanguage(code);
  localStorage.setItem('jmaa-lang', code);
  applyDir(code);
}

export default i18n;
