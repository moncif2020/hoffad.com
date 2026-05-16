import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { Cat, BookOpen, Settings, Coins, Heart, Trophy, Plus, Check, ArrowRight, RefreshCw, X, Mic, MicOff, ListOrdered, LayoutGrid, Eye, EyeOff, Book, Edit3, Loader2, Headphones, Play, Pause, Square, Volume2, TreePine, Leaf, Droplet, HeartHandshake, Utensils, Gift, Sprout, FileText, Languages, Moon, Sun, Download, Menu, ChevronDown, ChevronUp, Image as ImageIcon, Video, ShieldCheck, AlertCircle, Star, Sparkles, LogIn, LogOut, User as UserIcon, CheckCircle, Camera, Search } from 'lucide-react';
import { QURAN_SURAHS, fetchAyahs, downloadSurahAudio, downloadFullQuranAudio, getAudioUrl, isRangeDownloaded, safeJson } from './lib/quran';
import { MushafViewer } from './components/MushafViewer';
import { CustomSelect } from './components/CustomSelect';
import { QuranSearchInline } from './components/QuranSearchInline';
import { GoogleGenAI } from "@google/genai";
import { translations } from './translations';
import { Leaderboard } from './components/Leaderboard';
import { RecitationRecorder } from './components/RecitationRecorder';
import { ScoreService } from './services/scoreService';
import { diff_match_patch } from 'diff-match-patch';
import { useAudio } from './AudioContext';
import { useCallback } from 'react';

import { QRCodeSVG } from 'qrcode.react';
import { db, auth, storage, googleProvider } from './firebase';
import { collection, addDoc, onSnapshot, query, where, serverTimestamp, deleteDoc, doc, setDoc, getDoc, orderBy, updateDoc } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL, getBlob } from 'firebase/storage';
import { signInWithPopup, signOut, onAuthStateChanged, User, signInWithCustomToken } from 'firebase/auth';

// --- Alignment and Result Types ---
type SegmentType = 'correct' | 'substitution' | 'deletion' | 'insertion' | 'swapped';
interface AlignmentSegment {
  type: SegmentType;
  text: string; 
  originalText?: string;
  origIdx?: number;
  verseIdx?: number;
}
const devLog = (...args: any[]) => {
  if (import.meta.env.DEV) console.log(...args);
};

const devError = (...args: any[]) => {
  if (import.meta.env.DEV) console.error(...args);
};

const formatTime = (seconds: number) => {
  if (isNaN(seconds) || seconds === Infinity) return '0:00';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
};

// --- Types ---
type View = 'study' | 'parent' | 'game' | 'listen' | 'mushaf' | 'about' | 'upgrade' | 'leaderboard' | 'recorder';
type Lesson = { id: string; title: string; text: string; type?: 'quran' | 'custom'; audioUrl?: string; lang?: string };
type Language = string;

interface FirestoreErrorInfo {
  error: string;
  operationType: 'create' | 'update' | 'delete' | 'list' | 'get' | 'write';
  path: string | null;
  authInfo: {
    userId: string;
    email: string;
    emailVerified: boolean;
    isAnonymous: boolean;
    providerInfo: { providerId: string; displayName: string; email: string; }[];
  }
}

const handleFirestoreError = (error: any, operationType: any, path: string | null = null) => {
  const authInfo = auth.currentUser ? {
    userId: auth.currentUser.uid,
    email: auth.currentUser.email || '',
    emailVerified: auth.currentUser.emailVerified,
    isAnonymous: auth.currentUser.isAnonymous,
    providerInfo: auth.currentUser.providerData.map(p => ({
      providerId: p.providerId,
      displayName: p.displayName || '',
      email: p.email || ''
    }))
  } : {
    userId: 'unauthenticated',
    email: '',
    emailVerified: false,
    isAnonymous: false,
    providerInfo: []
  };

  const errorInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    operationType,
    path,
    authInfo
  };
  
  devError("Firestore Error:", errorInfo);
  
  // Show alert for debugging on production/vercel if needed (optional, but helpful for the user now)
  if (window.location.hostname !== 'localhost' && !import.meta.env.DEV) {
    const msg = errorInfo.error.includes('permission') 
      ? "تنبيه: فشل الوصول للبيانات (مشكلة في الصلاحيات). تأكد من إعدادات Firestore Rules." 
      : `خطأ في قاعدة البيانات: ${errorInfo.error}`;
    console.warn("UI Alerting via handleFirestoreError:", msg);
  }

  throw new Error(JSON.stringify(errorInfo));
};

const APP_LANGUAGES = [
  { code: 'ar', name: 'العربية', dir: 'rtl' },
  { code: 'en', name: 'English', dir: 'ltr' },
  { code: 'fr', name: 'Français', dir: 'ltr' },
  { code: 'es', name: 'Español', dir: 'ltr' },
  { code: 'zh', name: '中文', dir: 'ltr' },
  { code: 'hi', name: 'हिन्दी', dir: 'ltr' },
  { code: 'ur', name: 'اردو', dir: 'rtl' },
  { code: 'id', name: 'Bahasa Indonesia', dir: 'ltr' },
  { code: 'tr', name: 'Türkçe', dir: 'ltr' },
  { code: 'ru', name: 'Русский', dir: 'ltr' },
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

// Proxy to handle all 20 languages with English fallback for both language and specific keys
const t: any = new Proxy(translations, {
  get: (target, lang: string) => {
    const langData = target[lang] || target['en'];
    return new Proxy(langData, {
      get: (innerTarget, key: string) => {
        // Return the translation if it exists in the current language, 
        // otherwise fall back to the English version of that key, 
        // and if that's also missing, return an empty string to prevent .replace() errors.
        return innerTarget[key] || target['en'][key] || '';
      }
    });
  }
});

// --- Helper: Normalize Arabic Text for Comparison ---
const normalizeArabic = (text: string) => {
  if (!text) return '';
  
  // 1. Remove all Quranic marks, diacritics, and small Uthmani letters
  let normalized = text
    .replace(/[\u064B-\u065F\u0670\u06D6-\u06ED\u0640]/g, "") 
    
  // 2. Unicode Normalization
  normalized = normalized.normalize('NFD')
    .replace(/[\u0300-\u036f]/g, "")
    .normalize('NFC');
    
  // 3. Unify skeletal letters and remove Quranic ornaments/digits for comparison
  return normalized
    .replace(/[أإآٱء]/g, "ا")
    .replace(/ة/g, "ه")
    .replace(/[ىي]/g, "ي")
    .replace(/ؤ/g, "و")
    .replace(/ئ/g, "ي")
    .replace(/صلوه/g, "صلاه")
    .replace(/زكوه/g, "زكاه")
    .replace(/حيوة/g, "حياه")
    .replace(/نجوة/g, "نجاه")
    .replace(/ربوا/g, "ربا")
    .replace(/[\u060C\u061B\u061F\u06D4۝٠-٩0-9]/g, "") 
    .replace(/[^\u0600-\u06FF\s]/g, "") 
    .trim()
    .replace(/\s+/g, " ");
};

// Levenshtein distance for fuzzy matching
const getLevenshteinDistance = (a: string, b: string): number => {
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;
  const matrix = Array.from({ length: b.length + 1 }, (_, i) => [i]);
  for (let j = 0; j <= a.length; j++) matrix[0][j] = j;

  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b[i - 1] === a[j - 1]) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1
        );
      }
    }
  }
  return matrix[b.length][a.length];
};

// --- Reusable Custom Text Input Component ---
function CustomTextInput({ 
  text, 
  setText, 
  customLang, 
  setCustomLang, 
  onAction, 
  actionLabel, 
  actionIcon,
  lang,
  setLang,
  isParentMode = false
}: { 
  text: string, 
  setText: React.Dispatch<React.SetStateAction<string>>,
  customLang: string,
  setCustomLang: React.Dispatch<React.SetStateAction<string>>,
  onAction: () => void,
  actionLabel: string,
  actionIcon: React.ReactNode,
  lang: Language,
  setLang?: (l: Language) => void,
  isParentMode?: boolean
}) {
  const [extractingType, setExtractingType] = useState<'image' | 'audio' | 'video' | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const audioInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);

  const handleExtraction = async (file: File, type: 'image' | 'audio' | 'video') => {
    if (!file) return;

    if (file.size > 25 * 1024 * 1024) {
      alert(lang.startsWith('ar') ? "حجم الملف كبير جداً. يرجى رفع ملف أقل من 25 ميجابايت." : "File size is too large. Please upload a file smaller than 25MB.");
      return;
    }

    const apiKey = (import.meta as any).env?.VITE_GEMINI_API_KEY || 
                   process.env.GEMINI_API_KEY || 
                   process.env.VITE_GEMINI_API_KEY ||
                   (window as any).GEMINI_API_KEY;
    
    if (!apiKey || apiKey === "undefined" || apiKey === "" || apiKey === "null") {
      devError("Gemini API Key missing or invalid:", { 
        hasKey: !!apiKey, 
        value: apiKey ? "SET" : "EMPTY" 
      });
      alert(lang.startsWith('ar') ? "خطأ: لم يتم العثور على مفتاح API. يرجى التأكد من إعداد المفتاح في الإعدادات." : "Error: API key not found. Please ensure the key is set in settings.");
      return;
    }
    


    setExtractingType(type);
    setStatus(lang.startsWith('ar') ? "جاري معالجة الملف واستخراج النص..." : "Processing file and extracting text...");
    try {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      await new Promise<void>((resolve, reject) => {
        reader.onload = () => resolve();
        reader.onerror = error => reject(error);
      });

      const base64Data = (reader.result as string).split(',')[1];
      let mimeType = file.type;
      
      if (type === 'image' && !mimeType) mimeType = 'image/jpeg';
      if (type === 'audio' && !mimeType) {
        const ext = file.name.split('.').pop()?.toLowerCase();
        mimeType = ext === 'wav' ? 'audio/wav' : ext === 'm4a' ? 'audio/mp4' : 'audio/mpeg';
      } else if (type === 'audio' && mimeType === 'audio/mp3') {
        mimeType = 'audio/mpeg';
      }
      if (type === 'video' && !mimeType) mimeType = 'video/mp4';

      const ai = new GoogleGenAI({ apiKey });
      const prompt = type === 'image' 
        ? "استخرج النص من هذه الصورة بدقة. أعد النص فقط بدون أي إضافات أو تعليقات. إذا كان هناك نص عربي، حافظ على التشكيل إن وجد."
        : "استخرج النص من هذا المقطع بدقة (تفريغ صوتي). أعد النص فقط بدون أي إضافات أو تعليقات.";

      const result = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: { parts: [{ inlineData: { data: base64Data, mimeType } }, { text: prompt }] },
      });

      if (result.text) {
        setText(prev => prev ? prev + '\n\n' + result.text.trim() : result.text.trim());
        setStatus(lang.startsWith('ar') ? "تم استخراج النص بنجاح!" : "Text extracted successfully!");
      } else {
        throw new Error("لم يتم العثور على نص.");
      }
    } catch (error: any) {
      devError("Extraction Error:", error);
      setStatus(lang.startsWith('ar') ? "فشل استخراج النص." : "Failed to extract text.");
      alert(lang.startsWith('ar') ? `حدث خطأ أثناء استخراج النص: ${error?.message || error}` : `Error during extraction: ${error?.message || error}`);
    } finally {
      setExtractingType(null);
      setTimeout(() => setStatus(null), 3000);
      if (fileInputRef.current) fileInputRef.current.value = '';
      if (audioInputRef.current) audioInputRef.current.value = '';
      if (videoInputRef.current) videoInputRef.current.value = '';
    }
  };

  return (
    <div className="space-y-5">
      <div>
        <div className="flex flex-col items-center mb-4">
          <div className="flex gap-2 mb-2">
            <input type="file" accept="image/*" className="hidden" ref={fileInputRef} onChange={e => e.target.files?.[0] && handleExtraction(e.target.files[0], 'image')} />
            <button 
              onClick={() => fileInputRef.current?.click()}
              disabled={extractingType !== null}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 text-emerald-600 rounded-lg hover:bg-emerald-100 transition-colors text-sm font-medium disabled:opacity-50"
            >
              {extractingType === 'image' ? <Loader2 className="w-4 h-4 animate-spin" /> : <ImageIcon className="w-4 h-4" />}
              {lang.startsWith('ar') ? 'صورة' : 'Image'}
            </button>

            <input type="file" accept="audio/*" className="hidden" ref={audioInputRef} onChange={e => e.target.files?.[0] && handleExtraction(e.target.files[0], 'audio')} />
            <button 
              onClick={() => audioInputRef.current?.click()}
              disabled={extractingType !== null}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 text-emerald-600 rounded-lg hover:bg-emerald-100 transition-colors text-sm font-medium disabled:opacity-50"
            >
              {extractingType === 'audio' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Mic className="w-4 h-4" />}
              {lang.startsWith('ar') ? 'صوت' : 'Audio'}
            </button>

            <input type="file" accept="video/*" className="hidden" ref={videoInputRef} onChange={e => e.target.files?.[0] && handleExtraction(e.target.files[0], 'video')} />
            <button 
              onClick={() => videoInputRef.current?.click()}
              disabled={extractingType !== null}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 text-emerald-600 rounded-lg hover:bg-emerald-100 transition-colors text-sm font-medium disabled:opacity-50"
            >
              {extractingType === 'video' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Video className="w-4 h-4" />}
              {lang.startsWith('ar') ? 'فيديو' : 'Video'}
            </button>
          </div>
          {status && (
            <motion.p 
              initial={{ opacity: 0, y: -5 }} 
              animate={{ opacity: 1, y: 0 }} 
              className={`text-xs font-bold ${status.includes('فشل') || status.includes('Failed') ? 'text-red-500' : 'text-emerald-600'}`}
            >
              {status}
            </motion.p>
          )}
        </div>
        <div className="relative group">
          <textarea 
            value={text}
            onChange={e => setText(e.target.value)}
            placeholder={translations[lang]?.textPlaceholder || translations['en']?.textPlaceholder}
            className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-emerald-500 text-slate-700 font-medium min-h-[150px] resize-none"
            dir="auto"
          />
          <AnimatePresence>
            {text.length > 0 && (
              <motion.button
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.8 }}
                onClick={() => setText('')}
                className="absolute top-4 right-4 p-2 bg-white/90 hover:bg-white text-red-500 rounded-full shadow-lg backdrop-blur-sm transition-all border border-red-50 z-10 hover:scale-110 active:scale-95"
                title={lang.startsWith('ar') ? "مسح النص" : "Clear text"}
              >
                <X size={18} strokeWidth={2.5} />
              </motion.button>
            )}
          </AnimatePresence>
        </div>
        <p className="text-xs text-slate-400 mt-2">{translations[lang]?.textTip || translations['en']?.textTip}</p>
      </div>


      {!isParentMode && (
        <div className="mt-4">
          <label className="block text-sm font-bold text-slate-700 mb-2">{translations[lang]?.textLanguage || translations['en']?.textLanguage}</label>
          <CustomSelect 
            value={customLang} 
            onChange={(val) => {
              setCustomLang(val);
              if (setLang) setLang(val);
            }}
            options={APP_LANGUAGES.map(l => ({ value: l.code, label: l.name }))}
            lang={lang}
            placeholder={translations[lang]?.searchPlaceholder || '...'}
          />
        </div>
      )}

      <button 
        onClick={onAction}
        disabled={text.trim().length === 0}
        className="w-full bg-emerald-500 text-white font-bold text-lg py-4 rounded-2xl shadow-md shadow-emerald-200 flex items-center justify-center gap-2 mt-4 hover:bg-emerald-600 transition-colors disabled:opacity-70"
      >
        {actionIcon}
        {actionLabel}
      </button>
    </div>
  );
}

