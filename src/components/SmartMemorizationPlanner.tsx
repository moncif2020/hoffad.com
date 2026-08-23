import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Calendar, CheckCircle2, Clock, Sparkles, Target, Compass, 
  ChevronLeft, ChevronRight, BookOpen, Award, ArrowRight, 
  RotateCcw, Flame, Bell, ShieldCheck, Share2, Check, RefreshCw,
  Book, Mic, CalendarDays, BarChart3, AlertCircle
} from 'lucide-react';
import { QURAN_SURAHS } from '../lib/quran';

export interface PlanConfig {
  id: string;
  level: 'beginner' | 'intermediate' | 'advanced' | 'custom';
  dailyPaceType: 'lines' | 'pages' | 'verses';
  dailyPaceAmount: number; // e.g. 3 lines, 0.5 pages, 5 verses
  targetType: 'full_quran' | 'juz_amma' | 'juz_tabarak' | 'surah_baqarah' | 'custom_surah';
  targetSurahNumber?: number;
  durationYears?: number; // for long-term target (e.g. 2, 3, 5)
  startDate: string; // ISO date
  restDay: number; // 5 for Friday, -1 for none
  enableSpacedRepetition: boolean;
  createdAt: number;
}

export interface PlanProgress {
  currentDayIndex: number;
  completedDays: Record<string, boolean>; // 'YYYY-MM-DD': true
  streak: number;
  lastCompletedDate?: string;
  totalVersesMemorized: number;
}

interface SmartMemorizationPlannerProps {
  onBack?: () => void;
  lang?: string;
  onNavigateToMushaf?: (page?: number) => void;
  onNavigateToRecite?: (surahNum?: number) => void;
  onOpenShareModal?: (config: { surahName?: string; ayahRange?: string; defaultTitle?: string; defaultText?: string }) => void;
}

const DEFAULT_PLAN: PlanConfig = {
  id: 'default_quran_plan',
  level: 'intermediate',
  dailyPaceType: 'pages',
  dailyPaceAmount: 0.5,
  targetType: 'full_quran',
  durationYears: 3,
  startDate: new Date().toISOString().split('T')[0],
  restDay: 5, // Friday
  enableSpacedRepetition: true,
  createdAt: Date.now()
};

