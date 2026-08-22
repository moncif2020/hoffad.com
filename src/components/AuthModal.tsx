import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  X, Mail, Lock, User, Eye, EyeOff, Loader2, 
  CheckCircle2, AlertCircle, ArrowRight, ArrowLeft,
  Sparkles, KeyRound
} from 'lucide-react';
import { 
  signInWithPopup, 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  updateProfile, 
  sendPasswordResetEmail 
} from 'firebase/auth';
import { auth, googleProvider } from '../firebase';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  lang?: string;
  initialMode?: 'signin' | 'signup';
}

export const AuthModal: React.FC<AuthModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  lang = 'ar',
  initialMode = 'signin'
}) => {
  const [mode, setMode] = useState<'signin' | 'signup' | 'forgot'>(initialMode);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resetSent, setResetSent] = useState(false);

  const isRtl = ['ar', 'ur', 'fa'].includes(lang);

  const t = {
    ar: {
      title_signin: 'مرحباً بك في حُفّاظ',
      subtitle_signin: 'سجّل دخولك لمتابعة حفظك والتنافس في لوحة الشرف',
      title_signup: 'إنشاء حساب جديد',
      subtitle_signup: 'انضم لرحلة حفظ القرآن والمتون الذكية مجاناً',
      title_forgot: 'استعادة كلمة المرور',
      subtitle_forgot: 'أدخل بريدك الإلكتروني وسنرسل لك رابط إعادة تعيين كلمة المرور',
      tab_signin: 'تسجيل الدخول',
      tab_signup: 'حساب جديد',
      google_btn: 'المتابعة باستخدام Google',
      or_email: 'أو عبر البريد الإلكتروني',
      name_label: 'الاسم الكريم',
      name_placeholder: 'أدخل اسمك أو كنيتك',
      email_label: 'البريد الإلكتروني',
      email_placeholder: 'name@example.com',
      password_label: 'كلمة المرور',
      password_placeholder: '••••••••',
      forgot_pwd: 'نسيت كلمة المرور؟',
      submit_signin: 'دخول',
      submit_signup: 'إنشاء الحساب',
      submit_forgot: 'إرسال رابط الاستعادة',
      back_to_login: 'العودة لتسجيل الدخول',
      have_account: 'لديك حساب بالفعل؟',
      no_account: 'ليس لديك حساب؟',
      signup_now: 'سجّل الآن',
      reset_sent_title: 'تم إرسال الرابط بنجاح!',
      reset_sent_desc: 'يرجى مراجعة صندوق الوارد (أو الرسائل غير المرغوب فيها) في بريدك الإلكتروني لإعادة تعيين كلمة المرور.',
      
      // Error messages
      err_empty_fields: 'يرجى ملء جميع الحقول المطلوبة.',
      err_weak_pass: 'كلمة المرور ضعيفة جداً، يجب أن تكون 6 أحرف على الأقل.',
      err_email_in_use: 'هذا البريد الإلكتروني مسجل بالفعل. يرجى تسجيل الدخول.',
      err_invalid_email: 'صيغة البريد الإلكتروني غير صحيحة.',
      err_wrong_pass: 'البريد الإلكتروني أو كلمة المرور غير صحيحة.',
      err_user_not_found: 'لم يتم العثور على حساب بهذا البريد الإلكتروني.',
      err_popup_blocked: 'تم حظر النافذة المنبثقة، يرجى السماح بها في متصفحك.',
      err_generic: 'حدث خطأ، يرجى المحاولة مرة أخرى.'
    },
    en: {
      title_signin: 'Welcome to Hoffad',
      subtitle_signin: 'Sign in to track your memorization and climb the leaderboard',
      title_signup: 'Create an Account',
      subtitle_signup: 'Join the smart Quran memorization journey for free',
      title_forgot: 'Reset Password',
      subtitle_forgot: 'Enter your email and we will send you a reset link',
      tab_signin: 'Sign In',
      tab_signup: 'Sign Up',
      google_btn: 'Continue with Google',
      or_email: 'Or with Email',
      name_label: 'Full Name',
      name_placeholder: 'Your name',
      email_label: 'Email Address',
      email_placeholder: 'name@example.com',
      password_label: 'Password',
      password_placeholder: '••••••••',
      forgot_pwd: 'Forgot password?',
      submit_signin: 'Sign In',
      submit_signup: 'Create Account',
      submit_forgot: 'Send Reset Link',
      back_to_login: 'Back to Sign In',
      have_account: 'Already have an account?',
      no_account: "Don't have an account?",
      signup_now: 'Sign up now',
      reset_sent_title: 'Reset link sent!',
      reset_sent_desc: 'Please check your inbox (or spam folder) to reset your password.',
      
      // Error messages
      err_empty_fields: 'Please fill in all required fields.',
      err_weak_pass: 'Password is too weak. Must be at least 6 characters.',
      err_email_in_use: 'This email is already in use. Please sign in.',
      err_invalid_email: 'Invalid email address format.',
      err_wrong_pass: 'Incorrect email or password.',
      err_user_not_found: 'No account found with this email.',
      err_popup_blocked: 'Popup blocked. Please allow popups for this site.',
      err_generic: 'An error occurred. Please try again.'
    },
    fr: {
      title_signin: 'Bienvenue sur Hoffad',
      subtitle_signin: 'Connectez-vous pour suivre votre mémorisation',
      title_signup: 'Créer un compte',
      subtitle_signup: 'Rejoignez la mémorisation intelligente gratuitement',
      title_forgot: 'Mot de passe oublié',
      subtitle_forgot: 'Entrez votre e-mail pour recevoir le lien de réinitialisation',
      tab_signin: 'Connexion',
      tab_signup: 'Inscription',
      google_btn: 'Continuer avec Google',
      or_email: 'Ou avec votre e-mail',
      name_label: 'Nom complet',
      name_placeholder: 'Votre nom',
      email_label: 'Adresse e-mail',
      email_placeholder: 'nom@example.com',
      password_label: 'Mot de passe',
      password_placeholder: '••••••••',
      forgot_pwd: 'Mot de passe oublié ?',
      submit_signin: 'Se connecter',
      submit_signup: 'Créer mon compte',
      submit_forgot: 'Envoyer le lien',
      back_to_login: 'Retour à la connexion',
      have_account: 'Vous avez déjà un compte ?',
      no_account: "Vous n'avez pas de compte ?",
      signup_now: "S'inscrire maintenant",
      reset_sent_title: 'Lien envoyé avec succès !',
      reset_sent_desc: 'Vérifiez votre boîte de réception pour réinitialiser votre mot de passe.',
      
      err_empty_fields: 'Veuillez remplir tous les champs.',
      err_weak_pass: 'Le mot de passe doit comporter au moins 6 caractères.',
      err_email_in_use: 'Cet e-mail est déjà utilisé.',
      err_invalid_email: 'Format d’e-mail invalide.',
      err_wrong_pass: 'E-mail ou mot de passe incorrect.',
      err_user_not_found: 'Aucun compte trouvé avec cet e-mail.',
      err_popup_blocked: 'Fenêtre bloquée par le navigateur.',
      err_generic: 'Une erreur est survenue.'
    }
  };

  const currentTexts = t[lang as keyof typeof t] || t.ar;

  const translateFirebaseError = (errCode: string): string => {
    switch (errCode) {
      case 'auth/email-already-in-use':
        return currentTexts.err_email_in_use;
      case 'auth/weak-password':
        return currentTexts.err_weak_pass;
      case 'auth/invalid-email':
        return currentTexts.err_invalid_email;
      case 'auth/wrong-password':
      case 'auth/invalid-credential':
        return currentTexts.err_wrong_pass;
      case 'auth/user-not-found':
        return currentTexts.err_user_not_found;
      case 'auth/popup-blocked':
        return currentTexts.err_popup_blocked;
      default:
        return currentTexts.err_generic;
    }
  };

  const handleGoogleSignIn = async () => {
    setError(null);
    setIsGoogleLoading(true);
    try {
      await signInWithPopup(auth, googleProvider);
      onSuccess();
      onClose();
    } catch (err: any) {
      console.error("Google Auth Error:", err);
      setError(translateFirebaseError(err.code));
    } finally {
      setIsGoogleLoading(false);
    }
  };

  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (mode === 'forgot') {
      if (!email.trim()) {
        setError(currentTexts.err_empty_fields);
        return;
      }
      setIsLoading(true);
      try {
        await sendPasswordResetEmail(auth, email.trim());
        setResetSent(true);
      } catch (err: any) {
        console.error("Password Reset Error:", err);
        setError(translateFirebaseError(err.code));
      } finally {
        setIsLoading(false);
      }
      return;
    }

    if (!email.trim() || !password.trim()) {
      setError(currentTexts.err_empty_fields);
      return;
    }

    if (mode === 'signup' && !name.trim()) {
      setError(currentTexts.err_empty_fields);
      return;
    }

    setIsLoading(true);
    try {
      if (mode === 'signup') {
        const userCred = await createUserWithEmailAndPassword(auth, email.trim(), password);
        if (name.trim()) {
          await updateProfile(userCred.user, {
            displayName: name.trim(),
            photoURL: `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(name.trim())}`
          });
        }
      } else {
        await signInWithEmailAndPassword(auth, email.trim(), password);
      }
      onSuccess();
      onClose();
    } catch (err: any) {
      console.error("Email Auth Error:", err);
      setError(translateFirebaseError(err.code));
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div 
        className="fixed inset-0 z-[2500] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm"
        dir={isRtl ? 'rtl' : 'ltr'}
      >
        {/* Backdrop click */}
        <div className="fixed inset-0" onClick={onClose} />

        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 15 }}
          transition={{ duration: 0.2, ease: "easeOut" }}
          className="relative w-full max-w-md bg-white rounded-3xl shadow-2xl border border-slate-100 overflow-hidden z-10"
        >
          {/* Top Header Decorative Banner */}
          <div className="bg-gradient-to-r from-emerald-600 to-teal-600 p-6 text-white text-center relative overflow-hidden">
            <div className="absolute -top-12 -right-12 w-32 h-32 bg-white/10 rounded-full blur-xl pointer-events-none" />
            <div className="absolute -bottom-12 -left-12 w-32 h-32 bg-emerald-400/20 rounded-full blur-xl pointer-events-none" />

            <button
              onClick={onClose}
              className="absolute top-4 start-4 p-2 text-white/80 hover:text-white hover:bg-white/10 rounded-full transition-colors"
              aria-label="Close"
            >
              <X size={20} />
            </button>

            <div className="w-14 h-14 bg-white/20 backdrop-blur-md rounded-2xl flex items-center justify-center mx-auto mb-3 border border-white/30 shadow-inner">
              <img src="/logo.svg" alt="Hoffad" className="w-9 h-9 object-contain" />
            </div>

            <h2 className="text-2xl font-black tracking-tight">
              {mode === 'signin' && currentTexts.title_signin}
              {mode === 'signup' && currentTexts.title_signup}
              {mode === 'forgot' && currentTexts.title_forgot}
            </h2>
            <p className="text-emerald-100 text-xs sm:text-sm mt-1 max-w-xs mx-auto leading-relaxed">
              {mode === 'signin' && currentTexts.subtitle_signin}
              {mode === 'signup' && currentTexts.subtitle_signup}
              {mode === 'forgot' && currentTexts.subtitle_forgot}
            </p>
          </div>

          <div className="p-6">
            {/* Mode Switch Tabs (Only when not in forgot mode) */}
            {mode !== 'forgot' && (
              <div className="flex bg-slate-100 p-1 rounded-2xl mb-6">
                <button
                  type="button"
                  onClick={() => { setMode('signin'); setError(null); }}
                  className={`flex-1 py-2.5 rounded-xl font-bold text-sm transition-all flex items-center justify-center gap-2 ${
                    mode === 'signin'
                      ? 'bg-white text-emerald-700 shadow-sm'
                      : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  <span>{currentTexts.tab_signin}</span>
                </button>
                <button
                  type="button"
                  onClick={() => { setMode('signup'); setError(null); }}
                  className={`flex-1 py-2.5 rounded-xl font-bold text-sm transition-all flex items-center justify-center gap-2 ${
                    mode === 'signup'
                      ? 'bg-white text-emerald-700 shadow-sm'
                      : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  <Sparkles size={14} className="text-amber-500" />
                  <span>{currentTexts.tab_signup}</span>
                </button>
              </div>
            )}

            {/* Error Message banner */}
            {error && (
              <motion.div
                initial={{ opacity: 0, y: -5 }}
                animate={{ opacity: 1, y: 0 }}
                className="mb-4 p-3.5 bg-red-50 border border-red-200 text-red-700 rounded-2xl text-xs sm:text-sm flex flex-col gap-2"
              >
                <div className="flex items-start gap-2.5">
                  <AlertCircle size={18} className="shrink-0 mt-0.5" />
                  <span className="leading-snug flex-1">{error}</span>
                </div>
                {mode === 'signup' && error === currentTexts.err_email_in_use && (
                  <button
                    type="button"
                    onClick={() => { setMode('signin'); setError(null); }}
                    className="self-end text-xs font-bold text-emerald-700 underline hover:text-emerald-800"
                  >
                    {currentTexts.tab_signin} ←
                  </button>
                )}
              </motion.div>
            )}

            {/* Forgot Password Success State */}
            {mode === 'forgot' && resetSent ? (
              <div className="text-center py-6">
                <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-4">
                  <CheckCircle2 size={36} />
                </div>
                <h3 className="text-lg font-bold text-slate-800 mb-2">{currentTexts.reset_sent_title}</h3>
                <p className="text-slate-600 text-sm leading-relaxed mb-6">{currentTexts.reset_sent_desc}</p>
                <button
                  onClick={() => { setMode('signin'); setResetSent(false); }}
                  className="w-full bg-emerald-600 text-white font-bold py-3.5 rounded-2xl hover:bg-emerald-700 transition-colors"
                >
                  {currentTexts.back_to_login}
                </button>
              </div>
            ) : (
              <>
                {/* Google Sign In Button (Shown in Signin and Signup modes) */}
                {mode !== 'forgot' && (
                  <>
                    <button
                      type="button"
                      onClick={handleGoogleSignIn}
                      disabled={isGoogleLoading || isLoading}
                      className="w-full bg-white border-2 border-slate-200 hover:border-emerald-300 hover:bg-slate-50 text-slate-700 font-bold py-3 px-4 rounded-2xl transition-all shadow-sm flex items-center justify-center gap-3 active:scale-[0.99] disabled:opacity-60"
                    >
                      {isGoogleLoading ? (
                        <Loader2 size={20} className="animate-spin text-emerald-600" />
                      ) : (
                        <svg className="w-5 h-5 shrink-0" viewBox="0 0 24 24">
                          <path
                            fill="#4285F4"
                            d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                          />
                          <path
                            fill="#34A853"
                            d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                          />
                          <path
                            fill="#FBBC05"
                            d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                          />
                          <path
                            fill="#EA4335"
                            d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                          />
                        </svg>
                      )}
                      <span>{currentTexts.google_btn}</span>
                    </button>

                    {/* Divider */}
                    <div className="relative my-5">
                      <div className="absolute inset-0 flex items-center">
                        <div className="w-full border-t border-slate-200"></div>
                      </div>
                      <div className="relative flex justify-center text-xs">
                        <span className="bg-white px-3 text-slate-400 font-bold">
                          {currentTexts.or_email}
                        </span>
                      </div>
                    </div>
                  </>
                )}

                {/* Email Form */}
                <form onSubmit={handleEmailSubmit} className="space-y-4">
                  {/* Name field (Only in Signup) */}
                  {mode === 'signup' && (
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1.5">
                        {currentTexts.name_label}
                      </label>
                      <div className="relative">
                        <div className="absolute inset-y-0 start-0 ps-3.5 flex items-center pointer-events-none text-slate-400">
                          <User size={18} />
                        </div>
                        <input
                          type="text"
                          required
                          value={name}
                          onChange={(e) => setName(e.target.value)}
                          placeholder={currentTexts.name_placeholder}
                          className="w-full ps-10 pe-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-slate-800 text-sm font-medium focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all"
                        />
                      </div>
                    </div>
                  )}

                  {/* Email field */}
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1.5">
                      {currentTexts.email_label}
                    </label>
                    <div className="relative">
                      <div className="absolute inset-y-0 start-0 ps-3.5 flex items-center pointer-events-none text-slate-400">
                        <Mail size={18} />
                      </div>
                      <input
                        type="email"
                        required
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder={currentTexts.email_placeholder}
                        className="w-full ps-10 pe-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-slate-800 text-sm font-medium focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all"
                        dir="ltr"
                      />
                    </div>
                  </div>

                  {/* Password field (Only in Signin and Signup) */}
                  {mode !== 'forgot' && (
                    <div>
                      <div className="flex justify-between items-center mb-1.5">
                        <label className="block text-xs font-bold text-slate-700">
                          {currentTexts.password_label}
                        </label>
                        {mode === 'signin' && (
                          <button
                            type="button"
                            onClick={() => { setMode('forgot'); setError(null); }}
                            className="text-xs font-bold text-emerald-600 hover:text-emerald-700 transition-colors"
                          >
                            {currentTexts.forgot_pwd}
                          </button>
                        )}
                      </div>
                      <div className="relative">
                        <div className="absolute inset-y-0 start-0 ps-3.5 flex items-center pointer-events-none text-slate-400">
                          <Lock size={18} />
                        </div>
                        <input
                          type={showPassword ? 'text' : 'password'}
                          required
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          placeholder={currentTexts.password_placeholder}
                          className="w-full ps-10 pe-11 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-slate-800 text-sm font-medium focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all"
                          dir="ltr"
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          className="absolute inset-y-0 end-0 pe-3.5 flex items-center text-slate-400 hover:text-slate-600 transition-colors"
                        >
                          {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Submit Button */}
                  <button
                    type="submit"
                    disabled={isLoading || isGoogleLoading}
                    className="w-full mt-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-3.5 px-4 rounded-2xl transition-all shadow-md shadow-emerald-200 hover:shadow-lg flex items-center justify-center gap-2 active:scale-[0.99] disabled:opacity-60"
                  >
                    {isLoading ? (
                      <Loader2 size={20} className="animate-spin" />
                    ) : (
                      <>
                        <span>
                          {mode === 'signin' && currentTexts.submit_signin}
                          {mode === 'signup' && currentTexts.submit_signup}
                          {mode === 'forgot' && currentTexts.submit_forgot}
                        </span>
                        {isRtl ? <ArrowLeft size={18} /> : <ArrowRight size={18} />}
                      </>
                    )}
                  </button>
                </form>

                {/* Back to sign in link for forgot mode */}
                {mode === 'forgot' && (
                  <div className="mt-4 text-center">
                    <button
                      type="button"
                      onClick={() => { setMode('signin'); setError(null); }}
                      className="text-xs font-bold text-slate-500 hover:text-slate-800 transition-colors"
                    >
                      {currentTexts.back_to_login}
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
