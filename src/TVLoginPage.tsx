import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { LogIn, CheckCircle, Loader2, Smartphone, Monitor } from 'lucide-react';
import { auth, googleProvider, db } from './firebase';
import { signInWithPopup, onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc, updateDoc, serverTimestamp } from 'firebase/firestore';

export function TVLoginPage() {
  const [searchParams] = useSearchParams();
  const sessionId = searchParams.get('sessionId');
  const [status, setStatus] = useState<'idle' | 'logging-in' | 'linking' | 'success' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    if (!sessionId) {
      setStatus('error');
      setErrorMessage('Invalid session ID. Please scan the QR code again.');
    }
  }, [sessionId]);

  const handleLoginAndLink = async () => {
    if (!sessionId) return;
    setStatus('logging-in');
    try {
      const result = await signInWithPopup(auth, googleProvider);
      const user = result.user;
      setStatus('linking');

      const sessionRef = doc(db, 'tv_sessions', sessionId);
      const sessionSnap = await getDoc(sessionRef);

      if (!sessionSnap.exists()) {
        throw new Error('الجلسة غير موجودة. يرجى مسح رمز QR من جديد.');
      }

      const sessionData = sessionSnap.data();

      if (sessionData.status !== 'waiting') {
        throw new Error('هذه الجلسة مرتبطة بالفعل أو منتهية الصلاحية.');
      }

      // Preserve currentAnonUid — do NOT overwrite it
      await updateDoc(sessionRef, {
        uid: user.uid,
        displayName: user.displayName || 'User',
        email: user.email || '',
        photoURL: user.photoURL || '',
        linkedAt: serverTimestamp(),
        status: 'linked'
        // currentAnonUid stays untouched by updateDoc
      });

      setStatus('success');
      setTimeout(() => navigate('/'), 3000);
    } catch (error: any) {
      console.error("Linking Error:", error);
      setStatus('error');
      setErrorMessage(error.message || 'فشل الربط. يرجى المحاولة مجدداً.');
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6 font-sans">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-md w-full bg-white rounded-[2.5rem] shadow-2xl p-8 text-center border border-slate-100"
      >
        <div className="flex justify-center gap-4 mb-8">
          <div className="w-16 h-16 bg-emerald-100 rounded-2xl flex items-center justify-center text-emerald-600">
            <Smartphone size={32} />
          </div>
          <div className="flex items-center text-slate-300">
            <div className="w-8 h-0.5 bg-current rounded-full"></div>
          </div>
          <div className="w-16 h-16 bg-blue-100 rounded-2xl flex items-center justify-center text-blue-600">
            <Monitor size={32} />
          </div>
        </div>

        <h1 className="text-2xl font-bold text-slate-900 mb-4">
          {status === 'success' ? 'تم الربط بنجاح!' : 'ربط التلفاز بحسابك'}
        </h1>
        
        <p className="text-slate-600 mb-8 leading-relaxed">
          {status === 'idle' && 'قم بتسجيل الدخول بهاتفك لفتح حسابك على شاشة التلفاز مباشرة دون الحاجة لكتابة أي بيانات.'}
          {status === 'logging-in' && 'جاري تسجيل الدخول عبر جوجل...'}
          {status === 'linking' && 'جاري ربط جهاز التلفاز بحسابك...'}
          {status === 'success' && 'تم ربط التلفاز! ستفتح الشاشة الآن تلقائياً على التلفاز.'}
          {status === 'error' && errorMessage}
        </p>

        {status === 'idle' && (
          <button 
            onClick={handleLoginAndLink}
            className="w-full bg-emerald-600 text-white font-bold py-4 rounded-2xl shadow-lg shadow-emerald-100 flex items-center justify-center gap-3 hover:bg-emerald-700 transition-all active:scale-95"
          >
            <LogIn size={20} />
            <span>تسجيل الدخول والربط</span>
          </button>
        )}

        {(status === 'logging-in' || status === 'linking') && (
          <div className="flex flex-col items-center gap-4">
            <Loader2 className="w-12 h-12 text-emerald-500 animate-spin" />
            <span className="text-emerald-600 font-bold">يرجى الانتظار...</span>
          </div>
        )}

        {status === 'success' && (
          <motion.div 
            initial={{ scale: 0.5, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="flex flex-col items-center gap-4"
          >
            <div className="w-20 h-20 bg-emerald-500 text-white rounded-full flex items-center justify-center shadow-xl shadow-emerald-200">
              <CheckCircle size={48} />
            </div>
            <span className="text-emerald-600 font-bold">استمتع بالتطبيق!</span>
          </motion.div>
        )}

        {status === 'error' && (
          <button 
            onClick={() => setStatus('idle')}
            className="w-full bg-slate-100 text-slate-700 font-bold py-4 rounded-2xl border-2 border-slate-200 hover:bg-slate-200 transition-all"
          >
            إعادة المحاولة
          </button>
        )}
      </motion.div>

      <p className="mt-8 text-slate-400 text-sm">
        حفاظ Hoffad &copy; {new Date().getFullYear()}
      </p>
    </div>
  );
}
