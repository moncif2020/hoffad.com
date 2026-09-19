import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  X, Mail, Send, Check, Copy, ExternalLink, 
  MessageSquare, AlertCircle, Sparkles, User, Tag
} from 'lucide-react';

interface SupportModalProps {
  isOpen: boolean;
  onClose: () => void;
  lang?: string;
  userEmail?: string;
  userName?: string;
}

const SUPPORT_EMAIL = 'mmn323520@gmail.com';

const translations: Record<string, {
  title: string;
  subtitle: string;
  nameLabel: string;
  namePlaceholder: string;
  emailLabel: string;
  emailPlaceholder: string;
  topicLabel: string;
  messageLabel: string;
  messagePlaceholder: string;
  sendBtn: string;
  openGmailBtn: string;
  copyEmailBtn: string;
  copiedSuccess: string;
  officialEmailTitle: string;
  topics: { id: string; label: string }[];
  validationError: string;
  sentSuccessTitle: string;
  sentSuccessDesc: string;
  closeBtn: string;
  quickNote: string;
}> = {
  ar: {
    title: 'الدعم الفني والتواصل',
    subtitle: 'نسعد دائماً بخدمتكم والإجابة عن كافة استفساراتكم واقتراحاتكم لتطوير منصة حُفّاظ.',
    nameLabel: 'الاسم الكريم',
    namePlaceholder: 'أدخل اسمك...',
    emailLabel: 'بريدك الإلكتروني للرد',
    emailPlaceholder: 'example@domain.com',
    topicLabel: 'نوع الرسالة',
    messageLabel: 'نص الرسالة أو الاستفسار',
    messagePlaceholder: 'اكتب رسالتك أو استفسارك هنا بكل وضوح وسنرد عليك في أقرب وقت...',
    sendBtn: 'إرسال عبر تطبيق البريد',
    openGmailBtn: 'فتح عبر Gmail مباشرة',
    copyEmailBtn: 'نسخ عنوان البريد',
    copiedSuccess: 'تم نسخ البريد بنجاح!',
    officialEmailTitle: 'البريد الرسمي للدعم الفني:',
    topics: [
      { id: 'general', label: 'استفسار عام' },
      { id: 'technical', label: 'مشكلة تقنية أو خطأ' },
      { id: 'suggestion', label: 'اقتراح أو فكرة جديدة' },
      { id: 'quran_help', label: 'مساعدة في الحفظ والتسميع' },
      { id: 'other', label: 'أمر آخر' }
    ],
    validationError: 'يرجى كتابة نص الرسالة وبريدك الإلكتروني للمتابعة.',
    sentSuccessTitle: 'جاري فتح نافذة الإرسال...',
    sentSuccessDesc: 'تم تجهيز رسالتك وسيتم إرسالها إلى فريق دعم حُفّاظ على:',
    closeBtn: 'إغلاق',
    quickNote: 'فريق الدعم متاح للرد على استفساراتكم خلال 24 ساعة بإذن الله.'
  },
  en: {
    title: 'Support & Inquiries',
    subtitle: 'We are glad to help you and answer any questions or suggestions to enhance Hoffad platform.',
    nameLabel: 'Your Name',
    namePlaceholder: 'Enter your full name...',
    emailLabel: 'Your Email Address',
    emailPlaceholder: 'example@domain.com',
    topicLabel: 'Message Subject',
    messageLabel: 'Your Message',
    messagePlaceholder: 'Write your message or inquiry here, we will reply promptly...',
    sendBtn: 'Send via Mail Client',
    openGmailBtn: 'Open in Gmail Web',
    copyEmailBtn: 'Copy Support Email',
    copiedSuccess: 'Email copied to clipboard!',
    officialEmailTitle: 'Official Support Email:',
    topics: [
      { id: 'general', label: 'General Inquiry' },
      { id: 'technical', label: 'Technical Issue' },
      { id: 'suggestion', label: 'Feature Suggestion' },
      { id: 'quran_help', label: 'Memorization Support' },
      { id: 'other', label: 'Other Topic' }
    ],
    validationError: 'Please fill in your email address and message before sending.',
    sentSuccessTitle: 'Opening Mail Composer...',
    sentSuccessDesc: 'Your message is formatted and addressed to Hoffad support at:',
    closeBtn: 'Close',
    quickNote: 'Our support team usually replies within 24 hours.'
  },
  fr: {
    title: 'Support & Assistance',
    subtitle: 'Nous sommes ravis de vous aider et de répondre à toutes vos questions et suggestions.',
    nameLabel: 'Votre Nom',
    namePlaceholder: 'Entrez votre nom complet...',
    emailLabel: 'Votre Adresse Email',
    emailPlaceholder: 'exemple@domaine.com',
    topicLabel: 'Objet du message',
    messageLabel: 'Votre Message',
    messagePlaceholder: 'Écrivez votre question ou message ici, nous vous répondrons rapidement...',
    sendBtn: 'Envoyer par Mail',
    openGmailBtn: 'Ouvrir avec Gmail',
    copyEmailBtn: 'Copier l\'email du support',
    copiedSuccess: 'Email copié avec succès !',
    officialEmailTitle: 'Email officiel du support :',
    topics: [
      { id: 'general', label: 'Question générale' },
      { id: 'technical', label: 'Problème technique' },
      { id: 'suggestion', label: 'Suggestion d\'amélioration' },
      { id: 'quran_help', label: 'Aide à la mémorisation' },
      { id: 'other', label: 'Autre sujet' }
    ],
    validationError: 'Veuillez saisir votre email et votre message avant d\'envoyer.',
    sentSuccessTitle: 'Préparation du message...',
    sentSuccessDesc: 'Votre message a été préparé et adressé au support de Hoffad :',
    closeBtn: 'Fermer',
    quickNote: 'Notre équipe de support répond généralement sous 24 heures.'
  }
};

