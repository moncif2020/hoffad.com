import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Download, Share2, Copy, Check, MessageCircle, Sparkles, Award, BookOpen, Star } from 'lucide-react';

interface ShareAchievementModalProps {
  isOpen: boolean;
  onClose: () => void;
  lang?: string;
  userName?: string;
  userScore?: number;
  userXp?: number;
  defaultTitle?: string;
  defaultText?: string;
  surahName?: string;
  ayahRange?: string;
}

export const ShareAchievementModal: React.FC<ShareAchievementModalProps> = ({
  isOpen,
  onClose,
  lang = 'ar',
  userName = 'حافظ القرآن',
  userScore = 150,
  userXp = 50,
  defaultTitle = 'إنجاز حفظ وتلاوة',
  defaultText = '﴿ وَلَقَدْ يَسَّرْنَا الْقُرْآنَ لِلذِّكْرِ فَهَلْ مِن مُّدَّكِرٍ ﴾',
  surahName = '',
  ayahRange = ''
}) => {
  const [achievementType, setAchievementType] = useState<'daily_wird' | 'recitation_score' | 'ayah_reflection'>('daily_wird');
  const [customNote, setCustomNote] = useState('');
  const [copied, setCopied] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const isArabic = lang === 'ar' || lang.startsWith('ar');

  const todayDateFormatted = new Date().toLocaleDateString(isArabic ? 'ar-SA' : 'en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });

  const getShareText = () => {
    let text = '';
    if (achievementType === 'daily_wird') {
      text = isArabic 
        ? `🌟 أتممت بفضل الله ورد اليوم على منصة حُفّاظ لتعلّم وحفظ القرآن الكريم.\n${surahName ? `📖 الورد: ${surahName} ${ayahRange}` : '📖 ورد الحفظ والمراجعة اليومي'}\nانضم إلينا وابدأ حفظك وتسميعك الذكي مجاناً: https://hoffad.com/`
        : `🌟 Completed my daily Quran session on Hoffad App!\n${surahName ? `📖 Surah: ${surahName}` : '📖 Daily Quran Memorization'}\nJoin us and start smart memorization: https://hoffad.com/`;
    } else if (achievementType === 'recitation_score') {
      text = isArabic
        ? `🏆 حققت إنجازاً جديداً في التسميع على منصة حُفّاظ!\n⭐ النقاط: ${userScore} نقطة | الخبرة: ${userXp} XP\nجرّب التسميع الصوتي بالذكاء الاصطناعي الآن: https://hoffad.com/`
        : `🏆 Achieved a new recitation score on Hoffad App!\n⭐ Score: ${userScore} pts | XP: ${userXp} XP\nTry AI Quran Recitation: https://hoffad.com/`;
    } else {
      text = isArabic
        ? `✨ آية وتدبر من منصة حُفّاظ:\n${defaultText}\nشارك الأجر وابدأ تلاوتك الآن: https://hoffad.com/`
        : `✨ Quran reflection from Hoffad App:\n${defaultText}\nRead and listen at: https://hoffad.com/`;
    }
    return text;
  };

  // Draw card on canvas
  const drawCard = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // High resolution canvas for sharp rendering
    const width = 1080;
    const height = 1080;
    canvas.width = width;
    canvas.height = height;

    // 1. Background Gradient (Luxury Olive & Emerald Deep Gradient)
    const bgGrad = ctx.createLinearGradient(0, 0, width, height);
    bgGrad.addColorStop(0, '#064e3b');   // Deep Emerald
    bgGrad.addColorStop(0.5, '#042f2e'); // Deep Teal/Green
    bgGrad.addColorStop(1, '#022c22');   // Dark Forest Green
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, width, height);

    // 2. Decorative Outer Border (Double Gold/Bronze Rim)
    ctx.strokeStyle = '#d97706';
    ctx.lineWidth = 6;
    ctx.strokeRect(40, 40, width - 80, height - 80);

    ctx.strokeStyle = 'rgba(217, 119, 6, 0.4)';
    ctx.lineWidth = 2;
    ctx.strokeRect(55, 55, width - 110, height - 110);

    // Corner Ornaments
    const drawCorner = (x: number, y: number, angle: number) => {
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate((angle * Math.PI) / 180);
      ctx.strokeStyle = '#f59e0b';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(0, 30);
      ctx.lineTo(0, 0);
      ctx.lineTo(30, 0);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(12, 12, 4, 0, 2 * Math.PI);
      ctx.fillStyle = '#fbbf24';
      ctx.fill();
      ctx.restore();
    };

    drawCorner(40, 40, 0);
    drawCorner(width - 40, 40, 90);
    drawCorner(width - 40, height - 40, 180);
    drawCorner(40, height - 40, 270);

    // 3. Central Islamic Arch Frame
    ctx.fillStyle = 'rgba(255, 255, 255, 0.04)';
    ctx.beginPath();
    ctx.roundRect(80, 80, width - 160, height - 160, 32);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.12)';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // 4. Header: Hoffad Logo & Title
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    // App Name / Wreath Icon Marker
    ctx.fillStyle = '#34d399';
    ctx.font = 'bold 34px system-ui, -apple-system, sans-serif';
    ctx.fillText('🌿 مـنـصّـة حُــفَّــاظْ 🌿', width / 2, 145);

    ctx.fillStyle = '#fbbf24';
    ctx.font = 'bold 22px system-ui, -apple-system, sans-serif';
    ctx.fillText('HOFFAD QURAN PLATFORM', width / 2, 185);

    // Divider Line
    ctx.strokeStyle = 'rgba(245, 158, 11, 0.4)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(width / 2 - 180, 215);
    ctx.lineTo(width / 2 + 180, 215);
    ctx.stroke();

    // 5. Achievement Badge & Title
    let titleText = 'بِطَاقَةُ إِنْجَازِ وِرْدِ القُرْآنِ الكَرِيم';
    if (achievementType === 'recitation_score') {
      titleText = 'وَسَامُ التَّفَوُّقِ فِي التَّسْمِيعِ الذَّكِيّ';
    } else if (achievementType === 'ayah_reflection') {
      titleText = 'قَبَسٌ وَتَدَبُّرٌ مِنْ كِتَابِ الله';
    }

    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 44px "Amiri", "Traditional Arabic", serif, system-ui';
    ctx.fillText(titleText, width / 2, 290);

    // User Name Banner
    ctx.fillStyle = 'rgba(16, 185, 129, 0.2)';
    ctx.beginPath();
    ctx.roundRect(width / 2 - 280, 345, 560, 65, 20);
    ctx.fill();
    ctx.strokeStyle = '#10b981';
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.fillStyle = '#6ee7b7';
    ctx.font = 'bold 30px system-ui, -apple-system, sans-serif';
    ctx.fillText(`الحافظ المُوفَّق: ${userName || 'حافظ القرآن'}`, width / 2, 378);

    // 6. Central Card Box (Content Area)
    ctx.fillStyle = 'rgba(0, 0, 0, 0.35)';
    ctx.beginPath();
    ctx.roundRect(120, 445, width - 240, 370, 24);
    ctx.fill();
    ctx.strokeStyle = 'rgba(217, 119, 6, 0.3)';
    ctx.lineWidth = 2;
    ctx.stroke();

    if (achievementType === 'daily_wird') {
      // Verse or Surah detail
      ctx.fillStyle = '#fef08a';
      ctx.font = '36px "Amiri", "Traditional Arabic", serif, system-ui';
      ctx.fillText('﴿ وَلَقَدْ يَسَّرْنَا الْقُرْآنَ لِلذِّكْرِ فَهَلْ مِن مُّدَّكِرٍ ﴾', width / 2, 530);

      ctx.fillStyle = '#e2e8f0';
      ctx.font = 'bold 32px system-ui, -apple-system, sans-serif';
      const detail = surahName ? `أُتِمَّ الورد اليومي من: ${surahName} ${ayahRange}` : 'تم إتمام قراءة ومراجعة الورد اليومي بنجاح وتوفيق';
      ctx.fillText(detail, width / 2, 610);

      if (customNote) {
        ctx.fillStyle = '#a7f3d0';
        ctx.font = '26px system-ui, -apple-system, sans-serif';
        ctx.fillText(`« ${customNote} »`, width / 2, 680);
      } else {
        ctx.fillStyle = '#94a3b8';
        ctx.font = '24px system-ui, -apple-system, sans-serif';
        ctx.fillText('اللهم اجعل القرآن العظيم ربيع قلوبنا ونور صدورنا', width / 2, 680);
      }

      ctx.fillStyle = '#34d399';
      ctx.font = 'bold 28px system-ui, -apple-system, sans-serif';
      ctx.fillText(`⭐ +${userScore || 20} نقطة إنجاز في بستان الحفظ`, width / 2, 750);
    } else if (achievementType === 'recitation_score') {
      // Recitation stats
      ctx.fillStyle = '#fde047';
      ctx.font = 'bold 80px system-ui, -apple-system, sans-serif';
      ctx.fillText(`${userScore} 🏆`, width / 2, 550);

      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 32px system-ui, -apple-system, sans-serif';
      ctx.fillText('مستوى الإتقان: مـمـتـاز ★★★★★', width / 2, 640);

      ctx.fillStyle = '#a7f3d0';
      ctx.font = '26px system-ui, -apple-system, sans-serif';
      ctx.fillText(`مجموع نقاط الخبرة: ${userXp} XP  •  التصنيف الذهبي`, width / 2, 720);
    } else {
      // Ayah reflection
      ctx.fillStyle = '#fef08a';
      ctx.font = '36px "Amiri", "Traditional Arabic", serif, system-ui';
      ctx.fillText(defaultText, width / 2, 550);

      ctx.fillStyle = '#e2e8f0';
      ctx.font = '28px system-ui, -apple-system, sans-serif';
      ctx.fillText(customNote || 'تأمّل وتدبّر في معاني كلام ربّ العالمين', width / 2, 660);

      ctx.fillStyle = '#34d399';
      ctx.font = 'bold 26px system-ui, -apple-system, sans-serif';
      ctx.fillText('🌿 منصة حُفّاظ للتسميع والتدبر الذكي', width / 2, 740);
    }

    // 7. Footer: Date & Official Web Link Watermark
    ctx.fillStyle = '#94a3b8';
    ctx.font = '22px system-ui, -apple-system, sans-serif';
    ctx.fillText(`🗓️ ${todayDateFormatted}`, width / 2, 860);

    // Official Web Domain Link Badge
    ctx.fillStyle = 'rgba(255, 255, 255, 0.1)';
    ctx.beginPath();
    ctx.roundRect(width / 2 - 220, 910, 440, 52, 16);
    ctx.fill();

    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 26px system-ui, -apple-system, sans-serif';
    ctx.fillText('🔗 الرابط: hoffad.com', width / 2, 936);
  };

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => {
        drawCard();
      }, 100);
    }
  }, [isOpen, achievementType, userName, userScore, userXp, surahName, ayahRange, customNote]);

  const handleDownload = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    setIsGenerating(true);

    try {
      const imageUri = canvas.toDataURL('image/png');
      const link = document.createElement('a');
      link.download = `hoffad-achievement-${Date.now()}.png`;
      link.href = imageUri;
      link.click();
    } catch (err) {
      console.error("Download error:", err);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleCopy = () => {
    const text = getShareText();
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const handleWhatsApp = () => {
    const text = encodeURIComponent(getShareText());
    window.open(`https://api.whatsapp.com/send?text=${text}`, '_blank');
  };

  const handleNativeShare = async () => {
    const text = getShareText();
    const canvas = canvasRef.current;

    if (navigator.share) {
      if (canvas && navigator.canShare) {
        canvas.toBlob(async (blob) => {
          if (blob) {
            const file = new File([blob], 'hoffad-achievement.png', { type: 'image/png' });
            if (navigator.canShare({ files: [file] })) {
              try {
                await navigator.share({
                  title: 'إنجاز منصة حُفّاظ',
                  text: text,
                  files: [file]
                });
                return;
              } catch (e) {
                // fallback to text share
              }
            }
          }
          try {
            await navigator.share({
              title: 'إنجاز منصة حُفّاظ',
              text: text,
              url: 'https://hoffad.com/'
            });
          } catch (e) {}
        });
      } else {
        try {
          await navigator.share({
            title: 'إنجاز منصة حُفّاظ',
            text: text,
            url: 'https://hoffad.com/'
          });
        } catch (e) {}
      }
    } else {
      handleCopy();
    }
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[4000] flex items-center justify-center bg-black/70 backdrop-blur-md p-3 sm:p-6 overflow-y-auto" dir={isArabic ? 'rtl' : 'ltr'}>
        <motion.div 
          initial={{ opacity: 0, scale: 0.92, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.92, y: 20 }}
          className="bg-white dark:bg-slate-900 rounded-[32px] w-full max-w-2xl shadow-2xl overflow-hidden border border-slate-100 dark:border-slate-800 my-auto flex flex-col max-h-[92vh]"
        >
          {/* Header */}
          <div className="p-4 sm:p-5 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-emerald-50/50 dark:bg-emerald-950/20">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-emerald-500 text-white flex items-center justify-center shadow-md">
                <Award size={22} />
              </div>
              <div>
                <h3 className="text-lg sm:text-xl font-black text-slate-800 dark:text-white">
                  {isArabic ? 'مشاركة بطاقة الإنجاز والورد' : 'Share Achievement Card'}
                </h3>
                <p className="text-xs text-slate-500">
                  {isArabic ? 'انشر وردك اليومي وشجع غيرك على حفظ القرآن' : 'Share your daily progress and inspire others'}
                </p>
              </div>
            </div>
            <button 
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors"
            >
              <X size={20} />
            </button>
          </div>

          {/* Body */}
          <div className="p-4 sm:p-6 overflow-y-auto flex-1 flex flex-col gap-5">
            {/* Type selector */}
            <div className="flex bg-slate-100 dark:bg-slate-800 p-1.5 rounded-2xl gap-1">
              <button
                onClick={() => setAchievementType('daily_wird')}
                className={`flex-1 py-2.5 px-3 rounded-xl text-xs sm:text-sm font-bold transition-all flex items-center justify-center gap-1.5 ${
                  achievementType === 'daily_wird' 
                    ? 'bg-emerald-600 text-white shadow-md' 
                    : 'text-slate-600 dark:text-slate-300 hover:bg-white/50'
                }`}
              >
                <BookOpen size={16} />
                <span>{isArabic ? 'ورد اليوم' : 'Daily Wird'}</span>
              </button>

              <button
                onClick={() => setAchievementType('recitation_score')}
                className={`flex-1 py-2.5 px-3 rounded-xl text-xs sm:text-sm font-bold transition-all flex items-center justify-center gap-1.5 ${
                  achievementType === 'recitation_score' 
                    ? 'bg-emerald-600 text-white shadow-md' 
                    : 'text-slate-600 dark:text-slate-300 hover:bg-white/50'
                }`}
              >
                <Star size={16} />
                <span>{isArabic ? 'وسام التسميع' : 'Recitation Score'}</span>
              </button>

              <button
                onClick={() => setAchievementType('ayah_reflection')}
                className={`flex-1 py-2.5 px-3 rounded-xl text-xs sm:text-sm font-bold transition-all flex items-center justify-center gap-1.5 ${
                  achievementType === 'ayah_reflection' 
                    ? 'bg-emerald-600 text-white shadow-md' 
                    : 'text-slate-600 dark:text-slate-300 hover:bg-white/50'
                }`}
              >
                <Sparkles size={16} />
                <span>{isArabic ? 'آية وتدبر' : 'Reflection'}</span>
              </button>
            </div>

            {/* Note Input */}
            <div>
              <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1.5">
                {isArabic ? 'إضافة كلمة أو دعاء خاص (اختياري):' : 'Add custom note or prayer (optional):'}
              </label>
              <input
                type="text"
                value={customNote}
                onChange={(e) => setCustomNote(e.target.value)}
                placeholder={isArabic ? 'مثال: الحمد لله الذي بنعمته تتم الصالحات' : 'e.g. Grateful for this blessed milestone'}
                className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 text-slate-800 dark:text-slate-100"
                maxLength={60}
              />
            </div>

            {/* Live Canvas Preview */}
            <div className="relative rounded-2xl overflow-hidden border-2 border-emerald-500/30 shadow-lg bg-slate-950 flex items-center justify-center aspect-square max-w-[340px] mx-auto w-full">
              <canvas 
                ref={canvasRef} 
                className="w-full h-full object-contain"
              />
            </div>
          </div>

          {/* Footer Action Buttons */}
          <div className="p-4 sm:p-5 border-t border-slate-100 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/50 flex flex-wrap gap-2 justify-between items-center">
            <button
              onClick={handleDownload}
              disabled={isGenerating}
              className="flex-1 min-w-[140px] bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-3 px-4 rounded-xl shadow-md flex items-center justify-center gap-2 transition-all active:scale-95 text-xs sm:text-sm"
            >
              <Download size={18} />
              <span>{isArabic ? 'تحميل كصورة (PNG)' : 'Download PNG'}</span>
            </button>

            <button
              onClick={handleWhatsApp}
              className="bg-green-500 hover:bg-green-600 text-white font-bold py-3 px-4 rounded-xl shadow-md flex items-center justify-center gap-2 transition-all active:scale-95 text-xs sm:text-sm"
              title="واتساب"
            >
              <MessageCircle size={18} />
              <span>{isArabic ? 'واتساب' : 'WhatsApp'}</span>
            </button>

            <button
              onClick={handleNativeShare}
              className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-4 rounded-xl shadow-md flex items-center justify-center gap-2 transition-all active:scale-95 text-xs sm:text-sm"
            >
              <Share2 size={18} />
              <span>{isArabic ? 'مشاركة' : 'Share'}</span>
            </button>

            <button
              onClick={handleCopy}
              className="p-3 bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 hover:bg-slate-100 text-slate-700 dark:text-slate-200 rounded-xl transition-all"
              title={isArabic ? 'نسخ النص والرابط' : 'Copy link and text'}
            >
              {copied ? <Check size={18} className="text-emerald-500" /> : <Copy size={18} />}
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
