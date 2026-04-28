import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, X, Loader2, BookOpen, Play, ArrowRight, ArrowLeft, Eye } from 'lucide-react';
import { searchInQuran, QURAN_SURAHS, normalizeArabic, normalizeLatin, getAudioUrl } from '../lib/quran';
import { useAudio } from '../AudioContext';

interface SearchResult {
  type: 'surah' | 'ayah';
  text: string;
  surahNumber: number;
  surahName: string;
  englishSurahName: string;
  ayahNumber?: number;
}

interface QuranSearchInlineProps {
  onSelect: (surahNumber: number, ayahNumber: number, action: 'view' | 'play', ayahText?: string) => void;
  onBack?: () => void;
  lang: string;
  autoFocus?: boolean;
}

export function QuranSearchInline({ onSelect, onBack, lang, autoFocus = true }: QuranSearchInlineProps) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [ayahMatchesCount, setAyahMatchesCount] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const { isPlaying, reciter } = useAudio();
  const [playingAyahId, setPlayingAyahId] = useState<string | null>(null);

  useEffect(() => {
    if (autoFocus && inputRef.current) {
      inputRef.current.focus();
    }
  }, [autoFocus]);

  useEffect(() => {
    if (!isPlaying) {
      setPlayingAyahId(null);
    }
  }, [isPlaying]);

  useEffect(() => {
    const delayDebounceFn = setTimeout(async () => {
      const trimmedQuery = query.trim();
      if (trimmedQuery.length >= 1) {
        setIsLoading(true);
        
        let unifiedResults: SearchResult[] = [];
        const cleanQuery = normalizeArabic(trimmedQuery);
        const isNumeric = /^\d+$/.test(trimmedQuery);

        // 1. Search Surahs (Local)
        const surahMatches = QURAN_SURAHS.filter(s => {
          if (isNumeric) return s.number === parseInt(trimmedQuery);
          const cleanLatinQuery = normalizeLatin(trimmedQuery);
          return (
            normalizeArabic(s.name).includes(cleanQuery) || 
            normalizeLatin(s.englishName).includes(cleanLatinQuery)
          );
        }).map(s => ({
          type: 'surah' as const,
          text: s.name,
          surahNumber: s.number,
          surahName: s.name,
          englishSurahName: s.englishName,
          ayahNumber: 1
        }));

        unifiedResults = [...surahMatches];

        // 2. Search Ayahs (API) - only if not just a number
        if (!isNumeric && trimmedQuery.length >= 2) {
          const ayahMatches = await searchInQuran(trimmedQuery);
          // Limit total displayed to manage UI, but keep count accurate
          setAyahMatchesCount(ayahMatches.length);
          
          const formattedAyahResults = ayahMatches.map(m => ({
            type: 'ayah' as const,
            text: m.text,
            surahNumber: m.surahNum,
            surahName: m.surahName,
            englishSurahName: m.englishSurahName,
            ayahNumber: m.ayahNum
          }));
          
          unifiedResults = [...unifiedResults, ...formattedAyahResults];
        } else {
          setAyahMatchesCount(0);
        }

        setResults(unifiedResults);
        setIsLoading(false);
      } else {
        setResults([]);
        setAyahMatchesCount(0);
      }
    }, 300);

    return () => clearTimeout(delayDebounceFn);
  }, [query]);

  const surahResults = results.filter(r => r.type === 'surah');
  const ayahResults = results.filter(r => r.type === 'ayah');

  return (
    <div className="flex flex-col h-full max-h-[75vh]" dir={lang === 'ar' ? 'rtl' : 'ltr'}>
      <div className="flex items-center gap-3 mb-4">
        {onBack && (
          <button 
            onClick={onBack}
            className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors text-slate-500"
          >
            {lang === 'ar' ? <ArrowRight size={24} /> : <ArrowLeft size={24} />}
          </button>
        )}
        <div className="flex-1 relative">
          <Search className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 rtl:right-4 rtl:left-auto ltr:left-4 ltr:right-auto" size={20} />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={lang === 'ar' ? "ابحث برقم السورة، اسمها، أو بالآية..." : "Search by surah number, name, or ayah..."}
            className="w-full bg-slate-50 dark:bg-slate-800 border-2 border-transparent focus:border-emerald-500 rounded-2xl py-4 px-12 font-bold outline-none ltr:pl-12 ltr:pr-4 rtl:pr-12 rtl:pl-4 transition-all text-lg shadow-sm"
          />
          {query && (
            <button 
              onClick={() => setQuery('')}
              className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 rtl:left-4 rtl:right-auto ltr:right-4 ltr:left-auto p-1 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-full"
            >
              <X size={18} />
            </button>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto custom-scrollbar pr-1">
        {isLoading && (
          <div className="flex flex-col items-center justify-center py-12 text-slate-400">
            <Loader2 className="animate-spin mb-3 text-emerald-500" size={32} />
            <p className="font-bold">{lang === 'ar' ? 'جاري البحث في المصحف...' : 'Searching Quran...'}</p>
          </div>
        )}

        {!isLoading && query.length > 0 && results.length === 0 && (
          <div className="text-center py-12 text-slate-400">
            <p className="font-bold">{lang === 'ar' ? 'لم يتم العثور على سورة أو آية مطابقة' : 'No matching surah or ayah found'}</p>
          </div>
        )}

        {!isLoading && query.length === 0 && (
          <div className="flex flex-col items-center justify-center py-12 text-slate-400 opacity-50">
            <BookOpen size={48} className="mb-4" />
            <p className="font-bold text-lg">
              {lang === 'ar' ? 'ابدأ البحث...' : 'Start searching...'}
            </p>
          </div>
        )}

        <div className="space-y-6 pb-4">
          {/* Surah Matches */}
          {surahResults.length > 0 && (
            <div>
              <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-3 px-2 flex items-center gap-2">
                <span className="w-2 h-2 bg-emerald-500 rounded-full"></span>
                {lang === 'ar' ? 'السور المطابقة' : 'Matching Surahs'}
              </h4>
              <div className="space-y-2">
                {surahResults.map((result, idx) => (
                  <motion.div
                    key={`surah-${result.surahNumber}-${idx}`}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    className="p-4 bg-white dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800 rounded-2xl hover:border-emerald-500 transition-all group"
                  >
                    <div className="flex justify-between items-center gap-4">
                      <div className="flex items-center gap-3">
                        <span className="w-8 h-8 rounded-lg bg-emerald-100 dark:bg-emerald-900/40 text-emerald-600 flex items-center justify-center font-bold text-sm">
                          {result.surahNumber}
                        </span>
                        <div className="text-right rtl:text-right ltr:text-left">
                          <p className="font-bold text-slate-800 dark:text-slate-200">
                            {lang === 'ar' ? result.surahName : result.englishSurahName}
                          </p>
                          <p className="text-[10px] text-slate-400 font-bold uppercase">
                            {lang === 'ar' ? result.englishSurahName : result.surahName}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <button 
                          onClick={(e) => {
                            e.stopPropagation();
                            setPlayingAyahId(`${result.surahNumber}:1`);
                            onSelect(result.surahNumber, 1, 'play');
                          }}
                          className={`p-2.5 rounded-xl transition-all shadow-sm ${
                            playingAyahId === `${result.surahNumber}:1`
                              ? 'bg-emerald-500 text-white shadow-emerald-200'
                              : 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 hover:bg-emerald-500 hover:text-white'
                          }`}
                          title={lang === 'ar' ? 'استماع للسورة' : 'Listen to Surah'}
                        >
                          {playingAyahId === `${result.surahNumber}:1` ? (
                            <Loader2 className="w-5 h-5 animate-spin" />
                          ) : (
                            <Play size={18} fill="currentColor" />
                          )}
                        </button>
                        <button 
                          onClick={() => onSelect(result.surahNumber, 1, 'view')}
                          className="p-2.5 bg-slate-50 dark:bg-slate-800 text-slate-400 hover:text-emerald-600 rounded-xl transition-all border border-slate-100 dark:border-slate-800"
                          title={lang === 'ar' ? 'فتح في المصحف' : 'Open in Mushaf'}
                        >
                          <Eye size={18} />
                        </button>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>
            </div>
          )}

          {/* Ayah Matches */}
          {ayahResults.length > 0 && (
            <div>
              <div className="flex items-center justify-between mb-3 px-2">
                <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                  <span className="w-2 h-2 bg-orange-500 rounded-full"></span>
                  {lang === 'ar' ? 'الآيات المطابقة' : 'Matching Ayahs'}
                </h4>
                <span className="bg-orange-100 dark:bg-orange-900/20 text-orange-600 px-2 py-0.5 rounded-lg text-[10px] font-black uppercase">
                  {ayahMatchesCount} {lang === 'ar' ? 'نتيجة' : 'Results'}
                </span>
              </div>
              <div className="space-y-3">
                {ayahResults.map((result, idx) => (
                  <motion.div
                    key={`ayah-${result.surahNumber}-${result.ayahNumber}-${idx}`}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: Math.min(idx * 0.05, 0.4) }}
                    className="w-full text-right p-5 rounded-2xl border border-slate-100 dark:border-slate-800 transition-all bg-white dark:bg-slate-800/40 group flex flex-col items-start gap-4"
                  >
                    <div className="flex w-full items-center justify-between gap-4">
                      <div className="flex items-center gap-2">
                        <span className="text-emerald-600 font-black text-[10px] bg-emerald-50 dark:bg-emerald-900/30 px-2 py-1 rounded-lg border border-emerald-100 dark:border-emerald-800/40">
                          {lang === 'ar' ? result.surahName : result.englishSurahName}
                        </span>
                        <span className="text-slate-400 font-black text-[10px] border border-slate-100 dark:border-slate-800 px-2 py-1 rounded-lg">
                          {lang === 'ar' ? 'الآية' : 'Ayah'} {result.ayahNumber}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <button 
                          onClick={(e) => {
                            e.stopPropagation();
                            setPlayingAyahId(`${result.surahNumber}:${result.ayahNumber}`);
                            onSelect(result.surahNumber, result.ayahNumber!, 'play');
                          }}
                          className={`p-2.5 rounded-xl transition-all shadow-sm ${
                            playingAyahId === `${result.surahNumber}:${result.ayahNumber}`
                              ? 'bg-emerald-500 text-white shadow-emerald-200'
                              : 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 hover:bg-emerald-500 hover:text-white'
                          }`}
                          title={lang === 'ar' ? 'استماع للآية' : 'Listen to Ayah'}
                        >
                          {playingAyahId === `${result.surahNumber}:${result.ayahNumber}` ? (
                            <Loader2 className="w-5 h-5 animate-spin" />
                          ) : (
                            <Play size={20} fill="currentColor" />
                          )}
                        </button>
                        <button 
                          onClick={() => onSelect(result.surahNumber, result.ayahNumber || 1, 'view')}
                          className="p-2.5 bg-slate-50 dark:bg-slate-800 text-slate-400 hover:text-emerald-600 rounded-xl transition-all border border-slate-100 dark:border-slate-800"
                          title={lang === 'ar' ? 'فتح في المصحف' : 'Open in Mushaf'}
                        >
                          <Eye size={20} />
                        </button>
                      </div>
                    </div>
                    <p className="font-arabic text-xl font-bold leading-[1.8] text-slate-800 dark:text-slate-200 w-full text-right">
                      {result.text}
                    </p>
                  </motion.div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
