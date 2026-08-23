import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Check, Star, Sparkles, X, Zap, ShieldCheck, Cloud, Cpu, HelpCircle } from 'lucide-react';
import { translations } from '../translations';
import { auth, db } from '../firebase';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';

interface UpgradeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  lang: string;
  isPremium?: boolean;
}

export const UpgradeModal: React.FC<UpgradeModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  lang,
  isPremium = false
}) => {
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'yearly'>('yearly');
  const [isProcessing, setIsProcessing] = useState(false);
  const [showSuccessToast, setShowSuccessToast] = useState(false);

  const t = translations[lang] || translations['ar'];
  const isRtl = lang === 'ar' || lang === 'ur' || lang === 'fa';

  if (!isOpen) return null;

  const handleSubscribe = async () => {
    setIsProcessing(true);
    try {
      if (auth.currentUser) {
        const userDocRef = doc(db, 'users', auth.currentUser.uid);
        await setDoc(userDocRef, {
          displayName: auth.currentUser.displayName || 'حافظ القرآن',
          subscription: {
            status: 'active',
            plan: billingCycle === 'yearly' ? 'pro_yearly' : 'pro_monthly',
            updatedAt: serverTimestamp()
          },
          updatedAt: serverTimestamp()
        }, { merge: true });
      }
    } catch (e) {
      console.warn("Subscription sync deferred:", e);
    }

    setTimeout(() => {
      setIsProcessing(false);
      setShowSuccessToast(true);
      setTimeout(() => {
        onSuccess();
        onClose();
      }, 1400);
    }, 1000);
  };

  const proFeatures = [
    {
      title: lang === 'ar' ? 'استخراج وتحليل غير محدود بالذكاء الاصطناعي' : 'Unlimited AI Quran & Text Extraction',
      desc: lang === 'ar' ? 'مسح الصور والتفريغ الصوتي للمقاطع بجودة فائقة دون أي قيود' : 'Extract from photos & audio with Gemini AI without limits',
      icon: <Cpu className="text-emerald-500" size={20} />
    },
    {
      title: lang === 'ar' ? 'مزامنة ونسخ احتياطي سحابي كامل' : 'Full Cloud Sync & Backup',
      desc: lang === 'ar' ? 'حفظ تقدمك والدروس وقوائمك على كافة هواتفك وحاسوبك تلقائياً' : 'Access your lessons, scores & progress across all devices',
      icon: <Cloud className="text-emerald-500" size={20} />
    },
    {
      title: lang === 'ar' ? 'الرفع السريع للشاشات والأجهزة عن بُعد' : 'High-Speed Remote & TV Upload',
      desc: lang === 'ar' ? 'ربط مباشر وسلس لنقل الملفات من الجوال إلى التلفاز والحاسوب' : 'Instant QR sync to broadcast lessons to smart TVs & tablets',
      icon: <Zap className="text-emerald-500" size={20} />
    },
    {
      title: lang === 'ar' ? 'شارة المشترك الذهبي وأولوية الخوادم' : 'VIP Golden Badge & Fast Servers',
      desc: lang === 'ar' ? 'تميّز في لوحة الشرف وأولوية معالجة فورية فائقة السرعة' : 'Stand out on the leaderboard with dedicated cloud bandwidth',
      icon: <Star className="text-amber-500" size={20} />
    }
  ];

  const freeFeatures = [
    lang === 'ar' ? 'تصفح المصحف كاملاً بجميع الروايات والتفاسير' : 'Full Quran reader with all recitations & Tafseer',
    lang === 'ar' ? 'الاستماع لكافة القراء والتحميل بدون إنترنت' : 'Listen & download all reciters offline',
    lang === 'ar' ? 'التسميع الصوتي واكتشاف الأخطاء محلياً' : 'Interactive voice recitation & speech check',
    lang === 'ar' ? 'ألعاب الحفظ (الترتيب، الفراغات، وبنك الذاكرة)' : 'Memorization games & smart study planner'
  ];

  return (
    <AnimatePresence>
      <div 
        className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-md overflow-y-auto"
        dir={isRtl ? 'rtl' : 'ltr'}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.94, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.94, y: 20 }}
          className="relative w-full max-w-2xl bg-white rounded-3xl sm:rounded-[36px] shadow-2xl border border-slate-100 overflow-hidden my-6"
        >
          {/* Header Glow Banner */}
          <div className="relative bg-gradient-to-br from-emerald-600 via-emerald-700 to-teal-800 text-white p-6 sm:p-8 text-center overflow-hidden">
            <button
              onClick={onClose}
              className="absolute top-4 end-4 p-2 bg-white/15 hover:bg-white/25 rounded-full transition-colors text-white outline-none focus:ring-2 focus:ring-white/40"
              aria-label="Close modal"
            >
              <X size={20} />
            </button>

            <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-amber-400/20 border border-amber-300/40 rounded-full text-amber-300 font-bold text-xs sm:text-sm mb-3">
              <Sparkles size={16} />
              <span>{lang === 'ar' ? 'خطة الحفّاظ المتميزة (Hoffad Pro)' : 'Hoffad Pro Membership'}</span>
            </div>

            <h2 className="text-2xl sm:text-3xl font-black mb-2">
              {lang === 'ar' ? 'أطلق العنان لقوة الذكاء الاصطناعي في الحفظ' : 'Supercharge Your Quran Journey'}
            </h2>
            <p className="text-emerald-100 text-sm sm:text-base max-w-lg mx-auto opacity-90">
              {lang === 'ar' 
                ? 'استمتع بكافة إمكانيات الذكاء الاصطناعي والمزامنة السحابية غير المحدودة لحسابك ولعائلتك.'
                : 'Unlock limitless AI extractions, multi-device backup and VIP fast processing.'}
            </p>
          </div>

          <div className="p-6 sm:p-8 space-y-6">
            {/* Billing Toggle Switch */}
            <div className="flex items-center justify-center">
              <div className="inline-flex p-1.5 bg-slate-100 rounded-2xl border border-slate-200">
                <button
                  type="button"
                  onClick={() => setBillingCycle('monthly')}
                  className={`px-5 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all ${
                    billingCycle === 'monthly'
                      ? 'bg-white text-slate-800 shadow-md shadow-slate-200'
                      : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  {lang === 'ar' ? 'اشتراك شهري' : 'Monthly'}
                </button>
                <button
                  type="button"
                  onClick={() => setBillingCycle('yearly')}
                  className={`relative px-5 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all flex items-center gap-2 ${
                    billingCycle === 'yearly'
                      ? 'bg-emerald-600 text-white shadow-md shadow-emerald-700/30'
                      : 'text-slate-600 hover:text-emerald-700'
                  }`}
                >
                  <span>{lang === 'ar' ? 'اشتراك سنوي' : 'Yearly'}</span>
                  <span className={`text-[10px] font-black px-2 py-0.5 rounded-full ${
                    billingCycle === 'yearly' ? 'bg-amber-400 text-amber-950' : 'bg-emerald-100 text-emerald-800'
                  }`}>
                    {lang === 'ar' ? 'وفر 40% 🔥' : 'Save 40% 🔥'}
                  </span>
                </button>
              </div>
            </div>

            {/* Pricing Card Display */}
            <div className="bg-gradient-to-b from-slate-50 to-emerald-50/40 p-6 rounded-2xl sm:rounded-3xl border border-emerald-100 text-center relative">
              <div className="flex items-baseline justify-center gap-2">
                <span className="text-4xl sm:text-5xl font-black text-slate-900">
                  {billingCycle === 'yearly' ? '$36.00' : '$5.00'}
                </span>
                <span className="text-slate-500 font-bold text-sm sm:text-base">
                  {billingCycle === 'yearly' 
                    ? (lang === 'ar' ? '/ سنوياً (فقط 3$ شهرياً)' : '/ year ($3.00/mo)') 
                    : (lang === 'ar' ? '/ شهرياً' : '/ month')}
                </span>
              </div>
              
              {billingCycle === 'yearly' && (
                <p className="text-xs font-semibold text-emerald-700 mt-2">
                  {lang === 'ar' ? '🎉 يتم دفع 36$ سنوياً بدلاً من 60$ — وفر 24$ فوراً!' : '🎉 Billed $36/year instead of $60 — save $24 today!'}
                </p>
              )}
            </div>

            {/* Pro Features Grid */}
            <div>
              <h3 className="text-xs font-black uppercase tracking-wider text-slate-400 mb-3">
                {lang === 'ar' ? 'الميزات الاحترافية المشمولة في الباقة:' : 'What you get with Pro:'}
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {proFeatures.map((item, idx) => (
                  <div key={idx} className="flex items-start gap-3 p-3.5 bg-slate-50 hover:bg-emerald-50/50 rounded-2xl border border-slate-100 transition-colors">
                    <div className="p-2 bg-white rounded-xl shadow-xs shrink-0 mt-0.5">
                      {item.icon}
                    </div>
                    <div>
                      <h4 className="text-xs sm:text-sm font-bold text-slate-800 leading-snug">{item.title}</h4>
                      <p className="text-[11px] text-slate-500 mt-0.5 leading-relaxed">{item.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Always Free Features Guarantee */}
            <div className="p-4 bg-emerald-50/80 rounded-2xl border border-emerald-200/60">
              <div className="flex items-center gap-2 mb-2">
                <ShieldCheck size={18} className="text-emerald-700 shrink-0" />
                <h4 className="text-xs sm:text-sm font-bold text-emerald-900">
                  {lang === 'ar' ? 'وعد حُفّاظ: الأساسيات مجانية مدى الحياة' : 'Hoffad Promise: Core features remain 100% free'}
                </h4>
              </div>
              <ul className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 text-[11px] text-emerald-800">
                {freeFeatures.map((f, i) => (
                  <li key={i} className="flex items-center gap-1.5">
                    <Check size={14} className="text-emerald-600 shrink-0" />
                    <span>{f}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Action CTA Button */}
            <div className="space-y-2 pt-2">
              <button
                type="button"
                onClick={handleSubscribe}
                disabled={isProcessing}
                className="w-full py-4 px-6 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-black text-base sm:text-lg rounded-2xl shadow-lg shadow-emerald-700/25 transition-all transform active:scale-[0.99] flex items-center justify-center gap-2 disabled:opacity-75 cursor-pointer"
              >
                {isProcessing ? (
                  <div className="w-6 h-6 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <>
                    <Sparkles size={20} />
                    <span>
                      {isPremium 
                        ? (lang === 'ar' ? 'أنت مشترك بالفعل في الخطة الاحترافية ⭐' : 'You are currently a Pro Member ⭐')
                        : (lang === 'ar' 
                            ? (billingCycle === 'yearly' ? 'الاشتراك في الباقة السنوية (36$/سنة)' : 'الاشتراك في الباقة الشهرية (5$/شهر)')
                            : (billingCycle === 'yearly' ? 'Subscribe Yearly ($36/yr)' : 'Subscribe Monthly ($5/mo)'))
                      }
                    </span>
                  </>
                )}
              </button>

              <p className="text-[11px] text-center text-slate-400">
                {lang === 'ar' 
                  ? '🔒 دفع آمن ومشفر 100%. يمكنك إلغاء الاشتراك في أي وقت بضغطة زر دون أي التزام.'
                  : '🔒 Safe & Encrypted checkout. Cancel anytime with a single click.'}
              </p>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
