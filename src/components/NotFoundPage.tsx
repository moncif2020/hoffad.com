import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'motion/react';
import { 
  Home, 
  BookOpen, 
  Search, 
  ArrowLeft, 
  ArrowRight, 
  Globe, 
  Compass, 
  Sparkles,
  HelpCircle
} from 'lucide-react';

interface LanguageOption {
  code: 'ar' | 'en' | 'fr';
  name: string;
  dir: 'rtl' | 'ltr';
}

const LANGUAGES: LanguageOption[] = [
  { code: 'ar', name: 'العربية', dir: 'rtl' },
  { code: 'en', name: 'English', dir: 'ltr' },
  { code: 'fr', name: 'Français', dir: 'ltr' }
];

const TRANSLATIONS = {
  ar: {
    app_name: 'حُفّاظ',
    app_sub: 'رفيقك الذكي لإتقان القرآن الكريم',
    tag: 'رمز الخطأ 404',
    title: 'عفواً، هذه الصفحة غير موجودة',
    desc: 'يبدو أنك سلكت مساراً غير صحيح أو تم نقل الصفحة إلى عنوان آخر. لا تقلق، وجهتك القرآنية في متناول يدك دائماً.',
    search_placeholder: 'ابحث عن سورة، آية، أو خدمة...',
    btn_search: 'بحث',
    btn_home: 'الصفحة الرئيسية',
    btn_quran: 'المصحف الشريف والتسميع',
    btn_help: 'تواصل معنا للدعم',
    quote: '﴿ وَقُل رَّبِّ زِدْنِي عِلْمًا ﴾',
    quote_ref: 'سورة طه: الآية 114',
    footer_copy: 'جميع الحقوق محفوظة لمنصة حُفّاظ © 2026'
  },
  en: {
    app_name: 'Hoffad',
    app_sub: 'Smart Quran Memorization Companion',
    tag: 'Error Code 404',
    title: 'Page Not Found',
    desc: 'The page you are looking for might have been moved, renamed, or is temporarily unavailable. Let us guide you back to your Quran journey.',
    search_placeholder: 'Search for a Surah, Ayah, or feature...',
    btn_search: 'Search',
    btn_home: 'Home Page',
    btn_quran: 'Holy Quran & Memorizer',
    btn_help: 'Contact Support',
    quote: '“And say: My Lord, increase me in knowledge.”',
    quote_ref: 'Surah Taha: Ayah 114',
    footer_copy: 'All rights reserved © Hoffad Platform 2026'
  },
  fr: {
    app_name: 'Hoffad',
    app_sub: 'Compagnon Intelligent de Mémorisation du Coran',
    tag: 'Code d’erreur 404',
    title: 'Page Introuvable',
    desc: 'La page que vous recherchez semble inexistante ou a été déplacée. Laissez-nous vous guider vers votre parcours d’apprentissage du Noble Coran.',
    search_placeholder: 'Rechercher une sourate, un verset...',
    btn_search: 'Chercher',
    btn_home: 'Page d’accueil',
    btn_quran: 'Noble Coran & Mémorisation',
    btn_help: 'Contacter l’assistance',
    quote: '« Et dis: Ô mon Seigneur, accroît mes connaissances ! »',
    quote_ref: 'Sourate Ta-Ha : Verset 114',
    footer_copy: 'Tous droits réservés © Plateforme Hoffad 2026'
  }
};

