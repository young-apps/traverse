// Auth service — uses @capacitor-firebase/authentication for native iOS sign-in
// (Google + Apple Sign-In via Apple's AuthenticationServices and Google's iOS
// SDK). On native, plugin runs with skipNativeAuth:true — it returns the OAuth
// credential WITHOUT signing into Firebase. We then call signInWithCredential
// on the JS Firebase Auth instance exactly once. This single-path approach
// avoids the "auth/missing-or-invalid-nonce / Duplicate credential" error,
// which happens when Apple's single-use identity token is consumed by both
// the native plugin AND the JS SDK.
//
// On web (localhost dev), the plugin falls back to Firebase Auth web SDK
// (signInWithPopup), which works because localhost is in the authorized
// domains list.

import { FirebaseAuthentication } from "@capacitor-firebase/authentication";
import { GoogleAuthProvider, OAuthProvider, signInWithCredential, signOut as firebaseSignOut } from "firebase/auth";
import { Capacitor } from "@capacitor/core";
import { auth } from "./firebase";

// Wrap a promise so it rejects after `ms` instead of hanging forever.
// Surfaces silent native-bridge stalls as a visible error in the UI.
function withTimeout(promise, ms, label) {
  return Promise.race([
    promise,
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error(`${label} timed out after ${ms / 1000}s`)), ms)
    ),
  ]);
}

export async function signInWithGoogle() {
  if (Capacitor.isNativePlatform()) {
    console.log("[auth] Google: calling native plugin signInWithGoogle…");
    let result;
    try {
      result = await withTimeout(
        FirebaseAuthentication.signInWithGoogle(),
        30000,
        "Google native sign-in"
      );
    } catch (e) {
      console.error("[auth] Google native step failed:", e);
      throw e;
    }
    console.log("[auth] Google: native returned", {
      hasIdToken: !!result?.credential?.idToken,
      hasUser: !!result?.user,
    });
    if (!result.credential?.idToken) throw new Error("Google sign-in returned no ID token");
    console.log("[auth] Google: exchanging credential with Firebase JS SDK…");
    const credential = GoogleAuthProvider.credential(result.credential.idToken);
    const userCred = await withTimeout(
      signInWithCredential(auth, credential),
      20000,
      "Firebase signInWithCredential (Google)"
    );
    console.log("[auth] Google: signed in, uid=", userCred.user.uid);
    return userCred.user;
  }
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
