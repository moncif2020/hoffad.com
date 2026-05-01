import React, { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Mic, Square, Play, Pause, RefreshCw, Share2, ArrowLeft, Volume2, Music, Sparkles } from 'lucide-react';

interface RecitationRecorderProps {
  onBack: () => void;
  lang: string;
  t: any;
}

export const RecitationRecorder: React.FC<RecitationRecorderProps> = ({ onBack, lang, t }) => {
  const [isRecording, setIsRecording] = useState(false);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const animationFrameRef = useRef<number | null>(null);

  const [noiseReduction, setNoiseReduction] = useState(true);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          echoCancellation: noiseReduction,
          noiseSuppression: noiseReduction,
          autoGainControl: noiseReduction,
        } 
      });

      // Web Audio API Enhancement
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      const source = audioContext.createMediaStreamSource(stream);
      
      // Analyser for visualizer
      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 256;
      const bufferLength = analyser.frequencyBinCount;
      const dataArray = new Uint8Array(bufferLength);

      let finalStream = stream;

      if (noiseReduction) {
        // 1. High-pass filter to cut low-frequency rumble (below 100Hz)
        const hpFilter = audioContext.createBiquadFilter();
        hpFilter.type = 'highpass';
        hpFilter.frequency.value = 100;

        // 2. Low-pass filter to cut high-frequency hiss (above 8kHz)
        const lpFilter = audioContext.createBiquadFilter();
        lpFilter.type = 'lowpass';
        lpFilter.frequency.value = 8000; 

        // 3. Clarity filter - boost the 3kHz range for vocal presence
        const clarityFilter = audioContext.createBiquadFilter();
        clarityFilter.type = 'peaking';
        clarityFilter.frequency.value = 3000;
        clarityFilter.Q.value = 1;
        clarityFilter.gain.value = 3; // 3dB boost

        // 4. Dynamics Compressor - levels the volume like a pro studio
        const compressor = audioContext.createDynamicsCompressor();
        compressor.threshold.setValueAtTime(-24, audioContext.currentTime);
        compressor.knee.setValueAtTime(40, audioContext.currentTime);
        compressor.ratio.setValueAtTime(12, audioContext.currentTime);
        compressor.attack.setValueAtTime(0, audioContext.currentTime);
        compressor.release.setValueAtTime(0.25, audioContext.currentTime);

        const destination = audioContext.createMediaStreamDestination();
        
        // Connect the chain: Source -> HighPass -> LowPass -> Clarity -> Compressor -> Destination/Analyser
        source.connect(hpFilter);
        hpFilter.connect(lpFilter);
        lpFilter.connect(clarityFilter);
        clarityFilter.connect(compressor);
        
        compressor.connect(analyser); 
        compressor.connect(destination);
        finalStream = destination.stream;
      } else {
        source.connect(analyser);
      }

      // Dynamic MIME type selection for better browser support (e.g. Safari likes mp4, Chrome likes webm)
      const mimeTypes = ['audio/webm', 'audio/mp4', 'audio/ogg', 'audio/wav'];
      let selectedMimeType = '';
      for (const mime of mimeTypes) {
        if (MediaRecorder.isTypeSupported(mime)) {
          selectedMimeType = mime;
          break;
        }
      }

      // Visualizer Function
      const draw = () => {
        if (!canvasRef.current) return;
        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        animationFrameRef.current = requestAnimationFrame(draw);
        analyser.getByteFrequencyData(dataArray);

        ctx.clearRect(0, 0, canvas.width, canvas.height);
        const barWidth = (canvas.width / bufferLength) * 2.5;
        let x = 0;

        for (let i = 0; i < bufferLength; i++) {
          const barHeight = (dataArray[i] / 255) * canvas.height;
          ctx.fillStyle = `rgba(16, 185, 129, ${dataArray[i] / 255 + 0.2})`;
          ctx.fillRect(x, canvas.height - barHeight, barWidth, barHeight);
          x += barWidth + 1;
        }
      };
      draw();

      const mediaRecorder = new MediaRecorder(finalStream, selectedMimeType ? { mimeType: selectedMimeType } : undefined);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        audioChunksRef.current.push(event.data);
      };

      mediaRecorder.onstop = () => {
        const blob = new Blob(audioChunksRef.current, { type: mediaRecorder.mimeType || 'audio/wav' });
        const url = URL.createObjectURL(blob);
        setAudioBlob(blob);
        setAudioUrl(url);
      };

      mediaRecorder.start();
      setIsRecording(true);
      setAudioUrl(null);
      setAudioBlob(null);
    } catch (err) {
      console.error("Error accessing microphone:", err);
      alert(lang === 'ar' ? 'يرجى السماح بالوصول إلى الميكروفون' : 'Please allow microphone access');
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      mediaRecorderRef.current.stream.getTracks().forEach(track => track.stop());
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    }
  };

  const togglePlayback = () => {
    if (!audioRef.current) return;
    if (isPlaying) {
      audioRef.current.pause();
    } else {
      audioRef.current.play();
    }
    setIsPlaying(!isPlaying);
  };

  const shareAudio = async () => {
    if (!audioUrl) return;
    
    const appUrl = "https://ais-pre-he7bqvh6v6zlbqlmvf2ala-7598449985.europe-west2.run.app";
    const shareText = lang === 'ar' 
      ? `استمع لتلاوتي عبر تطبيق "حُفّاظ" - رفيقي في حفظ القرآن الكريم. يمكنك تحميل التطبيق من هنا: ${appUrl}`
      : `Listen to my recitation on "Hoffad" app - my companion in Quran memorization. Download it here: ${appUrl}`;

    try {
      if (navigator.share) {
        await navigator.share({
          title: t.amazingRecitation || "حُفّاظ",
          text: shareText,
          url: appUrl,
        });
      } else {
        // Fallback: Copy link and download
        await navigator.clipboard.writeText(shareText);
        alert(lang === 'ar' ? 'تم نسخ رابط التطبيق ورسالة المشاركة!' : 'App link and share message copied!');
        
        const link = document.createElement('a');
        link.href = audioUrl;
        link.download = 'recitation.wav';
        link.click();
      }
    } catch (err) {
      console.warn("Sharing failed:", err);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-emerald-50 to-teal-100 p-4 md:p-8" dir={lang === 'ar' || lang === 'ur' ? 'rtl' : 'ltr'}>
      <div className="max-w-xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <button 
            onClick={onBack}
            className="p-2 bg-white/80 rounded-full shadow-sm hover:bg-emerald-50 transition-colors"
          >
            <ArrowLeft className={`w-6 h-6 text-emerald-700 ${lang === 'ar' || lang === 'ur' ? 'rotate-180' : ''}`} />
          </button>
          <div className="flex items-center gap-3">
            <Mic className="w-8 h-8 text-emerald-600" />
            <h1 className="text-2xl font-bold text-emerald-900 font-sans tracking-tight">
              {t.recitationRecorder}
            </h1>
          </div>
          <div className="w-10"></div>
        </div>

        {/* Main Recording Area */}
        <div className="bg-white rounded-3xl p-8 shadow-xl border border-emerald-100 flex flex-col items-center gap-8 relative overflow-hidden">
          {/* Background decoration */}
          <div className="absolute top-0 right-0 p-4 opacity-10">
            <Music className="w-32 h-32 text-emerald-600" />
          </div>

          <div className="text-center">
            <h2 className="text-xl font-bold text-emerald-900 mb-2">{t.recordRecitation}</h2>
            <p className="text-emerald-600/70 text-sm">{isRecording ? t.listeningMode : (audioUrl ? t.amazingRecitation : '')}</p>
            
            {/* Noise Reduction Toggle (Studio vs Raw) */}
            {!isRecording && (
              <div className="mt-4 flex flex-col items-center gap-2">
                <div className="flex items-center gap-3">
                  <span className={`text-xs font-bold transition-colors ${!noiseReduction ? 'text-emerald-600' : 'text-slate-400'}`}>
                    {t.rawMode}
                  </span>
                  <button 
                    onClick={() => setNoiseReduction(!noiseReduction)}
                    className={`w-12 h-6 rounded-full transition-all relative p-1 shadow-inner ${noiseReduction ? 'bg-emerald-500' : 'bg-slate-300'}`}
                  >
                    <motion.div 
                      animate={{ x: noiseReduction ? 24 : 0 }}
                      className="w-4 h-4 bg-white rounded-full shadow-md"
                    />
                  </button>
                  <span className={`text-xs font-bold transition-colors ${noiseReduction ? 'text-emerald-600' : 'text-slate-400'}`}>
                    {t.studioMode}
                  </span>
                </div>
                <p className="text-[10px] text-emerald-600/50 font-medium">
                  {noiseReduction ? (lang === 'ar' ? 'يتم الآن عزل الضوضاء وتحسين الصوت' : 'Noise cancellation & audio enhancement active') : ''}
                </p>
              </div>
            )}
          </div>

          {/* Large Recording Button / Status */}
          <div className="relative w-full flex flex-col items-center">
            {isRecording && (
              <canvas 
                ref={canvasRef} 
                className="w-full h-24 mb-4 rounded-xl opacity-50"
                width={300}
                height={100}
              />
            )}
            
            <div className="relative">
              <AnimatePresence>
                {isRecording && (
                  <motion.div 
                    initial={{ scale: 0.8, opacity: 0 }}
                    animate={{ scale: [1, 1.2, 1], opacity: 1 }}
                    transition={{ repeat: Infinity, duration: 1.5 }}
                    className="absolute inset-0 bg-red-100 rounded-full"
                  />
                )}
              </AnimatePresence>

              <button
                onClick={isRecording ? stopRecording : startRecording}
                className={`relative z-10 w-32 h-32 rounded-full flex items-center justify-center transition-all shadow-lg ${
                  isRecording 
                  ? 'bg-red-500 hover:bg-red-600 scale-110' 
                  : 'bg-emerald-500 hover:bg-emerald-600 hover:scale-105'
                }`}
              >
                {isRecording ? (
                  <Square className="w-12 h-12 text-white fill-current" />
                ) : (
                  <Mic className="w-12 h-12 text-white" />
                )}
              </button>
            </div>
          </div>

          {/* Action Area */}
          <div className="w-full space-y-4">
            <AnimatePresence>
              {audioUrl && !isRecording && (
                <motion.div 
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="space-y-4"
                >
                  <div className="bg-emerald-50 rounded-2xl p-4 flex items-center gap-4">
                    <button 
                      onClick={togglePlayback}
                      className="w-12 h-12 rounded-full bg-emerald-600 text-white flex items-center justify-center shadow-md hover:bg-emerald-700"
                    >
                      {isPlaying ? <Pause className="w-6 h-6" /> : <Play className="w-6 h-6 fill-current" />}
                    </button>
                    
                    <div className="flex-1 h-2 bg-emerald-200 rounded-full overflow-hidden">
                       <motion.div 
                         initial={{ width: "0%" }}
                         animate={{ width: isPlaying ? "100%" : "0%" }}
                         transition={{ duration: 10, ease: "linear" }}
                         className="h-full bg-emerald-600"
                       />
                    </div>

                    <audio 
                      ref={audioRef} 
                      src={audioUrl} 
                      onEnded={() => setIsPlaying(false)}
                      className="hidden" 
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                     <button 
                       onClick={startRecording}
                       className="flex items-center justify-center gap-2 py-3 px-4 bg-slate-100 text-slate-700 rounded-xl font-bold hover:bg-slate-200 transition-colors"
                     >
                        <RefreshCw className="w-5 h-5" />
                        {t.reRecord}
                     </button>
                     <button 
                       onClick={shareAudio}
                       className="flex items-center justify-center gap-2 py-3 px-4 bg-emerald-600 text-white rounded-xl font-bold shadow-lg shadow-emerald-200 hover:bg-emerald-700 transition-all hover:scale-[1.02]"
                     >
                        <Share2 className="w-5 h-5" />
                        {t.shareWithFamily}
                     </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Encouragement message */}
          {!audioUrl && !isRecording && (
            <div className="flex items-center gap-2 text-emerald-700/60 font-medium animate-pulse">
               <Sparkles className="w-5 h-5" />
               <span>{t.startRecording}</span>
            </div>
          )}
        </div>

        {/* Footer info */}
        <div className="mt-8 text-center text-emerald-800/40 text-xs px-8">
           <Volume2 className="w-4 h-4 mx-auto mb-2" />
           <p>{lang === 'ar' ? 'سجل تلاوتك بصوتك، واستوحي من الحفظ طمأنينة القلب. استمع لنفسك وشارك الجمال مع عائلتك.' : 'Record your recitation, let your heart find peace in Hifz. Listen to your progress and share the beauty with your family.'}</p>
        </div>
      </div>
    </div>
  );
};