export function SmartMemorizationPlanner({
  onBack,
  lang = 'ar',
  onNavigateToMushaf,
  onNavigateToRecite,
  onOpenShareModal
}: SmartMemorizationPlannerProps) {
  const isAr = lang === 'ar';

  // State
  const [hasExistingPlan, setHasExistingPlan] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<'plan_dashboard' | 'setup_wizard' | 'schedule_view'>('plan_dashboard');
  const [wizardStep, setWizardStep] = useState<1 | 2 | 3>(1);

  // Plan Form State
  const [plan, setPlan] = useState<PlanConfig>(() => {
    try {
      const saved = localStorage.getItem('hoffad_memorization_plan');
      if (saved) {
        return JSON.parse(saved);
      }
    } catch (e) {
      console.warn("Failed to load plan:", e);
    }
    return DEFAULT_PLAN;
  });

  const [progress, setProgress] = useState<PlanProgress>(() => {
    try {
      const saved = localStorage.getItem('hoffad_plan_progress');
      if (saved) {
        return JSON.parse(saved);
      }
    } catch (e) {
      console.warn("Failed to load progress:", e);
    }
    return {
      currentDayIndex: 1,
      completedDays: {},
      streak: 0,
      totalVersesMemorized: 0
    };
  });

  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  // Check existing plan on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem('hoffad_memorization_plan');
      if (saved) {
        setHasExistingPlan(true);
        setActiveTab('plan_dashboard');
      } else {
        setHasExistingPlan(false);
        setActiveTab('setup_wizard');
      }
    } catch (e) {
      setActiveTab('setup_wizard');
    }
  }, []);

  // Save plan to localStorage
  const savePlan = (newPlan: PlanConfig) => {
    try {
      localStorage.setItem('hoffad_memorization_plan', JSON.stringify(newPlan));
      setPlan(newPlan);
      setHasExistingPlan(true);
      setActiveTab('plan_dashboard');
      showToast(isAr ? 'تم حفظ وضبط خطة الحفظ بنجاح! بارك الله في همتك.' : 'Memorization plan saved successfully!');
    } catch (e) {
      console.error("Save plan error:", e);
    }
  };

  // Save progress
  const saveProgress = (newProgress: PlanProgress) => {
    try {
      localStorage.setItem('hoffad_plan_progress', JSON.stringify(newProgress));
      setProgress(newProgress);
    } catch (e) {
      console.error("Save progress error:", e);
    }
  };

  // Calculations
  const planStats = useMemo(() => {
    let totalUnits = 604; // default pages for full quran
    let unitName = isAr ? 'صفحة' : 'pages';

    if (plan.targetType === 'juz_amma') {
      totalUnits = 23; // ~23 pages (582-604)
    } else if (plan.targetType === 'juz_tabarak') {
      totalUnits = 20; // pages (562-581)
    } else if (plan.targetType === 'surah_baqarah') {
      totalUnits = 48; // ~48 pages
    } else if (plan.targetType === 'custom_surah' && plan.targetSurahNumber) {
      const s = QURAN_SURAHS.find(x => x.number === plan.targetSurahNumber);
      if (s) {
        totalUnits = Math.max(1, Math.ceil(s.numberOfAyahs / 15));
      }
    }

    // Daily pace in pages
    let paceInPages = 0.5;
    if (plan.dailyPaceType === 'pages') {
      paceInPages = plan.dailyPaceAmount;
    } else if (plan.dailyPaceType === 'lines') {
      paceInPages = plan.dailyPaceAmount / 15; // 15 lines per standard Madinah mushaf page
    } else if (plan.dailyPaceType === 'verses') {
      paceInPages = plan.dailyPaceAmount / 10; // average ~10 verses per page
    }

    // Account for weekly rest day (e.g. 6 days active per week)
    const activeDaysPerWeek = plan.restDay >= 0 ? 6 : 7;
    const weeklyPacePages = paceInPages * activeDaysPerWeek;
    const totalWeeksNeeded = Math.ceil(totalUnits / Math.max(0.1, weeklyPacePages));
    const totalDaysNeeded = Math.ceil((totalUnits / Math.max(0.01, paceInPages)) * (7 / activeDaysPerWeek));

    // Expected Finish Date
    const start = new Date(plan.startDate || new Date());
    const finishDate = new Date(start.getTime() + totalDaysNeeded * 24 * 60 * 60 * 1000);
    
    // Formatting date
    const dateOptions: Intl.DateTimeFormatOptions = { 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    };
    const formattedFinish = finishDate.toLocaleDateString(isAr ? 'ar-SA' : 'en-US', dateOptions);

    // Completion percentage
    const completedCount = Object.keys(progress.completedDays).length;
    const completionPercent = Math.min(100, Math.round((completedCount / Math.max(1, totalDaysNeeded)) * 100));

    return {
      totalUnits,
      unitName,
      paceInPages,
      totalDaysNeeded,
      totalWeeksNeeded,
      formattedFinish,
      completionPercent,
      completedCount
    };
  }, [plan, progress, isAr]);

  // Today's date string YYYY-MM-DD
  const todayStr = new Date().toISOString().split('T')[0];
  const isTodayCompleted = Boolean(progress.completedDays[todayStr]);

  // Toggle Today Completion
  const toggleTodayCompletion = () => {
    const newCompleted = { ...progress.completedDays };
    let newStreak = progress.streak;

    if (newCompleted[todayStr]) {
      delete newCompleted[todayStr];
      newStreak = Math.max(0, newStreak - 1);
      showToast(isAr ? 'تم إلغاء تحديد ورد اليوم' : 'Marked as uncompleted');
    } else {
      newCompleted[todayStr] = true;
      newStreak = (progress.streak || 0) + 1;
      showToast(isAr ? '🎉 هنيئاً لك إتمام ورد اليوم! ثبّت الله القرآن في صدرك.' : '🎉 Great job! Today’s wird completed.');
    }

    saveProgress({
      ...progress,
      completedDays: newCompleted,
      streak: newStreak,
      lastCompletedDate: todayStr
    });
  };

  // Helper for Surah Target Names
  const getTargetTitle = () => {
    switch (plan.targetType) {
      case 'full_quran': return isAr ? 'القرآن الكريم كاملاً (٣٠ جزءاً)' : 'Full Holy Quran (30 Juz)';
      case 'juz_amma': return isAr ? 'جزء عمّ (٣٧ سورة قصيرة)' : 'Juz Amma (37 Surahs)';
      case 'juz_tabarak': return isAr ? 'جزء تبارك (١١ سورة)' : 'Juz Tabarak (11 Surahs)';
      case 'surah_baqarah': return isAr ? 'سورة البقرة المباركة' : 'Surah Al-Baqarah';
      case 'custom_surah': {
        const s = QURAN_SURAHS.find(x => x.number === plan.targetSurahNumber);
        return s ? (isAr ? `سورة ${s.name}` : `Surah ${s.englishName}`) : (isAr ? 'سورة مخصصة' : 'Custom Surah');
      }
      default: return isAr ? 'القرآن الكريم' : 'Holy Quran';
    }
  };

  // Helper for Pace Text
  const getPaceDescription = () => {
    if (plan.dailyPaceType === 'lines') {
      return isAr ? `${plan.dailyPaceAmount} أسطر يومياً` : `${plan.dailyPaceAmount} lines daily`;
    }
    if (plan.dailyPaceType === 'pages') {
      if (plan.dailyPaceAmount === 0.5) return isAr ? 'نصف صفحة يومياً' : 'Half page daily';
      if (plan.dailyPaceAmount === 1) return isAr ? 'صفحة كاملة يومياً' : '1 page daily';
      if (plan.dailyPaceAmount === 2) return isAr ? 'صفحتان (وجهان) يومياً' : '2 pages daily';
      return isAr ? `${plan.dailyPaceAmount} صفحة يومياً` : `${plan.dailyPaceAmount} pages daily`;
    }
    return isAr ? `${plan.dailyPaceAmount} آيات يومياً` : `${plan.dailyPaceAmount} verses daily`;
  };

  return (
    <div className="w-full max-w-5xl mx-auto py-3 sm:py-6 px-3 sm:px-6" dir={isAr ? 'rtl' : 'ltr'}>
      {/* Toast Notification */}
      <AnimatePresence>
        {toastMessage && (
          <motion.div
            initial={{ opacity: 0, y: -20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -20, scale: 0.95 }}
            className="fixed top-5 left-1/2 -translate-x-1/2 z-50 bg-emerald-900 text-emerald-100 px-5 py-3 rounded-2xl shadow-2xl border border-emerald-500/40 flex items-center gap-3 text-sm sm:text-base font-bold backdrop-blur-md"
          >
            <Sparkles className="text-amber-400 size-5 shrink-0" />
            <span>{toastMessage}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Top Header & Breadcrumb */}
      <div className="flex items-center justify-between gap-4 mb-6 pb-4 border-b border-emerald-100 dark:border-emerald-900/40">
        <div className="flex items-center gap-3">
          {onBack && (
            <button
              onClick={onBack}
              className="p-2.5 rounded-full hover:bg-emerald-100/60 dark:hover:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 transition-colors"
              title={isAr ? 'رجوع' : 'Back'}
            >
              {isAr ? <ChevronRight size={22} /> : <ChevronLeft size={22} />}
            </button>
          )}
          <div>
            <div className="flex items-center gap-2">
              <Compass className="text-emerald-600 dark:text-emerald-400 size-6" />
              <h1 className="text-xl sm:text-2xl font-black text-slate-800 dark:text-slate-100">
                {isAr ? 'خطة الحفظ الذكية والمراجعة المؤتمتة' : 'Smart Quran Memorization Planner'}
              </h1>
            </div>
            <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-0.5">
              {isAr ? 'جدولة ذكية لورد الحفظ والمراجعة التراكمية وفق مستواك وهدفك' : 'Adaptive schedule with spaced repetition tailored to your pace'}
            </p>
          </div>
        </div>

        {/* View Switcher if plan exists */}
        {hasExistingPlan && (
          <div className="flex items-center gap-2 bg-slate-100 dark:bg-slate-800/80 p-1 rounded-2xl border border-slate-200 dark:border-slate-700">
            <button
              onClick={() => setActiveTab('plan_dashboard')}
              className={`px-3 py-1.5 rounded-xl text-xs sm:text-sm font-bold transition-all ${
                activeTab === 'plan_dashboard'
                  ? 'bg-emerald-600 text-white shadow-md'
                  : 'text-slate-600 dark:text-slate-300 hover:text-emerald-600'
              }`}
            >
              {isAr ? 'لوحة المتابعة' : 'Dashboard'}
            </button>
            <button
              onClick={() => {
                setActiveTab('setup_wizard');
                setWizardStep(1);
              }}
              className={`px-3 py-1.5 rounded-xl text-xs sm:text-sm font-bold transition-all ${
                activeTab === 'setup_wizard'
                  ? 'bg-emerald-600 text-white shadow-md'
                  : 'text-slate-600 dark:text-slate-300 hover:text-emerald-600'
              }`}
            >
              {isAr ? 'تعديل الخطة' : 'Edit Plan'}
            </button>
          </div>
        )}
      </div>

      {/* VIEW 1: PLAN DASHBOARD */}
      {activeTab === 'plan_dashboard' && hasExistingPlan && (
        <div className="space-y-6">
          {/* Main Hero Card */}
          <div className="relative overflow-hidden bg-gradient-to-br from-emerald-800 via-emerald-700 to-teal-900 text-white p-6 sm:p-8 rounded-[32px] shadow-xl shadow-emerald-900/10 border border-emerald-600/30">
            {/* Islamic Watermark */}
            <div className="absolute top-0 right-0 p-8 opacity-10 pointer-events-none">
              <BookOpen size={240} />
            </div>

            <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
              <div className="space-y-3">
                <div className="inline-flex items-center gap-2 bg-emerald-500/30 backdrop-blur-md px-3.5 py-1 rounded-full text-xs font-black text-amber-300 border border-emerald-400/30">
                  <Target size={14} />
                  <span>{getTargetTitle()}</span>
                </div>

                <h2 className="text-2xl sm:text-3xl font-black leading-snug">
                  {isAr ? 'الورد اليومي لحفظ كتاب الله' : 'Your Daily Quran Goal'}
                </h2>

                <div className="flex flex-wrap items-center gap-3 text-xs sm:text-sm text-emerald-100">
                  <span className="bg-white/10 px-3 py-1 rounded-xl">
                    ⚡ {getPaceDescription()}
                  </span>
                  <span className="bg-white/10 px-3 py-1 rounded-xl">
                    📅 {isAr ? `الختم التقديري: ${planStats.formattedFinish}` : `Est. Completion: ${planStats.formattedFinish}`}
                  </span>
                  <span className="bg-white/10 px-3 py-1 rounded-xl">
                    🔄 {isAr ? 'المراجعة المؤتمتة مفعلة' : 'Spaced repetition active'}
                  </span>
                </div>
              </div>

              {/* Action Button: Complete Today */}
              <div className="flex flex-col items-center gap-2.5">
                <button
                  onClick={toggleTodayCompletion}
                  className={`w-full md:w-auto px-6 py-4 rounded-2xl font-black text-base sm:text-lg flex items-center justify-center gap-3 transition-all transform active:scale-95 shadow-xl ${
                    isTodayCompleted
                      ? 'bg-amber-400 text-amber-950 hover:bg-amber-300 ring-4 ring-amber-400/30'
                      : 'bg-white text-emerald-900 hover:bg-emerald-50 ring-4 ring-white/20'
                  }`}
                >
                  <CheckCircle2 size={24} className={isTodayCompleted ? 'text-amber-950' : 'text-emerald-600'} />
                  <span>{isTodayCompleted ? (isAr ? 'أتممت ورد اليوم بنجاح ✓' : 'Completed Today ✓') : (isAr ? 'تأكيد إتمام ورد اليوم' : 'Mark Today as Done')}</span>
                </button>

                <p className="text-[11px] text-emerald-200 font-medium">
                  {isTodayCompleted ? (isAr ? 'تم تثبيت إنجاز اليوم في سجلك' : 'Logged into your streak') : (isAr ? 'اضغط عند إنهاء الحفظ والمراجعة' : 'Tap once you finish recitation')}
                </p>
              </div>
            </div>

            {/* Progress Bar inside Card */}
            <div className="mt-8 pt-6 border-t border-white/10">
              <div className="flex justify-between items-center text-xs font-bold mb-2">
                <span>{isAr ? 'نسبة التقدم الإجمالية' : 'Overall Completion Progress'}</span>
                <span>{planStats.completionPercent}% ({planStats.completedCount} {isAr ? 'أيام منجزة' : 'days'})</span>
              </div>
              <div className="w-full h-3 bg-black/20 rounded-full overflow-hidden p-0.5">
                <motion.div 
                  initial={{ width: 0 }}
                  animate={{ width: `${planStats.completionPercent}%` }}
                  transition={{ duration: 1, ease: 'easeOut' }}
                  className="h-full bg-gradient-to-r from-amber-400 to-emerald-300 rounded-full"
                />
              </div>
            </div>
          </div>

          {/* Triple Schedule Breakdown: (1. الحفظ الجديد | 2. المراجعة الصغرى | 3. المراجعة الكبرى) */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Card 1: New Memorization */}
            <div className="bg-white dark:bg-slate-800 p-5 rounded-3xl border border-emerald-100 dark:border-emerald-900/50 shadow-sm flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-xl bg-emerald-100 dark:bg-emerald-900/60 flex items-center justify-center text-emerald-700 dark:text-emerald-300 font-bold">
                      ١
                    </div>
                    <h3 className="font-black text-slate-800 dark:text-slate-100 text-base">
                      {isAr ? 'الحفظ الجديد اليومي' : '1. New Memorization'}
                    </h3>
                  </div>
                  <span className="text-[10px] font-bold bg-emerald-50 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 px-2 py-0.5 rounded-full border border-emerald-200">
                    {isAr ? 'الأساس' : 'Core'}
                  </span>
                </div>
                <p className="text-xs text-slate-600 dark:text-slate-400 mb-4 leading-relaxed">
                  {isAr 
                    ? `مقدار ورد اليوم: ${getPaceDescription()}. ركّز على التكرار السليم ٥ مرات قبل الانتقال للآية التالية.`
                    : `Today's quota: ${getPaceDescription()}. Repeat each verse 5 times with proper tajweed.`
                  }
                </p>
              </div>

              <div className="flex items-center gap-2 pt-3 border-t border-slate-100 dark:border-slate-700">
                {onNavigateToMushaf && (
                  <button
                    onClick={() => onNavigateToMushaf()}
                    className="flex-1 flex items-center justify-center gap-1.5 py-2 bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 rounded-xl text-xs font-bold transition-colors"
                  >
                    <Book size={14} />
                    <span>{isAr ? 'فتح المصحف' : 'Open Mushaf'}</span>
                  </button>
                )}
                {onNavigateToRecite && (
                  <button
                    onClick={() => onNavigateToRecite()}
                    className="flex-1 flex items-center justify-center gap-1.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-colors shadow-sm"
                  >
                    <Mic size={14} />
                    <span>{isAr ? 'تسميع ذكي' : 'AI Recite'}</span>
                  </button>
                )}
              </div>
            </div>

            {/* Card 2: Recent Review */}
            <div className="bg-white dark:bg-slate-800 p-5 rounded-3xl border border-teal-100 dark:border-teal-900/50 shadow-sm flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-xl bg-teal-100 dark:bg-teal-900/60 flex items-center justify-center text-teal-700 dark:text-teal-300 font-bold">
                      ٢
                    </div>
                    <h3 className="font-black text-slate-800 dark:text-slate-100 text-base">
                      {isAr ? 'المراجعة الصغرى (القريبة)' : '2. Recent Review'}
                    </h3>
                  </div>
                  <span className="text-[10px] font-bold bg-teal-50 dark:bg-teal-950 text-teal-700 dark:text-teal-300 px-2 py-0.5 rounded-full border border-teal-200">
                    {isAr ? 'تثبيت' : 'Solidify'}
                  </span>
                </div>
                <p className="text-xs text-slate-600 dark:text-slate-400 mb-4 leading-relaxed">
                  {isAr 
                    ? 'مراجعة ما تم حفظه خلال آخر ٥ إلى ٧ أيام دون انقطاع، لمنع تفلت الحفظ الجديد وضمان ربطه بالسياق.'
                    : 'Review the memorization of the last 5-7 days continuously to prevent short-term forgetting.'
                  }
                </p>
              </div>

              <div className="pt-3 border-t border-slate-100 dark:border-slate-700 flex items-center justify-between text-xs text-teal-700 dark:text-teal-400 font-bold">
                <span className="flex items-center gap-1">
                  <Clock size={14} />
                  <span>{isAr ? 'المدة المقترحة: ١٠ دقائق' : 'Est: 10 mins'}</span>
                </span>
                <span className="text-[11px] bg-teal-100 dark:bg-teal-900/50 px-2 py-0.5 rounded-md">
                  {isAr ? 'تكرار غيباً' : 'By Memory'}
                </span>
              </div>
            </div>

            {/* Card 3: Spaced Repetition (Cumulative Review) */}
            <div className="bg-white dark:bg-slate-800 p-5 rounded-3xl border border-amber-100 dark:border-amber-900/50 shadow-sm flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-xl bg-amber-100 dark:bg-amber-900/60 flex items-center justify-center text-amber-700 dark:text-amber-300 font-bold">
                      ٣
                    </div>
                    <h3 className="font-black text-slate-800 dark:text-slate-100 text-base">
                      {isAr ? 'المراجعة الكبرى (المؤتمتة)' : '3. Cumulative Revision'}
                    </h3>
                  </div>
                  <span className="text-[10px] font-bold bg-amber-50 dark:bg-amber-950 text-amber-700 dark:text-amber-300 px-2 py-0.5 rounded-full border border-amber-200">
                    {isAr ? 'تمكين دائم' : 'Long-Term'}
                  </span>
                </div>
                <p className="text-xs text-slate-600 dark:text-slate-400 mb-4 leading-relaxed">
                  {isAr 
                    ? 'جدول تكرار متباعد يمر بك على كامل الأجزاء والمحفوظات السابقة كل شهر، ليبقى القرآن حاضراً كالفاتحة.'
                    : 'Systematic spaced repetition passing through older juz every month to ensure permanent retention.'
                  }
                </p>
              </div>

              <div className="pt-3 border-t border-slate-100 dark:border-slate-700 flex items-center justify-between text-xs text-amber-700 dark:text-amber-400 font-bold">
                <span className="flex items-center gap-1">
                  <Flame size={14} className="text-amber-500" />
                  <span>{isAr ? `سلسلة الالتزام: ${progress.streak} أيام` : `Streak: ${progress.streak} days`}</span>
                </span>
                {onOpenShareModal && (
                  <button
                    onClick={() => {
                      onOpenShareModal({
                        surahName: getTargetTitle(),
                        ayahRange: getPaceDescription(),
                        defaultTitle: isAr ? 'خطة الحفظ والورد اليومي في منصة حُفّاظ' : 'Hoffad Memorization Plan',
                        defaultText: isAr 
                          ? `الحمد لله، ألتزم بخطة حفظ ${getTargetTitle()} بمعدل ${getPaceDescription()} على منصة حُفّاظ الذكية.`
                          : `Committed to my Quran memorization plan on Hoffad App!`
                      });
                    }}
                    className="p-1.5 hover:bg-amber-50 dark:hover:bg-amber-900/40 rounded-lg text-amber-700 transition-colors"
                    title={isAr ? 'مشاركة بطاقة الخطة' : 'Share Plan Card'}
                  >
                    <Share2 size={16} />
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Quick Settings Bar */}
          <div className="bg-slate-50 dark:bg-slate-800/60 p-4 sm:p-5 rounded-3xl border border-slate-200 dark:border-slate-700 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300 rounded-2xl">
                <CalendarDays size={22} />
              </div>
              <div>
                <p className="font-bold text-sm text-slate-800 dark:text-slate-100">
                  {isAr ? 'يوم الراحة والمراجعة الشاملة:' : 'Weekly Rest / Review Day:'}
                </p>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {plan.restDay === 5 
                    ? (isAr ? 'يوم الجمعة (مخصص لقراءة سورة الكهف والمراجعة العامة)' : 'Friday (Dedicated to Surah Al-Kahf & General Review)')
                    : (isAr ? 'بدون انقطاع (٧ أيام أسبوعياً)' : '7 Days Active')
                  }
                </p>
              </div>
            </div>

            <button
              onClick={() => {
                setActiveTab('setup_wizard');
                setWizardStep(1);
              }}
              className="px-4 py-2 bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 hover:border-emerald-500 rounded-xl text-xs font-bold text-slate-700 dark:text-slate-200 flex items-center gap-2 transition-all shadow-sm"
            >
              <RefreshCw size={14} />
              <span>{isAr ? 'إعادة ضبط الخطة والمستوى' : 'Recalibrate Plan & Level'}</span>
            </button>
          </div>
        </div>
      )}

      {/* VIEW 2: SETUP WIZARD (الخطوات الثلاث لإنشاء/تعديل الخطة) */}
      {(activeTab === 'setup_wizard' || !hasExistingPlan) && (
        <div className="bg-white dark:bg-slate-800 p-6 sm:p-8 rounded-[32px] border border-slate-100 dark:border-slate-700 shadow-xl space-y-8">
          {/* Wizard Step Indicators */}
          <div className="flex items-center justify-between max-w-xl mx-auto relative">
            <div className="absolute top-1/2 left-0 right-0 h-1 bg-slate-100 dark:bg-slate-700 -translate-y-1/2 z-0" />
            
            {[
              { num: 1, label: isAr ? '١. تقييم مستواك' : '1. Level Assessment' },
              { num: 2, label: isAr ? '٢. تحديد الهدف' : '2. Target Goal' },
              { num: 3, label: isAr ? '٣. وتيرة الحفظ' : '3. Daily Pace' }
            ].map(step => (
              <div 
                key={step.num} 
                onClick={() => setWizardStep(step.num as any)}
                className="relative z-10 flex flex-col items-center gap-1 cursor-pointer"
              >
                <div 
                  className={`w-10 h-10 rounded-full flex items-center justify-center font-black text-sm transition-all ${
                    wizardStep === step.num
                      ? 'bg-emerald-600 text-white ring-4 ring-emerald-100 dark:ring-emerald-900/60 shadow-lg'
                      : wizardStep > step.num
                      ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/60 dark:text-emerald-300'
                      : 'bg-slate-100 dark:bg-slate-700 text-slate-400'
                  }`}
                >
                  {wizardStep > step.num ? <Check size={18} /> : step.num}
                </div>
                <span className={`text-xs font-bold ${wizardStep === step.num ? 'text-emerald-700 dark:text-emerald-400' : 'text-slate-500'}`}>
                  {step.label}
                </span>
              </div>
            ))}
          </div>

          {/* STEP 1: تقييم المستوى الحالي */}
          {wizardStep === 1 && (
            <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="space-y-6">
              <div className="text-center max-w-lg mx-auto space-y-2">
                <h2 className="text-xl sm:text-2xl font-black text-slate-800 dark:text-slate-100">
                  {isAr ? '📊 الخطوة الأولى: تقييم مستواك الحالي' : '📊 Step 1: Assess Your Current Level'}
                </h2>
                <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400">
                  {isAr ? 'اختر المستوى الأنسب لظروفك ووقتك لضمان الاستمرارية وعدم الانقطاع:' : 'Select the level matching your daily schedule for long-term consistency:'}
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* Level 1: Beginner */}
                <div 
                  onClick={() => {
                    setPlan({ ...plan, level: 'beginner', dailyPaceType: 'lines', dailyPaceAmount: 3, targetType: 'juz_amma' });
                  }}
                  className={`p-6 rounded-3xl border-2 transition-all cursor-pointer flex flex-col justify-between ${
                    plan.level === 'beginner'
                      ? 'border-emerald-500 bg-emerald-50/70 dark:bg-emerald-950/40 shadow-md ring-2 ring-emerald-500/20'
                      : 'border-slate-200 dark:border-slate-700 hover:border-emerald-300'
                  }`}
                >
                  <div>
                    <div className="w-12 h-12 rounded-2xl bg-emerald-100 dark:bg-emerald-900/50 flex items-center justify-center text-emerald-700 dark:text-emerald-300 font-bold mb-4 text-xl">
                      🌱
                    </div>
                    <h3 className="font-black text-lg text-slate-800 dark:text-slate-100 mb-2">
                      {isAr ? 'مبتدئ (البدايات المباركة)' : 'Beginner (Gentle Pace)'}
                    </h3>
                    <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                      {isAr 
                        ? '• البدء بالسور القصيرة (جزء عم).\n• بمعدل ٢ إلى ٣ أسطر يومياً.\n• مثالي للمبتدئين والأطفال ومن لديهم وقت محدود.'
                        : '• Focus on short Surahs (Juz Amma).\n• 2 to 3 lines daily.\n• Ideal for starters and busy schedules.'
                      }
                    </p>
                  </div>
                  <div className="mt-4 pt-3 border-t border-emerald-200/50 flex justify-between items-center text-xs font-bold text-emerald-700">
                    <span>{isAr ? 'المقترح: جزء عمّ' : 'Suggested: Juz Amma'}</span>
                    {plan.level === 'beginner' && <CheckCircle2 size={18} />}
                  </div>
                </div>

                {/* Level 2: Intermediate */}
                <div 
                  onClick={() => {
                    setPlan({ ...plan, level: 'intermediate', dailyPaceType: 'pages', dailyPaceAmount: 0.5, targetType: 'full_quran', durationYears: 3 });
                  }}
                  className={`p-6 rounded-3xl border-2 transition-all cursor-pointer flex flex-col justify-between ${
                    plan.level === 'intermediate'
                      ? 'border-emerald-500 bg-emerald-50/70 dark:bg-emerald-950/40 shadow-md ring-2 ring-emerald-500/20'
                      : 'border-slate-200 dark:border-slate-700 hover:border-emerald-300'
                  }`}
                >
                  <div>
                    <div className="w-12 h-12 rounded-2xl bg-teal-100 dark:bg-teal-900/50 flex items-center justify-center text-teal-700 dark:text-teal-300 font-bold mb-4 text-xl">
                      🌿
                    </div>
                    <h3 className="font-black text-lg text-slate-800 dark:text-slate-100 mb-2">
                      {isAr ? 'متوسط (التثبيت والتجويد)' : 'Intermediate (Steady Pace)'}
                    </h3>
                    <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                      {isAr 
                        ? '• بمعدل نصف صفحة يومياً (٧-٨ أسطر).\n• إتقان القواعد الأساسية للتجويد.\n• خطة متوازنة لختم القرآن خلال سنتين إلى ٣ سنوات.'
                        : '• Half a page daily (~7-8 lines).\n• Master tajweed foundations.\n• Balanced 2-3 year completion plan.'
                      }
                    </p>
                  </div>
                  <div className="mt-4 pt-3 border-t border-teal-200/50 flex justify-between items-center text-xs font-bold text-teal-700">
                    <span>{isAr ? 'المقترح: نصف صفحة' : 'Suggested: 1/2 page'}</span>
                    {plan.level === 'intermediate' && <CheckCircle2 size={18} />}
                  </div>
                </div>

                {/* Level 3: Advanced */}
                <div 
                  onClick={() => {
                    setPlan({ ...plan, level: 'advanced', dailyPaceType: 'pages', dailyPaceAmount: 1, targetType: 'full_quran', durationYears: 2 });
                  }}
                  className={`p-6 rounded-3xl border-2 transition-all cursor-pointer flex flex-col justify-between ${
                    plan.level === 'advanced'
                      ? 'border-emerald-500 bg-emerald-50/70 dark:bg-emerald-950/40 shadow-md ring-2 ring-emerald-500/20'
                      : 'border-slate-200 dark:border-slate-700 hover:border-emerald-300'
                  }`}
                >
                  <div>
                    <div className="w-12 h-12 rounded-2xl bg-amber-100 dark:bg-amber-900/50 flex items-center justify-center text-amber-700 dark:text-amber-300 font-bold mb-4 text-xl">
                      🌳
                    </div>
                    <h3 className="font-black text-lg text-slate-800 dark:text-slate-100 mb-2">
                      {isAr ? 'متقدم (روتين الحفظ المكثف)' : 'Advanced (Intensive Pace)'}
                    </h3>
                    <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                      {isAr 
                        ? '• صفحة كاملة أو أكثر يومياً.\n• روتين حفظ يومي قوي ومراجعة مضاعفة.\n• مثالي لطلاب الحلقات والمشاريع القرآنية السريعة.'
                        : '• 1 page or more daily.\n• Strong dedicated routine.\n• Ideal for full-time memorizers.'
                      }
                    </p>
                  </div>
                  <div className="mt-4 pt-3 border-t border-amber-200/50 flex justify-between items-center text-xs font-bold text-amber-700">
                    <span>{isAr ? 'المقترح: صفحة كاملة' : 'Suggested: 1 page'}</span>
                    {plan.level === 'advanced' && <CheckCircle2 size={18} />}
                  </div>
                </div>
              </div>

              <div className="flex justify-end pt-4">
                <button
                  onClick={() => setWizardStep(2)}
                  className="px-8 py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-black rounded-2xl shadow-lg flex items-center gap-2 transition-all"
                >
                  <span>{isAr ? 'المتابعة لتحديد الهدف' : 'Next: Set Target'}</span>
                  {isAr ? <ChevronLeft size={20} /> : <ChevronRight size={20} />}
                </button>
              </div>
            </motion.div>
          )}

          {/* STEP 2: تحديد هدفك الزمني */}
          {wizardStep === 2 && (
            <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="space-y-6">
              <div className="text-center max-w-lg mx-auto space-y-2">
                <h2 className="text-xl sm:text-2xl font-black text-slate-800 dark:text-slate-100">
                  {isAr ? '⏱️ الخطوة الثانية: تحديد هدفك القرآني والزمني' : '⏱️ Step 2: Set Your Target Goal'}
                </h2>
                <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400">
                  {isAr ? 'هل هدفك حفظ سورة معينة أم ختم القرآن الكريم كاملاً؟' : 'Choose a specific Surah/Juz or the full Quran:'}
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                {/* Option A: Short Term Plan (سورة معينة أو جزء) */}
                <div className="p-6 bg-slate-50 dark:bg-slate-800/80 rounded-3xl border border-slate-200 dark:border-slate-700 space-y-4">
                  <div className="flex items-center gap-2 text-emerald-700 dark:text-emerald-400 font-black">
                    <Target size={20} />
                    <h3>{isAr ? 'أ. خطة قصيرة المدى (أجزاء أو سور مختارة)' : 'A. Short-Term Goal (Selected Parts)'}</h3>
                  </div>

                  <div className="space-y-2.5">
                    {[
                      { id: 'juz_amma', label: isAr ? 'جزء عمّ (الجزء ٣٠ - ٣٧ سورة)' : 'Juz Amma (Juz 30)' },
                      { id: 'juz_tabarak', label: isAr ? 'جزء تبارك (الجزء ٢٩ - ١١ سورة)' : 'Juz Tabarak (Juz 29)' },
                      { id: 'surah_baqarah', label: isAr ? 'سورة البقرة المباركة (أطول سور القرآن)' : 'Surah Al-Baqarah' }
                    ].map(item => (
                      <button
                        key={item.id}
                        onClick={() => setPlan({ ...plan, targetType: item.id as any })}
                        className={`w-full text-start p-3.5 rounded-2xl text-xs sm:text-sm font-bold border transition-all flex items-center justify-between ${
                          plan.targetType === item.id
                            ? 'bg-emerald-600 text-white border-emerald-600 shadow-md'
                            : 'bg-white dark:bg-slate-700 border-slate-200 dark:border-slate-600 text-slate-700 dark:text-slate-200 hover:border-emerald-400'
                        }`}
                      >
                        <span>{item.label}</span>
                        {plan.targetType === item.id && <Check size={18} />}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Option B: Long Term Plan (ختم القرآن كاملاً) */}
                <div className="p-6 bg-emerald-50/50 dark:bg-emerald-950/20 rounded-3xl border border-emerald-200 dark:border-emerald-800/40 space-y-4">
                  <div className="flex items-center gap-2 text-emerald-800 dark:text-emerald-300 font-black">
                    <BookOpen size={20} />
                    <h3>{isAr ? 'ب. خطة طويلة المدى (ختم القرآن كاملاً)' : 'B. Long-Term Goal (Full Quran)'}</h3>
                  </div>

                  <div className="space-y-2.5">
                    {[
                      { years: 2, label: isAr ? 'ختم في سنتين (معدل صفحة يومياً)' : 'Complete in 2 Years (~1 page/day)' },
                      { years: 3, label: isAr ? 'ختم في ٣ سنوات (معدل نصف صفحة يومياً)' : 'Complete in 3 Years (~1/2 page/day)' },
                      { years: 5, label: isAr ? 'ختم في ٥ سنوات (معدل ربع صفحة مريح)' : 'Complete in 5 Years (~1/4 page/day)' }
                    ].map(item => (
                      <button
                        key={item.years}
                        onClick={() => setPlan({ 
                          ...plan, 
                          targetType: 'full_quran', 
                          durationYears: item.years,
                          dailyPaceType: 'pages',
                          dailyPaceAmount: item.years === 2 ? 1 : item.years === 3 ? 0.5 : 0.25
                        })}
                        className={`w-full text-start p-3.5 rounded-2xl text-xs sm:text-sm font-bold border transition-all flex items-center justify-between ${
                          plan.targetType === 'full_quran' && plan.durationYears === item.years
                            ? 'bg-emerald-600 text-white border-emerald-600 shadow-md'
                            : 'bg-white dark:bg-slate-700 border-slate-200 dark:border-slate-600 text-slate-700 dark:text-slate-200 hover:border-emerald-400'
                        }`}
                      >
                        <span>{item.label}</span>
                        {plan.targetType === 'full_quran' && plan.durationYears === item.years && <Check size={18} />}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="flex justify-between pt-4">
                <button
                  onClick={() => setWizardStep(1)}
                  className="px-6 py-3 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 text-slate-700 dark:text-slate-200 font-bold rounded-2xl transition-all"
                >
                  {isAr ? 'السابق' : 'Previous'}
                </button>

                <button
                  onClick={() => setWizardStep(3)}
                  className="px-8 py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-black rounded-2xl shadow-lg flex items-center gap-2 transition-all"
                >
                  <span>{isAr ? 'المتابعة لضبط الوتيرة والمراجعة' : 'Next: Pace & Review'}</span>
                  {isAr ? <ChevronLeft size={20} /> : <ChevronRight size={20} />}
                </button>
              </div>
            </motion.div>
          )}

          {/* STEP 3: ضبط وتيرة الحفظ والمراجعة المؤتمتة */}
          {wizardStep === 3 && (
            <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="space-y-6">
              <div className="text-center max-w-lg mx-auto space-y-2">
                <h2 className="text-xl sm:text-2xl font-black text-slate-800 dark:text-slate-100">
                  {isAr ? '🔄 الخطوة الثالثة: ضبط وتيرة الحفظ والمراجعة المؤتمتة' : '🔄 Step 3: Pace & Automated Spaced Repetition'}
                </h2>
                <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400">
                  {isAr ? 'حدد مقدار الحفظ اليومي الدقيق وتفعيل نظام المراجعة الذكي:' : 'Customize your exact daily amount and automated reminders:'}
                </p>
              </div>

              {/* Pace Selector Controls */}
              <div className="p-6 bg-slate-50 dark:bg-slate-800/80 rounded-3xl border border-slate-200 dark:border-slate-700 space-y-5">
                <div>
                  <label className="block text-xs font-black text-slate-700 dark:text-slate-200 uppercase tracking-wider mb-2">
                    {isAr ? 'وحدة الحفظ اليومي:' : 'Daily Unit:'}
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { id: 'lines', label: isAr ? 'بالأسطر (Lines)' : 'Lines' },
                      { id: 'pages', label: isAr ? 'بالصفحات (Pages)' : 'Pages' },
                      { id: 'verses', label: isAr ? 'بالآيات (Verses)' : 'Verses' }
                    ].map(u => (
                      <button
                        key={u.id}
                        onClick={() => {
                          const defaultAmount = u.id === 'lines' ? 3 : u.id === 'pages' ? 0.5 : 5;
                          setPlan({ ...plan, dailyPaceType: u.id as any, dailyPaceAmount: defaultAmount });
                        }}
                        className={`py-2.5 px-3 rounded-xl text-xs font-bold transition-all border ${
                          plan.dailyPaceType === u.id
                            ? 'bg-emerald-600 text-white border-emerald-600'
                            : 'bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-200 border-slate-200 dark:border-slate-600'
                        }`}
                      >
                        {u.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Amount Slider */}
                <div>
                  <div className="flex justify-between items-center mb-2">
                    <label className="text-xs font-black text-slate-700 dark:text-slate-200">
                      {isAr ? 'المقدار اليومي:' : 'Daily Amount:'}
                    </label>
                    <span className="text-sm font-black text-emerald-700 dark:text-emerald-400 bg-emerald-100 dark:bg-emerald-950 px-3 py-1 rounded-xl">
                      {getPaceDescription()}
                    </span>
                  </div>

                  {plan.dailyPaceType === 'lines' && (
                    <input 
                      type="range" 
                      min="1" 
                      max="15" 
                      step="1" 
                      value={plan.dailyPaceAmount}
                      onChange={(e) => setPlan({ ...plan, dailyPaceAmount: Number(e.target.value) })}
                      className="w-full accent-emerald-600 h-2 bg-slate-200 dark:bg-slate-700 rounded-lg cursor-pointer"
                    />
                  )}

                  {plan.dailyPaceType === 'pages' && (
                    <input 
                      type="range" 
                      min="0.25" 
                      max="5" 
                      step="0.25" 
                      value={plan.dailyPaceAmount}
                      onChange={(e) => setPlan({ ...plan, dailyPaceAmount: Number(e.target.value) })}
                      className="w-full accent-emerald-600 h-2 bg-slate-200 dark:bg-slate-700 rounded-lg cursor-pointer"
                    />
                  )}

                  {plan.dailyPaceType === 'verses' && (
                    <input 
                      type="range" 
                      min="1" 
                      max="30" 
                      step="1" 
                      value={plan.dailyPaceAmount}
                      onChange={(e) => setPlan({ ...plan, dailyPaceAmount: Number(e.target.value) })}
                      className="w-full accent-emerald-600 h-2 bg-slate-200 dark:bg-slate-700 rounded-lg cursor-pointer"
                    />
                  )}
                </div>

                {/* Spaced Repetition Toggle */}
                <div className="pt-4 border-t border-slate-200 dark:border-slate-700 flex items-center justify-between">
                  <div className="space-y-0.5">
                    <p className="font-bold text-sm text-slate-800 dark:text-slate-100">
                      {isAr ? 'تفعيل نظام المراجعة المؤتمتة (Spaced Repetition)' : 'Automated Spaced Repetition'}
                    </p>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      {isAr ? 'يقوم الذكاء الاصطناعي بجدولة تذكيرات للمحفوظات السابقة تلقائياً حتى لا تنساها' : 'Auto-schedules previous memorization so you never forget'}
                    </p>
                  </div>

                  <input 
                    type="checkbox" 
                    checked={plan.enableSpacedRepetition}
                    onChange={(e) => setPlan({ ...plan, enableSpacedRepetition: e.target.checked })}
                    className="w-5 h-5 accent-emerald-600 rounded cursor-pointer"
                  />
                </div>
              </div>

              {/* Calculated Summary Box */}
              <div className="p-5 bg-emerald-50 dark:bg-emerald-950/30 rounded-2xl border border-emerald-200 dark:border-emerald-800/40 text-xs sm:text-sm text-emerald-900 dark:text-emerald-200 flex items-center gap-3 font-bold">
                <Sparkles className="text-amber-500 size-6 shrink-0" />
                <div>
                  <p>{isAr ? `تاريخ الختم التقديري لهدفك: ${planStats.formattedFinish}` : `Estimated Goal Completion: ${planStats.formattedFinish}`}</p>
                  <p className="text-xs font-normal text-emerald-700 dark:text-emerald-300 mt-0.5">
                    {isAr 
                      ? `بإجمالي ${planStats.totalDaysNeeded} يوماً (${planStats.totalWeeksNeeded} أسبوعاً) من الحفظ الراسخ والمراجعة.`
                      : `Total of ${planStats.totalDaysNeeded} active days with continuous spaced review.`
                    }
                  </p>
                </div>
              </div>

              <div className="flex justify-between pt-4">
                <button
                  onClick={() => setWizardStep(2)}
                  className="px-6 py-3 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 text-slate-700 dark:text-slate-200 font-bold rounded-2xl transition-all"
                >
                  {isAr ? 'السابق' : 'Previous'}
                </button>

                <button
                  onClick={() => savePlan(plan)}
                  className="px-8 py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-black rounded-2xl shadow-xl flex items-center gap-2 transition-all transform active:scale-95"
                >
                  <Check size={20} />
                  <span>{isAr ? 'اعتماد وبدء الخطة الآن' : 'Save & Start Plan'}</span>
                </button>
              </div>
            </motion.div>
          )}
        </div>
      )}
    </div>
  );
}
