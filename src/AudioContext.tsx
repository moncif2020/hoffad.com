import React, { createContext, useState, useRef, useContext, useEffect } from 'react';
import { getAudioUrl } from './lib/quran';

export const AudioContext = createContext<any>(null);

export const AudioProvider = ({ children }: { children: React.ReactNode }) => {
  const [playlist, setPlaylist] = useState<any[]>([]);
  const [currentTrackIndex, setCurrentTrackIndex] = useState<number>(-1);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [sessionTime, setSessionTime] = useState(0);

  useEffect(() => {
    let interval: any;
    if (isPlaying) {
      interval = setInterval(() => {
        setSessionTime(prev => prev + 1);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [isPlaying]);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [retryCount, setRetryCount] = useState(0);

  const playlistRef = useRef<any[]>([]);

  // Update ref whenever playlist state changes
  useEffect(() => {
    playlistRef.current = playlist;
  }, [playlist]);

  const devLog = (...args: any[]) => { if (import.meta.env.DEV) console.log(...args); };
  const devError = (...args: any[]) => { if (import.meta.env.DEV) console.error(...args); };

  const playTrack = (index: number) => {
    const currentPlaylist = playlistRef.current;
    if (index >= 0 && index < currentPlaylist.length) {
      setCurrentTrackIndex(index);
      setRetryCount(0); // Reset retry count for new track
      setIsLoading(true);
      if (audioRef.current) {
        audioRef.current.src = currentPlaylist[index].url;
        audioRef.current.load();
        const playPromise = audioRef.current.play();
        if (playPromise !== undefined) {
          playPromise.then(() => {
            setIsLoading(false);
            setIsPlaying(true);
          }).catch(e => {
            // AbortError/interruption is common when src is changed rapidly
            if (e.name !== 'AbortError' && e.name !== 'NotAllowedError') {
              devError("Initial playback promise failed", e);
            }
            // Error event will handle retry for real failures
          });
        }
      }
    }
  };

  const pause = () => {
    if (audioRef.current) {
      audioRef.current.pause();
      setIsPlaying(false);
    }
  };

  const resume = () => {
    if (audioRef.current) {
      audioRef.current.play();
      setIsPlaying(true);
    }
  };

  const stop = () => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }
    setIsPlaying(false);
    setCurrentTrackIndex(-1);
    setPlaylist([]);
    setSessionTime(0);
  };

  const handleAudioEnded = () => {
    const nextIndex = currentTrackIndex + 1;
    if (nextIndex < playlistRef.current.length) {
      playTrack(nextIndex);
    } else {
      setIsPlaying(false);
      setPlaylist([]);
      setCurrentTrackIndex(-1);
    }
  };

  const [reciter, setReciter] = useState('Husary_64kbps');
  const [repetitions, setRepetitions] = useState(1);
  const [rangeRepetitions, setRangeRepetitions] = useState(1);

  const startNewPlaylist = (newPlaylist: any[], startIndex: number = 0) => {
    playlistRef.current = newPlaylist;
    setPlaylist(newPlaylist);
    setSessionTime(0);
    playTrack(startIndex);
  };

  const handleAudioError = (e: any) => {
    devError("Audio element error", e);
    const audio = audioRef.current;
    if (!audio) return;

    const currentTrack = playlistRef.current[currentTrackIndex];
    if (currentTrack && currentTrack.surah && currentTrack.ayah && retryCount < 2) {
      // Try next mirror
      const nextMirrorIndex = retryCount + 1;
      const nextUrl = getAudioUrl(reciter, currentTrack.surah, currentTrack.ayah, nextMirrorIndex);
      
      devLog(`Retrying playback with mirror ${nextMirrorIndex}: ${nextUrl}`);
      setRetryCount(nextMirrorIndex);
      setIsLoading(true);
      
      audio.src = nextUrl;
      audio.load();
      audio.play().catch(err => devError("Mirror playback failed", err));
    } else {
      setIsLoading(false);
      setIsPlaying(false);
    }
  };

  const handleWaiting = () => {
    setIsLoading(true);
  };

  const handlePlaying = () => {
    setIsLoading(false);
    setIsPlaying(true);
  };

  const value = React.useMemo(() => ({
    playlist, setPlaylist,
    currentTrackIndex, setCurrentTrackIndex,
    isPlaying, setIsPlaying,
    isLoading, setIsLoading,
    playTrack, pause, resume, stop,
    startNewPlaylist,
    reciter, setReciter,
    repetitions, setRepetitions,
    rangeRepetitions, setRangeRepetitions,
    currentTime, duration, sessionTime,
    overallProgress: playlist.length > 0 ? ((currentTrackIndex + (duration > 0 ? currentTime / duration : 0)) / playlist.length) * 100 : 0
  }), [
    playlist, currentTrackIndex, isPlaying, isLoading, 
    reciter, repetitions, rangeRepetitions, currentTime, duration, sessionTime
  ]);

  return (
    <AudioContext.Provider value={value}>
      {children}
      <audio 
        ref={audioRef} 
        onEnded={handleAudioEnded} 
        onError={handleAudioError}
        onWaiting={handleWaiting}
        onPlaying={handlePlaying}
        onCanPlay={() => setIsLoading(false)}
        onTimeUpdate={() => audioRef.current && setCurrentTime(audioRef.current.currentTime)}
        onLoadedMetadata={() => audioRef.current && setDuration(audioRef.current.duration)}
        preload="auto"
        playsInline
      />
    </AudioContext.Provider>
  );
};

export const useAudio = () => useContext(AudioContext);
