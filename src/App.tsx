import React, { Component, ErrorInfo, ReactNode } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { LandingPage } from './LandingPage';
import { RemoteUploadPage } from './RemoteUploadPage';
import { TVLoginPage } from './TVLoginPage';
import HoffadApp from './HoffadApp';
import { AudioProvider } from './AudioContext';

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  public override state: ErrorBoundaryState = {
    hasError: false,
    error: null
  };

  public static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  public override componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught runtime error:', error, errorInfo);
  }

  public override render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-slate-900 text-white flex flex-col items-center justify-center p-6 text-center" dir="rtl">
          <div className="w-16 h-16 bg-emerald-500/20 text-emerald-400 rounded-2xl flex items-center justify-center mb-4 text-3xl font-bold">
            📖
          </div>
          <h2 className="text-2xl font-bold mb-2">تطبيق الحفّاظ</h2>
          <p className="text-slate-400 mb-6 max-w-md">حدث خطأ غير متوقع أثناء التحميل. اضغط على الزر أدناه لإعادة تشغيل التطبيق بكل سلاسة.</p>
          <button
            onClick={() => window.location.href = '/'}
            className="px-6 py-3 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl transition shadow-lg shadow-emerald-900/30"
          >
            إعادة فتح التطبيق 🔄
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

export default function App() {
  return (
    <ErrorBoundary>
      <BrowserRouter>
        <AudioProvider>
          <Routes>
            <Route path="/" element={<LandingPage />} />
            <Route path="/upload" element={<RemoteUploadPage />} />
            <Route path="/tv-login" element={<TVLoginPage />} />
            <Route path="/app/*" element={<HoffadApp />} />
          </Routes>
        </AudioProvider>
      </BrowserRouter>
    </ErrorBoundary>
  );
}
