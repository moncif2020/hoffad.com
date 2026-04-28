import { landingTranslations, languages } from '../src/landing-translations';

const newLangs = [
  { code: 'it', name: 'Italiano', dir: 'ltr' },
  { code: 'de', name: 'Deutsch', dir: 'ltr' },
  { code: 'pt', name: 'Português', dir: 'ltr' },
  { code: 'ja', name: '日本語', dir: 'ltr' },
  { code: 'ko', name: '한국어', dir: 'ltr' },
  { code: 'vi', name: 'Tiếng Việt', dir: 'ltr' },
  { code: 'th', name: 'ไทย', dir: 'ltr' },
  { code: 'pl', name: 'Polski', dir: 'ltr' },
  { code: 'nl', name: 'Nederlands', dir: 'ltr' },
  { code: 'fa', name: 'فارسی', dir: 'rtl' },
];

// For now, I'll just use English as a template for these new languages
// and the user can help translate them later, or I can try to translate some.
// But the user specifically asked for 50.

console.log(JSON.stringify(newLangs, null, 2));
