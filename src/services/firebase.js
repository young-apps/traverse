// Firebase initialization
// Uses initializeAuth instead of getAuth so we can conditionally omit the
// popupRedirectResolver on native platforms. The resolver is what triggers
// Firebase Auth to load the cross-origin __/auth/iframe used for popup
// signaling, which fails in Capacitor's WKWebView (capacitor://localhost
// origin isn't in Firebase's authorized domains and the SDK throws errors
// the WebView surfaces as opaque "Script error :0"). On web we keep the
// resolver so the @capacitor-firebase/authentication plugin's web fallback
// (signInWithPopup) continues to work for localhost dev.

import { initializeApp } from "firebase/app";
import {
  initializeAuth,
  indexedDBLocalPersistence,
  browserLocalPersistence,
  browserPopupRedirectResolver,
} from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";
import { Capacitor } from "@capacitor/core";

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

if (!firebaseConfig.apiKey) {
  console.error("Firebase config missing. Did you copy .env.example to .env and fill in your keys?");
}

export const app = initializeApp(firebaseConfig);

const isNative = Capacitor.isNativePlatform();

export const auth = initializeAuth(app, {
  persistence: [indexedDBLocalPersistence, browserLocalPersistence],
  popupRedirectResolver: isNative ? undefined : browserPopupRedirectResolver,
});

export const db = getFirestore(app);
export const storage = getStorage(app);
