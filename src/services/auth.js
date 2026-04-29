// Auth service — uses @capacitor-firebase/authentication for native iOS sign-in
// (Google + Apple Sign-In via Apple's AuthenticationServices and Google's iOS
// SDK). The plugin syncs credentials with Firebase Auth web SDK so the rest
// of the app continues to use onAuthStateChanged on the auth instance.
//
// On web (localhost dev), the plugin falls back to Firebase Auth web SDK
// (signInWithPopup), which works because localhost is in the authorized
// domains list. In Capacitor's WKWebView, the plugin uses native flows that
// bypass the cross-origin iframe entirely.

import { FirebaseAuthentication } from "@capacitor-firebase/authentication";
import { GoogleAuthProvider, OAuthProvider, signInWithCredential, signOut as firebaseSignOut } from "firebase/auth";
import { Capacitor } from "@capacitor/core";
import { auth } from "./firebase";

export async function signInWithGoogle() {
  if (Capacitor.isNativePlatform()) {
    // Native: get OAuth credential from iOS Google Sign-In SDK,
    // exchange for Firebase credential, sign in to web SDK so
    // onAuthStateChanged fires consistently.
    const result = await FirebaseAuthentication.signInWithGoogle();
    if (!result.credential?.idToken) throw new Error("Google sign-in returned no ID token");
    const credential = GoogleAuthProvider.credential(result.credential.idToken);
    const userCred = await signInWithCredential(auth, credential);
    return userCred.user;
  }
  // Web: plugin uses Firebase Auth web SDK internally (signInWithPopup),
  // which works on localhost because it's in authorized domains.
  const result = await FirebaseAuthentication.signInWithGoogle();
  return result.user;
}

export async function signInWithApple() {
  if (Capacitor.isNativePlatform()) {
    // Native: AuthenticationServices framework handles Sign in with Apple.
    // Apple returns idToken + nonce; we hand both to Firebase so it can
    // verify the nonce against the one Apple signed.
    const result = await FirebaseAuthentication.signInWithApple();
    if (!result.credential?.idToken) throw new Error("Apple sign-in returned no ID token");
    const provider = new OAuthProvider("apple.com");
    const credential = provider.credential({
      idToken: result.credential.idToken,
      rawNonce: result.credential.nonce,
    });
    const userCred = await signInWithCredential(auth, credential);
    return userCred.user;
  }
  const result = await FirebaseAuthentication.signInWithApple();
  return result.user;
}

export async function signOut() {
  // Sign out from both the plugin (clears native session) and the web SDK.
  await FirebaseAuthentication.signOut();
  await firebaseSignOut(auth);
}
