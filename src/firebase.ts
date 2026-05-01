import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';
import { getStorage } from 'firebase/storage';

// Use environment variables for production (Vercel)
// Fallback to manual values if needed for dev
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID,
  firestoreDatabaseId: import.meta.env.VITE_FIREBASE_DATABASE_ID
};

// Check if we are in environment where the JSON might exist directly (Dev)
// But to avoid build errors, we'll assume VERCEL/Production will use the env vars
// For local AI Studio, we'll hardcode the values if env vars are missing to maintain functionality
const finalConfig = firebaseConfig.apiKey ? firebaseConfig : {
  projectId: "gen-lang-client-0883054189",
  appId: "1:805790851857:web:a55cfc81b0a93bc650a2b0",
  apiKey: "AIzaSyBjgOXJdiKUCNUo_5VyJ5hjQ4aTJdbRdfs",
  authDomain: "gen-lang-client-0883054189.firebaseapp.com",
  firestoreDatabaseId: "ai-studio-3358a67e-2eb3-4036-8e2c-18c625f57ae5",
  storageBucket: "gen-lang-client-0883054189.firebasestorage.app",
  messagingSenderId: "805790851857",
  measurementId: ""
};

const app = initializeApp(finalConfig);
export const db = getFirestore(app, finalConfig.firestoreDatabaseId);
export const auth = getAuth(app);
export const storage = getStorage(app);
export const googleProvider = new GoogleAuthProvider();

export default app;