export function NotFoundPage() {
  const navigate = useNavigate();
  const [lang, setLang] = useState<'ar' | 'en' | 'fr'>(() => {
    const saved = localStorage.getItem('hoffad_lang');
    if (saved === 'en' || saved === 'fr' || saved === 'ar') return saved;
    const navLang = navigator.language?.toLowerCase() || '';
    if (navLang.startsWith('fr')) return 'fr';
    if (navLang.startsWith('en')) return 'en';
    return 'ar';
  });

  const [searchQuery, setSearchQuery] = useState('');
  const t = TRANSLATIONS[lang] || TRANSLATIONS.ar;
  const currentLangObj = LANGUAGES.find((l) => l.code === lang) || LANGUAGES[0];
  const isRtl = currentLangObj.dir === 'rtl';

  useEffect(() => {
    document.title = `${t.title} | ${t.app_name}`;
    document.documentElement.dir = currentLangObj.dir;
    document.documentElement.lang = lang;
  }, [lang, t.title, t.app_name, currentLangObj.dir]);

  const handleLanguageChange = (newLang: 'ar' | 'en' | 'fr') => {
    setLang(newLang);
    localStorage.setItem('hoffad_lang', newLang);
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      navigate(`/app?search=${encodeURIComponent(searchQuery.trim())}`);
    } else {
      navigate('/app');
    }
  };

  const ArrowForward = isRtl ? ArrowLeft : ArrowRight;

  return (
    <div 
      className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-between selection:bg-emerald-500 selection:text-white relative overflow-hidden"
      dir={currentLangObj.dir}
    >
      {/* Subtle Background Glows */}
      <div className="absolute -top-40 -right-40 w-96 h-96 bg-emerald-600/15 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-40 -left-40 w-96 h-96 bg-teal-600/15 rounded-full blur-3xl pointer-events-none" />

      {/* Header with Brand & Language Switcher */}
      <header className="w-full max-w-6xl mx-auto px-4 sm:px-6 py-6 flex items-center justify-between z-10">
        <a 
          href="/" 
          className="flex items-center gap-3 group transition-transform duration-200 hover:scale-105"
        >
          <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-700 p-0.5 shadow-lg shadow-emerald-900/30 flex items-center justify-center">
            <img 
              src="/logo.svg" 
              alt="Hoffad Logo" 
              className="w-8 h-8 object-contain"
              onError={(e) => {
                // Fallback to icon-512 if SVG fails
                (e.target as HTMLElement).style.display = 'none';
              }}
            />
          </div>
          <div>
            <h1 className="text-xl font-black tracking-tight text-white group-hover:text-emerald-400 transition-colors">
              {t.app_name}
            </h1>
            <p className="text-xs text-slate-400 font-medium">
              {t.app_sub}
            </p>
          </div>
        </a>

        {/* Multilingual Selector (AR, EN, FR) */}
        <div className="flex items-center gap-1 bg-slate-900/90 border border-slate-800 rounded-2xl p-1 shadow-inner backdrop-blur-md">
          <Globe className="w-4 h-4 text-emerald-400 mx-2 hidden sm:inline-block" />
          {LANGUAGES.map((l) => {
            const isActive = l.code === lang;
            return (
              <button
                key={l.code}
                onClick={() => handleLanguageChange(l.code)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all duration-200 ${
                  isActive 
                    ? 'bg-emerald-600 text-white shadow-md shadow-emerald-700/40 scale-100' 
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
                }`}
              >
                {l.name}
              </button>
            );
          })}
        </div>
      </header>

      {/* Main 404 Hero Content */}
      <main className="w-full max-w-4xl mx-auto px-4 sm:px-6 py-8 flex-1 flex flex-col items-center justify-center text-center z-10">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, ease: 'easeOut' }}
          className="w-full flex flex-col items-center"
        >
          {/* Status Badge */}
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs sm:text-sm font-semibold mb-6">
            <Sparkles className="w-4 h-4" />
            <span>{t.tag}</span>
          </div>

          {/* Large Stylized 404 Typography */}
          <div className="relative mb-4 select-none">
            <span className="text-8xl sm:text-9xl md:text-[11rem] font-black tracking-tighter bg-gradient-to-b from-white via-slate-200 to-slate-500 bg-clip-text text-transparent drop-shadow-2xl">
              404
            </span>
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-20 blur-xl bg-emerald-500/40 rounded-full" />
          </div>

          {/* Error Title & Explanatory Text */}
          <h2 className="text-2xl sm:text-3xl md:text-4xl font-extrabold text-white mb-4 tracking-tight">
            {t.title}
          </h2>
          <p className="text-slate-400 text-base sm:text-lg max-w-xl mb-8 leading-relaxed font-normal">
            {t.desc}
          </p>

          {/* Quranic Verse / Spiritual Encouragement Card */}
          <div className="w-full max-w-md bg-gradient-to-r from-emerald-950/40 via-slate-900/60 to-emerald-950/40 border border-emerald-500/20 rounded-2xl p-4 mb-8 shadow-lg">
            <p className="text-emerald-300 font-semibold text-base sm:text-lg mb-1 tracking-wide">
              {t.quote}
            </p>
            <p className="text-emerald-500/80 text-xs font-medium">
              {t.quote_ref}
            </p>
          </div>

          {/* Integrated Quran Quick Search Form */}
          <form 
            onSubmit={handleSearchSubmit} 
            className="w-full max-w-md flex items-center gap-2 bg-slate-900/90 border border-slate-800 rounded-2xl p-2 mb-8 shadow-lg focus-within:border-emerald-500 transition-colors"
          >
            <Search className="w-5 h-5 text-slate-500 mx-2 shrink-0" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={t.search_placeholder}
              className="bg-transparent border-none outline-none text-sm text-slate-100 placeholder-slate-500 w-full"
            />
            <button
              type="submit"
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs sm:text-sm font-bold rounded-xl transition-colors shadow-sm shrink-0"
            >
              {t.btn_search}
            </button>
          </form>

          {/* Main Action Buttons */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 w-full max-w-lg">
            <button
              onClick={() => navigate('/')}
              className="w-full sm:w-auto flex-1 inline-flex items-center justify-center gap-2.5 px-6 py-3.5 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-sm sm:text-base transition-all duration-200 shadow-lg shadow-emerald-900/30 hover:scale-[1.02] active:scale-[0.99]"
            >
              <Home className="w-4 h-4" />
              <span>{t.btn_home}</span>
              <ArrowForward className="w-4 h-4 opacity-70" />
            </button>

            <button
              onClick={() => navigate('/app')}
              className="w-full sm:w-auto flex-1 inline-flex items-center justify-center gap-2.5 px-6 py-3.5 rounded-2xl bg-slate-900 hover:bg-slate-800 text-slate-100 border border-slate-700 font-bold text-sm sm:text-base transition-all duration-200 shadow-md hover:scale-[1.02] active:scale-[0.99]"
            >
              <BookOpen className="w-4 h-4 text-emerald-400" />
              <span>{t.btn_quran}</span>
            </button>
          </div>
        </motion.div>
      </main>

      {/* Footer */}
      <footer className="w-full max-w-6xl mx-auto px-4 sm:px-6 py-6 flex flex-col sm:flex-row items-center justify-between gap-4 border-t border-slate-900 text-xs text-slate-500 z-10">
        <div>{t.footer_copy}</div>
        <div className="flex items-center gap-6">
          <a href="/" className="hover:text-emerald-400 transition-colors">
            {t.btn_home}
          </a>
          <a href="/app" className="hover:text-emerald-400 transition-colors">
            {t.btn_quran}
          </a>
          <a href="mailto:contact@hoffad.com" className="inline-flex items-center gap-1.5 hover:text-emerald-400 transition-colors">
            <HelpCircle className="w-3.5 h-3.5" />
            <span>{t.btn_help}</span>
          </a>
        </div>
      </footer>
    </div>
  );
}

export default NotFoundPage;
