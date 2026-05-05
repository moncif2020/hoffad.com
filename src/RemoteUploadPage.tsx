import React, { useState, useEffect, useRef } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Upload, Mic, Video, Check, Loader2, X, AlertCircle, Camera, QrCode } from 'lucide-react';
import { db, storage, auth, googleProvider } from './firebase';
import { collection, addDoc, serverTimestamp, doc, getDoc } from 'firebase/firestore';
import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import { signInWithPopup, onAuthStateChanged, User, signOut } from 'firebase/auth';
import { Html5QrcodeScanner } from 'html5-qrcode';

export function RemoteUploadPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const deviceId = searchParams.get('dev');
  
  const [status, setStatus] = useState<'idle' | 'uploading' | 'success' | 'error'>('idle');
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState('');
  const [uploadType, setUploadType] = useState<'image' | 'audio' | 'video' | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [isAuthChecking, setIsAuthChecking] = useState(true);
  const navigate = useNavigate();
  const scannerRef = useRef<Html5QrcodeScanner | null>(null);

  // 1. Session Validation on mount
  useEffect(() => {
    if (!deviceId) return;
    
    const validateSession = async () => {
      try {
        const sessionDoc = await getDoc(doc(db, 'tv_sessions', deviceId));
        if (!sessionDoc.exists()) {
          setError("Invalid TV Session. Please refresh your TV.");
          setStatus('error');
        } else {
          // If status is 'waiting', it might still be valid for upload if anonUid is present
          const data = sessionDoc.data();
          if (!data.currentAnonUid) {
            setError("TV is not ready. Please make sure the QR code is visible.");
            setStatus('error');
          }
        }
      } catch (err: any) {
        console.error("Session Validation Error:", err);
        setError("Connection issue. Please check your internet.");
        setStatus('error');
      }
    };
    
    validateSession();
  }, [deviceId]);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setIsAuthChecking(false);
    });
    return () => unsubscribe();
  }, []);

  // QR Scanner Logic
  useEffect(() => {
    if (!deviceId && !isAuthChecking && user) {
      const scanner = new Html5QrcodeScanner(
        "reader",
        { fps: 10, qrbox: { width: 250, height: 250 } },
        /* verbose= */ false
      );

      scanner.render((decodedText) => {
        try {
          const url = new URL(decodedText);
          const dev = url.searchParams.get('dev');
          if (dev) {
            scanner.clear();
            setSearchParams({ dev });
          } else {
            setError('Invalid QR Code. Please scan the code from your TV.');
          }
        } catch (e) {
          setError('Invalid QR Code format.');
        }
      }, (err) => {
        // Silent error for scanning
      });

      scannerRef.current = scanner;
      return () => {
        if (scannerRef.current) {
          scannerRef.current.clear().catch(e => console.error("Scanner cleanup error", e));
        }
      };
    }
  }, [deviceId, isAuthChecking, user, setSearchParams]);

  const handleGoogleLogin = async () => {
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>, type: 'image' | 'audio' | 'video') => {
    const file = e.target.files?.[0];
    if (!file || !deviceId) return;

    // Require login for security
    if (!user) {
      setError('Please login with Google first');
      setStatus('error');
      return;
    }

    // Basic size check (50MB for video, 10MB for others)
    const maxSize = type === 'video' ? 50 * 1024 * 1024 : 10 * 1024 * 1024;
    if (file.size > maxSize) {
      setError(`File too large (max ${type === 'video' ? '50MB' : '10MB'})`);
      setStatus('error');
      return;
    }

    setStatus('uploading');
    setUploadType(type);
    setProgress(0);
    setError('');

    try {
      if (!storage) throw new Error("Storage not initialized.");

      // 1. Fetch TV Session to get the current anonUid
      const sessionDoc = await getDoc(doc(db, 'tv_sessions', deviceId));
      if (!sessionDoc.exists()) {
        throw new Error("Invalid TV Session. Please refresh your TV.");
      }
      const sessionData = sessionDoc.data();
      const anonUid = sessionData.currentAnonUid;

      if (!anonUid || typeof anonUid !== 'string' || anonUid.trim() === '') {
        throw new Error(
          "التلفاز غير جاهز. تأكد من ظهور رمز QR على الشاشة وأن الجلسة نشطة."
        );
      }

      // 2. Upload to Firebase Storage with progress (New Path with anonUid)
      const storageRef = ref(storage, `remote_uploads/${user.uid}/${deviceId}/${anonUid}/${Date.now()}_${file.name}`);
      const uploadTask = uploadBytesResumable(storageRef, file);

      uploadTask.on('state_changed', 
        (snapshot) => {
          const p = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
          setProgress(p);
        }, 
        (err) => {
          console.error("Upload Task Error:", err);
          setError(err.message || 'Upload failed');
          setStatus('error');
        }, 
        async () => {
          try {
            const url = await getDownloadURL(uploadTask.snapshot.ref);
            const fullPath = uploadTask.snapshot.ref.fullPath;

            // 3. Add to Firestore including the anonUid for lookup
            await addDoc(collection(db, 'uploads'), {
              deviceId,
              anonUid,
              userId: user.uid,
              userName: user.displayName,
              type,
              url,
              path: fullPath,
              name: file.name,
              createdAt: serverTimestamp(),
              status: 'pending'
            });

            setStatus('success');
            setTimeout(() => setStatus('idle'), 3000);
          } catch (err: any) {
            console.error("Finalizing Upload Error:", err);
            setError(err.message || 'Failed to save upload info');
            setStatus('error');
          }
        }
      );
    } catch (err: any) {
      console.error("Upload Initiation Error:", err);
      setError(err.message || 'Upload failed to start');
      setStatus('error');
    }
  };

  if (isAuthChecking) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-12 h-12 text-emerald-600 animate-spin mx-auto mb-4" />
          <p className="text-slate-500 font-bold">Checking Authentication...</p>
        </div>
      </div>
    );
  }

  if (!deviceId) {
    return (
      <div className="min-h-screen bg-slate-50 p-6 flex flex-col items-center justify-center">
        <motion.div 
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="bg-white p-8 rounded-[40px] shadow-2xl border border-slate-100 max-w-md w-full overflow-hidden"
        >
          <div className="text-center mb-8">
            <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <Camera size={32} />
            </div>
            <h1 className="text-2xl font-black text-slate-800">Scan TV Code</h1>
            <p className="text-slate-500">Point your camera at the QR code on your TV or computer screen.</p>
          </div>

          <div id="reader" className="overflow-hidden rounded-3xl border-4 border-slate-50 bg-slate-100 min-h-[300px]"></div>

          {error && (
            <div className="mt-6 p-4 bg-red-50 text-red-600 rounded-2xl flex items-center gap-3 text-sm font-bold">
              <AlertCircle size={20} />
              {error}
            </div>
          )}

          <button 
            onClick={() => navigate('/')}
            className="mt-8 w-full p-4 text-slate-400 hover:text-slate-600 font-bold transition-colors"
          >
            Cancel
          </button>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 p-6 flex flex-col items-center justify-center">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-white p-8 rounded-[40px] shadow-2xl border border-slate-100 max-w-md w-full"
      >
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <Upload size={32} />
          </div>
          <h1 className="text-2xl font-black text-slate-800">Remote Upload</h1>
          <p className="text-slate-500 mb-4">Connected to TV: <span className="font-mono font-bold text-emerald-600">{deviceId}</span></p>

          {user ? (
            <div className="flex items-center justify-center gap-3 p-3 bg-slate-50 rounded-2xl border border-slate-100">
              <img src={user.photoURL || ''} alt="" className="w-8 h-8 rounded-full border border-emerald-500" referrerPolicy="no-referrer" />
              <div className="text-left">
                <p className="text-xs font-bold text-slate-800">{user.displayName}</p>
                <button onClick={() => signOut(auth)} className="text-[10px] text-slate-500 hover:text-red-500 font-bold uppercase">Logout</button>
              </div>
            </div>
          ) : (
            <button 
              onClick={handleGoogleLogin}
              className="w-full flex items-center justify-center gap-2 bg-white border border-slate-200 p-3 rounded-2xl shadow-sm hover:bg-slate-50 transition-colors font-bold text-slate-700 text-sm"
            >
              <img src="https://www.google.com/favicon.ico" className="w-4 h-4" alt="" />
              Login with Google to Upload
            </button>
          )}
        </div>

        <div className="grid gap-4">
          {/* Image Upload */}
          <label className="relative flex items-center gap-4 p-6 bg-slate-50 rounded-3xl border-2 border-dashed border-slate-200 hover:border-emerald-500 hover:bg-emerald-50 transition-all cursor-pointer group">
            <input type="file" accept="image/*" className="hidden" onChange={(e) => handleFileUpload(e, 'image')} disabled={status === 'uploading'} />
            <div className="w-12 h-12 bg-white rounded-xl shadow-sm flex items-center justify-center text-emerald-600 group-hover:scale-110 transition-transform">
              <Upload size={24} />
            </div>
            <div className="text-left">
              <p className="font-bold text-slate-800">Upload Photo</p>
              <p className="text-sm text-slate-500">JPG, PNG, WebP</p>
            </div>
          </label>

          {/* Audio Upload */}
          <label className="relative flex items-center gap-4 p-6 bg-slate-50 rounded-3xl border-2 border-dashed border-slate-200 hover:border-blue-500 hover:bg-blue-50 transition-all cursor-pointer group">
            <input type="file" accept="audio/*" className="hidden" onChange={(e) => handleFileUpload(e, 'audio')} disabled={status === 'uploading'} />
            <div className="w-12 h-12 bg-white rounded-xl shadow-sm flex items-center justify-center text-blue-600 group-hover:scale-110 transition-transform">
              <Mic size={24} />
            </div>
            <div className="text-left">
              <p className="font-bold text-slate-800">Upload Audio</p>
              <p className="text-sm text-slate-500">MP3, WAV, M4A</p>
            </div>
          </label>

          {/* Video Upload */}
          <label className="relative flex items-center gap-4 p-6 bg-slate-50 rounded-3xl border-2 border-dashed border-slate-200 hover:border-purple-500 hover:bg-purple-50 transition-all cursor-pointer group">
            <input type="file" accept="video/*" className="hidden" onChange={(e) => handleFileUpload(e, 'video')} disabled={status === 'uploading'} />
            <div className="w-12 h-12 bg-white rounded-xl shadow-sm flex items-center justify-center text-purple-600 group-hover:scale-110 transition-transform">
              <Video size={24} />
            </div>
            <div className="text-left">
              <p className="font-bold text-slate-800">Upload Video</p>
              <p className="text-sm text-slate-500">MP4, MOV, WebM</p>
            </div>
          </label>
        </div>

        <AnimatePresence>
          {status === 'uploading' && (
            <motion.div 
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="mt-8 p-6 bg-emerald-50 rounded-2xl border border-emerald-100"
            >
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2 text-emerald-700 font-bold">
                  <Loader2 className="animate-spin" size={20} />
                  <span>Uploading {uploadType}...</span>
                </div>
                <span className="text-emerald-600 font-black">{Math.round(progress)}%</span>
              </div>
              <div className="w-full bg-emerald-200/50 rounded-full h-2 overflow-hidden">
                <motion.div 
                  className="bg-emerald-500 h-full"
                  initial={{ width: 0 }}
                  animate={{ width: `${progress}%` }}
                />
              </div>
            </motion.div>
          )}

          {status === 'success' && (
            <motion.div 
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="mt-8 p-4 bg-green-100 text-green-700 rounded-2xl flex items-center justify-center gap-3 font-bold"
            >
              <Check size={20} />
              Uploaded Successfully!
            </motion.div>
          )}

          {status === 'error' && (
            <motion.div 
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="mt-8 p-4 bg-red-100 text-red-700 rounded-2xl flex items-center justify-center gap-3 font-bold"
            >
              <AlertCircle size={20} />
              {error}
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  );
}
