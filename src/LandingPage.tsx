import React, { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { 
  BookOpen, Sparkles, Mic, TreePine, Users, 
  ArrowLeft, ArrowRight, CheckCircle2, Play, ShieldCheck,
  BrainCircuit, Sprout, HeartHandshake, ChevronRight, ChevronLeft, Globe, Menu, X as CloseIcon, LogIn, Monitor, X, ChevronUp, ChevronDown
} from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { landingTranslations, languages } from './landing-translations';
import { auth, googleProvider, db } from './firebase';
import { safeJson } from './lib/quran';
import { signInWithPopup, onAuthStateChanged, signInAnonymously } from 'firebase/auth';
import { doc, onSnapshot, deleteDoc, setDoc, serverTimestamp, getDoc } from 'firebase/firestore';
import { AuthModal } from './components/AuthModal';

export function LandingPage() {
  const [lang, setLang] = useState('ar');
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isAuthChecking, setIsAuthChecking] = useState(true);
  const [isTVModalOpen, setIsTVModalOpen] = useState(false);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [authModalMode, setAuthModalMode] = useState<'signin' | 'signup'>('signin');
  const [tvSessionId, setTvSessionId] = useState<string | null>(null);
  const [deviceId] = useState<string>(() => {
    const saved = localStorage.getItem('hoffad_device_id');
    if (saved) return saved;
    const newId = Math.random().toString(36).substring(2, 10).toUpperCase();
    localStorage.setItem('hoffad_device_id', newId);
    return newId;
  });
  const [isLangOpen, setIsLangOpen] = useState(false);
  const navigate = useNavigate();
  const langRef = useRef<HTMLDivElement>(null);

  // Merge selected language with English as fallback for missing keys
  const t = {
    ...landingTranslations['en'],
    ...(landingTranslations[lang] || landingTranslations['ar'])
  };

  const devError = (...args: any[]) => { if (import.meta.env.DEV) console.error(...args); };
  
  const currentLang = languages.find(l => l.code === lang) || languages[0];
  const isRtl = currentLang.dir === 'rtl';

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (langRef.current && !langRef.current.contains(event.target as Node)) {
        setIsLangOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    document.title = `${t.app_name} - ${t.hero_title1} ${t.hero_title2}`;
    document.documentElement.dir = currentLang.dir;
    document.documentElement.lang = lang;

    // If already logged in (Google/Email), redirect to app
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user && !user.isAnonymous) {
        navigate('/app');
      } else if (!user) {
        // Sign in anonymously as a fallback for TV sessions and basic usage
        try {
          await signInAnonymously(auth);
        } catch (err) {
          devError("Anon Sign-in Error:", err);
        }
        setIsAuthChecking(false);
      } else {
        setIsAuthChecking(false);
      }
    });
    return () => unsubscribe();
  }, [lang, t, currentLang, navigate]);

  const handleStart = (preferredMode: 'signin' | 'signup' = 'signin') => {
    if (auth.currentUser && !auth.currentUser.isAnonymous) {
      navigate('/app');
      return;
    }
    setAuthModalMode(preferredMode);
    setIsAuthModalOpen(true);
  };

  const handleTVLogin = async () => {
    // Ensure we have a user identity (either anonymous or Google)
    let currentUid = auth.currentUser?.uid;
    
    // If not signed in at all (rare but possible), try to sign in anonymously now
    if (!currentUid) {
      try {
        const anon = await signInAnonymously(auth);
        currentUid = anon.user.uid;
      } catch (err) {
        currentUid = deviceId;
      }
    }

    const sessionId = currentUid || deviceId;
    setTvSessionId(sessionId);
    setIsTVModalOpen(true);

    // Initialize the session in Firestore FIRST
    try {
      await setDoc(doc(db, 'tv_sessions', sessionId), {
        deviceId: deviceId,
        status: 'waiting',
        currentAnonUid: sessionId, 
        updatedAt: serverTimestamp(),
        createdAt: serverTimestamp()
      });
    } catch (err) {
      devError("Failed to initialize TV session:", err);
    }

    // Listen for the session to be linked
    const unsubscribe = onSnapshot(doc(db, 'tv_sessions', sessionId), (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.data();
        if (data.status === 'linked') {
          // 2. Try to get a custom token from our backend for "real" authentication
          // This allows the TV to actually BE the user in the eyes of Firestore rules
          fetch('/api/generate-custom-token', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ uid: data.uid })
          })
          .then(res => {
            if (!res.ok) throw new Error('Backend failed to generate token');
            return safeJson(res);
          })
          .then(tokenData => {
            if (tokenData.customToken) {
              localStorage.setItem('hoffad_custom_token', tokenData.customToken);
            }
          })
          .catch(err => {
            console.warn("Custom token generation failed. Falling back to simple session.", err);
            // We still proceed, but Firestore might block reads if rules aren't met
          })
          .finally(() => {
            // Store the session info in localStorage
            localStorage.setItem('hoffad_session_uid', data.uid);
            localStorage.setItem('hoffad_session_name', data.displayName || '');
            localStorage.setItem('hoffad_session_photo', data.photoURL || '');
            
            unsubscribe();
            navigate('/app');
          });
        }
      }
    }, (error) => {
      devError("TV Session Listener Error:", error);
      // If error happens here, the TV can't see its own session
      if (error.message.includes('permission')) {
        alert(lang === 'ar' 
          ? "خطأ في الاتصال بقاعدة البيانات. يرجى التأكد من تفعيل Firestore ونشر قواعد الأمان." 
          : "Database connection error. Please ensure Firestore is enabled and rules are deployed.");
      }
    });

    return () => unsubscribe();
  };

  return (
    <div className="min-h-screen bg-slate-50 font-sans" dir={currentLang.dir}>
      {isAuthChecking && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-white">
          <div className="flex flex-col items-center">
            <motion.div 
              animate={{ rotate: 360 }}
              transition={{ repeat: Infinity, duration: 1, ease: "linear" }}
              className="w-12 h-12 border-4 border-emerald-500 border-t-transparent rounded-full mb-4"
            />
            <p className="text-slate-600 font-medium">
              {lang === 'ar' ? 'جاري التحقق من الهوية...' : 'Verifying identity...'}
            </p>
          </div>
        </div>
      )}

      {/* Navbar */}
      <nav className="fixed top-0 left-0 right-0 bg-white/80 backdrop-blur-md z-50 border-b border-slate-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center gap-2">
              <img src="/logo.svg" alt={`${t.app_name} Logo`} className="w-8 h-8 object-contain" />
              <span className="font-bold text-xl text-emerald-700">{t.app_name}</span>
            </div>
            
            <div className="flex items-center gap-2 sm:gap-4">
              {/* Language Selector - Visible on all screens */}
              <div className="relative" ref={langRef}>
                <button 
                  onClick={() => setIsLangOpen(!isLangOpen)}
                  className={`flex items-center gap-2 px-2 sm:px-3 py-1.5 rounded-lg border border-slate-200 text-slate-600 hover:text-emerald-600 hover:border-emerald-200 hover:bg-emerald-50 font-medium transition-all text-sm sm:text-base focus:outline-none focus:ring-2 focus:ring-emerald-500 ${isLangOpen ? 'ring-2 ring-emerald-500 border-transparent bg-emerald-50' : ''}`}
                >
                  <Globe size={18} />
                  <span className="xs:inline">{currentLang.name}</span>
                </button>
                {isLangOpen && (
                  <div className="absolute top-full mt-2 w-48 bg-white rounded-xl shadow-xl border border-slate-100 overflow-hidden animate-in fade-in zoom-in duration-200 z-50 flex flex-col" style={isRtl ? { left: 0 } : { right: 0 }}>
                    <button 
                      type="button"
                      onClick={(e) => { e.stopPropagation(); document.getElementById('lang-scroll')?.scrollBy({ top: -100, behavior: 'smooth' }); }}
                      className="w-full flex justify-center py-1 bg-slate-50 hover:bg-slate-100 text-slate-400 border-b border-slate-100"
                    >
                      <ChevronUp size={18} />
                    </button>
                    
                    <div id="lang-scroll" className="max-h-[40vh] overflow-y-auto py-2 force-scrollbar scrollbar-thin scrollbar-thumb-slate-300 scrollbar-track-slate-100">
                      {languages.map((l) => (
                        <button
                          key={l.code}
                          onClick={() => {
                            setLang(l.code);
                            setIsLangOpen(false);
                          }}
                          onFocus={(e) => e.currentTarget.scrollIntoView({ behavior: 'smooth', block: 'nearest' })}
                          className={`w-full text-left px-4 py-2 hover:bg-emerald-50 focus:bg-emerald-50 focus:outline-none transition-colors ${lang === l.code ? 'text-emerald-600 font-bold bg-emerald-50/50' : 'text-slate-700'}`}
                          style={{ textAlign: isRtl ? 'right' : 'left' }}
                        >
                          {l.name}
                        </button>
                      ))}
                    </div>

                    <button 
                      type="button"
                      onClick={(e) => { e.stopPropagation(); document.getElementById('lang-scroll')?.scrollBy({ top: 100, behavior: 'smooth' }); }}
                      className="w-full flex justify-center py-1 bg-slate-50 hover:bg-slate-100 text-slate-400 border-t border-slate-100"
                    >
                      <ChevronDown size={18} />
                    </button>
                  </div>
                )}
              </div>

              <button 
                onClick={handleTVLogin}
                className="text-slate-600 hover:text-emerald-600 font-medium transition-colors flex items-center gap-2"
              >
                <Monitor size={18} />
                <span className="hidden sm:inline">{lang === 'ar' ? 'دخول عبر الهاتف' : 'TV Login'}</span>
              </button>

              <button 
                onClick={() => handleStart('signin')}
                className="text-slate-600 hover:text-emerald-600 font-medium transition-colors hidden md:block"
              >
                {t.nav_login}
              </button>
              
              <button 
                onClick={() => handleStart('signup')}
                disabled={isLoading}
                className="bg-emerald-600 text-white px-4 sm:px-5 py-2 rounded-full font-medium hover:bg-emerald-700 transition-colors shadow-sm hover:shadow-md flex items-center gap-2 text-sm sm:text-base disabled:opacity-50"
              >
                <span>{t.nav_start}</span>
                {isRtl ? <ChevronLeft size={18} /> : <ChevronRight size={18} />}
              </button>
            </div>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="pt-32 pb-20 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
        <div className="grid lg:grid-cols-2 gap-12 items-center">
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className={`text-center ${isRtl ? 'lg:text-right' : 'lg:text-left'}`}
          >
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-emerald-100 text-emerald-700 font-medium text-sm mb-6">
              <Sparkles size={16} />
              <span>{t.hero_badge}</span>
            </div>
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold text-slate-900 leading-tight mb-6">
              {t.hero_title1} <br className="hidden sm:block" />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-600 to-teal-500">
                {t.hero_title2}
              </span>
            </h1>
            <p className={`text-lg sm:text-xl text-slate-600 mb-8 max-w-2xl mx-auto ${isRtl ? 'lg:mx-0' : 'lg:mx-0'} leading-relaxed`}>
              {t.hero_desc}
            </p>
            <div className={`flex flex-col sm:flex-row gap-4 justify-center ${isRtl ? 'lg:justify-start' : 'lg:justify-start'}`}>
              <button 
                onClick={() => handleStart('signup')}
                disabled={isLoading}
                className="bg-emerald-600 text-white px-8 py-4 rounded-full font-bold text-lg hover:bg-emerald-700 transition-all shadow-lg hover:shadow-xl hover:-translate-y-1 flex items-center justify-center gap-2 disabled:opacity-50"
              >
                <Play size={20} fill="currentColor" />
                <span>{t.hero_btn_web}</span>
              </button>
              <button className="bg-white text-slate-700 border-2 border-slate-200 px-8 py-4 rounded-full font-bold text-lg hover:border-emerald-200 hover:bg-emerald-50 transition-all flex items-center justify-center gap-2 opacity-80 cursor-not-allowed" title={t.hero_btn_app}>
                <span>{t.hero_btn_app}</span>
              </button>
            </div>
          </motion.div>

          <motion.div 
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="relative"
          >
            <div className="absolute inset-0 bg-gradient-to-tr from-emerald-200 to-teal-100 rounded-[3rem] transform rotate-3 scale-105 -z-10 opacity-50 blur-2xl"></div>
            <div className="bg-white border border-slate-100 rounded-[2rem] shadow-2xl overflow-hidden relative">
              <div className="bg-slate-50 border-b border-slate-100 p-4 flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-red-400"></div>
                <div className="w-3 h-3 rounded-full bg-amber-400"></div>
                <div className="w-3 h-3 rounded-full bg-emerald-400"></div>
              </div>
              <div className="p-6">
                <div className="flex items-center justify-between mb-6">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 bg-emerald-100 rounded-2xl flex items-center justify-center">
                      <BookOpen className="text-emerald-600" size={24} />
                    </div>
                    <div>
                      <div className="h-4 w-24 bg-slate-200 rounded-full mb-2"></div>
                      <div className="h-3 w-16 bg-slate-100 rounded-full"></div>
                    </div>
                  </div>
                  <div className="flex gap-1">
                    <div className="w-8 h-8 bg-amber-100 rounded-full flex items-center justify-center text-amber-600">🪙</div>
                    <div className="w-8 h-8 bg-emerald-100 rounded-full flex items-center justify-center text-emerald-600">🌱</div>
                  </div>
                </div>
                <div className="space-y-3">
                  <div className="h-4 w-full bg-slate-100 rounded-full"></div>
                  <div className="h-4 w-5/6 bg-slate-100 rounded-full"></div>
                  <div className="h-4 w-4/6 bg-slate-100 rounded-full"></div>
                </div>
                <div className="mt-8 flex justify-center">
                  <div className="w-16 h-16 bg-emerald-500 rounded-full flex items-center justify-center shadow-lg shadow-emerald-200 text-white animate-pulse">
                    <Mic size={28} />
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold text-slate-900 mb-4">{t.features_title}</h2>
            <p className="text-lg text-slate-600">{t.features_desc}</p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
            {[
              {
                icon: <BrainCircuit size={32} />,
                title: t.feat1_title,
                desc: t.feat1_desc,
                color: "bg-emerald-50 text-emerald-600"
              },
              {
                icon: <Mic size={32} />,
                title: t.feat2_title,
                desc: t.feat2_desc,
                color: "bg-emerald-50 text-emerald-600"
              },
              {
                icon: <Users size={32} />,
                title: t.feat4_title,
                desc: t.feat4_desc,
                color: "bg-purple-50 text-purple-600"
              }
            ].map((feature, idx) => (
              <motion.div 
                key={idx}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: idx * 0.1 }}
                className="bg-slate-50 rounded-3xl p-8 border border-slate-100 hover:shadow-xl hover:-translate-y-1 transition-all"
              >
                <div className={`w-16 h-16 rounded-2xl flex items-center justify-center mb-6 ${feature.color}`}>
                  {feature.icon}
                </div>
                <h3 className="text-xl font-bold text-slate-900 mb-3">{feature.title}</h3>
                <p className="text-slate-600 leading-relaxed">{feature.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="py-20 bg-slate-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold text-slate-900 mb-4">{t.how_title}</h2>
            <p className="text-lg text-slate-600">{t.how_desc}</p>
          </div>

          <div className="grid md:grid-cols-3 gap-8 relative">
            <div className="hidden md:block absolute top-1/2 left-0 right-0 h-0.5 bg-slate-200 -translate-y-1/2 z-0"></div>
            
            {[
              { step: "1", title: t.step1_title, desc: t.step1_desc },
              { step: "2", title: t.step2_title, desc: t.step2_desc },
              { step: "3", title: t.step3_title, desc: t.step3_desc }
            ].map((item, idx) => (
              <motion.div 
                key={idx}
                initial={{ opacity: 0, scale: 0.9 }}
                whileInView={{ opacity: 1, scale: 1 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: idx * 0.2 }}
                className="relative z-10 bg-white p-8 rounded-3xl shadow-sm border border-slate-100 text-center"
              >
                <div className="w-12 h-12 bg-emerald-600 text-white rounded-full flex items-center justify-center text-xl font-bold mx-auto mb-6 shadow-lg shadow-emerald-200">
                  {item.step}
                </div>
                <h3 className="text-xl font-bold text-slate-900 mb-3">{item.title}</h3>
                <p className="text-slate-600">{item.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 bg-emerald-600 relative overflow-hidden">
        <div className="absolute inset-0 opacity-10">
          <svg className="w-full h-full" viewBox="0 0 100 100" preserveAspectRatio="none">
            <path d="M0,0 L100,0 L100,100 L0,100 Z" fill="url(#pattern)" />
            <defs>
              <pattern id="pattern" width="10" height="10" patternUnits="userSpaceOnUse">
                <circle cx="2" cy="2" r="1" fill="white" />
              </pattern>
            </defs>
          </svg>
        </div>
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10 text-center">
          <h2 className="text-3xl sm:text-5xl font-bold text-white mb-6">{t.cta_title}</h2>
          <p className="text-xl text-emerald-100 mb-10">{t.cta_desc}</p>
          <button 
            onClick={() => handleStart('signup')}
            disabled={isLoading}
            className={`inline-flex items-center gap-2 bg-white text-emerald-700 px-8 py-4 rounded-full font-bold text-lg hover:bg-emerald-50 transition-all shadow-xl hover:shadow-2xl hover:-translate-y-1 disabled:opacity-50 ${isRtl ? 'flex-row-reverse' : 'flex-row'}`}
          >
            <span>{t.cta_btn}</span>
            {isRtl ? <ArrowLeft size={20} /> : <ArrowRight size={20} />}
          </button>
        </div>
      </section>

      {/* Legal & Warning Section */}
      <section id="legal" className="py-16 bg-white border-t border-slate-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid md:grid-cols-3 gap-12">
            <div className={`p-6 rounded-2xl bg-amber-50 border border-amber-100 ${isRtl ? 'text-right' : 'text-left'}`}>
              <div className="flex items-center gap-2 text-amber-700 font-bold mb-3">
                <ShieldCheck size={20} />
                <span>{t.warning?.split(':')[0] || 'Warning'}</span>
              </div>
              <p className="text-amber-800 text-sm leading-relaxed">
                {t.warning}
              </p>
            </div>
            
            <div id="privacy" className={isRtl ? 'text-right' : 'text-left'}>
              <h3 className="font-bold text-slate-900 mb-4">{t.privacy_policy}</h3>
              <p className="text-slate-600 text-sm leading-relaxed">
                {t.privacy_desc}
              </p>
            </div>

            <div id="terms" className={isRtl ? 'text-right' : 'text-left'}>
              <h3 className="font-bold text-slate-900 mb-4">{t.terms_of_use}</h3>
              <p className="text-slate-600 text-sm leading-relaxed">
                {t.terms_desc}
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-slate-900 text-slate-400 py-12 text-center">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-center gap-2 mb-6 opacity-50 grayscale">
            <img src="/logo.svg" alt={`${t.app_name} Logo`} className="w-8 h-8 object-contain" />
            <span className="font-bold text-xl text-white">{t.app_name}</span>
          </div>
          <p className="mb-6">{t.footer_rights} &copy; {new Date().getFullYear()} {t.app_name}</p>
          <div className="flex justify-center gap-6 text-sm">
            <a href="#privacy" className="hover:text-white transition-colors">{t.footer_privacy}</a>
            <a href="#terms" className="hover:text-white transition-colors">{t.footer_terms}</a>
            <a href="#" className="hover:text-white transition-colors">{t.footer_contact}</a>
          </div>
        </div>
      </footer>

      {/* TV Login Modal */}
      {isTVModalOpen && tvSessionId && (
        <div className="fixed inset-0 z-[2000] flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-sm">
          <motion.div 
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            className="bg-white rounded-[2.5rem] shadow-2xl max-w-lg w-full p-8 relative overflow-hidden"
          >
            <button 
              onClick={() => setIsTVModalOpen(false)}
              className="absolute top-6 right-6 text-slate-400 hover:text-slate-600 transition-colors"
            >
              <X size={24} />
            </button>

            <div className="text-center">
              <div className="w-16 h-16 bg-emerald-100 rounded-2xl flex items-center justify-center text-emerald-600 mx-auto mb-6">
                <Monitor size={32} />
              </div>
              <h2 className="text-2xl font-bold text-slate-900 mb-2">
                {lang === 'ar' ? 'تسجيل الدخول عبر الهاتف' : 'Login via Phone'}
              </h2>
              <p className="text-slate-600 mb-8">
                {lang === 'ar' 
                  ? 'امسح الرمز أدناه بهاتفك لتسجيل الدخول مباشرة على التلفاز' 
                  : 'Scan the code below with your phone to login directly on the TV'}
              </p>

              <div className="bg-slate-50 p-6 rounded-3xl inline-block border-4 border-emerald-50 mb-8">
                <QRCodeSVG 
                  value={`${window.location.origin}/tv-login?sessionId=${tvSessionId}`}
                  size={200}
                  level="H"
                  includeMargin={false}
                />
              </div>

              <div className="space-y-4">
                <div className="flex items-center justify-center gap-3 text-emerald-600 font-bold">
                  <div className="w-2 h-2 bg-emerald-500 rounded-full animate-ping"></div>
                  <span>{lang === 'ar' ? 'في انتظار المسح...' : 'Waiting for scan...'}</span>
                </div>
                <p className="text-xs text-slate-400">
                  {lang === 'ar' 
                    ? 'بمجرد تسجيل الدخول من هاتفك، ستفتح هذه الشاشة تلقائياً.' 
                    : 'Once you login from your phone, this screen will open automatically.'}
                </p>
              </div>
            </div>
          </motion.div>
        </div>
      )}

      {/* Authentication Modal (Google & Email/Password Choice) */}
      <AuthModal
        isOpen={isAuthModalOpen}
        onClose={() => setIsAuthModalOpen(false)}
        onSuccess={() => navigate('/app')}
        lang={lang}
        initialMode={authModalMode}
      />
    </div>
  );
}
