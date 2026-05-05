import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Trophy, Medal, Crown, Star, Coins, Heart, Loader2, User as UserIcon, ArrowLeft } from 'lucide-react';
import { db, auth } from '../firebase';
import { collection, query, orderBy, limit, getDocs, where } from 'firebase/firestore';

interface LeaderboardUser {
  id: string;
  displayName: string;
  photoURL: string;
  xp: number;
  coins: number;
  donations: number;
  totalScore: number;
  countryCode?: string;
}

interface LeaderboardProps {
  onBack: () => void;
  lang: string;
  t: any;
}

type SortType = 'totalScore' | 'xp' | 'donations';

export const Leaderboard: React.FC<LeaderboardProps> = ({ onBack, lang, t }) => {
  const [activeTab, setActiveTab] = useState<SortType>('totalScore');
  const [users, setUsers] = useState<LeaderboardUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentUserRank, setCurrentUserRank] = useState<number | null>(null);

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged((user) => {
      if (user) {
        fetchLeaderboard();
      } else {
        setLoading(false);
      }
    });
    return () => unsubscribe();
  }, [activeTab]);

  const fetchLeaderboard = async () => {
    if (!auth.currentUser) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const q = query(
        collection(db, 'users'),
        orderBy(activeTab, 'desc'),
        limit(100)
      );
      
      const snapshot = await getDocs(q);
      const fetchedUsers: LeaderboardUser[] = [];
      let foundCurrentUser = false;

      let index = 0;
      snapshot.forEach((doc) => {
        const data = doc.data();
        fetchedUsers.push({
          id: doc.id,
          displayName: data.displayName || 'حافظ مجهول',
          photoURL: data.photoURL || '',
          xp: data.xp || 0,
          coins: data.coins || 0,
          donations: data.donations || 0,
          totalScore: data.totalScore || 0,
          countryCode: data.countryCode || '',
        });
        
        if (auth.currentUser && doc.id === auth.currentUser.uid) {
          setCurrentUserRank(index + 1);
          foundCurrentUser = true;
        }
        index++;
      });

      setUsers(fetchedUsers);
      
      if (!foundCurrentUser) {
        setCurrentUserRank(null);
      }
    } catch (error) {
      console.error("Error fetching leaderboard:", error);
    } finally {
      setLoading(false);
    }
  };

  const getRankIcon = (index: number) => {
    if (index === 0) return <Crown className="w-6 h-6 text-yellow-400 animate-pulse" />;
    if (index === 1) return <Medal className="w-6 h-6 text-slate-300" />;
    if (index === 2) return <Medal className="w-6 h-6 text-amber-600" />;
    return <span className="text-gray-400 font-bold">{index + 1}</span>;
  };

  const getFlagEmoji = (countryCode?: string) => {
    if (!countryCode || countryCode === '') return '';
    try {
      const codePoints = countryCode
        .toUpperCase()
        .split('')
        .map(char => 127397 + char.charCodeAt(0));
      return String.fromCodePoint(...codePoints);
    } catch (e) {
      return '';
    }
  };

  const getMetricIcon = () => {
    switch (activeTab) {
      case 'totalScore': return <Trophy className="w-4 h-4 text-emerald-500" />;
      case 'xp': return <Star className="w-4 h-4 text-yellow-500" />;
      case 'donations': return <Heart className="w-4 h-4 text-red-500" />;
    }
  };

  const getMetricValue = (user: LeaderboardUser) => {
    switch (activeTab) {
      case 'totalScore': return user.totalScore;
      case 'xp': return user.xp;
      case 'donations': return user.donations;
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-emerald-50 to-teal-100 p-4 md:p-8" dir={lang === 'ar' || lang === 'ur' ? 'rtl' : 'ltr'}>
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <button 
            onClick={onBack}
            className="p-2 bg-white/80 rounded-full shadow-sm hover:bg-emerald-50 transition-colors"
          >
            <ArrowLeft className={`w-6 h-6 text-emerald-700 ${lang === 'ar' || lang === 'ur' ? 'rotate-180' : ''}`} />
          </button>
          <div className="flex flex-col items-center">
            <h1 className="text-3xl font-black text-emerald-900 font-sans tracking-tight flex items-center gap-2">
              <Trophy className="w-8 h-8 text-yellow-500" />
              {t.leaderboard || "لوحة الشرف"}
            </h1>
            <p className="text-xs text-emerald-600 font-bold uppercase tracking-[0.2em] mt-1">{lang === 'ar' ? 'أفضل 100 حافظ في العالم' : 'Top 100 Globally'}</p>
          </div>
          <div className="w-10"></div>
        </div>

        {/* Tabs */}
        <div className="bg-white/40 backdrop-blur-sm p-1 rounded-2xl flex gap-1 mb-6 shadow-sm ring-1 ring-white/50">
          {(['totalScore', 'xp', 'donations'] as SortType[]).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`flex-1 py-2 rounded-xl text-sm font-medium transition-all duration-300 flex items-center justify-center gap-2 ${
                activeTab === tab 
                ? 'bg-white text-emerald-700 shadow-md scale-[1.02]' 
                : 'text-emerald-900/60 hover:bg-white/40'
              }`}
            >
              {tab === 'totalScore' && <Trophy className="w-4 h-4" />}
              {tab === 'xp' && <Star className="w-4 h-4" />}
              {tab === 'donations' && <Heart className="w-4 h-4" />}
              {tab === 'totalScore' ? (lang === 'ar' ? "الترتيب الذكي" : "Smart Rank") : tab === 'xp' ? (t.xpShort || "XP") : (t.donations || "صدقات")}
            </button>
          ))}
        </div>

        {/* List */}
        <div className="space-y-3">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-20 gap-4">
              <Loader2 className="w-10 h-10 text-emerald-600 animate-spin" />
              <p className="text-emerald-800 font-medium">{t.loadingUsers || "جاري جلب القائمة..."}</p>
            </div>
          ) : (
            <AnimatePresence mode="popLayout">
              {users.map((user, index) => (
                <motion.div
                  key={user.id}
                  layout
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  transition={{ delay: index * 0.05 }}
                  className={`bg-white rounded-2xl p-4 flex items-center justify-between shadow-sm border border-emerald-100 hover:shadow-md transition-shadow relative overflow-hidden ${
                    auth.currentUser?.uid === user.id ? 'ring-2 ring-emerald-500' : ''
                  }`}
                >
                  {/* Rank Badge for Current User */}
                  {auth.currentUser?.uid === user.id && (
                    <div className="absolute top-0 right-0 md:right-auto md:left-0 bg-emerald-500 text-white text-[10px] px-3 py-0.5 rounded-bl-lg md:rounded-bl-none md:rounded-br-lg font-bold">
                      {t.you || "أنت"}
                    </div>
                  )}

                  <div className="flex items-center gap-4">
                    <div className="w-10 flex justify-center">
                      {getRankIcon(index)}
                    </div>
                    
                    <div className="relative">
                      {user.photoURL ? (
                        <img 
                          src={user.photoURL} 
                          alt={user.displayName}
                          className="w-12 h-12 rounded-full object-cover border-2 border-white shadow-sm"
                          referrerPolicy="no-referrer"
                        />
                      ) : (
                        <div className="w-12 h-12 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-600 border-2 border-white shadow-sm">
                          <UserIcon className="w-6 h-6" />
                        </div>
                      )}
                      
                      {index < 3 && (
                        <div className="absolute -top-1 -right-1 bg-white rounded-full p-1 shadow-sm">
                          <Sparkles className={`w-3 h-3 ${index === 0 ? 'text-yellow-500' : index === 1 ? 'text-slate-400' : 'text-amber-600'}`} />
                        </div>
                      )}
                    </div>

                    <div>
                      <h3 className="font-bold text-emerald-900 truncate max-w-[150px] md:max-w-[250px] flex items-center gap-2">
                        {user.displayName}
                        {user.countryCode && (
                          <span className="text-lg" title={user.countryCode}>
                            {getFlagEmoji(user.countryCode)}
                          </span>
                        )}
                      </h3>
                      <div className="flex items-center gap-1.5 text-xs text-emerald-600 font-medium">
                        {getMetricIcon()}
                        <span>{getMetricValue(user)} {activeTab === 'xp' ? (t.xpShort || "XP") : activeTab === 'totalScore' ? (lang === 'ar' ? "نقطة إتقان" : "Points") : (t.donations || "صدقات")}</span>
                      </div>
                    </div>
                  </div>

                  <div className="text-right">
                    <div className={`text-lg font-black font-mono ${
                      index === 0 ? 'text-yellow-600' : 
                      index === 1 ? 'text-slate-500' : 
                      index === 2 ? 'text-amber-700' : 
                      'text-emerald-800'
                    }`}>
                      #{index + 1}
                    </div>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          )}

          {!loading && users.length === 0 && (
            <div className="text-center py-20 text-emerald-800/60 bg-white/20 rounded-3xl backdrop-blur-sm border-2 border-dashed border-emerald-200">
              <Trophy className="w-12 h-12 mx-auto mb-4 opacity-20" />
              <p>{t.noUsersYet || "لا يوجد متنافسون بعد. كن أول من يتصدر!"}</p>
            </div>
          )}
        </div>

        {/* Current User Stats Summary if not in list */}
        {!loading && currentUserRank === null && auth.currentUser && (
            <div className="mt-8 p-4 bg-emerald-600 rounded-2xl flex items-center justify-between text-white shadow-lg shadow-emerald-200/50">
               <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center">
                    <UserIcon className="w-6 h-6" />
                  </div>
                  <div>
                    <p className="text-xs text-emerald-100 font-medium">{t.yourPosition || "مركزك الحالي"}</p>
                    <p className="font-bold text-lg">{auth.currentUser.displayName || "أنت"}</p>
                  </div>
               </div>
               <div className="text-right">
                  <p className="text-xs text-emerald-100 font-medium">{t.rank || "الترتيب"}</p>
                  <p className="font-black text-xl font-mono">20+</p>
               </div>
            </div>
        )}
      </div>
    </div>
  );
};

// Internal Sparkles component used for decoration
const Sparkles = ({ className }: { className: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor">
    <path d="M12 1L14.5 9L22.5 11.5L14.5 14L12 22L9.5 14L1.5 11.5L9.5 9L12 1Z" />
  </svg>
);
