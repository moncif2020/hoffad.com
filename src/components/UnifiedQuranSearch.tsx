import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown, Search, Check, Loader2, Book, Type } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { searchInQuran, normalizeLatin } from '../lib/quran';

interface Option {
  id: number;
  name: string;
  englishName?: string;
}

interface UnifiedQuranSearchProps {
  options: Option[];
  selectedSurah: number;
  onSelectSurah: (id: number) => void;
  onSelectAyah: (surahNum: number, ayahNum: number) => void;
  placeholder?: string;
  lang?: string;
}

export const UnifiedQuranSearch: React.FC<UnifiedQuranSearchProps> = ({ 
  options, 
  selectedSurah, 
  onSelectSurah, 
  onSelectAyah,
  placeholder, 
  lang = 'ar' 
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState('');
  const [ayahResults, setAyahResults] = useState<any[]>([]);
  const [filteredSurahs, setFilteredSurahs] = useState<Option[]>(options);
  const [isSearchingAyahs, setIsSearchingAyahs] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const currentSurah = options.find(opt => opt.id === selectedSurah);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Debounce search term
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchTerm(searchTerm);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  // Handle results based on debounced term
  useEffect(() => {
    const fetchResults = async () => {
      const term = debouncedSearchTerm.trim();
      
      // 1. Filter Surahs locally
      if (!term) {
        setFilteredSurahs(options);
        setAyahResults([]);
        return;
      }

      const cleanSearch = normalizeLatin(term);
      const filtered = options.filter(opt => {
        return (
          opt.name.toLowerCase().includes(term.toLowerCase()) || 
          (opt.englishName && normalizeLatin(opt.englishName).includes(cleanSearch)) ||
          opt.id.toString().includes(term)
        );
      });
      setFilteredSurahs(filtered);

      // 2. Search for Ayahs (only if not just a short query or numeric)
      if (term.length < 3 || /^\d+$/.test(term)) {
        setAyahResults([]);
        return;
      }

      setIsSearchingAyahs(true);
      try {
        const results = await searchInQuran(term);
        setAyahResults(results.slice(0, 5));
      } catch (err) {
        console.error(err);
      } finally {
        setIsSearchingAyahs(false);
      }
    };

    fetchResults();
  }, [debouncedSearchTerm, options]);

  return (
    <div className="relative w-full" ref={containerRef}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full bg-emerald-50/30 border-2 border-emerald-100/50 rounded-2xl py-4 px-6 text-right flex items-center justify-between hover:border-emerald-300 transition-all focus:border-emerald-500 outline-none shadow-sm group"
        dir={lang === 'ar' ? 'rtl' : 'ltr'}
      >
        <div className="flex items-center gap-3">
          <Search className="text-emerald-500 group-hover:scale-110 transition-transform" size={24} />
          <span className={`font-bold text-lg sm:text-xl ${currentSurah ? 'text-slate-700' : 'text-slate-400'}`}>
            {currentSurah ? currentSurah.name : placeholder}
          </span>
        </div>
        <ChevronDown className={`text-emerald-300 transition-transform ${isOpen ? 'rotate-180' : ''}`} size={24} />
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: -10, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.98 }}
            className="absolute z-[1000] mt-3 w-full bg-white border border-slate-200 rounded-3xl shadow-2xl overflow-hidden"
            dir={lang === 'ar' ? 'rtl' : 'ltr'}
          >
            <div className="p-4 border-b border-slate-100 bg-slate-50 flex items-center gap-3">
              <Search className="text-emerald-500" size={20} />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder={placeholder}
                className="w-full bg-transparent border-none focus:ring-0 text-lg font-bold text-slate-700 outline-none"
                autoFocus
              />
              {isSearchingAyahs && <Loader2 className="animate-spin text-emerald-500" size={18} />}
            </div>
            
            <div className="max-h-[60vh] overflow-y-auto custom-scrollbar p-2">
              {/* Surah Matches */}
              {filteredSurahs.length > 0 && (
                <div className="mb-2">
                  <div className="px-4 py-2 text-[10px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2">
                    <Book size={12} /> {lang === 'ar' ? 'السور والنتائج الرقمية' : 'Surahs & Digital Results'}
                  </div>
                  {filteredSurahs.map((opt) => (
                    <button
                      key={`s-${opt.id}`}
                      onClick={() => {
                        onSelectSurah(opt.id);
                        setIsOpen(false);
                        setSearchTerm('');
                      }}
                      className={`w-full text-right px-4 py-3 rounded-xl hover:bg-emerald-50 transition-colors flex items-center justify-between group mb-1 ${selectedSurah === opt.id ? 'bg-emerald-50 text-emerald-700' : 'text-slate-600'}`}
                    >
                      <div className="flex flex-col">
                        <span className="font-bold text-base">{opt.name}</span>
                        {opt.englishName && <span className="text-[10px] text-slate-400 group-hover:text-emerald-400">{opt.englishName}</span>}
                      </div>
                      {selectedSurah === opt.id && <Check className="text-emerald-500" size={18} />}
                    </button>
                  ))}
                </div>
              )}

              {/* Ayah (Verse) Results - Integrated Fallback/Extra */}
              {ayahResults.length > 0 && (
                <div className="mt-2 border-t border-slate-100 pt-2">
                  <div className="px-4 py-2 text-[10px] font-bold text-emerald-500 uppercase tracking-widest flex items-center gap-2">
                    <Type size={12} /> {lang === 'ar' ? 'نتائج من نص الآيات' : 'Ayah Text Results'}
                  </div>
                  {ayahResults.map((ayah, i) => (
                    <button
                      key={`a-${i}`}
                      onClick={() => {
                        onSelectAyah(ayah.surahNum, ayah.ayahNum);
                        setIsOpen(false);
                        setSearchTerm('');
                      }}
                      className="w-full text-right px-4 py-3 rounded-xl hover:bg-emerald-50 transition-colors border-b border-slate-50 last:border-0 mb-1"
                    >
                      <div className="text-[10px] font-bold text-emerald-600 mb-1">{ayah.surahName} • {lang === 'ar' ? 'آية' : 'Ayah'} {ayah.ayahNum}</div>
                      <div className="text-sm font-medium text-slate-700 font-amiri line-clamp-2 leading-relaxed">
                        {ayah.text}
                      </div>
                    </button>
                  ))}
                </div>
              )}

              {filteredSurahs.length === 0 && ayahResults.length === 0 && (
                <div className="p-8 text-center text-slate-400 font-bold">
                  {lang === 'ar' ? "لا توجد نتائج مطابقة" : "No results found"}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <style>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: #e2e8f0;
          border-radius: 10px;
        }
      `}</style>
    </div>
  );
};
