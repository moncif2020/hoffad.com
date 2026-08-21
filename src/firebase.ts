import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';
import { getStorage } from 'firebase/storage';

// Use environment variables for production (Vercel)
// Fallback to manual values if needed for dev
const ACTIVE_FIRESTORE_DB_ID = "ai-studio-8ace2559-df7d-4c32-998b-89baf5db60ff";

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID,
  firestoreDatabaseId: import.meta.env.VITE_FIREBASE_DATABASE_ID || ACTIVE_FIRESTORE_DB_ID
};

const finalConfig = firebaseConfig.apiKey ? firebaseConfig : {
  projectId: "gen-lang-client-0883054189",
  appId: "1:805790851857:web:a55cfc81b0a93bc650a2b0",
  apiKey: "AIzaSyBjgOXJdiKUCNUo_5VyJ5hjQ4aTJdbRdfs",
  authDomain: "gen-lang-client-0883054189.firebaseapp.com",
  firestoreDatabaseId: import.meta.env.VITE_FIREBASE_DATABASE_ID || ACTIVE_FIRESTORE_DB_ID,
  storageBucket: "gen-lang-client-0883054189.firebasestorage.app",
  messagingSenderId: "805790851857",
  measurementId: ""
};

const app = initializeApp(finalConfig);

// Initialize Firestore with specific database ID if provided, otherwise default
const targetDbId = finalConfig.firestoreDatabaseId;
export const db = (targetDbId && targetDbId !== '(default)')
  ? getFirestore(app, targetDbId)
  : getFirestore(app);

export const auth = getAuth(app);
export const storage = getStorage(app);
export const googleProvider = new GoogleAuthProvider();

export default app;
