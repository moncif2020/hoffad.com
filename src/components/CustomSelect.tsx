import React, { useState, useRef, useEffect, useMemo } from 'react';
import { ChevronDown, ChevronUp, Search } from 'lucide-react';

interface Option {
  value: string | number;
  label: string;
}

interface CustomSelectProps {
  value: string | number;
  onChange: (value: any) => void;
  options: Option[];
  className?: string;
  placeholder?: string;
  lang?: string;
}

// Simple normalization for search comparison
const normalizeText = (text: string) => {
  return text
    .toLowerCase()
    .replace(/[\u064B-\u065F]/g, "") // Remove Tashkeel
    .replace(/\u0640/g, "") // Remove Tatweel
    .replace(/[أإآٱ]/g, "ا") // Normalize Alef
    .replace(/ة/g, "ه") // Normalize Ta Marbuta
    .replace(/[ىي]/g, "ي") // Normalize Yaa/Alif Maksura
    .trim();
};

export function CustomSelect({ value, onChange, options, className = '', placeholder = '', lang = 'ar' }: CustomSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const dropdownRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const optionsRef = useRef<(HTMLButtonElement | null)[]>([]);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const filteredOptions = useMemo(() => {
    if (!searchTerm.trim()) return options;
    const term = normalizeText(searchTerm);
    return options.filter(opt => 
      normalizeText(opt.label).includes(term) || 
      opt.value.toString().includes(term)
    );
  }, [options, searchTerm]);

  const selectedOption = options.find(opt => opt.value === value) || options[0];

  useEffect(() => {
    if (isOpen && searchInputRef.current) {
      setTimeout(() => searchInputRef.current?.focus(), 100);
    }
    if (!isOpen) {
      setSearchTerm('');
    }
  }, [isOpen]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Ensure focused item is visible (important for TV)
  const handleFocus = (index: number) => {
    optionsRef.current[index]?.scrollIntoView({
      behavior: 'smooth',
      block: 'nearest'
    });
  };

  const scroll = (direction: 'up' | 'down') => {
    if (scrollContainerRef.current) {
      const scrollAmount = 100;
      scrollContainerRef.current.scrollBy({
        top: direction === 'up' ? -scrollAmount : scrollAmount,
        behavior: 'smooth'
      });
    }
  };

  return (
    <div className={`relative w-full ${isOpen ? 'z-[1000]' : 'z-10'}`} ref={dropdownRef}>
      <div 
        tabIndex={0}
        role="button"
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        onFocus={(e) => e.currentTarget.scrollIntoView({ behavior: 'smooth', block: 'nearest' })}
        className={`flex items-center justify-between w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl cursor-pointer select-none transition-all focus:outline-none focus:ring-2 focus:ring-emerald-500 ${isOpen ? 'ring-2 ring-emerald-500 border-transparent bg-white shadow-sm' : ''} ${className}`}
        onClick={() => setIsOpen(!isOpen)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            setIsOpen(!isOpen);
          }
          if (e.key === 'Escape') setIsOpen(false);
        }}
      >
        <span className="text-slate-700 font-medium truncate">{selectedOption?.label}</span>
        <ChevronDown className={`w-5 h-5 text-slate-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </div>
      
      {isOpen && (
        <div className="absolute z-[1001] w-full mt-2 bg-white border border-slate-200 rounded-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200 flex flex-col">
          {/* Search Input */}
          <div className="p-3 bg-slate-50 border-b border-slate-100 flex items-center gap-2">
            <Search size={18} className="text-slate-400" />
            <input 
              ref={searchInputRef}
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder={placeholder || (lang === 'ar' ? 'البحث...' : 'Search...')}
              className="w-full bg-transparent border-none outline-none font-medium text-slate-700 placeholder:text-slate-400"
              onClick={(e) => e.stopPropagation()}
            />
          </div>

          {/* Top Scroll Indicator */}
          <button 
            type="button"
            onClick={(e) => { e.stopPropagation(); scroll('up'); }}
            className="w-full flex justify-center py-1 bg-slate-50 hover:bg-slate-100 text-slate-400 border-b border-slate-100"
          >
            <ChevronUp size={20} />
          </button>

          <div 
            ref={scrollContainerRef}
            className="max-h-[35vh] overflow-y-auto force-scrollbar scrollbar-thin scrollbar-thumb-slate-300 scrollbar-track-slate-100"
          >
            {filteredOptions.length > 0 ? (
              filteredOptions.map((option, idx) => (
                <button
                  key={option.value}
                  ref={el => { optionsRef.current[idx] = el; }}
                  onFocus={() => handleFocus(idx)}
                  className={`w-full text-start p-4 cursor-pointer hover:bg-emerald-50 focus:bg-emerald-50 focus:outline-none transition-colors ${value === option.value ? 'bg-emerald-100 text-emerald-800 font-bold' : 'text-slate-700'}`}
                  onClick={() => {
                    onChange(option.value);
                    setIsOpen(false);
                  }}
                >
                  {option.label}
                </button>
              ))
            ) : (
              <div className="p-4 text-center text-slate-400 italic">
                {lang === 'ar' ? 'لا توجد نتائج' : 'No results'}
              </div>
            )}
          </div>

          {/* Bottom Scroll Indicator */}
          <button 
            type="button"
            onClick={(e) => { e.stopPropagation(); scroll('down'); }}
            className="w-full flex justify-center py-1 bg-slate-50 hover:bg-slate-100 text-slate-400 border-t border-slate-100"
          >
            <ChevronDown size={20} />
          </button>
        </div>
      )}
    </div>
  );
}
