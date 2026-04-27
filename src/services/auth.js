// Auth service — Google and Apple sign-in via Firebase
import {
  GoogleAuthProvider,
  OAuthProvider,
  signInWithPopup,
  signOut as firebaseSignOut,
} from "firebase/auth";
import { auth } from "./firebase";

const googleProvider = new GoogleAuthProvider();

const appleProvider = new OAuthProvider("apple.com");
appleProvider.addScope("email");
appleProvider.addScope("name");

async function signInWithRetry(provider) {
  try {
    const result = await signInWithPopup(auth, provider);
    return result.user;
  } catch (e) {
    // The "missing initial state" error on mobile Safari — just retry once
    if (e.message?.includes("missing initial state") || e.code === "auth/missing-initial-state") {
      const result = await signInWithPopup(auth, provider);
      return result.user;
    }
    throw e;
  }
}

export function signInWithGoogle() {
  return signInWithRetry(googleProvider);
}

export function signInWithApple() {
  return signInWithRetry(appleProvider);
}

export async function signOut() {
  await firebaseSignOut(auth);
}