export function SupportModal({ isOpen, onClose, lang = 'ar', userEmail = '', userName = '' }: SupportModalProps) {
  const isRtl = lang === 'ar' || lang === 'ur' || lang === 'fa';
  const t = translations[lang] || translations['ar'];

  const [name, setName] = useState(userName);
  const [email, setEmail] = useState(userEmail);
  const [topic, setTopic] = useState(t.topics[0].id);
  const [message, setMessage] = useState('');
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSuccessState, setIsSuccessState] = useState(false);

  // Sync props when user opens modal
  React.useEffect(() => {
    if (userName && !name) setName(userName);
    if (userEmail && !email) setEmail(userEmail);
  }, [userName, userEmail]);

  if (!isOpen) return null;

  const currentTopicLabel = t.topics.find(top => top.id === topic)?.label || topic;

  const constructEmailBody = () => {
    return [
      `الاسم / Name: ${name || 'زائر / Visitor'}`,
      `البريد الإلكتروني للرد / Reply-To: ${email || 'غير محدد / Unspecified'}`,
      `التصنيف / Category: ${currentTopicLabel}`,
      `التاريخ / Date: ${new Date().toLocaleString()}`,
      `--------------------------------------------------`,
      `نص الرسالة / Message:`,
      message,
      `--------------------------------------------------`,
      `مرسلة عبر منصة حُفّاظ (Hoffad Platform Support System)`
    ].join('\n\n');
  };

  const handleCopyEmail = async () => {
    try {
      await navigator.clipboard.writeText(SUPPORT_EMAIL);
      setCopied(true);
      setTimeout(() => setCopied(false), 3000);
    } catch {
      // Fallback
      setCopied(true);
      setTimeout(() => setCopied(false), 3000);
    }
  };

  const handleSendMailto = (e: React.FormEvent) => {
    e.preventDefault();
    if (!message.trim()) {
      setError(t.validationError);
      return;
    }
    setError(null);

    const subject = encodeURIComponent(`[دعم حُفّاظ] ${currentTopicLabel} - ${name || 'رسالة جديدة'}`);
    const body = encodeURIComponent(constructEmailBody());
    const mailtoUrl = `mailto:${SUPPORT_EMAIL}?subject=${subject}&body=${body}`;

    setIsSuccessState(true);
    window.location.href = mailtoUrl;
  };

  const handleOpenGmail = () => {
    if (!message.trim()) {
      setError(t.validationError);
      return;
    }
    setError(null);

    const subject = encodeURIComponent(`[دعم حُفّاظ] ${currentTopicLabel} - ${name || 'رسالة جديدة'}`);
    const body = encodeURIComponent(constructEmailBody());
    const gmailUrl = `https://mail.google.com/mail/?view=cm&fs=1&to=${SUPPORT_EMAIL}&su=${subject}&body=${body}`;

    setIsSuccessState(true);
    window.open(gmailUrl, '_blank', 'noopener,noreferrer');
  };

  const resetAndClose = () => {
    setIsSuccessState(false);
    setError(null);
    onClose();
  };

  return (
    <AnimatePresence>
      <div 
        className="fixed inset-0 z-[2500] flex items-center justify-center p-3 sm:p-4 bg-slate-950/70 backdrop-blur-sm overflow-y-auto"
        dir={isRtl ? 'rtl' : 'ltr'}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 15 }}
          transition={{ duration: 0.2 }}
          className="relative w-full max-w-lg bg-white rounded-3xl shadow-2xl border border-emerald-100 overflow-hidden my-auto"
        >
          {/* Header Banner */}
          <div className="bg-gradient-to-br from-emerald-700 via-emerald-800 to-teal-900 text-white p-6 sm:p-7 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-40 h-40 bg-white/5 rounded-full blur-2xl -mr-10 -mt-10 pointer-events-none" />
            <div className="absolute bottom-0 left-0 w-32 h-32 bg-amber-400/10 rounded-full blur-xl -ml-8 -mb-8 pointer-events-none" />
            
            <button
              id="support-modal-close-btn"
              onClick={resetAndClose}
              className={`absolute top-4 ${isRtl ? 'left-4' : 'right-4'} p-2 rounded-full text-emerald-100 hover:text-white hover:bg-white/10 transition-colors focus:outline-none`}
              aria-label={t.closeBtn}
            >
              <X size={20} />
            </button>

            <div className="flex items-center gap-3 mb-2">
              <div className="w-12 h-12 rounded-2xl bg-white/15 backdrop-blur-md flex items-center justify-center text-amber-300 border border-white/20 shadow-inner">
                <MessageSquare size={24} />
              </div>
              <div>
                <h3 className="text-xl sm:text-2xl font-bold tracking-tight text-white flex items-center gap-2">
                  <span>{t.title}</span>
                  <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-500/40 text-emerald-100 border border-emerald-400/30">
                    Support
                  </span>
                </h3>
                <p className="text-xs sm:text-sm text-emerald-100/90 mt-0.5 max-w-sm leading-relaxed">
                  {t.subtitle}
                </p>
              </div>
            </div>

            {/* Support Direct Email Chip */}
            <div className="mt-4 pt-3 border-t border-white/10 flex flex-wrap items-center justify-between gap-2 text-xs">
              <span className="text-emerald-200/90 flex items-center gap-1.5 font-medium">
                <Mail size={14} className="text-amber-300" />
                <span>{t.officialEmailTitle}</span>
                <strong className="text-white font-mono tracking-wide underline underline-offset-2">
                  {SUPPORT_EMAIL}
                </strong>
              </span>
              <button
                type="button"
                id="support-copy-email-btn"
                onClick={handleCopyEmail}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white/15 hover:bg-white/25 text-white text-xs font-medium transition-all"
              >
                {copied ? <Check size={13} className="text-emerald-300" /> : <Copy size={13} />}
                <span>{copied ? t.copiedSuccess : t.copyEmailBtn}</span>
              </button>
            </div>
          </div>

          {/* Modal Content */}
          <div className="p-6 sm:p-7">
            {isSuccessState ? (
              <div className="text-center py-6 space-y-4 animate-in fade-in zoom-in duration-200">
                <div className="w-16 h-16 bg-emerald-50 text-emerald-600 rounded-full flex items-center justify-center mx-auto border-4 border-emerald-100">
                  <Check size={32} />
                </div>
                <div>
                  <h4 className="text-xl font-bold text-slate-800">{t.sentSuccessTitle}</h4>
                  <p className="text-sm text-slate-600 mt-1 max-w-xs mx-auto">
                    {t.sentSuccessDesc}{' '}
                    <strong className="text-emerald-700 block font-mono mt-1 text-base">{SUPPORT_EMAIL}</strong>
                  </p>
                </div>
                <p className="text-xs text-slate-500 bg-slate-50 p-3 rounded-xl border border-slate-100 max-w-md mx-auto">
                  {t.quickNote}
                </p>
                <div className="pt-3 flex gap-3 justify-center">
                  <button
                    onClick={resetAndClose}
                    className="px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-medium text-sm transition-colors shadow-sm"
                  >
                    {t.closeBtn}
                  </button>
                  <button
                    onClick={() => setIsSuccessState(false)}
                    className="px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium text-sm transition-colors"
                  >
                    تعديل الرسالة
                  </button>
                </div>
              </div>
            ) : (
              <form onSubmit={handleSendMailto} className="space-y-4">
                {error && (
                  <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl flex items-center gap-2 text-rose-700 text-xs font-medium">
                    <AlertCircle size={16} className="shrink-0" />
                    <span>{error}</span>
                  </div>
                )}

                {/* Name & Email Inputs */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center gap-1">
                      <User size={13} className="text-emerald-600" />
                      <span>{t.nameLabel}</span>
                    </label>
                    <input
                      id="support-name-input"
                      type="text"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder={t.namePlaceholder}
                      className="w-full px-3.5 py-2.5 text-sm rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/40 focus:border-emerald-500 transition-all bg-slate-50/50 hover:bg-white text-slate-800"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center gap-1">
                      <Mail size={13} className="text-emerald-600" />
                      <span>{t.emailLabel}</span>
                      <span className="text-rose-500">*</span>
                    </label>
                    <input
                      id="support-email-input"
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder={t.emailPlaceholder}
                      className="w-full px-3.5 py-2.5 text-sm rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/40 focus:border-emerald-500 transition-all bg-slate-50/50 hover:bg-white text-slate-800"
                    />
                  </div>
                </div>

                {/* Topic Selector */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center gap-1">
                    <Tag size={13} className="text-emerald-600" />
                    <span>{t.topicLabel}</span>
                  </label>
                  <select
                    id="support-topic-select"
                    value={topic}
                    onChange={(e) => setTopic(e.target.value)}
                    className="w-full px-3.5 py-2.5 text-sm rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/40 focus:border-emerald-500 transition-all bg-slate-50/50 hover:bg-white text-slate-800 cursor-pointer"
                  >
                    {t.topics.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.label}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Message Textarea */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center gap-1">
                    <MessageSquare size={13} className="text-emerald-600" />
                    <span>{t.messageLabel}</span>
                    <span className="text-rose-500">*</span>
                  </label>
                  <textarea
                    id="support-message-textarea"
                    required
                    rows={4}
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    placeholder={t.messagePlaceholder}
                    className="w-full px-3.5 py-2.5 text-sm rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/40 focus:border-emerald-500 transition-all bg-slate-50/50 hover:bg-white text-slate-800 resize-none leading-relaxed"
                  />
                </div>

                {/* Actions */}
                <div className="pt-2 space-y-2.5">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    {/* Send via Default Mail App */}
                    <button
                      id="support-send-btn"
                      type="submit"
                      className="w-full py-3 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 active:scale-[0.98] text-white font-medium text-sm flex items-center justify-center gap-2 shadow-md shadow-emerald-600/20 transition-all cursor-pointer"
                    >
                      <Send size={16} />
                      <span>{t.sendBtn}</span>
                    </button>

                    {/* Open in Gmail directly */}
                    <button
                      id="support-gmail-btn"
                      type="button"
                      onClick={handleOpenGmail}
                      className="w-full py-3 px-4 rounded-xl bg-slate-100 hover:bg-slate-200 active:scale-[0.98] text-slate-700 font-medium text-sm flex items-center justify-center gap-2 border border-slate-200/80 transition-all cursor-pointer"
                    >
                      <ExternalLink size={16} className="text-emerald-600" />
                      <span>{t.openGmailBtn}</span>
                    </button>
                  </div>

                  <p className="text-[11px] text-center text-slate-400">
                    {t.quickNote}
                  </p>
                </div>
              </form>
            )}
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
