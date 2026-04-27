// Auth service — signInWithPopup with smart error recovery
import {
  GoogleAuthProvider,
  signInWithPopup,
  signOut as firebaseSignOut,
} from "firebase/auth";
import { auth } from "./firebase";

const googleProvider = new GoogleAuthProvider();

export async function signInWithGoogle() {
  try {
    const result = await signInWithPopup(auth, googleProvider);
    return result.user;
  } catch (e) {
    // The "missing initial state" error on mobile Safari — just retry once
    if (e.message?.includes("missing initial state") || e.code === "auth/missing-initial-state") {
      // Second attempt usually works after session storage is initialized
      const result = await signInWithPopup(auth, googleProvider);
      return result.user;
    }
    throw e;
  }
}

export async function signOut() {
  await firebaseSignOut(auth);
}