// --- Listen & Memorize Screen ---
function ListenScreen({ lang }: { lang: Language }) {
  const [listenMode, setListenMode] = useState<'quran' | 'custom'>('quran');

  // Quran State
  const [surahs, setSurahs] = useState<any[]>(QURAN_SURAHS);
  const [selectedSurah, setSelectedSurah] = useState<number | null>(null);
  const [fromAyah, setFromAyah] = useState<number>(1);
  const [toAyah, setToAyah] = useState<number>(1);
  const {
    playlist, setPlaylist,
    currentTrackIndex, setCurrentTrackIndex,
    isPlaying, setIsPlaying,
    isLoading, setIsLoading,
    playTrack, pause, resume, stop, startNewPlaylist,
    reciter, setReciter,
    repetitions, setRepetitions,
    rangeRepetitions, setRangeRepetitions,
    currentTime, duration, sessionTime, overallProgress
  } = useAudio();

  // Custom Text State
  const [customText, setCustomText] = useState<string>('');
  const [customLang, setCustomLang] = useState<string>('ar-SA');
  const [customReps, setCustomReps] = useState<number>(3);
  const [customRangeReps, setCustomRangeReps] = useState<number>(1);
  const [customPlaylist, setCustomPlaylist] = useState<string[]>([]);
  const [customCurrentIndex, setCustomCurrentIndex] = useState<number>(-1);
  const [isCurrentRangeDownloaded, setIsCurrentRangeDownloaded] = useState(false);

  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState(0);
  const [downloadingSurahName, setDownloadingSurahName] = useState('');
  const [showDownloadModal, setShowDownloadModal] = useState(false);
  const downloadAbortController = useRef<AbortController | null>(null);
  const [isTextSearchOpen, setIsTextSearchOpen] = useState(false);

  // Check if current range is already downloaded
  useEffect(() => {
    if (listenMode === 'quran') {
      isRangeDownloaded(selectedSurah, fromAyah, toAyah, reciter).then(setIsCurrentRangeDownloaded);
    }
  }, [selectedSurah, fromAyah, toAyah, reciter, listenMode]);

  const RECITERS = [
    { id: 'Husary_64kbps', name: 'محمود خليل الحصري (معلم)' },
    { id: 'Minshawy_Murattal_128kbps', name: 'محمد صديق المنشاوي' },
    { id: 'Alafasy_128kbps', name: 'مشاري العفاسي' },
    { id: 'Abdul_Basit_Murattal_64kbps', name: 'عبد الباسط عبد الصمد' },
    { id: 'Ghamadi_40kbps', name: 'سعد الغامدي' },
    { id: 'Maher_AlMuaiqly_64kbps', name: 'ماهر المعيقلي' },
    { id: 'https://server14.mp3quran.net/islam/Rewayat-Hafs-A-n-Assem/', name: 'إسلام صبحي' },
    { id: 'https://server9.mp3quran.net/omar_warsh/', name: 'عمر القزابري (المغرب)' },
    { id: 'https://server11.mp3quran.net/koshi/', name: 'العيون الكوشي (المغرب)' },
    { id: 'https://server16.mp3quran.net/souilass/Rewayat-Warsh-A-n-Nafi/', name: 'يونس اسويلص (المغرب)' },
    { id: 'https://server12.mp3quran.net/ifrad/', name: 'رشيد افراد (المغرب)' },
    { id: 'https://server6.mp3quran.net/bl3/Rewayat-Warsh-A-n-Nafi/', name: 'رشيد بلعالية (المغرب)' }
  ];

  useEffect(() => {
    // Cleanup custom audio on unmount
    return () => {
      window.speechSynthesis.cancel();
    };
  }, []);

  const handleSurahChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const s = Number(e.target.value);
    setSelectedSurah(s);
    setFromAyah(1);
    const surahData = surahs.find(x => x.number === s);
    setToAyah(surahData ? surahData.numberOfAyahs : 1);
  };

  const selectedSurahData = surahs.find(s => s.number === selectedSurah);
  const maxAyahs = selectedSurahData ? selectedSurahData.numberOfAyahs : 1;

  const handleDownloadSurah = async () => {
    if (selectedSurah === null) return;
    setIsDownloading(true);
    setDownloadProgress(0);
    setShowDownloadModal(false);
    downloadAbortController.current = new AbortController();
    
    try {
      const surahData = surahs.find(s => s.number === selectedSurah);
      setDownloadingSurahName(surahData?.name || '');
      
      await downloadSurahAudio(
        selectedSurah, 
        1, 
        surahData?.numberOfAyahs || 1, 
        reciter, 
        (progress) => setDownloadProgress(progress),
        downloadAbortController.current.signal
      );
      
      setIsCurrentRangeDownloaded(true);
      alert(t[lang].downloadComplete);
    } catch (err: any) {
      if (err.message !== 'Aborted') {
        console.error(err);
        alert(t[lang].downloadError);
      }
    } finally {
      setIsDownloading(false);
      setDownloadingSurahName('');
    }
  };

  const handleDownloadFullQuran = async () => {
    if (!confirm(t[lang].downloadFullWarning)) return;
    
    setIsDownloading(true);
    setDownloadProgress(0);
    setShowDownloadModal(false);
    downloadAbortController.current = new AbortController();
    
    try {
      await downloadFullQuranAudio(
        reciter,
        (progress, surahName) => {
          setDownloadProgress(progress);
          setDownloadingSurahName(surahName);
        },
        downloadAbortController.current.signal
      );
      
      setIsCurrentRangeDownloaded(true);
      alert(t[lang].downloadComplete);
    } catch (err: any) {
      if (err.message !== 'Aborted') {
        console.error(err);
        alert(t[lang].downloadError);
      }
    } finally {
      setIsDownloading(false);
      setDownloadingSurahName('');
    }
  };

  const cancelDownload = () => {
    if (downloadAbortController.current) {
      downloadAbortController.current.abort();
    }
  };

  const startListening = async (overrideSurah?: any, overrideFrom?: number, overrideTo?: number) => {
    // If the first argument is a React Event, ignore it
    const sId = (overrideSurah !== undefined && typeof overrideSurah === 'number') ? overrideSurah : selectedSurah;
    const fId = (overrideFrom !== undefined && typeof overrideFrom === 'number') ? overrideFrom : fromAyah;
    const tId = (overrideTo !== undefined && typeof overrideTo === 'number') ? overrideTo : toAyah;

    if (listenMode === 'quran') {
      if (sId === null) {
        alert(t[lang].chooseSurah || "Please choose a surah first");
        return;
      }
      setIsLoading(true);
      try {
        const data = await fetchAyahs(sId, fId, tId);
        const ayahs = data.ayahs;

        if (ayahs.length === 0) {
          setIsLoading(false);
          alert(t[lang].errorFetchingAyahs);
          return;
        }

        const newPlaylist: {url: string, text: string, surah: number, ayah: number}[] = [];

        // Build playlist: repeat each ayah X times, and repeat the whole range Y times
        for (let j = 0; j < rangeRepetitions; j++) {
          ayahs.forEach((ayah: any) => {
            for (let i = 0; i < repetitions; i++) {
              newPlaylist.push({
                url: getAudioUrl(reciter, sId, ayah.numberInSurah),
                text: ayah.text,
                surah: sId,
                ayah: ayah.numberInSurah
              });
            }
          });
        }

        startNewPlaylist(newPlaylist, 0);
      } catch (err) {
        devError(err);
        alert(t[lang].errorFetchingAyahs);
        setIsLoading(false);
      }
    } else {
      // Custom text start logic
      if (!customText.trim()) return;
      const sentences = customText.split(/[.،\n]+/).filter(s => s.trim().length > 0);
      const newPlaylist: string[] = [];
      
      for (let j = 0; j < customRangeReps; j++) {
        sentences.forEach(sentence => {
          for (let i = 0; i < customReps; i++) {
            newPlaylist.push(sentence.trim());
          }
        });
      }
      
      setCustomPlaylist(newPlaylist);
      setCustomCurrentIndex(0);
      setIsPlaying(true);
    }
  };

  const stopListening = () => {
    if (listenMode === 'quran') {
      stop();
    } else {
      window.speechSynthesis.cancel();
      setCustomCurrentIndex(-1);
      setCustomPlaylist([]);
      setIsPlaying(false);
    }
  };

  const togglePlayPause = () => {
    if (listenMode === 'quran') {
      if (isPlaying) {
        pause();
      } else {
        resume();
      }
    } else {
      if (isPlaying) {
        window.speechSynthesis.pause();
        setIsPlaying(false);
      } else {
        window.speechSynthesis.resume();
        setIsPlaying(true);
      }
    }
  };

  useEffect(() => {
    const handleGlobalKeys = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.code === 'Space') {
        e.preventDefault();
        togglePlayPause();
      } else if (e.key === 's' || e.key === 'S') {
        stopListening();
      }
    };
    window.addEventListener('keydown', handleGlobalKeys);
    return () => window.removeEventListener('keydown', handleGlobalKeys);
  }, [isPlaying, listenMode, customText, customReps, customRangeReps]);

  // Custom Text Effect
  useEffect(() => {
    if (listenMode !== 'custom') return;
    if (customCurrentIndex >= 0 && customCurrentIndex < customPlaylist.length) {
      window.speechSynthesis.cancel(); // cancel previous
      const text = customPlaylist[customCurrentIndex];
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = customLang;
      utterance.rate = 0.85; // Slightly slower for memorization
      
      utterance.onend = () => {
        setCustomCurrentIndex(prev => prev + 1);
      };
      utterance.onerror = (e) => {
        console.error("TTS Error", e);
        setCustomCurrentIndex(prev => prev + 1);
      };
      
      window.speechSynthesis.speak(utterance);
      setIsPlaying(true);
    } else if (customCurrentIndex >= customPlaylist.length && customPlaylist.length > 0) {
      stopListening();
    }
  }, [customCurrentIndex, customPlaylist, customLang, listenMode]);

  const startCustomListening = () => {
    window.speechSynthesis.cancel();
    // Split by newlines or periods to create chunks
    const chunks = customText.split(/\n|\./).map(s => s.trim()).filter(s => s.length > 0);
    if (chunks.length === 0) return;

    const newPlaylist: string[] = [];
    for (let j = 0; j < customRangeReps; j++) {
      chunks.forEach(chunk => {
        for (let i = 0; i < customReps; i++) {
          newPlaylist.push(chunk);
        }
      });
    }

    setCustomPlaylist(newPlaylist);
    setCustomCurrentIndex(0);
    setIsPlaying(true);
  };

  return (
    <div className="p-4 sm:p-6 pb-24 max-w-7xl mx-auto h-full overflow-y-auto">
      <div className="flex items-center gap-4 mb-8">
        <div className="bg-emerald-100 p-4 rounded-2xl shadow-sm">
          <Headphones className="text-emerald-600" size={32} />
        </div>
        <div>
          <h2 className="text-2xl sm:text-3xl font-bold text-slate-800">{t[lang].listenAndMemorizeTitle}</h2>
          <p className="text-slate-500 text-sm sm:text-base">{t[lang].listenAndMemorizeDesc}</p>
        </div>
      </div>

      {/* Mode Toggle */}
      <div className="flex bg-slate-200 p-1.5 rounded-2xl mb-8 shadow-inner max-w-2xl mx-auto">
        <button 
          onClick={() => { setListenMode('quran'); stopListening(); }}
          className={`flex-1 py-4 rounded-xl font-bold text-base transition-all focus:ring-2 focus:ring-emerald-500 outline-none ${listenMode === 'quran' ? 'bg-white text-emerald-600 shadow-md' : 'text-slate-500 hover:text-slate-700'}`}
        >
          {t[lang].quran}
        </button>
        <button 
          onClick={() => { setListenMode('custom'); stopListening(); }}
          className={`flex-1 py-4 rounded-xl font-bold text-base transition-all focus:ring-2 focus:ring-emerald-500 outline-none ${listenMode === 'custom' ? 'bg-white text-emerald-600 shadow-md' : 'text-slate-500 hover:text-slate-700'}`}
        >
          {t[lang].customTexts}
        </button>
      </div>

      {listenMode === 'quran' ? (
        playlist.length > 0 && currentTrackIndex >= 0 && currentTrackIndex < playlist.length ? (
          <motion.div 
            initial={{ opacity: 0, y: 20 }} 
            animate={{ opacity: 1, y: 0 }} 
            className="bg-white p-4 sm:p-8 rounded-[40px] shadow-2xl border border-slate-100 mb-8 flex flex-col gap-6"
          >
            {/* Player UI (Voice Note Style) */}
            <div className="w-full max-w-2xl mx-auto flex flex-col gap-4">
              <div className="flex items-center justify-between gap-4">
                 <h3 className="text-xl sm:text-2xl font-bold text-emerald-700 flex flex-wrap items-center gap-2">
                  <span className="font-arabic">{lang === 'ar' ? selectedSurahData?.name : `${selectedSurahData?.englishName} (${selectedSurahData?.name})`}</span>
                  <span className="text-lg sm:text-xl text-emerald-500 font-arabic">{t[lang].ayah} {playlist[currentTrackIndex].ayah}</span>
                </h3>
                
                <button 
                  onClick={stopListening}
                  className="p-3 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-full transition-all"
                  title={t[lang].stopListening || 'Stop'}
                >
                  <X size={24} />
                </button>
              </div>

              <div className="w-full bg-emerald-50/50 p-2 sm:p-2.5 rounded-full border border-emerald-100 flex items-center gap-3 sm:gap-4" style={{ direction: 'ltr' }}>
                <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-full overflow-hidden flex-shrink-0 bg-white border border-emerald-200 flex items-center justify-center p-2 shadow-sm">
                  <img src="/logo.svg" alt="Hoffad" className="w-full h-full object-contain" />
                </div>
                
                <button 
                  onClick={togglePlayPause}
                  className="w-10 h-10 sm:w-12 sm:h-12 bg-emerald-500 text-white rounded-full flex items-center justify-center flex-shrink-0 hover:bg-emerald-600 shadow-lg transition-all active:scale-95"
                >
                  {isPlaying ? <Pause size={24} fill="currentColor" /> : <Play size={24} fill="currentColor" className="ml-1" />}
                </button>
                
                <div className="flex-1 flex items-center gap-3 pr-2 sm:pr-4">
                  <div className="flex-1 h-1.5 bg-emerald-200/50 rounded-full overflow-hidden relative">
                    <motion.div 
                      className="absolute inset-y-0 left-0 bg-emerald-500"
                      animate={{ width: `${overallProgress}%` }}
                      transition={{ type: 'spring', bounce: 0, duration: 0.5 }}
                    />
                  </div>
                  <div className="text-xs sm:text-sm font-black text-emerald-600 font-mono min-w-[45px] text-right">
                    {formatTime(sessionTime)}
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-center gap-3">
                <div className="flex items-center gap-2 bg-emerald-100/50 px-4 py-1.5 rounded-full text-emerald-700 font-bold text-sm">
                  <span className="opacity-70">{t[lang].currentRepetition.split(':')[0]}</span>
                  <span>{(currentTrackIndex % repetitions) + 1} / {repetitions}</span>
                </div>
                {rangeRepetitions > 1 && (
                  <div className="flex items-center gap-2 bg-blue-100/50 px-4 py-1.5 rounded-full text-blue-700 font-bold text-sm">
                    <span className="opacity-70">{t[lang].currentRangeRepetition.split(':')[0]}</span>
                    <span>{Math.floor(currentTrackIndex / (playlist.length / rangeRepetitions)) + 1} / {rangeRepetitions}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Quran Text - Maximize space */}
            <div className="flex-1 w-full">
              <div className="bg-emerald-50/20 p-8 sm:p-12 rounded-[32px] border-2 border-emerald-100/50 w-full min-h-[300px] flex items-center justify-center shadow-inner mt-2">
                <p className="text-4xl sm:text-6xl leading-relaxed sm:leading-[1.8] font-arabic text-slate-800 text-center">
                  {playlist[currentTrackIndex].text} ۝
                </p>
              </div>
            </div>
          </motion.div>
        ) : (
          <div className="bg-white p-6 sm:p-10 rounded-[40px] shadow-lg border border-slate-100 space-y-8 max-w-4xl mx-auto">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              <div className="space-y-6">
                <button
                  type="button"
                  onClick={() => setIsTextSearchOpen(true)}
                  className="w-full bg-emerald-50/30 border-2 border-emerald-100/50 rounded-2xl py-4 px-6 text-right flex items-center justify-between hover:border-emerald-300 transition-all focus:border-emerald-500 outline-none shadow-sm group"
                  dir={lang === 'ar' ? 'rtl' : 'ltr'}
                >
                  <div className="flex items-center gap-3">
                    <Search className="text-emerald-500 group-hover:scale-110 transition-transform" size={24} />
                    <span className={`font-bold text-lg sm:text-xl ${selectedSurah ? 'text-slate-700' : 'text-slate-400'}`}>
                      {selectedSurah ? surahs.find(s => s.number === selectedSurah)?.name : t[lang].ayahSearchPlaceholder}
                    </span>
                  </div>
                  <ChevronDown className="text-emerald-300" size={24} />
                </button>

                  <div className="flex gap-4 sm:gap-6">
                    <div className="flex-1">
                      <label className="block text-sm font-bold text-slate-700 mb-2">{t[lang].fromAyah}</label>
                      <input 
                        type="number" min="1" max={toAyah} 
                        value={fromAyah} onChange={e => setFromAyah(Number(e.target.value))}
                        className="w-full p-4 bg-slate-50 border-2 border-slate-100 rounded-2xl focus:outline-none focus:ring-2 focus:ring-emerald-500 text-center font-bold text-xl"
                      />
                    </div>
                    <div className="flex-1">
                      <label className="block text-sm font-bold text-slate-700 mb-2">{t[lang].toAyah}</label>
                      <input 
                        type="number" min={fromAyah} max={maxAyahs} 
                        value={toAyah} onChange={e => setToAyah(Number(e.target.value))}
                        className="w-full p-4 bg-slate-50 border-2 border-slate-100 rounded-2xl focus:outline-none focus:ring-2 focus:ring-emerald-500 text-center font-bold text-xl"
                      />
                    </div>
                  </div>
                </div>

              <div className="space-y-6">
                <div>
                  <label className="block text-base font-bold text-slate-700 mb-3">{t[lang].reciter}</label>
                  <CustomSelect 
                    value={reciter} 
                    onChange={(val) => setReciter(val)}
                    options={RECITERS.map(r => ({ value: r.id, label: r.name }))}
                  />
                </div>

                <div>
                  <label className="block text-base font-bold text-slate-700 mb-3">{t[lang].repetitions}</label>
                  <div className="flex items-center gap-6 bg-slate-50 p-4 rounded-2xl border-2 border-slate-100">
                    <input 
                      type="range" min="1" max="10" 
                      value={repetitions} onChange={e => setRepetitions(Number(e.target.value))}
                      className="flex-1 accent-emerald-500 h-2"
                    />
                    <span className="w-12 text-center font-black text-emerald-600 text-2xl">{repetitions}</span>
                  </div>
                </div>

                <div>
                  <label className="block text-base font-bold text-slate-700 mb-3">{t[lang].rangeRepetitions}</label>
                  <div className="flex items-center gap-6 bg-slate-50 p-4 rounded-2xl border-2 border-slate-100">
                    <input 
                      type="range" min="1" max="10" 
                      value={rangeRepetitions} onChange={e => setRangeRepetitions(Number(e.target.value))}
                      className="flex-1 accent-emerald-500 h-2"
                    />
                    <span className="w-12 text-center font-black text-emerald-600 text-2xl">{rangeRepetitions}</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex flex-col gap-4 pt-4">
              <div className="flex flex-col sm:flex-row gap-4">
                <button 
                  onClick={() => startListening()}
                  disabled={isLoading || selectedSurah === null}
                  className="flex-[2] bg-emerald-500 text-white font-bold py-5 rounded-2xl shadow-xl shadow-emerald-100 hover:bg-emerald-600 focus:ring-4 focus:ring-emerald-300 outline-none transition-all flex items-center justify-center gap-3 text-xl"
                >
                  {isLoading ? <Loader2 className="animate-spin" /> : <Play fill="currentColor" size={24} />}
                  <span>{t[lang].startListening}</span>
                </button>
              </div>

              {isDownloading ? (
                <div className="bg-emerald-50 p-6 rounded-2xl border-2 border-emerald-100">
                  <div className="flex justify-between items-center mb-3">
                    <div className="flex flex-col">
                      <span className="text-emerald-700 font-bold flex items-center gap-2">
                        <Loader2 className="animate-spin" size={20} />
                        {downloadingSurahName ? t[lang].downloadingSurah.replace('{surah}', downloadingSurahName).replace('{progress}', String(downloadProgress)) : t[lang].downloading.replace('{progress}', String(downloadProgress))}
                      </span>
                    </div>
                    <button 
                      onClick={cancelDownload}
                      className="text-red-500 hover:text-red-700 font-bold text-sm"
                    >
                      {t[lang].downloadCancel}
                    </button>
                  </div>
                  <div className="w-full bg-emerald-200 rounded-full h-3 overflow-hidden">
                    <motion.div 
                      className="bg-emerald-500 h-full"
                      initial={{ width: 0 }}
                      animate={{ width: `${downloadProgress}%` }}
                    />
                  </div>
                </div>
              ) : (
                <button 
                  onClick={() => setShowDownloadModal(true)}
                  disabled={isLoading || selectedSurah === null}
                  className="w-full bg-slate-100 text-slate-700 font-bold py-5 rounded-2xl border-2 border-slate-200 flex items-center justify-center gap-3 hover:bg-slate-200 focus:ring-4 focus:ring-slate-300 outline-none transition-all text-xl"
                >
                  <Download size={24} />
                  <span>{t[lang].downloadOffline}</span>
                </button>
              )}
            </div>

            {/* Download Options Modal */}
            <AnimatePresence>
              {showDownloadModal && (
                <div className="fixed inset-0 z-[3000] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
                  <motion.div 
                    initial={{ opacity: 0, scale: 0.9, y: 20 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.9, y: 20 }}
                    className="bg-white dark:bg-slate-900 rounded-[2.5rem] w-full max-w-md shadow-2xl overflow-hidden"
                  >
                    <div className="p-8">
                      <div className="flex justify-between items-center mb-8">
                        <h3 className="text-2xl font-black text-slate-800 dark:text-white flex items-center gap-3">
                          <Download className="text-emerald-500" size={28} />
                          {t[lang].downloadOffline}
                        </h3>
                        <button 
                          onClick={() => setShowDownloadModal(false)}
                          className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors"
                        >
                          <X size={24} className="text-slate-400" />
                        </button>
                      </div>

                      <div className="space-y-4">
                        <button 
                          onClick={handleDownloadSurah}
                          className="w-full p-6 bg-emerald-50 hover:bg-emerald-100 border-2 border-emerald-100 rounded-3xl text-right transition-all group flex flex-col gap-1"
                        >
                          <span className="font-black text-emerald-900 text-lg group-hover:translate-x-1 transition-transform inline-block">
                            {t[lang].downloadSurahOnly}
                          </span>
                          <span className="text-emerald-600 text-sm opacity-80">
                            {selectedSurahData?.name} ({selectedSurahData?.numberOfAyahs} {t[lang].ayah})
                          </span>
                        </button>

                        <button 
                          onClick={handleDownloadFullQuran}
                          className="w-full p-6 bg-slate-50 hover:bg-slate-100 border-2 border-slate-100 rounded-3xl text-right transition-all group flex flex-col gap-1"
                        >
                          <span className="font-black text-slate-900 dark:text-white text-lg group-hover:translate-x-1 transition-transform inline-block">
                            {t[lang].downloadFullQuran}
                          </span>
                          <span className="text-slate-500 text-sm opacity-80">
                            114 {t[lang].chooseSurah} (6236 {t[lang].ayah})
                          </span>
                        </button>
                      </div>

                      <div className="mt-8 pt-6 border-t border-slate-100 dark:border-slate-800">
                        <p className="text-slate-400 text-sm text-center italic">
                          {lang === 'ar' ? 'سيتم حفظ التلاوة بصوت القارئ المختار حالياً' : 'Recitation will be saved for the currently selected reciter'}
                        </p>
                      </div>
                    </div>
                  </motion.div>
                </div>
              )}
            </AnimatePresence>
            {isTextSearchOpen && (
              <div className="fixed inset-0 z-[2000] flex items-center justify-center bg-black/50 p-4" dir="rtl">
                <div className="bg-white dark:bg-slate-900 rounded-3xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col shadow-2xl">
                  <div className="p-4 border-b border-gray-100 dark:border-slate-800 flex justify-between items-center bg-slate-50/50 dark:bg-slate-800/50">
                    <h3 className="text-xl font-bold text-gray-900 dark:text-white">
                      {lang === 'ar' ? 'بحث في القرآن' : 'Search Quran'}
                    </h3>
                    <button 
                      onClick={() => setIsTextSearchOpen(false)}
                      className="p-2 hover:bg-gray-200 dark:hover:bg-slate-700 rounded-full transition-colors text-gray-500"
                    >
                      <X size={20} />
                    </button>
                  </div>
                  <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
                    <QuranSearchInline
                      lang={lang}
                      onSelect={(surahNum, ayahNum, action) => {
                        setListenMode('quran');
                        setSelectedSurah(surahNum);
                        setFromAyah(ayahNum);
                        const surahObj = QURAN_SURAHS.find(s => s.number === surahNum);
                        const finalToAyah = surahObj ? surahObj.numberOfAyahs : ayahNum;
                        
                        setToAyah(finalToAyah);
                        setIsTextSearchOpen(false);
                        
                        if (action === 'play') {
                          startListening(surahNum, ayahNum, finalToAyah);
                        }
                      }}
                    />
                  </div>
                </div>
              </div>
            )}
          </div>
        )
      ) : (
        customPlaylist.length > 0 && customCurrentIndex >= 0 && customCurrentIndex < customPlaylist.length ? (
          <motion.div 
            initial={{ opacity: 0, y: 20 }} 
            animate={{ opacity: 1, y: 0 }} 
            className="bg-white p-4 sm:p-8 rounded-[40px] shadow-2xl border border-slate-100 mb-8 flex flex-col gap-6"
          >
            <div className="w-full max-w-2xl mx-auto flex flex-col gap-4">
              <div className="flex items-center justify-between gap-4">
                <h3 className="text-xl font-bold text-emerald-700">
                  {t[lang].dictationText}
                </h3>
                <button 
                  onClick={stopListening}
                  className="p-3 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-full transition-all"
                >
                  <X size={24} />
                </button>
              </div>

              <div className="w-full bg-emerald-50/50 p-2 sm:p-2.5 rounded-full border border-emerald-100 flex items-center gap-3 sm:gap-4" style={{ direction: 'ltr' }}>
                <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-full overflow-hidden flex-shrink-0 bg-white border border-emerald-200 flex items-center justify-center p-2 shadow-sm">
                  <img src="/logo.svg" alt="Hoffad" className="w-full h-full object-contain" />
                </div>
                
                <button 
                  onClick={togglePlayPause}
                  className="w-10 h-10 sm:w-12 sm:h-12 bg-emerald-500 text-white rounded-full flex items-center justify-center flex-shrink-0 hover:bg-emerald-600 shadow-lg transition-all active:scale-95"
                >
                  {isPlaying ? <Pause size={24} fill="currentColor" /> : <Play size={24} fill="currentColor" className="ml-1" />}
                </button>
                
                <div className="flex-1 flex items-center gap-3 pr-2 sm:pr-4">
                  <div className="flex-1 h-1.5 bg-emerald-200/50 rounded-full overflow-hidden relative">
                    <motion.div 
                      className="absolute inset-y-0 left-0 bg-emerald-500"
                      animate={{ width: `${((customCurrentIndex) / customPlaylist.length) * 100}%` }}
                    />
                  </div>
                  <div className="text-xs sm:text-sm font-black text-emerald-600 font-mono min-w-[45px] text-right">
                    {formatTime(sessionTime)}
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-emerald-50/20 p-8 sm:p-12 rounded-[32px] border-2 border-emerald-100/50 w-full min-h-[150px] flex items-center justify-center shadow-inner mt-2">
              <p className="text-2xl sm:text-4xl leading-loose font-medium text-slate-800 text-center" dir="auto">
                {customPlaylist[customCurrentIndex]}
              </p>
            </div>

            <div className="flex flex-wrap items-center justify-center gap-3">
              <div className="flex items-center gap-2 bg-emerald-100/50 px-4 py-1.5 rounded-full text-emerald-700 font-bold text-sm">
                <span className="opacity-70">{t[lang].currentRepetition.split(':')[0]}</span>
                <span>{(customCurrentIndex % customReps) + 1} / {customReps}</span>
              </div>
              {customRangeReps > 1 && (
                <div className="flex items-center gap-2 bg-blue-100/50 px-4 py-1.5 rounded-full text-blue-700 font-bold text-sm">
                  <span className="opacity-70">{t[lang].currentRangeRepetition.split(':')[0]}</span>
                  <span>{Math.floor(customCurrentIndex / (customPlaylist.length / customRangeReps)) + 1} / {customRangeReps}</span>
                </div>
              )}
            </div>
          </motion.div>
        ) : (
          <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100 space-y-5">
            <CustomTextInput 
              text={customText}
              setText={setCustomText}
              customLang={customLang}
              setCustomLang={setCustomLang}
              onAction={startCustomListening}
              actionLabel={t[lang].startDictation}
              actionIcon={<Play fill="currentColor" />}
              lang={lang}
            />
            
            <div className="pt-4 border-t border-slate-100">
              <label className="block text-sm font-bold text-slate-700 mb-2">{t[lang].repetitionsPerLine}</label>
              <div className="flex items-center gap-4 bg-slate-50 p-2 rounded-2xl border border-slate-200">
                <input 
                  type="range" min="1" max="10" 
                  value={customReps} onChange={e => setCustomReps(Number(e.target.value))}
                  className="flex-1 accent-emerald-500"
                />
                <span className="w-10 text-center font-bold text-emerald-600 text-lg">{customReps}</span>
              </div>
            </div>

            <div>
              <label className="block text-sm font-bold text-slate-700 mb-2">{t[lang].rangeRepetitions}</label>
              <div className="flex items-center gap-4 bg-slate-50 p-2 rounded-2xl border border-slate-200">
                <input 
                  type="range" min="1" max="10" 
                  value={customRangeReps} onChange={e => setCustomRangeReps(Number(e.target.value))}
                  className="flex-1 accent-emerald-500"
                />
                <span className="w-10 text-center font-bold text-emerald-600 text-lg">{customRangeReps}</span>
              </div>
            </div>
          </div>
        )
      )}
    </div>
  );
}

// --- Main App Component ---
const isWordMatchArabic = (w1: string, w2: string) => {
  if (w1 === w2) return true;
  if (w1.replace(/ا/g, '') === w2.replace(/ا/g, '')) return true;
  if (w1.length > 3 && w2.length > 3) {
    const dist = getLevenshteinDistance(w1, w2);
    if (dist === 1) return true;
  }
  return false;
};

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [userCountry, setUserCountry] = useState<string | null>(null);

  // Fetch country once
  useEffect(() => {
    fetch('https://ipapi.co/json/')
      .then(res => res.json())
      .then(data => {
        if (data.country_code) {
          setUserCountry(data.country_code);
        }
      })
      .catch(err => console.warn("Country detection failed:", err));
  }, []);
  const [isAuthChecking, setIsAuthChecking] = useState(true);
  const [view, setView] = useState<View>('study');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isPremium, setIsPremium] = useState(false);
  const [coins, setCoins] = useState(0);
  const [xp, setXp] = useState(0);
  const [totalScore, setTotalScore] = useState(0);
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [activeLesson, setActiveLesson] = useState<Lesson | null>(null);
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [lang, setLang] = useState<Language>('ar');
  const [isLangMenuOpen, setIsLangMenuOpen] = useState(false);
  const langMenuRef = useRef<HTMLDivElement>(null);
  const { isPlaying, playlist, currentTrackIndex, pause, resume, currentTime, duration, sessionTime, stop, overallProgress } = useAudio();

  const [isRemoteModalOpen, setIsRemoteModalOpen] = useState(false);
  const [deviceId] = useState(() => {
    const saved = localStorage.getItem('hoffad_device_id');
    if (saved) return saved;
    const newId = Math.random().toString(36).substring(2, 10).toUpperCase();
    localStorage.setItem('hoffad_device_id', newId);
    return newId;
  });

  const [authError, setAuthError] = useState<string | null>(null);

  // Sync Device Session to Firestore
  useEffect(() => {
    if (!auth.currentUser || !deviceId || !isRemoteModalOpen) return;
    
    const syncSession = async () => {
      try {
        await setDoc(doc(db, 'tv_sessions', deviceId), {
          deviceId,
          currentAnonUid: auth.currentUser.uid,
          updatedAt: serverTimestamp(),
          status: 'active'
        }, { merge: true });
      } catch (err: any) {
        console.warn("Session sync warning:", err.message);
      }
    };
    
    syncSession();
  }, [auth.currentUser, deviceId, isRemoteModalOpen]);

  // Real-time Data Listeners
  useEffect(() => {
    // CRITICAL: Only start listeners if we have an AUTHENTICATED Firebase user.
    if (!auth.currentUser) {
      setLessons([]);
      setXp(0);
      setCoins(0);
      return;
    }

    const sessionUid = localStorage.getItem('hoffad_session_uid');
    const currentUid = sessionUid || auth.currentUser.uid;
    
    // 1. Profile Listener
    const profileUnsubscribe = onSnapshot(doc(db, 'users', currentUid), (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.data();
        if (data.xp !== undefined) setXp(data.xp);
        if (data.coins !== undefined) setCoins(data.coins);
        if (data.totalScore !== undefined) setTotalScore(data.totalScore);

        const needsNameUpdate = (data.displayName === 'حافظ مجهول' || !data.displayName) && auth.currentUser?.displayName;
        const needsPhotoUpdate = (!data.photoURL || data.photoURL === '') && auth.currentUser?.photoURL;
        const needsCountryUpdate = !data.countryCode && userCountry;

        if (needsNameUpdate || needsPhotoUpdate || needsCountryUpdate) {
          updateDoc(doc(db, 'users', currentUid), {
            ...(needsNameUpdate ? { displayName: auth.currentUser?.displayName } : {}),
            ...(needsPhotoUpdate ? { photoURL: auth.currentUser?.photoURL } : {}),
            ...(needsCountryUpdate ? { countryCode: userCountry } : {}),
            updatedAt: serverTimestamp()
          }).catch(e => console.warn("Identity sync deferred:", e.message));
        }
      } else {
        setDoc(doc(db, 'users', currentUid), {
          displayName: auth.currentUser?.displayName || 'حافظ مجهول',
          photoURL: auth.currentUser?.photoURL || '',
          countryCode: userCountry || '',
          xp: 10,
          coins: 10,
          totalScore: 0,
          updatedAt: serverTimestamp(),
          createdAt: serverTimestamp()
        }, { merge: true }).catch(err => {
          console.warn("Profile init deferred:", err.message);
        });
      }
    }, (error) => {
      console.warn("Profile Listener Warning:", error.message);
    });

    // 2. Lessons Listener
    const lessonsQuery = query(
      collection(db, 'users', currentUid, 'lessons'),
      orderBy('createdAt', 'desc')
    );
    const lessonsUnsubscribe = onSnapshot(lessonsQuery, (snapshot) => {
      const fetchedLessons = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Lesson[];
      setLessons(fetchedLessons);
    }, (error) => {
      console.warn("Lessons Listener Warning:", error.message);
    });

    return () => {
      profileUnsubscribe();
      lessonsUnsubscribe();
    };
  }, [user?.uid, userCountry]);

  const [uploadNotification, setUploadNotification] = useState<string | null>(null);
  
  // Parent Dashboard Lifted State
  const [parentNewTitle, setParentNewTitle] = useState('');
  const [parentNewText, setParentNewText] = useState('');
  const [parentCustomLang, setParentCustomLang] = useState<string>('ar');
  
  useEffect(() => {
    setParentCustomLang(lang);
  }, [lang]);
  const [isExtractingRemote, setIsExtractingRemote] = useState(false);

  const navigate = useNavigate();

  // Auth Listener
  useEffect(() => {
    let isMounted = true;

    const checkSession = async () => {
      // 1. Check for custom token (highest priority)
      const customToken = localStorage.getItem('hoffad_custom_token');
      if (customToken) {
        try {
          await signInWithCustomToken(auth, customToken);
          localStorage.removeItem('hoffad_custom_token');
          return;
        } catch (err) {
          console.error("Custom token login failed:", err);
          localStorage.removeItem('hoffad_custom_token');
        }
      }

      // 2. Check for manual session fallback (Phone Login)
      const sessionUid = localStorage.getItem('hoffad_session_uid');
      if (sessionUid) {
        const sessionName = localStorage.getItem('hoffad_session_name');
        const sessionPhoto = localStorage.getItem('hoffad_session_photo');
        
        // Create a mock user object for UI
        setUser({
          uid: sessionUid,
          displayName: sessionName,
          photoURL: sessionPhoto,
          isAnonymous: false, // Treat as "real" for UI
          email: '',
          emailVerified: false,
          metadata: {},
          providerData: []
        } as any);
        
        setIsAuthChecking(false);
        return;
      }

      // No more anonymous login. Just finish checking.
      if (isMounted) setIsAuthChecking(false);
    };

    const unsubscribe = onAuthStateChanged(auth, (u) => {
      if (!isMounted) return;
      
      if (u) {
        setUser(u);
        setIsAuthChecking(false);
      } else {
        checkSession();
      }
    });

    return () => {
      isMounted = false;
      unsubscribe();
    };
  }, [navigate]);

  const handleLogin = async () => {
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (error: any) {
      console.error("Login Error:", error);
      if (error.code === 'auth/unauthorized-domain') {
        alert(lang.startsWith('ar') 
          ? "خطأ: النطاق غير مصرح به. يرجى إضافة 'hoffad.vercel.app' إلى قائمة 'Authorized domains' في إعدادات (Authentication) داخل Firebase Console." 
          : "Error: Unauthorized domain. Please add 'hoffad.vercel.app' to the 'Authorized domains' list in the Firebase Console Authentication settings.");
      } else if (error.code === 'auth/internal-error' || error.code === 'auth/network-request-failed') {
        alert(lang.startsWith('ar') 
          ? "خطأ داخلي في تسجيل الدخول. يرجى التأكد من السماح بالنوافذ المنبثقة وإضافة النطاق الحالي إلى قائمة النطاقات المصرح بها (Authorized Domains) في Firebase Console." 
          : "Internal login error. Please ensure popups are allowed and the current domain is added to the Authorized Domains in Firebase Console.");
      } else if (error.code === 'auth/popup-blocked') {
        alert(lang.startsWith('ar') ? "تم حظر النافذة المنبثقة. يرجى السماح بالنوافذ المنبثقة للموقع." : "Popup blocked. Please allow popups for this site.");
      } else {
        alert(lang.startsWith('ar') ? "فشل تسجيل الدخول. يرجى المحاولة مرة أخرى." : "Login failed. Please try again.");
      }
    }
  };

  const handleLogout = async () => {
    try {
      localStorage.removeItem('hoffad_session_uid');
      localStorage.removeItem('hoffad_session_name');
      localStorage.removeItem('hoffad_session_photo');
      await signOut(auth);
    } catch (error) {
      console.error("Logout Error:", error);
    }
  };

  // Listen for remote uploads
  useEffect(() => {
    if (!deviceId) return;
    
    // Construct query based on authentication state
    // We strictly use anonUid which matches auth.currentUser.uid in TV mode
    let q;
    if (auth.currentUser) {
      q = query(
        collection(db, 'uploads'), 
        where('anonUid', '==', auth.currentUser.uid)
      );
    } else {
      // Should not happen as TV login secures it, but for safety:
      return;
    }
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      snapshot.docChanges().forEach(async (change) => {
        if (change.type === 'added') {
          const data = change.doc.data();
          const fileUrl = data.url;
          const fileType = data.type; // 'image', 'audio', 'video'
          const fileName = data.name || '';

          setUploadNotification(lang.startsWith('ar') ? `تم استلام ${fileType === 'image' ? 'صورة' : fileType === 'audio' ? 'ملف صوتي' : 'فيديو'}... جاري استخراج النص...` : `Received ${fileType}... Extracting text...`);
          setIsExtractingRemote(true);
          setView('parent'); // Switch to parent dashboard to show the result

          try {
            // 1. Fetch the file using our server-side proxy (bypasses CORS and client-side storage issues)
            const proxyUrl = `/api/proxy-file?url=${encodeURIComponent(fileUrl)}`;
            const response = await fetch(proxyUrl);
            if (!response.ok) throw new Error('Proxy fetch failed');
            
            const { base64: base64Data, contentType } = await safeJson(response);

            // 2. Call Gemini for extraction
            const apiKey = (import.meta as any).env?.VITE_GEMINI_API_KEY || 
                           process.env.GEMINI_API_KEY || 
                           process.env.VITE_GEMINI_API_KEY ||
                           (window as any).GEMINI_API_KEY;
            
            if (apiKey && apiKey !== "undefined" && apiKey !== "" && apiKey !== "null") {
              const ai = new GoogleGenAI({ apiKey });
              const prompt = fileType === 'image' 
                ? "استخرج النص من هذه الصورة بدقة. أعد النص فقط بدون أي إضافات أو تعليقات. إذا كان هناك نص عربي، حافظ على التشكيل إن وجد."
                : "استخرج النص من هذا المقطع بدقة (تفريغ صوتي). أعد النص فقط بدون أي إضافات أو تعليقات.";

              const result = await ai.models.generateContent({
                model: "gemini-3-flash-preview",
                contents: { parts: [{ inlineData: { data: base64Data, mimeType: contentType || (fileType === 'image' ? 'image/jpeg' : 'audio/mpeg') } }, { text: prompt }] },
              });

              if (result.text) {
                setParentNewText(prev => prev ? prev + '\n\n' + result.text.trim() : result.text.trim());
                setParentNewTitle(fileName || (lang.startsWith('ar') ? `نص مستخرج من ${fileType}` : `Extracted from ${fileType}`));
                setUploadNotification(lang.startsWith('ar') ? "تم استخراج النص بنجاح!" : "Text extracted successfully!");
              }
            }
          } catch (error) {
            console.error("Remote Extraction Error:", error);
            setUploadNotification(lang.startsWith('ar') ? "فشل استخراج النص تلقائياً." : "Failed to extract text automatically.");
          } finally {
            setIsExtractingRemote(false);
            setTimeout(() => setUploadNotification(null), 5000);
            // Delete from firestore after processing
            deleteDoc(doc(db, 'uploads', change.doc.id)).catch(e => console.warn(e));
          }
        }
      });
    }, (error) => {
      console.warn("Firestore Listener Warning (Uploads):", error);
    });
    return () => unsubscribe();
  }, [deviceId, lang, user]);

  useEffect(() => {
    const handleAppKeys = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      
      if (e.key === 'm' || e.key === 'M') {
        setIsSidebarOpen(prev => !prev);
      }
    };
    window.addEventListener('keydown', handleAppKeys);
    return () => window.removeEventListener('keydown', handleAppKeys);
  }, []);

  // Fallback translation helper
  const getT = (l: string) => {
    return (t as any)[l] || t['en'];
  };

  const currentT = getT(lang);

  // --- Screen Wake Lock & TV Logic ---
  const wakeLockRef = useRef<any>(null);

  const requestWakeLock = useCallback(async () => {
    if ('wakeLock' in navigator && !wakeLockRef.current) {
      try {
        wakeLockRef.current = await (navigator as any).wakeLock.request('screen');
        devLog('Wake Lock Acquired');
        wakeLockRef.current.addEventListener('release', () => {
          devLog('Wake Lock Released');
          wakeLockRef.current = null;
        });
      } catch (err: any) {
        console.warn('Wake Lock Request Failed:', err.name, err.message);
      }
    }
  }, []);

  const releaseWakeLock = useCallback(async () => {
    if (wakeLockRef.current) {
      try {
        await wakeLockRef.current.release();
        wakeLockRef.current = null;
      } catch (err) {
        console.error('Wake Lock Release Error:', err);
      }
    }
  }, []);

  // Sync Wake Lock with activity
  useEffect(() => {
    // Acquire when playing audio or in specific active views (Mushaf, Game)
    if (isPlaying || view === 'mushaf' || view === 'game') {
      requestWakeLock();
      
      // Also try to play the fallback video when user starts activity
      const fallbackVideo = document.getElementById('tv-fallback-video') as HTMLVideoElement;
      if (fallbackVideo && fallbackVideo.paused) {
        fallbackVideo.play().catch(() => {
          // Silent catch for autoplay block
        });
      }
    } else {
      // Release if no activity
      releaseWakeLock();
    }

    // Handle visibility change: re-acquire if app is back to foreground
    const handleVisibilityChange = async () => {
      if (document.visibilityState === 'visible' && (isPlaying || view === 'mushaf' || view === 'game')) {
        await requestWakeLock();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [isPlaying, view, requestWakeLock, releaseWakeLock]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (langMenuRef.current && !langMenuRef.current.contains(event.target as Node)) {
        setIsLangMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  if (isAuthChecking) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="w-12 h-12 text-emerald-600 animate-spin" />
          <p className="text-slate-400 font-bold animate-pulse">{lang === 'ar' ? 'جاري التحقق...' : 'Verifying...'}</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6 text-center">
         <motion.div 
           initial={{ opacity: 0, y: 20 }}
           animate={{ opacity: 1, y: 0 }}
           className="bg-white p-8 rounded-[40px] shadow-2xl shadow-emerald-100 max-w-sm w-full border border-slate-100"
         >
           <div className="w-20 h-20 bg-emerald-100 text-emerald-600 rounded-3xl flex items-center justify-center mx-auto mb-6 shadow-inner">
             <img src="/logo.svg" alt="Logo" className="w-12 h-12" />
           </div>
           <h2 className="text-3xl font-black text-slate-800 mb-2">
             {lang === 'ar' ? 'أهلاً بك في حُفّاظ' : 'Welcome to Hoffad'}
           </h2>
           <p className="text-slate-500 mb-8 leading-relaxed font-medium">
             {lang === 'ar' 
               ? 'يرجى تسجيل الدخول بحساب Google لحفظ تقدمك والتنافس مع الآخرين.' 
               : 'Please login with your Google account to save progress and compete with others.'}
           </p>
           
           <button 
             onClick={handleLogin}
             className="w-full bg-emerald-600 text-white font-bold py-4 rounded-2xl shadow-lg shadow-emerald-200 hover:bg-emerald-700 transition-all flex items-center justify-center gap-3 active:scale-95"
           >
             <LogIn size={24} />
             <span>{lang === 'ar' ? 'تسجيل الدخول عبر Google' : 'Sign in with Google'}</span>
           </button>
           
           <div className="mt-8 flex items-center justify-center gap-2 text-slate-400 text-xs">
             <ShieldCheck size={14} />
             <span>{lang === 'ar' ? 'تسجيل آمن عبر Google' : 'Secure sign in via Google'}</span>
           </div>
         </motion.div>
      </div>
    );
  }

  // --- Handlers ---
  const handleAddLesson = async (newLesson: Omit<Lesson, 'id'>) => {
    if (!user) return;
    try {
      const lessonsRef = collection(db, 'users', user.uid, 'lessons');
      await addDoc(lessonsRef, {
        ...newLesson,
        userId: user.uid,
        createdAt: serverTimestamp()
      });
    } catch (err) {
      console.error("Error adding lesson:", err);
    }
  };

  const handleDeleteLesson = async (lessonId: string) => {
    if (!user) return;
    try {
      await deleteDoc(doc(db, 'users', user.uid, 'lessons', lessonId));
    } catch (err) {
      console.error("Error deleting lesson:", err);
    }
  };

  const updateProfile = async (data: Partial<{ xp: number, coins: number, totalScore: number }>) => {
    if (!user) return;
    try {
      console.log("[Firebase] Updating profile...", data);
      const profileRef = doc(db, 'users', user.uid);
      await setDoc(profileRef, {
        ...data,
        updatedAt: serverTimestamp()
      }, { merge: true });
      devLog("Profile Update Success");
    } catch (err) {
      console.error("Error updating profile:", err);
      handleFirestoreError(err, 'write', `users/${user.uid}`);
    }
  };

  const startGame = (lesson: Lesson) => {
    setActiveLesson(lesson);
    setView('game');
  };

  const handleGameComplete = (earnedPoints: number) => {
    const newCoins = coins + earnedPoints;
    const newXp = xp + earnedPoints;
    const newTotalScore = totalScore + earnedPoints;
    setCoins(newCoins);
    setXp(newXp);
    setTotalScore(newTotalScore);
    updateProfile({ 
      coins: newCoins, 
      xp: newXp,
      totalScore: newTotalScore 
    });
    setView('study');
    setActiveLesson(null);
  };

  return (
    <div className={`min-h-screen font-sans flex flex-col transition-colors duration-300 bg-slate-50 text-slate-800 ${isDarkMode ? 'dark' : ''}`} dir={APP_LANGUAGES.find(l => l.code === lang)?.dir || 'ltr'}>
      {/* Remote Upload Modal */}
      <AnimatePresence>
        {isRemoteModalOpen && (
          <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="bg-white rounded-[40px] p-8 max-w-md w-full shadow-2xl relative overflow-hidden"
            >
              <button 
                onClick={() => setIsRemoteModalOpen(false)}
                className="absolute top-6 right-6 p-2 hover:bg-slate-100 rounded-full transition-colors text-slate-400"
              >
                <X size={24} />
              </button>

              <div className="text-center">
                <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-2xl flex items-center justify-center mx-auto mb-6">
                  <ImageIcon size={32} />
                </div>
                <h2 className="text-2xl font-black text-slate-800 mb-2">{currentT.remoteUploadTitle}</h2>
                <p className="text-slate-500 mb-8">{currentT.scanToUpload}</p>

                <div className="grid gap-6">
                  {/* QR Code Section - Primary for TV/Desktop */}
                  <div className="bg-slate-50 p-6 rounded-[32px] border border-slate-100 flex flex-col items-center">
                    <div className="bg-white p-4 rounded-2xl shadow-sm mb-4 border border-slate-100">
                      <QRCodeSVG 
                        value={`${window.location.origin}/upload?dev=${deviceId}`}
                        size={160}
                        level="H"
                        includeMargin={false}
                      />
                    </div>
                    <div className="bg-white px-4 py-2 rounded-xl border border-slate-100">
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Device ID</p>
                      <p className="text-xl font-mono font-black text-emerald-600 tracking-wider">{deviceId}</p>
                    </div>
                  </div>

                  {/* Scan Button Section - Primary for Mobile */}
                  <div className="md:hidden">
                    <div className="relative py-2 mb-4">
                      <div className="absolute inset-0 flex items-center"><span className="w-full border-t border-slate-200"></span></div>
                      <div className="relative flex justify-center text-xs uppercase"><span className="bg-white px-2 text-slate-400 font-bold">{lang === 'ar' ? 'أو' : 'OR'}</span></div>
                    </div>
                    
                    <button 
                      onClick={() => window.open(`${window.location.origin}/upload`, '_blank')}
                      className="w-full bg-emerald-600 text-white p-5 rounded-[24px] font-bold flex items-center justify-center gap-3 shadow-lg shadow-emerald-200 hover:bg-emerald-700 transition-all active:scale-95"
                    >
                      <Camera size={24} />
                      <span>{lang === 'ar' ? 'فتح الكاميرا لمسح الكود' : 'Open Camera to Scan'}</span>
                    </button>
                  </div>
                </div>

                {!user && (
                  <div className="mt-6 flex items-center gap-3 p-4 bg-amber-50 text-amber-700 rounded-2xl border border-amber-100 text-sm font-medium">
                    <AlertCircle size={20} className="shrink-0" />
                    <p className="text-left">
                      {lang === 'ar' ? 'يرجى تسجيل الدخول أولاً لتفعيل الرفع الآمن.' : 'Please login first to enable secure upload.'}
                    </p>
                  </div>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Upload Notification */}
      <AnimatePresence>
        {uploadNotification && (
          <motion.div 
            initial={{ opacity: 0, y: -50 }}
            animate={{ opacity: 1, y: 20 }}
            exit={{ opacity: 0, y: -50 }}
            className="fixed top-0 left-1/2 -translate-x-1/2 z-[2000] bg-emerald-600 text-white px-6 py-3 rounded-full shadow-2xl font-bold flex items-center gap-3"
          >
            <Check size={20} />
            {uploadNotification}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Header */}
      <header className="bg-white px-2 sm:px-6 py-2 sm:py-4 flex justify-between items-center sticky top-0 z-[100] transition-colors duration-300 border-b border-slate-100 shadow-sm">
        <div className="flex items-center gap-1 sm:gap-4 flex-1 min-w-0">
          <button 
            onClick={() => setIsSidebarOpen(!isSidebarOpen)}
            className="bg-[#00c48c] text-white p-2 sm:p-3 rounded-[12px] sm:rounded-[16px] shadow-sm hover:bg-[#00b07d] transition-colors focus:ring-4 focus:ring-emerald-300 outline-none shrink-0"
          >
            <Menu size={22} className="sm:size-6" />
          </button>
          
          <div className="flex items-center gap-1 sm:gap-2 shrink-0">
            <img src="/logo.svg" alt="Hoffad Logo" className="w-6 h-6 sm:w-8 sm:h-8 object-contain" />
            <h1 className="font-bold text-sm sm:text-xl text-slate-800 whitespace-nowrap truncate max-w-[100px] sm:max-w-none">
              {lang === 'ar' ? 'حُفّاظ' : 'Hoffad'}
            </h1>
          </div>

          <div className="relative shrink-0" ref={langMenuRef}>
            <button 
              onClick={() => setIsLangMenuOpen(!isLangMenuOpen)}
              className="flex items-center gap-1 sm:gap-1.5 bg-white text-emerald-700 text-[10px] sm:text-xs font-bold py-1 px-2 sm:px-3 rounded-full hover:bg-emerald-50 transition-all border-2 border-emerald-500 shadow-sm focus:ring-2 focus:ring-emerald-500 outline-none"
            >
              <Languages size={12} className="text-emerald-600 sm:size-4" />
              <span className="uppercase sm:inline-block tracking-wide">{lang}</span>
              <ChevronDown size={10} className={`transition-transform sm:size-4 ${isLangMenuOpen ? 'rotate-180' : ''}`} />
            </button>

            <AnimatePresence>
              {isLangMenuOpen && (
                <motion.div 
                  initial={{ opacity: 0, y: 10, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 10, scale: 0.95 }}
                  className="absolute top-full mt-2 start-0 w-48 bg-white border border-slate-200 rounded-2xl shadow-2xl z-[1000] overflow-hidden flex flex-col"
                >
                  <button 
                    type="button"
                    onClick={(e) => { e.stopPropagation(); document.getElementById('app-lang-scroll')?.scrollBy({ top: -100, behavior: 'smooth' }); }}
                    className="w-full flex justify-center py-1 bg-slate-50 hover:bg-slate-100 text-slate-400 border-b border-slate-100"
                  >
                    <ChevronUp size={18} />
                  </button>

                  <div id="app-lang-scroll" className="max-h-[40vh] overflow-y-auto py-2 force-scrollbar scrollbar-thin scrollbar-thumb-slate-300 scrollbar-track-slate-100">
                    {APP_LANGUAGES.map((l) => (
                      <button
                        key={l.code}
                        onClick={() => {
                          setLang(l.code);
                          setIsLangMenuOpen(false);
                        }}
                        onFocus={(e) => e.currentTarget.scrollIntoView({ behavior: 'smooth', block: 'nearest' })}
                        className={`w-full text-start px-4 py-3 text-sm font-medium transition-colors flex items-center justify-between focus:bg-emerald-50 focus:outline-none ${lang === l.code ? 'bg-emerald-50 text-emerald-700' : 'text-slate-600 hover:bg-slate-50'}`}
                      >
                        <span>{l.name}</span>
                        {lang === l.code && <Check size={16} />}
                      </button>
                    ))}
                  </div>

                  <button 
                    type="button"
                    onClick={(e) => { e.stopPropagation(); document.getElementById('app-lang-scroll')?.scrollBy({ top: 100, behavior: 'smooth' }); }}
                    className="w-full flex justify-center py-1 bg-slate-50 hover:bg-slate-100 text-slate-400 border-t border-slate-100"
                  >
                    <ChevronDown size={18} />
                  </button>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>

        <div className="flex items-center gap-1.5 sm:gap-4">
          {/* User Auth Section */}
          <div className="flex items-center gap-1 sm:gap-2">
            {user ? (
              <button 
                onClick={() => setIsSidebarOpen(!isSidebarOpen)}
                className="flex items-center gap-1 sm:gap-3 hover:opacity-80 transition-opacity focus:outline-none"
              >
                <div className="hidden md:flex flex-col items-end">
                  <span className="text-xs font-bold text-slate-800 leading-tight">{user.displayName}</span>
                  <span className="text-[10px] text-emerald-600 font-bold uppercase tracking-wider">
                    {lang === 'ar' ? 'الملف الشخصي' : 'Profile'}
                  </span>
                </div>
                <img 
                  src={user.photoURL || ''} 
                  alt={user.displayName || ''} 
                  className="w-7 h-7 sm:w-8 sm:h-8 rounded-full border-2 border-emerald-500 shadow-sm object-cover"
                  referrerPolicy="no-referrer"
                />
              </button>
            ) : (
              <button 
                onClick={handleLogin}
                className="flex items-center gap-1 sm:gap-2 bg-emerald-600 text-white text-[10px] sm:text-xs font-bold py-1.5 px-2 sm:px-4 rounded-full hover:bg-emerald-700 transition-colors shadow-md focus:ring-4 focus:ring-emerald-200 outline-none"
              >
                <LogIn size={18} />
                <span className="hidden sm:inline">{currentT.login || 'Login'}</span>
              </button>
            )}
          </div>
          
          <button
            onClick={() => setIsDarkMode(!isDarkMode)}
            className="w-7 h-7 sm:w-8 sm:h-8 flex items-center justify-center text-slate-400 hover:text-emerald-600 bg-white border-2 border-emerald-500 transition-all focus:ring-2 focus:ring-emerald-500 shadow-sm outline-none rounded-full"
          >
            {isDarkMode ? <Sun size={14} className="text-amber-500 sm:size-4" /> : <Moon size={14} className="sm:size-4" />}
          </button>
          
          <div className="flex items-center gap-1 sm:gap-2">
            {!isPremium && (
              <button 
                onClick={() => setView('upgrade')}
                className="w-7 h-7 sm:w-8 sm:h-8 flex items-center justify-center bg-amber-400 text-amber-950 rounded-full border-2 border-emerald-500 font-black text-[9px] sm:text-xs shadow-md hover:scale-105 transition-transform active:scale-95 focus:ring-4 focus:ring-emerald-200 outline-none"
                title={t[lang].upgrade}
              >
                <Star size={12} fill="currentColor" />
              </button>
            )}
            
          </div>
        </div>
      </header>

      {/* Sidebar Overlay */}
      <AnimatePresence>
        {isSidebarOpen && (
          <>
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsSidebarOpen(false)}
              className="fixed inset-0 bg-black/50 z-40"
            />
            <motion.div 
              initial={{ x: lang === 'ar' ? '100%' : '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: lang === 'ar' ? '100%' : '-100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className={`fixed top-0 bottom-0 ${lang === 'ar' ? 'right-0' : 'left-0'} w-64 bg-white shadow-2xl z-50 flex flex-col`}
              dir={lang === 'ar' ? 'rtl' : 'ltr'}
            >
              <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-emerald-50">
                <div className="flex items-center gap-2">
                  <img src="/logo.svg" alt="Hoffad Logo" className="w-8 h-8 object-contain" />
                  <span className="font-bold text-xl text-emerald-700">{lang === 'ar' ? t['ar'].myApp : t['en'].myApp}</span>
                </div>
                <button onClick={() => setIsSidebarOpen(false)} className="p-2 text-slate-400 hover:bg-emerald-100 hover:text-emerald-600 rounded-full transition-colors">
                  <X size={20} />
                </button>
              </div>
              
              <div className="flex-1 overflow-y-auto py-4 flex flex-col gap-2 px-3">
                <button 
                  onClick={() => { setView('mushaf'); setIsSidebarOpen(false); }}
                  className={`flex items-center gap-3 p-3 rounded-xl transition-all w-full focus:ring-2 focus:ring-emerald-500 outline-none ${view === 'mushaf' ? 'bg-emerald-100 text-emerald-700 font-bold' : 'text-slate-600 hover:bg-slate-50'}`}
                >
                  <Book size={22} className={view === 'mushaf' ? 'text-emerald-600' : 'text-emerald-500'} />
                  <span>{t[lang].quran}</span>
                </button>

                <button 
                  onClick={() => { setView('listen'); setIsSidebarOpen(false); }}
                  className={`flex items-center gap-3 p-3 rounded-xl transition-all w-full focus:ring-2 focus:ring-emerald-500 outline-none ${view === 'listen' ? 'bg-emerald-100 text-emerald-700 font-bold' : 'text-slate-600 hover:bg-slate-50'}`}
                >
                  <Headphones size={22} className={view === 'listen' ? 'text-emerald-600' : 'text-emerald-500'} />
                  <span>{t[lang].listen}</span>
                </button>

                <button 
                  onClick={() => { setView('study'); setIsSidebarOpen(false); }}
                  className={`flex items-center gap-3 p-3 rounded-xl transition-all w-full focus:ring-2 focus:ring-emerald-500 outline-none ${view === 'study' || view === 'game' ? 'bg-emerald-100 text-emerald-700 font-bold' : 'text-slate-600 hover:bg-slate-50'}`}
                >
                  <BookOpen size={22} className={view === 'study' || view === 'game' ? 'text-emerald-600' : 'text-emerald-500'} />
                  <span>{t[lang].study}</span>
                </button>

                <button 
                  onClick={() => { setView('leaderboard'); setIsSidebarOpen(false); }}
                  className={`flex items-center gap-3 p-3 rounded-xl transition-all w-full focus:ring-2 focus:ring-emerald-500 outline-none ${view === 'leaderboard' ? 'bg-emerald-100 text-emerald-700 font-bold' : 'text-slate-600 hover:bg-slate-50'}`}
                >
                  <Trophy size={22} className={view === 'leaderboard' ? 'text-emerald-600' : 'text-emerald-500'} />
                  <span>{t[lang].leaderboard}</span>
                </button>

                <button 
                  onClick={() => { setView('recorder'); setIsSidebarOpen(false); }}
                  className={`flex items-center gap-3 p-3 rounded-xl transition-all w-full focus:ring-2 focus:ring-emerald-500 outline-none ${view === 'recorder' ? 'bg-emerald-100 text-emerald-700 font-bold' : 'text-slate-600 hover:bg-slate-50'}`}
                >
                  <Mic size={22} className={view === 'recorder' ? 'text-emerald-600' : 'text-emerald-500'} />
                  <span>{t[lang].recitationRecorder}</span>
                </button>

                <button 
                  onClick={() => { setView('parent'); setIsSidebarOpen(false); }}
                  className={`flex items-center gap-3 p-3 rounded-xl transition-all w-full focus:ring-2 focus:ring-emerald-500 outline-none ${view === 'parent' ? 'bg-emerald-100 text-emerald-700 font-bold' : 'text-slate-600 hover:bg-slate-50'}`}
                >
                  <ShieldCheck size={22} className={view === 'parent' ? 'text-emerald-600' : 'text-emerald-500'} />
                  <span>{t[lang].settings}</span>
                </button>

                <button 
                  onClick={() => { navigate('/upload'); setIsSidebarOpen(false); }}
                  className="flex items-center gap-3 p-3 rounded-xl transition-all w-full text-slate-600 hover:bg-emerald-50 hover:text-emerald-600 focus:ring-2 focus:ring-emerald-500 outline-none"
                >
                  <Camera size={22} className="text-emerald-500" />
                  <span>{t[lang].scanQR}</span>
                </button>

                {!isPremium && (
                  <button 
                    onClick={() => { setView('upgrade'); setIsSidebarOpen(false); }}
                    className={`flex items-center gap-3 p-3 rounded-xl transition-all w-full focus:ring-2 focus:ring-amber-500 outline-none ${view === 'upgrade' ? 'bg-amber-100 text-amber-700 font-bold' : 'bg-amber-500 text-amber-950 font-bold hover:bg-amber-600 shadow-md shadow-amber-200'}`}
                  >
                    <Star size={22} className={view === 'upgrade' ? 'text-amber-600' : 'text-amber-950'} fill="currentColor" />
                    <span>{t[lang].upgrade}</span>
                  </button>
                )}

                <button 
                  onClick={() => { setView('about'); setIsSidebarOpen(false); }}
                  className={`flex items-center gap-3 p-3 rounded-xl transition-all w-full focus:ring-2 focus:ring-emerald-500 outline-none ${view === 'about' ? 'bg-emerald-100 text-emerald-700 font-bold' : 'text-slate-600 hover:bg-slate-50'}`}
                >
                  <AlertCircle size={22} className={view === 'about' ? 'text-emerald-600' : 'text-emerald-500'} />
                  <span>{t[lang].aboutUs}</span>
                </button>

                {user && (
                  <div className="mt-auto pt-4 border-t border-slate-100">
                    <div className="flex items-center gap-3 px-3 mb-4">
                      <img 
                        src={user.photoURL || ''} 
                        alt="" 
                        className="w-10 h-10 rounded-full border-2 border-emerald-500 shadow-sm"
                        referrerPolicy="no-referrer"
                      />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-bold text-slate-800 truncate">{user.displayName}</p>
                        <p className="text-[10px] text-slate-500 truncate">{user.email}</p>
                      </div>
                    </div>
                    <button 
                      onClick={handleLogout}
                      className="flex items-center gap-3 p-3 rounded-xl transition-all w-full text-red-500 hover:bg-red-50 focus:ring-2 focus:ring-red-500 outline-none"
                    >
                      <LogOut size={22} />
                      <span className="font-bold">{currentT.logout || 'Logout'}</span>
                    </button>
                  </div>
                )}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Main Content Area */}
      <main className={`flex-1 ${view === 'mushaf' ? 'max-w-7xl' : 'max-w-md lg:max-w-7xl'} w-full mx-auto p-2 sm:p-4 flex flex-col pb-8 transition-all duration-500`}>
        <AnimatePresence mode="wait">
          {view === 'study' && (
            <motion.div key="study" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="h-full">
              <StudyScreen lessons={lessons} onStartGame={startGame} lang={lang} />
            </motion.div>
          )}
          {view === 'game' && activeLesson && (
            <motion.div key="game" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="h-full">
              <GameScreen lesson={activeLesson} onComplete={handleGameComplete} onCancel={() => setView('study')} lang={lang} />
            </motion.div>
          )}
          {view === 'listen' && (
            <motion.div key="listen" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="h-full">
              <ListenScreen lang={lang} />
            </motion.div>
          )}
          {view === 'parent' && (
            <motion.div key="parent" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="h-full">
              <ParentScreen 
                lessons={lessons} 
                onAddLesson={handleAddLesson}
                onDeleteLesson={handleDeleteLesson}
                lang={lang} 
                setLang={setLang} 
                isPremium={isPremium} 
                onUpgrade={() => setView('upgrade')} 
                setIsRemoteModalOpen={setIsRemoteModalOpen}
                newTitle={parentNewTitle}
                setNewTitle={setParentNewTitle}
                newText={parentNewText}
                setNewText={setParentNewText}
                customLang={parentCustomLang}
                setCustomLang={setParentCustomLang}
                isExtractingRemote={isExtractingRemote}
              />
            </motion.div>
          )}
          {view === 'mushaf' && (
            <motion.div key="mushaf" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="h-full flex flex-col">
              <MushafViewer onClose={() => setView('study')} lang={lang} />
            </motion.div>
          )}
          {view === 'about' && (
            <motion.div key="about" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="h-full">
              <AboutScreen lang={lang} />
            </motion.div>
          )}
          {view === 'upgrade' && (
            <motion.div key="upgrade" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="h-full">
              <UpgradeScreen lang={lang} onUpgrade={() => { setIsPremium(true); setView('study'); }} />
            </motion.div>
          )}
          {view === 'leaderboard' && (
            <motion.div key="leaderboard" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="h-full">
              <Leaderboard onBack={() => setView('study')} lang={lang} t={currentT} />
            </motion.div>
          )}
          {view === 'recorder' && (
            <motion.div key="recorder" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="h-full">
              <RecitationRecorder onBack={() => setView('study')} lang={lang} t={currentT} />
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* Hidden constant video loop to keep TV active on older systems (Fallback) */}
      <video 
        id="tv-fallback-video"
        muted 
        loop 
        playsInline 
        className="fixed opacity-0 pointer-events-none w-px h-px z-[-1]"
        aria-hidden="true"
      >
        <source src="data:video/mp4;base64,AAAAIGZ0eXBpc29tAAACAGlzb21pc28yYXZjMW1wNDEAAAAIZnJlZQAAAAptZGF0AAAAEWF2Y0NGAAAAAAAAAAAAAAAAYXZjMS8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8v" type="video/mp4" />
      </video>
    </div>
  );
}

// --- Screens ---

function UpgradeScreen({ lang, onUpgrade }: { lang: Language, onUpgrade: () => void }) {
  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }}
      className="flex flex-col gap-6 py-4 max-w-5xl mx-auto"
    >
      <div className="bg-white p-8 sm:p-12 rounded-[40px] shadow-2xl border border-slate-100 relative overflow-hidden">
        {/* Decorative background */}
        <div className="absolute top-0 right-0 p-8 opacity-5">
          <Sparkles size={200} className="text-emerald-600" />
        </div>

        <div className="flex flex-col items-center text-center mb-12 relative z-10">
          <div className="p-6 bg-emerald-100 rounded-full mb-6">
            <Star className="text-emerald-600" size={64} fill="currentColor" />
          </div>
          <h2 className="text-4xl sm:text-5xl font-black text-slate-800 mb-4">{t[lang].upgrade}</h2>
          <p className="text-slate-500 text-lg max-w-lg">{t[lang].upgradeDesc}</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-12 relative z-10">
          {[
            { icon: <Mic size={24} />, text: t[lang].unlimitedMemorization },
            { icon: <Check size={24} />, text: t[lang].advancedTajweed },
            { icon: <BookOpen size={24} />, text: t[lang].unlimitedLessons },
            { icon: <Download size={24} />, text: t[lang].offlineMode },
          ].map((feature, i) => (
            <div key={i} className="flex items-center gap-5 p-6 bg-slate-50 rounded-3xl border border-slate-100 hover:bg-emerald-50/50 transition-colors">
              <div className="bg-white p-3 rounded-2xl shadow-sm text-emerald-600 font-bold">{feature.icon}</div>
              <span className="font-bold text-slate-700 text-lg">{feature.text}</span>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 relative z-10">
          <button 
            onClick={onUpgrade}
            className="p-8 bg-emerald-500 text-white rounded-[32px] shadow-xl shadow-emerald-100 flex flex-col items-center gap-2 hover:bg-emerald-600 transition-all transform active:scale-95 group"
          >
            <span className="text-2xl font-black">{t[lang].monthlyPlan}</span>
            <span className="text-emerald-100 font-bold text-lg">{t[lang].priceMonthly}</span>
            <div className="mt-4 w-full h-1 bg-white/20 rounded-full overflow-hidden">
               <div className="h-full bg-white w-0 group-hover:w-full transition-all duration-700" />
            </div>
          </button>

          <button 
            onClick={onUpgrade}
            className="p-8 bg-slate-800 text-white rounded-[32px] shadow-xl shadow-slate-200 flex flex-col items-center gap-2 hover:bg-slate-900 transition-all transform active:scale-95 relative overflow-hidden group"
          >
            <div className="absolute -top-1 -right-1 bg-amber-400 text-amber-950 text-xs font-black px-5 py-2 rounded-bl-2xl shadow-md uppercase tracking-wider">
              {t[lang].save25}
            </div>
            <span className="text-2xl font-black">{t[lang].yearlyPlan}</span>
            <span className="text-slate-400 font-bold text-lg">{t[lang].priceYearly}</span>
            <div className="mt-4 w-full h-1 bg-white/10 rounded-full overflow-hidden">
               <div className="h-full bg-emerald-400 w-0 group-hover:w-full transition-all duration-700" />
            </div>
          </button>
        </div>
      </div>
    </motion.div>
  );
}

function AboutScreen({ lang }: { lang: Language }) {
  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }}
      className="flex flex-col gap-6 py-4"
    >
      <div className="bg-white p-8 rounded-3xl shadow-sm border border-slate-100">
        <div className="flex items-center gap-4 mb-6">
          <div className="p-3 bg-emerald-100 rounded-2xl">
            <AlertCircle className="text-emerald-600" size={32} />
          </div>
          <h2 className="text-2xl font-black text-slate-800">{t[lang].aboutUs}</h2>
        </div>

        <div className="space-y-8">
          <section>
            <h3 className="text-lg font-bold text-emerald-600 mb-2">{lang === 'ar' ? t['ar'].myApp : t['en'].myApp}</h3>
            <p className="text-slate-600 leading-relaxed">{t[lang].aboutDesc}</p>
          </section>

          <section>
            <h3 className="text-lg font-bold text-slate-800 mb-2">{t[lang].privacyPolicy}</h3>
            <p className="text-slate-600 leading-relaxed">{t[lang].privacyDesc}</p>
          </section>

          <section>
            <h3 className="text-lg font-bold text-slate-800 mb-2">{t[lang].termsOfUse}</h3>
            <p className="text-slate-600 leading-relaxed">{t[lang].termsDesc}</p>
          </section>

          <div className="p-4 bg-emerald-50 border border-emerald-100 rounded-2xl">
            <div className="flex gap-3">
              <AlertCircle className="text-emerald-500 shrink-0" size={20} />
              <p className="text-sm text-emerald-800 font-medium leading-snug">
                {t[lang].warning}
              </p>
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

function StudyScreen({ lessons, onStartGame, lang }: { lessons: Lesson[], onStartGame: (l: Lesson) => void, lang: Language }) {
  return (
    <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }} className="py-4">
      <h2 className="text-2xl font-bold text-slate-800 mb-6 flex items-center gap-2">
        <BookOpen className="text-emerald-500" />
        {t[lang].memorizationTasks}
      </h2>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {lessons.length === 0 ? (
          <div className="col-span-full text-center p-8 bg-white rounded-2xl border border-slate-100 text-slate-500">
            {t[lang].noTasks}
          </div>
        ) : (
          lessons.map(lesson => (
            <div key={lesson.id} className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100 flex flex-col justify-between gap-4 hover:shadow-md transition-shadow">
              <div className="flex-1 min-w-0">
                <h3 className="font-bold text-lg text-slate-800 line-clamp-2">{lesson.title}</h3>
                <p className="text-sm text-slate-400 mt-2 line-clamp-3 font-arabic">{lesson.text}</p>
              </div>
              <div className="flex items-center gap-2 mt-auto">
                {lesson.type === 'custom' && (
                  <button 
                    onClick={(e) => {
                      e.stopPropagation();
                      window.speechSynthesis.cancel();
                      const utterance = new SpeechSynthesisUtterance(lesson.text);
                      utterance.lang = lesson.lang || 'ar-SA';
                      utterance.rate = 0.9;
                      window.speechSynthesis.speak(utterance);
                    }}
                    className="bg-blue-50 text-blue-600 p-3 rounded-xl hover:bg-blue-100 transition-colors"
                    title={t[lang].listen}
                  >
                    <Headphones size={20} />
                  </button>
                )}
                <button 
                  onClick={() => onStartGame(lesson)}
                  className="flex-1 bg-emerald-100 text-emerald-600 py-3 rounded-xl hover:bg-emerald-200 transition-colors font-bold flex items-center justify-center gap-2"
                >
                  {lang === 'ar' ? 'ابدأ المهمة' : 'Start Task'} <ArrowRight size={20} />
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </motion.div>
  );
}

// --- Game Modes Container ---
function GameScreen({ lesson, onComplete, onCancel, lang }: { lesson: Lesson, onComplete: (coins: number) => void, onCancel: () => void, lang: Language }) {
  const [mode, setMode] = useState<'blanks' | 'order' | 'recite'>('blanks');
  const [isSuccess, setIsSuccess] = useState(false);
  const [earned, setEarned] = useState(0);

  const handleSuccess = (coins: number) => {
    setEarned(coins);
    setIsSuccess(true);
    setTimeout(() => {
      onComplete(coins);
    }, 2500);
  };

  if (isSuccess) {
    return (
      <motion.div initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="flex flex-col items-center justify-center flex-1 py-8 text-center">
        <div className="text-8xl mb-6">🎉</div>
        <h2 className="text-3xl font-bold text-green-500 mb-2">{t[lang].wellDone}</h2>
        <p className="text-slate-600 text-lg mb-8">{t[lang].taskCompleted}</p>
        <div className="flex items-center gap-2 bg-amber-100 text-amber-600 px-6 py-3 rounded-full font-bold text-xl">
          <Coins size={24} />
          <span>+{earned}</span>
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} className="flex flex-col h-full py-4">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-bold text-slate-800">{lesson.title}</h2>
        <button onClick={onCancel} className="p-2 bg-slate-100 text-slate-500 rounded-full hover:bg-slate-200">
          <X size={20} />
        </button>
      </div>

      {/* Mode Selector */}
      <div className="flex bg-slate-200 p-1 rounded-2xl mb-6">
        <button 
          onClick={() => setMode('blanks')}
          className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-xl text-sm font-bold transition-colors ${mode === 'blanks' ? 'bg-white text-emerald-600 shadow-sm' : 'text-slate-500'}`}
        >
          <LayoutGrid size={16} />
          {t[lang].blanks}
        </button>
        <button 
          onClick={() => setMode('order')}
          className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-xl text-sm font-bold transition-colors ${mode === 'order' ? 'bg-white text-emerald-600 shadow-sm' : 'text-slate-500'}`}
        >
          <ListOrdered size={16} />
          {t[lang].order}
        </button>
        <button 
          onClick={() => setMode('recite')}
          className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-xl text-sm font-bold transition-colors ${mode === 'recite' ? 'bg-white text-emerald-600 shadow-sm' : 'text-slate-500'}`}
        >
          <Mic size={16} />
          {t[lang].recite}
        </button>
      </div>

      {/* Render Active Game Mode */}
      <div className="flex-1 flex flex-col">
        {mode === 'blanks' && <BlanksGame lesson={lesson} onSuccess={() => handleSuccess(ScoreService.calculatePoints(lesson.text, 'blanks'))} lang={lang} />}
        {mode === 'order' && <OrderGame lesson={lesson} onSuccess={() => handleSuccess(ScoreService.calculatePoints(lesson.text, 'order'))} lang={lang} />}
        {mode === 'recite' && <ReciteGame lesson={lesson} onSuccess={() => handleSuccess(ScoreService.calculatePoints(lesson.text, 'recite'))} lang={lang} />}
      </div>
    </motion.div>
  );
}

// --- Game Mode 1: Blanks ---
function BlanksGame({ lesson, onSuccess, lang }: { lesson: Lesson, onSuccess: () => void, lang: Language }) {
  const [words, setWords] = useState<{word: string, isHidden: boolean, id: number}[]>([]);
  const [options, setOptions] = useState<{word: string, id: number}[]>([]);
  const [filledBlanks, setFilledBlanks] = useState<Record<number, string>>({});

  useEffect(() => {
    // Better split using regex to handle any whitespace and potentially attached punctuation/markers
    const textWords = lesson.text.split(/\s+/).filter(w => w.trim() !== '');
    const gameWords = textWords.map((word, index) => {
      // Is this word a potential candidate for hiding?
      // 1. Must be longer than 1 character
      // 2. Must not be just a number or a lone verse marker/ornament
      const isVisibleOnly = /^[\d٠-٩()\[\]{}۝]+$/.test(word) || word.length <= 1 || word === '۝';
      
      return { 
        word, 
        isHidden: !isVisibleOnly && Math.random() > 0.6, 
        id: index 
      };
    });
    if (!gameWords.some(w => w.isHidden) && gameWords.length > 0) {
      // Force at least one hidden word if none were selected, pick the longest word
      const candidates = gameWords.filter(w => {
        const isVisibleOnly = /^[\d٠-٩()\[\]{}۝]+$/.test(w.word) || w.word.length <= 1 || w.word === '۝';
        return !isVisibleOnly;
      });
      if (candidates.length > 0) {
        const longestIdx = candidates.reduce((a, b, idx) => b.word.length > candidates[a].word.length ? idx : a, 0);
        candidates[longestIdx].isHidden = true;
      }
    }
    setWords(gameWords);
    setOptions(gameWords.filter(w => w.isHidden).map(w => ({ word: w.word, id: w.id })).sort(() => Math.random() - 0.5));
    setFilledBlanks({});
  }, [lesson]);

  const handleOptionClick = (option: {word: string, id: number}) => {
    const firstEmptyIndex = words.findIndex(w => w.isHidden && !filledBlanks[w.id]);
    if (firstEmptyIndex !== -1) {
      const targetId = words[firstEmptyIndex].id;
      setFilledBlanks(prev => ({ ...prev, [targetId]: option.word }));
      setOptions(prev => prev.filter(o => o.id !== option.id));
    }
  };

  const handleBlankClick = (id: number) => {
    if (filledBlanks[id]) {
      setOptions(prev => [...prev, { word: filledBlanks[id], id }]);
      const newBlanks = { ...filledBlanks };
      delete newBlanks[id];
      setFilledBlanks(newBlanks);
    }
  };

  const checkAnswer = () => {
    // Check if the current filled blank matches the word
    const isBlankCorrect = (blankText: string, wordText: string) => {
      const norm1 = normalizeArabic(blankText || '');
      const norm2 = normalizeArabic(wordText);
      return norm1 === norm2 || norm1.replace(/ا/g, '') === norm2.replace(/ا/g, '');
    };

    const correct = words.every(w => !w.isHidden || isBlankCorrect(filledBlanks[w.id], w.word));
    if (correct) onSuccess();
    else alert(t[lang].someErrorsTryAgain);
  };

  const isAllFilled = words.filter(w => w.isHidden).length === Object.keys(filledBlanks).length;

  return (
    <>
    <div className="bg-slate-50/50 p-6 sm:p-10 rounded-[32px] border border-slate-100 flex-1 flex flex-col">
      <div className="bg-white p-6 sm:p-8 rounded-3xl shadow-sm border border-slate-50 mb-6 flex-1 flex flex-col justify-center">
        <p className="text-slate-400 text-sm mb-8 text-center font-bold tracking-widest uppercase italic">{t[lang].fillBlanksInstructions}</p>
        <div className="flex flex-wrap gap-4 leading-[2.8] text-2xl sm:text-3xl font-quran text-slate-800 justify-center dir-rtl">
          {words.map((w, i) => {
            const isOrnament = w.word === '۝' || /^[\d٠-٩]+$/.test(w.word);
            if (!w.isHidden) return (
              <span key={i} className={`px-1 ${isOrnament ? 'text-slate-300 opacity-40 mx-2 scale-110' : ''}`}>
                {w.word}
              </span>
            );
            const filledWord = filledBlanks[w.id];
            return (
              <button
                key={i} onClick={() => handleBlankClick(w.id)}
                className={`min-w-[100px] h-12 px-5 rounded-2xl border-2 flex items-center justify-center transition-all ${filledWord ? 'bg-emerald-50 border-emerald-300 text-emerald-600 scale-105' : 'bg-slate-50 border-dashed border-slate-200 text-transparent'}`}
              >
                <span className="font-quran translate-y-[-2px]">{filledWord}</span>
                {!filledWord && <span className="bg-slate-200 w-full h-1 rounded-full opacity-30 px-4" />}
              </button>
            );
          })}
        </div>
      </div>
      <div className="bg-white/50 p-6 rounded-[32px] border border-slate-100/50 min-h-[140px] shadow-inner">
        <div className="flex flex-wrap gap-4 justify-center">
          <AnimatePresence>
            {options.map(opt => (
              <motion.button
                key={opt.id} initial={{ scale: 0, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0, opacity: 0 }}
                onClick={() => handleOptionClick(opt)}
                className="bg-white px-6 py-4 rounded-2xl shadow-md font-quran text-xl text-emerald-600 border border-emerald-50 hover:bg-emerald-50 hover:-translate-y-1 transition-all active:scale-95"
              >
                {opt.word}
              </motion.button>
            ))}
          </AnimatePresence>
          {options.length === 0 && isAllFilled && (
            <motion.button
              initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} onClick={checkAnswer}
              className="w-full bg-emerald-500 text-white font-bold text-xl py-5 rounded-2xl shadow-xl shadow-emerald-100 flex items-center justify-center gap-3 mt-4 hover:bg-emerald-600 transition-all"
            >
              <Check size={28} /> {t[lang].checkAnswer}
            </motion.button>
          )}
        </div>
      </div>
    </div>
    </>
  );
}

// --- Game Mode 2: Ordering ---
function OrderGame({ lesson, onSuccess, lang }: { lesson: Lesson, onSuccess: () => void, lang: Language }) {
  const [chunks, setChunks] = useState<{id: number, text: string}[]>([]);
  const [selected, setSelected] = useState<{id: number, text: string}[]>([]);

  useEffect(() => {
    const words = lesson.text.split(/\s+/).filter(w => w.trim() !== '');
    const newChunks = [];
    // Split into chunks of 2 words for easier ordering
    for(let i=0; i<words.length; i+=2) {
      newChunks.push({ id: i, text: words.slice(i, i+2).join(' ') });
    }
    setChunks(newChunks.sort(() => Math.random() - 0.5));
    setSelected([]);
  }, [lesson]);

  const selectChunk = (chunk: {id: number, text: string}) => {
    setSelected([...selected, chunk]);
    setChunks(chunks.filter(c => c.id !== chunk.id));
  };

  const deselectChunk = (chunk: {id: number, text: string}) => {
    setChunks([...chunks, chunk]);
    setSelected(selected.filter(c => c.id !== chunk.id));
  };

  const checkAnswer = () => {
    const currentText = selected.map(c => c.text).join(' ');
    if (normalizeArabic(currentText) === normalizeArabic(lesson.text)) onSuccess();
    else alert(t[lang].incorrectOrderTryAgain);
  };

  return (
    <>
      <div className="bg-slate-50/50 p-6 sm:p-10 rounded-[32px] border border-slate-100 flex-1 flex flex-col">
        <div className="bg-white p-6 sm:p-8 rounded-3xl shadow-sm border border-slate-50 mb-6 flex-1 flex flex-col justify-center">
          <p className="text-slate-400 text-sm mb-8 text-center font-bold tracking-widest uppercase italic">{t[lang].orderInstructions}</p>
          <div className="flex flex-wrap gap-4 leading-[2.8] text-2xl sm:text-3xl font-quran text-slate-800 justify-center dir-rtl min-h-[120px]">
            <AnimatePresence mode="popLayout">
              {selected.map((chunk, idx) => (
                <motion.button
                  key={`${chunk.id}-${idx}`} initial={{ scale: 0, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0, opacity: 0 }}
                  onClick={() => deselectChunk(chunk)}
                  className="px-2 hover:text-emerald-600 hover:scale-105 transition-all"
                >
                  {chunk.text}
                </motion.button>
              ))}
              {selected.length === 0 && (
                <p className="text-slate-300 italic font-sans text-xl">{t[lang].clickSentencesToOrder || "Click chunks to build the verse"}</p>
              )}
            </AnimatePresence>
          </div>
        </div>

        <div className="bg-white/50 p-6 rounded-[32px] border border-slate-100/50 min-h-[140px] shadow-inner">
          <div className="flex flex-wrap gap-4 justify-center">
            <AnimatePresence>
              {chunks.map(chunk => (
                <motion.button
                  key={chunk.id} initial={{ scale: 0, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0, opacity: 0 }}
                  onClick={() => selectChunk(chunk)}
                  className="bg-white px-6 py-4 rounded-2xl shadow-md font-quran text-xl text-slate-700 border border-slate-100 hover:bg-emerald-50 hover:-translate-y-1 transition-all active:scale-95"
                >
                  {chunk.text}
                </motion.button>
              ))}
            </AnimatePresence>
            {chunks.length === 0 && selected.length > 0 && (
              <motion.button
                initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} onClick={checkAnswer}
                className="w-full bg-emerald-500 text-white font-bold text-xl py-5 rounded-2xl shadow-xl shadow-emerald-100 flex items-center justify-center gap-3 mt-4 hover:bg-emerald-600 transition-all font-sans"
              >
                <Check size={28} /> {t[lang].checkOrder}
              </motion.button>
            )}
          </div>
        </div>
      </div>
    </>
  );
}

// --- Game Mode 3: Recitation (Voice, Write, Self) ---
function ReciteGame({ lesson, onSuccess, lang }: { lesson: Lesson, onSuccess: () => void, lang: Language }) {
  const [subMode, setSubMode] = useState<'voice' | 'write' | 'self'>('voice');
  const [isRecording, setIsRecording] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [writeText, setWriteText] = useState('');
  const [isSelfRevealed, setIsSelfRevealed] = useState(false);
  const [showHint, setShowHint] = useState(false);
  const [result, setResult] = useState<{ 
    score: number, 
    segments: AlignmentSegment[],
    mistakes?: string[]
  } | null>(null);
  const [error, setError] = useState('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  const recognitionRef = useRef<any>(null);
  const isRecordingRef = useRef(false);
  const isStartedRef = useRef(false);
  const isStartingRef = useRef(false);
  const fullTranscriptRef = useRef('');
  const currentSessionTranscriptRef = useRef('');

  const getRealTimeSegments = () => {
    const targetWords = lesson.text.split(/\s+/);
    const currentInput = subMode === 'voice' ? transcript : writeText;
    const normalizedTarget = targetWords.map(w => normalizeArabic(w));
    const normalizedInput = currentInput.split(/\s+/).map(w => normalizeArabic(w));

    // Simple forward matching for real-time feedback
    let inputIdx = 0;
    return targetWords.map((word, idx) => {
      const isOrnament = word === '۝' || /^[\d٠-٩]+$/.test(word);
      if (isOrnament) return { text: word, revealed: true, isOrnament: true };

      // Try to find this word in the input stream (greedy approach for real-time)
      let found = false;
      const targetNorm = normalizedTarget[idx];
      
      // Look ahead in input a bit to find a match (handling stutters or filler words)
      for (let i = inputIdx; i < Math.min(inputIdx + 10, normalizedInput.length); i++) {
        if (normalizedInput[i] && isWordMatchArabic(targetNorm, normalizedInput[i])) {
          found = true;
          inputIdx = i + 1; // Move pointer forward
          break;
        }
      }

      return { text: word, revealed: found || showHint || isSelfRevealed, isOrnament: false };
    });
  };

  const renderMaskedArea = () => {
    const segments = getRealTimeSegments();
    const isTesting = (subMode === 'self' && !isSelfRevealed) || (subMode !== 'self' && !showHint);

    return (
      <div className={`w-full bg-slate-50/50 p-6 sm:p-10 rounded-3xl border border-slate-100 mb-8 text-center transition-all relative group overflow-hidden ${isRecording ? 'border-emerald-200 ring-4 ring-emerald-50/50' : ''}`}>
        <div className="flex flex-wrap justify-center gap-x-2 gap-y-4 dir-rtl leading-[2.5]">
          {segments.map((seg, i) => (
            <motion.span
              key={i}
              initial={seg.revealed ? { opacity: 0, y: 5 } : false}
              animate={seg.revealed ? { opacity: 1, y: 0 } : { opacity: 1 }}
              className={`text-2xl sm:text-3xl font-quran transition-all ${
                seg.revealed 
                  ? (seg.isOrnament ? 'text-slate-300 opacity-40 mx-2 scale-110' : 'text-slate-800') 
                  : 'text-slate-200 select-none'
              }`}
            >
              {seg.revealed ? seg.text : (seg.isOrnament ? seg.text : '____')}
            </motion.span>
          ))}
        </div>
        
        {subMode !== 'self' && (
          <button 
            onClick={() => setShowHint(!showHint)}
            className="absolute bottom-2 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity bg-white border border-slate-200 px-4 py-1 rounded-full text-xs font-bold text-slate-500 hover:text-emerald-600 shadow-sm"
          >
            {showHint ? (lang === 'ar' ? 'إخفاء المساعدة' : 'Hide Hint') : (lang === 'ar' ? 'إظهار المساعدة' : 'Show Hint')}
          </button>
        )}
      </div>
    );
  };

  useEffect(() => {
    // Initialize Speech Recognition
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (SpeechRecognition) {
      const rec = new SpeechRecognition();
      
      // Determine recognition language: prioritize lesson language if it's a custom text, else use app lang
      const recognitionLang = lesson.lang || lang;
      rec.lang = recognitionLang.includes('-') ? recognitionLang : 
                (recognitionLang === 'ar' ? 'ar-SA' : 
                 recognitionLang === 'fr' ? 'fr-FR' : 
                 recognitionLang === 'es' ? 'es-ES' : 
                 recognitionLang === 'zh' ? 'zh-CN' :
                 recognitionLang === 'hi' ? 'hi-IN' :
                 recognitionLang === 'tr' ? 'tr-TR' :
                 recognitionLang === 'ru' ? 'ru-RU' :
                 recognitionLang === 'id' ? 'id-ID' :
                 'en-US');
      
      rec.continuous = true;
      rec.interimResults = true;

      rec.onstart = () => {
        isStartedRef.current = true;
        isStartingRef.current = false;
      };

      rec.onresult = (event: any) => {
        let sessionString = '';
        for (let i = 0; i < event.results.length; i++) {
          const chunk = event.results[i][0].transcript.trim();
          if (!chunk) continue;

          if (i > 0) {
            const prevChunk = event.results[i-1][0].transcript.trim();
            if (prevChunk && chunk.startsWith(prevChunk)) {
              const newPart = chunk.substring(prevChunk.length).trim();
              if (newPart) sessionString += newPart + ' ';
            } else {
              sessionString += chunk + ' ';
            }
          } else {
            sessionString += chunk + ' ';
          }
        }
        currentSessionTranscriptRef.current = sessionString.trim();
        setTranscript((fullTranscriptRef.current + ' ' + currentSessionTranscriptRef.current).trim());
      };

      rec.onerror = (event: any) => {
        if (event.error === 'aborted' || event.error === 'no-speech') return;
        if (event.error === 'not-allowed') {
          setError(t[lang].micPermission);
          isRecordingRef.current = false;
          setIsRecording(false);
        }
      };

      rec.onend = () => {
        isStartedRef.current = false;
        isStartingRef.current = false;
        if (isRecordingRef.current) {
          if (currentSessionTranscriptRef.current) {
            fullTranscriptRef.current = (fullTranscriptRef.current + ' ' + currentSessionTranscriptRef.current).trim();
            currentSessionTranscriptRef.current = '';
          }
          // Debounced restart
          setTimeout(() => {
            if (isRecordingRef.current && !isStartedRef.current && !isStartingRef.current) {
              try { 
                isStartingRef.current = true;
                recognitionRef.current?.start(); 
              } catch (e: any) {
                isStartingRef.current = false;
                if (e.message?.includes('already started')) {
                  // Ignore if already started
                } else {
                  devError(e);
                }
              }
            }
          }, 400);
        } else {
          setIsRecording(false);
        }
      };

      const startRec = () => {
        if (!recognitionRef.current) return;
        if (isStartedRef.current || isStartingRef.current) return;
        
        try {
          isStartingRef.current = true;
          recognitionRef.current.start();
        } catch (e: any) {
          isStartingRef.current = false;
          if (e.message?.includes('already started')) {
            // Safe to ignore
          } else {
            devError(e);
          }
        }
      };

      recognitionRef.current = rec;
      rec._safeStart = startRec; // Attach safe start helper
      
      return () => {
        isRecordingRef.current = false;
        isStartedRef.current = false;
        isStartingRef.current = false;
        rec.onend = null;
        rec.onerror = null;
        rec.onstart = null;
        try { rec.stop(); } catch (e) {}
      };
    } else {
      if (subMode === 'voice') setError(t[lang].speechNotSupported);
    }
  }, [lang, subMode, lesson]);

  const toggleRecording = () => {
    if (isRecordingRef.current) {
      isRecordingRef.current = false;
      setIsRecording(false);
      recognitionRef.current?.stop();
    } else {
      fullTranscriptRef.current = '';
      currentSessionTranscriptRef.current = '';
      setTranscript('');
      setResult(null);
      setError('');
      
      isRecordingRef.current = true;
      setIsRecording(true);
      if (recognitionRef.current?._safeStart) {
        recognitionRef.current._safeStart();
      } else {
        try {
          if (!isStartedRef.current && !isStartingRef.current) {
            isStartingRef.current = true;
            recognitionRef.current?.start();
          }
        } catch (e: any) {
          isStartingRef.current = false;
          if (!e.message?.includes('already started')) {
            devError(e);
          }
        }
      }
    }
  };

  const checkRecitation = async (textToCheck: string) => {
    if (isRecordingRef.current) {
      isRecordingRef.current = false;
      setIsRecording(false);
      recognitionRef.current?.stop();
    }

    const originalWords = lesson.text.split(/\s+/)
      .filter(w => {
        const norm = normalizeArabic(w);
        // Only keep words that have actual letters after normalization
        // This effectively removes isolated punctuation marks, Quranic signs, and verse markers
        return norm.length > 0;
      });
    
    // --- PRE-PROCESS TRANSCRIPT ---
    // STT often separates the "Waw" prefix (e.g., "و الأرض" instead of "والأرض")
    const rawTranscriptWords = textToCheck.split(/\s+/).filter(w => w.trim() !== '');
    const processedTranscript: string[] = [];
    for (let i = 0; i < rawTranscriptWords.length; i++) {
        const current = rawTranscriptWords[i];
        if (current === "و" && i < rawTranscriptWords.length - 1) {
            processedTranscript.push("و" + rawTranscriptWords[i + 1]);
            i++;
        } else {
            processedTranscript.push(current);
        }
    }

    const normalizedOriginal = originalWords.map(w => normalizeArabic(w));
    const normalizedTranscript = processedTranscript.map(w => normalizeArabic(w));

    if (normalizedTranscript.length === 0) {
       setError(t[lang].didNotHear);
       setIsAnalyzing(false);
       return;
    }

    setIsAnalyzing(true);
    setError('');

    try {
      // --- LOCAL COMPARISON LOGIC (Strict Word Alignment) ---
      const n = normalizedOriginal.length;
      const m = normalizedTranscript.length;
      const dp = Array.from({ length: n + 1 }, () => new Array(m + 1).fill(0));

      for (let i = 0; i <= n; i++) dp[i][0] = i;
      for (let j = 0; j <= m; j++) dp[0][j] = j;

      for (let i = 1; i <= n; i++) {
        for (let j = 1; j <= m; j++) {
          const cost = isWordMatchArabic(normalizedOriginal[i - 1], normalizedTranscript[j - 1]) ? 0 : 1;
          dp[i][j] = Math.min(
            dp[i - 1][j] + 1,       // deletion
            dp[i][j - 1] + 1,       // insertion
            dp[i - 1][j - 1] + cost // match/substitution
          );
        }
      }

      const segments: AlignmentSegment[] = [];
      let bi = n;
      let bj = m;

        while (bi > 0 || bj > 0) {
          if (bi > 0 && bj > 0 && isWordMatchArabic(normalizedOriginal[bi - 1], normalizedTranscript[bj - 1]) && dp[bi][bj] === dp[bi - 1][bj - 1]) {
            segments.unshift({ type: 'correct', text: originalWords[bi - 1], originalText: originalWords[bi - 1], origIdx: bi - 1 });
            bi--;
            bj--;
          } else if (bi > 0 && dp[bi][bj] === dp[bi - 1][bj] + 1) {
            segments.unshift({ type: 'deletion', text: originalWords[bi - 1], origIdx: bi - 1 });
            bi--;
          } else if (bj > 0 && dp[bi][bj] === dp[bi][bj - 1] + 1) {
            segments.unshift({ type: 'insertion', text: processedTranscript[bj - 1] });
            bj--;
          } else if (bi > 0 && bj > 0) {
            segments.unshift({ type: 'substitution', text: processedTranscript[bj - 1], originalText: originalWords[bi - 1], origIdx: bi - 1 });
            bi--;
            bj--;
          } else {
            if (bi > 0) {
              segments.unshift({ type: 'deletion', text: originalWords[bi - 1], origIdx: bi - 1 });
              bi--;
            } else if (bj > 0) {
              segments.unshift({ type: 'insertion', text: processedTranscript[bj - 1] });
              bj--;
            }
          }
        }

      // Detect Swapped Verses
      const mistakes: string[] = [];
      const isQuran = lesson.type === 'quran' || lesson.text.includes('۝');
      if (isQuran) {
        // Find verse ranges (start and end word indices)
        const versesList = lesson.text.split('۝').map(v => v.trim()).filter(v => v);
        let currentWordOffset = 0;
        const verseRanges = versesList.map((vStr) => {
          const vWords = vStr.split(/\s+/).filter(w => normalizeArabic(w).length > 0);
          const range = { start: currentWordOffset, end: currentWordOffset + vWords.length - 1 };
          currentWordOffset += vWords.length;
          return range;
        });

        const transcriptNorm = normalizeArabic(textToCheck);
        const foundVerses = versesList.map((vStr, vIdx) => {
          const vNorm = normalizeArabic(vStr);
          const pos = transcriptNorm.indexOf(vNorm);
          return { vIdx, pos };
        }).filter(v => v.pos !== -1).sort((a, b) => a.pos - b.pos);

        for (let k = 0; k < foundVerses.length - 1; k++) {
          if (foundVerses[k].vIdx > foundVerses[k + 1].vIdx) {
            const firstVerseNum = foundVerses[k].vIdx + 1;
            const secondVerseNum = foundVerses[k + 1].vIdx + 1;
            mistakes.push(t[lang].verseSwap.replace('{first}', String(firstVerseNum)).replace('{second}', String(secondVerseNum)));
            
            // Mark related segments as swapped using the pre-calculated verse ranges
            const range = verseRanges[foundVerses[k].vIdx];
            segments.forEach(seg => {
              if (seg.type === 'correct' && seg.origIdx !== undefined && seg.origIdx >= range.start && seg.origIdx <= range.end) {
                seg.type = 'swapped';
              }
            });
          }
        }
      }

      const score = Math.max(0, Math.round(((Math.max(n, m) - dp[n][m]) / Math.max(n, m)) * 100));
      setResult({ score, segments, mistakes });
    } catch (e: any) {
      console.error("Analysis error:", e);
      setError(t[lang].errorAnalyzingRecitation || "Error analyzing recitation. Please try again.");
    } finally {
      setIsAnalyzing(false);
    }
  };

  return (
    <div className="flex flex-col gap-6 h-full overflow-y-auto pb-8">
      {/* Sub-Mode Selector */}
      <div className="flex bg-slate-100 p-1 rounded-2xl shadow-inner">
        <button 
          onClick={() => { setSubMode('voice'); setResult(null); }}
          className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-bold transition-all focus:ring-2 focus:ring-emerald-500 outline-none ${subMode === 'voice' ? 'bg-white text-emerald-600 shadow-md' : 'text-slate-500'}`}
        >
          <Mic size={18} />
          {t[lang].voice}
        </button>
        <button 
          onClick={() => { setSubMode('write'); setResult(null); }}
          className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-bold transition-all focus:ring-2 focus:ring-emerald-500 outline-none ${subMode === 'write' ? 'bg-white text-emerald-600 shadow-md' : 'text-slate-500'}`}
        >
          <Edit3 size={18} />
          {t[lang].write}
        </button>
        <button 
          onClick={() => { setSubMode('self'); setResult(null); }}
          className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-bold transition-all focus:ring-2 focus:ring-emerald-500 outline-none ${subMode === 'self' ? 'bg-white text-emerald-600 shadow-md' : 'text-slate-500'}`}
        >
          <Eye size={18} />
          {t[lang].self}
        </button>
      </div>

      <div className="bg-white p-6 sm:p-8 rounded-[32px] shadow-lg border border-slate-100 flex-1 flex flex-col items-center">
        {isAnalyzing && (
          <div className="flex flex-col items-center justify-center py-12">
            <Loader2 className="w-12 h-12 text-emerald-500 animate-spin mb-4" />
            <p className="text-slate-500 font-bold">{lang.startsWith('ar') ? "جاري التحليل..." : "Analyzing..."}</p>
          </div>
        )}

        {!isAnalyzing && !result && (
          <>
            {/* Real-time Interaction Area (Merged Method) */}
            {renderMaskedArea()}

            {subMode === 'voice' && (
              <>
                <div className="flex flex-col items-center mb-8">
                  <button 
                    onClick={toggleRecording}
                    className={`w-24 h-24 rounded-full flex items-center justify-center mb-4 transition-all focus:ring-4 outline-none shadow-xl ${isRecording ? 'bg-red-500 text-white animate-pulse scale-110 shadow-red-100 ring-red-100' : 'bg-emerald-500 text-white hover:bg-emerald-600 shadow-emerald-100 ring-emerald-100'}`}
                  >
                    {isRecording ? <MicOff size={40} /> : <Mic size={40} />}
                  </button>
                  <p className="text-slate-400 text-sm font-bold tracking-widest uppercase italic">
                    {isRecording ? t[lang].listening : t[lang].clickMicToStart}
                  </p>
                </div>

                {error && <p className="text-red-500 text-sm mb-4 font-bold text-center">{error}</p>}
                
                {/* Visual feedback of what is currently heard (Optional, but useful for debugging) */}
                {transcript && (
                  <div className="w-full bg-slate-50/50 p-4 rounded-2xl border border-dashed border-slate-100 mb-8 text-center animate-in fade-in slide-in-from-bottom-2">
                    <p className="text-slate-400 font-quran text-lg opacity-60">{transcript}</p>
                  </div>
                )}
                
                <div className="flex gap-4 w-full">
                  {transcript && (
                    <button 
                      onClick={() => checkRecitation(transcript)} 
                      className="w-full bg-emerald-500 text-white py-5 rounded-2xl font-bold text-xl shadow-xl shadow-emerald-100 hover:bg-emerald-600 focus:ring-4 focus:ring-emerald-300 outline-none transition-all flex items-center justify-center gap-3"
                    >
                      <Check size={28} /> {t[lang].check}
                    </button>
                  )}
                </div>
              </>
            )}

            {subMode === 'write' && (
              <div className="w-full">
                <textarea 
                  value={writeText} onChange={(e) => setWriteText(e.target.value)}
                  placeholder={t[lang].typeHere}
                  className="w-full p-8 bg-slate-50 border-2 border-slate-100 rounded-[32px] focus:ring-2 focus:ring-emerald-500 outline-none min-h-[200px] text-2xl font-quran mb-6 resize-none transition-all text-center dir-rtl"
                />
                <button onClick={() => checkRecitation(writeText)} disabled={!writeText.trim()} className="w-full bg-emerald-500 text-white py-6 rounded-2xl font-bold text-xl shadow-xl shadow-emerald-100 hover:bg-emerald-600 focus:ring-4 focus:ring-emerald-300 outline-none transition-all flex items-center justify-center gap-3">
                  <Check size={28} /> {t[lang].check}
                </button>
              </div>
            )}

            {subMode === 'self' && (
              <div className="w-full flex flex-col items-center">
                <div className="mt-4 flex gap-4 w-full">
                  <button onClick={() => setIsSelfRevealed(!isSelfRevealed)} className="flex-1 bg-slate-100 text-slate-700 py-5 rounded-2xl font-bold text-lg border-2 border-slate-200 hover:bg-slate-200 focus:ring-4 focus:ring-slate-300 outline-none transition-all flex items-center justify-center gap-2">
                    {isSelfRevealed ? <EyeOff /> : <Eye />} {isSelfRevealed ? t[lang].hideAyah : t[lang].showAyah}
                  </button>
                  <button onClick={() => onSuccess()} className="flex-1 bg-emerald-500 text-white py-5 rounded-2xl font-bold text-lg shadow-lg shadow-emerald-100 hover:bg-emerald-600 focus:ring-4 focus:ring-emerald-300 outline-none transition-all flex items-center justify-center gap-2">
                    <Check /> {t[lang].wellDone}
                  </button>
                </div>
              </div>
            )}
          </>
        )}

        {result && (
          <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="w-full">
            <div className="flex flex-col gap-8 items-start">
              <div className="flex-1 w-full bg-white p-6 sm:p-10 rounded-[40px] border border-slate-100 shadow-sm leading-[2.5] text-2xl sm:text-3xl font-quran text-right dir-rtl">
                <div className="mb-8 text-center lg:text-right border-b border-slate-100 pb-6 flex flex-col sm:flex-row items-center gap-4">
                  <div className="text-5xl">{result.score === 100 ? '🌟' : '💪'}</div>
                  <div className="text-right font-sans">
                    <h3 className={`text-2xl sm:text-3xl font-black ${result.score >= 80 ? 'text-green-600' : 'text-amber-600'}`}>
                      {t[lang].resultScore.replace('{score}', String(result.score))}
                    </h3>
                    <p className="text-slate-400 font-bold">{lang === 'ar' ? 'نتيجتك النهائية' : 'Your final score'}</p>
                  </div>
                </div>
                <div className="flex flex-wrap gap-y-6 justify-center lg:justify-start" dir={APP_LANGUAGES.find(l => l.code === (lesson.lang || lang))?.dir || 'auto'}>
                  {result.segments.map((seg, index) => {
                    const isOrnament = seg.text === '۝' || /^[\d٠-٩]+$/.test(seg.text);
                    if (seg.type === 'correct') {
                      return <span key={index} className={`mx-0.5 px-0.5 ${isOrnament ? 'text-slate-300 opacity-60' : 'text-green-600'}`}>{seg.text}</span>;
                    }
                    if (seg.type === 'swapped') {
                      return <span key={index} className="mx-0.5 px-0.5 text-purple-600 underline decoration-purple-200 decoration-4 underline-offset-8">{seg.text}</span>;
                    }
                    if (seg.type === 'deletion') {
                      return (
                        <span key={index} className="group relative mx-0.5 px-0.5 text-slate-300 line-through decoration-slate-200 decoration-2">
                          {seg.text}
                          <span className="absolute bottom-full left-1/2 -translate-x-1/2 hidden group-hover:block bg-slate-800 text-white text-xs px-2 py-1 rounded whitespace-nowrap mb-1 font-sans">
                            {lang === 'ar' ? 'كلمة ناقصة' : 'Missing word'}
                          </span>
                        </span>
                      );
                    }
                    if (seg.type === 'substitution') {
                      return (
                        <span key={index} className="group relative mx-0.5 px-0.5 text-red-500 border-b-4 border-red-100">
                          {seg.text}
                          <span className="absolute bottom-full left-1/2 -translate-x-1/2 hidden group-hover:block bg-red-600 text-white text-xs px-2 py-1 rounded whitespace-nowrap mb-1 font-sans">
                            {lang === 'ar' ? `بدلاً من: ${seg.originalText}` : `Instead of: ${seg.originalText}`}
                          </span>
                        </span>
                      );
                    }
                    if (seg.type === 'insertion') {
                       return (
                        <span key={index} className="group relative mx-0.5 px-0.5 text-amber-600 italic">
                          {seg.text}
                          <span className="absolute bottom-full left-1/2 -translate-x-1/2 hidden group-hover:block bg-amber-600 text-white text-xs px-2 py-1 rounded whitespace-nowrap mb-1 font-sans">
                            {lang === 'ar' ? 'كلمة زائدة' : 'Extra word'}
                          </span>
                        </span>
                      );
                    }
                    return null;
                  })}
                </div>
              </div>

              {result.mistakes && result.mistakes.length > 0 && (
                <div className="w-full lg:w-1/3 text-right bg-red-50/50 p-6 rounded-[32px] border-2 border-red-100 shadow-sm sticky top-0">
                  <h4 className="font-black text-red-700 mb-5 text-xl flex items-center gap-3 justify-end border-b border-red-100 pb-3">
                    {lang.startsWith('ar') ? 'تنبيهات الأخطاء' : 'Error Alerts'} <AlertCircle size={24} />
                  </h4>
                  <ul className="space-y-3">
                    {result.mistakes.map((mistake, idx) => (
                      <li key={idx} className="text-base sm:text-lg text-red-600 flex items-start gap-2 justify-end bg-white/50 p-3 rounded-xl border border-red-50">
                        <span>{mistake}</span>
                        <span className="mt-1.5 w-1.5 h-1.5 bg-red-400 rounded-full flex-shrink-0" />
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>

            <div className="flex flex-col sm:flex-row gap-4 w-full mt-10">
              <button 
                onClick={() => { setResult(null); setTranscript(''); setWriteText(''); setIsSelfRevealed(false); }} 
                className="flex-1 bg-slate-100 text-slate-600 py-6 rounded-2xl font-bold text-xl flex items-center justify-center gap-3 hover:bg-slate-200 transition-all border-2 border-slate-200"
              >
                <RefreshCw size={24} /> {t[lang].reciteAgain}
              </button>
              <button 
                onClick={onSuccess} 
                className="flex-[2] bg-emerald-600 text-white py-6 rounded-2xl font-bold text-xl flex items-center justify-center gap-3 shadow-xl shadow-emerald-100 hover:bg-emerald-700 transition-all transform active:scale-95"
              >
                <CheckCircle size={24} /> {lang === 'ar' ? 'حفظ التقدم ومتابعة' : 'Save Progress & Continue'}
              </button>
            </div>
          </motion.div>
        )}
      </div>
    </div>
  );
}

// --- Parent Screen (Dashboard) ---
function ParentScreen({ 
  lessons, onAddLesson, onDeleteLesson, lang, setLang, isPremium, onUpgrade, setIsRemoteModalOpen,
  newTitle, setNewTitle, newText, setNewText, customLang, setCustomLang, isExtractingRemote
}: { 
  lessons: Lesson[], 
  onAddLesson: (l: Omit<Lesson, 'id'>) => Promise<void>,
  onDeleteLesson: (id: string) => Promise<void>,
  lang: Language, 
  setLang: (l: Language) => void, 
  isPremium: boolean, 
  onUpgrade: () => void,
  setIsRemoteModalOpen: (o: boolean) => void,
  newTitle: string,
  setNewTitle: (t: string) => void,
  newText: string,
  setNewText: (t: string) => void,
  customLang: string,
  setCustomLang: (l: string) => void,
  isExtractingRemote: boolean
}) {
  const [addMode, setAddMode] = useState<'custom' | 'quran'>('quran');
  
  // Quran state
  const [surahs, setSurahs] = useState<any[]>(QURAN_SURAHS);
  const [selectedSurah, setSelectedSurah] = useState<number>(1);
  const [startAyah, setStartAyah] = useState<number>(1);
  const [endAyah, setEndAyah] = useState<number>(7);
  const [isLoadingQuran, setIsLoadingQuran] = useState(false);
  const [isTextSearchOpen, setIsTextSearchOpen] = useState(false);

  const handleAddCustom = async () => {
    if (!isPremium && lessons.length >= 5) {
      onUpgrade();
      return;
    }
    if (newTitle.trim() && newText.trim()) {
      await onAddLesson({ 
        title: newTitle, 
        text: newText, 
        type: 'custom',
        lang: customLang
      });
      setNewTitle('');
      setNewText('');
    }
  };

  const handleAddQuran = async () => {
    if (!isPremium && lessons.length >= 5) {
      onUpgrade();
      return;
    }
    setIsLoadingQuran(true);
    try {
      const data = await fetchAyahs(selectedSurah, startAyah, endAyah);
      const selectedAyahs = data.ayahs;
      
      // Join ayahs with the beautiful end-of-ayah symbol
      // Ensure clean spacing around ornaments to avoid splitting issues in games
      let text = selectedAyahs.map((a: any) => a.text.trim()).join(' ۝ ') + ' ۝';
      
      // Critical Step: Pre-split symbols that might be attached to words (like digits or markers)
      // This ensures words like "الَّذِي" are always correctly isolated
      text = text
        .replace(/([^\s])([٠-٩0-9۝])/g, '$1 $2') // Add space before symbol/digit if attached
        .replace(/([٠-٩0-9۝])([^\s])/g, '$1 $2') // Add space after symbol/digit if attached
        .replace(/[\u200B-\u200D\uFEFF]/g, '')   // Remove zero-width characters
        .replace(/\s+/g, ' ')                   // Normalize all spaces
        .trim();

      const surahName = data.surahName || '';
      const title = `${surahName} ${t[lang].ayahsRange.replace('{start}', String(startAyah)).replace('{end}', String(endAyah))}`;
      
      await onAddLesson({ title, text, type: 'quran' });
      alert(t[lang].ayahsAddedSuccessfully);
    } catch (e) {
      alert(t[lang].errorFetchingAyahsCheckInternet);
    }
    setIsLoadingQuran(false);
  };

  const handleDelete = async (id: string) => {
    await onDeleteLesson(id);
  };

  const activeSurah = surahs.find(s => s.number === selectedSurah);
  const maxAyahs = activeSurah ? activeSurah.numberOfAyahs : 1;

  return (
    <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="py-4">
      <h2 className="text-2xl font-bold text-slate-800 mb-6 flex items-center gap-2">
        <Settings className="text-slate-500" />
        {t[lang].parentDashboard}
      </h2>

      <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100 mb-6 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-emerald-50 text-emerald-600 rounded-2xl flex items-center justify-center">
            <ImageIcon size={24} />
          </div>
          <div>
            <h3 className="font-bold text-slate-800">{t[lang].remoteUploadTitle}</h3>
            <p className="text-sm text-slate-500">{t[lang].connectPhone}</p>
          </div>
        </div>
        <button 
          onClick={() => setIsRemoteModalOpen(true)}
          className="bg-emerald-600 text-white px-6 py-3 rounded-2xl font-bold text-sm shadow-lg shadow-emerald-100 hover:bg-emerald-700 transition-all flex items-center gap-2"
        >
          <Plus size={18} />
          {t[lang].connectPhone}
        </button>
      </div>



      <div className="bg-white p-5 rounded-3xl shadow-sm border border-slate-100 mb-8">
        {/* Mode Toggle */}
        <div className="flex bg-slate-100 p-1 rounded-2xl mb-6">
          <button 
            onClick={() => setAddMode('quran')}
            className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-xl text-sm font-bold transition-colors ${addMode === 'quran' ? 'bg-white text-emerald-600 shadow-sm' : 'text-slate-500'}`}
          >
            <Book size={16} />
            {t[lang].quran}
          </button>
          <button 
            onClick={() => setAddMode('custom')}
            className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-xl text-sm font-bold transition-colors ${addMode === 'custom' ? 'bg-white text-emerald-600 shadow-sm' : 'text-slate-500'}`}
          >
            <Edit3 size={16} />
            {t[lang].customTexts}
          </button>
        </div>

        {addMode === 'custom' ? (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="relative">
            {isExtractingRemote && (
              <div className="absolute inset-0 z-10 bg-white/60 backdrop-blur-[2px] flex flex-col items-center justify-center rounded-2xl">
                <Loader2 className="w-10 h-10 text-emerald-600 animate-spin mb-2" />
                <p className="font-bold text-emerald-700">{lang === 'ar' ? 'جاري استخراج النص من الهاتف...' : 'Extracting text from phone...'}</p>
              </div>
            )}
            <h3 className="font-bold text-lg mb-4">{t[lang].addNewTask}</h3>
            <input 
              type="text" 
              placeholder={t[lang].taskTitle}
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 mb-6 focus:outline-none focus:ring-2 focus:ring-emerald-500 font-bold"
            />
            
            <CustomTextInput 
              text={newText}
              setText={setNewText}
              customLang={customLang}
              setCustomLang={setCustomLang}
              onAction={handleAddCustom}
              actionLabel={t[lang].add}
              actionIcon={<Plus size={20} />}
              lang={lang}
              setLang={setLang}
              isParentMode={true}
            />
          </motion.div>
        ) : (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            <h3 className="font-bold text-lg mb-4">{t[lang].chooseSurah}</h3>
            
            <button
              type="button"
              onClick={() => setIsTextSearchOpen(true)}
              className="w-full bg-emerald-50/30 border-2 border-emerald-100/50 rounded-2xl py-4 px-6 text-right flex items-center justify-between hover:border-emerald-300 transition-all focus:border-emerald-500 outline-none shadow-sm group mb-4"
              dir={lang === 'ar' ? 'rtl' : 'ltr'}
            >
              <div className="flex items-center gap-3">
                <Search className="text-emerald-500 group-hover:scale-110 transition-transform" size={24} />
                <span className={`font-bold text-lg ${selectedSurah ? 'text-slate-700' : 'text-slate-400'}`}>
                  {selectedSurah ? surahs.find(s => s.number === selectedSurah)?.name : t[lang].ayahSearchPlaceholder}
                </span>
              </div>
              <ChevronDown className="text-emerald-300" size={24} />
            </button>

            {isTextSearchOpen && (
              <div className="fixed inset-0 z-[3000] flex items-center justify-center bg-black/50 p-4" dir="rtl">
                <div className="bg-white dark:bg-slate-900 rounded-3xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col shadow-2xl">
                  <div className="p-4 border-b border-gray-100 dark:border-slate-800 flex justify-between items-center bg-slate-50/50 dark:bg-slate-800/50">
                    <h3 className="text-xl font-bold text-gray-900 dark:text-white">
                      {lang === 'ar' ? 'بحث في القرآن' : 'Search Quran'}
                    </h3>
                    <button 
                      onClick={() => setIsTextSearchOpen(false)}
                      className="p-2 hover:bg-gray-200 dark:hover:bg-slate-700 rounded-full transition-colors text-gray-500"
                    >
                      <X size={20} />
                    </button>
                  </div>
                  <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
                    <QuranSearchInline
                      lang={lang}
                      onSelect={(surahNum, ayahNum, action) => {
                        setSelectedSurah(surahNum);
                        setStartAyah(ayahNum);
                        const surahData = surahs.find(s => s.number === surahNum);
                        if (surahData) {
                          setEndAyah(surahData.numberOfAyahs);
                        } else {
                          setEndAyah(ayahNum);
                        }
                        setIsTextSearchOpen(false);
                      }}
                    />
                  </div>
                </div>
              </div>
            )}

            {surahs.length === 0 && (
              <div className="flex flex-col items-center justify-center py-8 text-slate-400">
                <Loader2 className="animate-spin mb-2 text-emerald-500" size={32} />
                <p>{t[lang].loadingSurahs}</p>
              </div>
            )}
            
            <div className="flex gap-3 mt-6 mb-6">
                  <div className="flex-1">
                    <label className="block text-sm font-bold text-slate-600 mb-1">{t[lang].fromAyah}:</label>
                    <input 
                      type="number" 
                      min={1} 
                      max={maxAyahs}
                      value={startAyah}
                      onChange={(e) => setStartAyah(Math.min(maxAyahs, Math.max(1, parseInt(e.target.value) || 1)))}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>
                  <div className="flex-1">
                    <label className="block text-sm font-bold text-slate-600 mb-1">{t[lang].toAyah}:</label>
                    <input 
                      type="number" 
                      min={startAyah} 
                      max={maxAyahs}
                      value={endAyah}
                      onChange={(e) => setEndAyah(Math.min(maxAyahs, Math.max(startAyah, parseInt(e.target.value) || startAyah)))}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>
                </div>

                <button 
                  onClick={handleAddQuran}
                  disabled={isLoadingQuran}
                  className="w-full bg-emerald-600 text-white font-bold py-3 rounded-xl flex items-center justify-center gap-2 disabled:opacity-50 hover:bg-emerald-700 transition-colors"
                >
                  {isLoadingQuran ? <Loader2 className="animate-spin" size={20} /> : <Book size={20} />}
                  {isLoadingQuran ? '...' : t[lang].addAyahs}
                </button>
              </motion.div>
            )}
          </div>

      <h3 className="font-bold text-lg mb-4 text-slate-700">{t[lang].currentTasks}</h3>
      <div className="flex flex-col gap-3">
        {lessons.map(lesson => (
          <div key={lesson.id} className="bg-white p-4 rounded-2xl border border-slate-200 flex justify-between items-center">
            <span className="font-bold text-slate-800">{lesson.title}</span>
            <button onClick={() => handleDelete(lesson.id)} className="text-red-500 p-2 hover:bg-red-50 rounded-lg transition-colors">
              <X size={18} />
            </button>
          </div>
        ))}
        {lessons.length === 0 && (
          <p className="text-center text-slate-400 py-4">{t[lang].noTasks}</p>
        )}
      </div>
    </motion.div>
  );
}

