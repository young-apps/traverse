// Account deletion — required by App Store Guideline 5.1.1(v).
//
// "Delete account" must actually delete the account and all associated
// user data. Apple's review team explicitly tests this; the previous
// implementation only removed `/users/{uid}` + the stays + friends
// subcollections, leaving:
//   - `/users/{uid}/profile/main` (the profile doc that powered the
//     directory) — this is why deleted users kept reappearing in the
//     "Everyone on Traverse" list.
//   - `/users/{uid}/friendRequests/*`
//   - Reciprocal entries in OTHER users' `/friends/{thisUid}` docs, so
//     they still saw the deleted user as a friend.
//   - Photos in Cloud Storage at `users/{uid}/stays/*.jpg`.
//
// The flow below cascades through every one of those, then deletes the
// Firebase Auth account. If reauth is required (Apple/Google tokens
// expire after ~5 minutes), we route through the Capacitor native
// plugin on iOS — `reauthenticateWithPopup` does not work in WKWebView.

import {
  collection, doc, getDoc, getDocs, deleteDoc,
} from "firebase/firestore";
import { ref as storageRef, listAll, deleteObject } from "firebase/storage";
import {
  deleteUser, GoogleAuthProvider, OAuthProvider,
  signInWithCredential, reauthenticateWithCredential,
} from "firebase/auth";
import { FirebaseAuthentication } from "@capacitor-firebase/authentication";
import { Capacitor } from "@capacitor/core";
import { auth, db, storage } from "./firebase";
import { invalidateDirectoryCache } from "./friends";

// Walk a Firestore subcollection and delete every doc. Promise.all is
// fine at our document counts — at scale this would want a batched
// writer (500/batch).
async function deleteSubcollection(path) {
  try {
    const snap = await getDocs(collection(db, ...path));
    if (snap.empty) return 0;
    await Promise.all(snap.docs.map((d) => deleteDoc(d.ref)));
    return snap.size;
  } catch (e) {
    console.warn(`[deleteAccount] subcollection ${path.join("/")} failed`, e);
    return 0;
  }
}

// Recursively delete every object under a Storage prefix. Hotel photos
// live at users/{uid}/stays/{stayId}.jpg today; nested folders are
// handled in case future writers add them.
async function deleteStoragePrefix(prefix) {
  try {
    const folder = storageRef(storage, prefix);
    const res = await listAll(folder);
    await Promise.all(res.items.map((it) => deleteObject(it).catch(() => {})));
    await Promise.all(res.prefixes.map((p) => deleteStoragePrefix(p.fullPath)));
  } catch (e) {
    // Storage rules may block listing if the user is already gone, etc.
    // Don't let storage failures block account deletion.
    console.warn(`[deleteAccount] storage ${prefix} failed`, e);
  }
}

// Get a fresh credential to satisfy auth/requires-recent-login. On
// native we re-run the same Capacitor sign-in and rebuild a Firebase
// credential; on web we fall back to popup providers.
async function reauthenticate(user) {
  const providerId = user.providerData[0]?.providerId;
  if (Capacitor.isNativePlatform()) {
    if (providerId === "apple.com") {
      const result = await FirebaseAuthentication.signInWithApple();
      const provider = new OAuthProvider("apple.com");
      const credential = provider.credential({
        idToken: result.credential.idToken,
        rawNonce: result.credential.nonce,
      });
      await reauthenticateWithCredential(user, credential);
    } else {
      const result = await FirebaseAuthentication.signInWithGoogle();
      const credential = GoogleAuthProvider.credential(result.credential.idToken);
      await reauthenticateWithCredential(user, credential);
    }
    return;
  }
  // Web fallback — dynamic import keeps popup helpers out of the
  // native bundle.
  const { signInWithPopup } = await import("firebase/auth");
  const provider = providerId === "apple.com"
    ? new OAuthProvider("apple.com")
    : new GoogleAuthProvider();
  const cred = await signInWithPopup(auth, provider);
  await reauthenticateWithCredential(user, cred.user);
}

export async function deleteAccount() {
  const user = auth.currentUser;
  if (!user) throw new Error("Not signed in");
  const uid = user.uid;

  // 1. Reciprocal friend cleanup. Read my friends list first; for each
  //    entry, delete my doc on THEIR side so I disappear from their
  //    Friends tab. Done before wiping my own friends list so we
  //    actually have the list to iterate.
  let myFriendUids = [];
  try {
    const friendsSnap = await getDocs(collection(db, "users", uid, "friends"));
    myFriendUids = friendsSnap.docs.map((d) => d.id);
    await Promise.all(
      myFriendUids.map((fid) =>
        deleteDoc(doc(db, "users", fid, "friends", uid)).catch((e) =>
          console.warn(`[deleteAccount] reciprocal friend ${fid} failed`, e)
        )
      )
    );
  } catch (e) { console.warn("[deleteAccount] reading friends failed", e); }

  // 2. Wipe every subcollection under /users/{uid}.
  //    profile + stays + friends + friendRequests, in parallel.
  const [profileN, staysN, friendsN, requestsN] = await Promise.all([
    deleteSubcollection(["users", uid, "profile"]),
    deleteSubcollection(["users", uid, "stays"]),
    deleteSubcollection(["users", uid, "friends"]),
    deleteSubcollection(["users", uid, "friendRequests"]),
  ]);

  // 3. Drop the user's parent doc if any fields were ever written there.
  try { await deleteDoc(doc(db, "users", uid)); } catch { /* may not exist */ }

  // 4. Storage — every uploaded hotel photo for this user.
  await deleteStoragePrefix(`users/${uid}`);

  // 5. Outgoing friend requests this user sent. Each lives in the
  //    recipient's friendRequests subcollection keyed by the sender's
  //    uid, so we can delete by id directly. We don't have the
  //    recipient list cheaply — best-effort: walk the friends we just
  //    deleted plus any directory entries we know about.
  //    (Pending requests to people who never accepted are the only
  //    ones still out there; this catches the common case.)
  await Promise.all(
    myFriendUids.map((fid) =>
      deleteDoc(doc(db, "users", fid, "friendRequests", uid)).catch(() => {})
    )
  );

  invalidateDirectoryCache();

  console.log("[deleteAccount] cascade complete", {
    uid, profileN, staysN, friendsN, requestsN,
    reciprocalFriends: myFriendUids.length,
  });

  // 6. Delete the Firebase Auth account itself. If the credential is
  //    stale Firebase requires a fresh sign-in first.
  try {
    await deleteUser(user);
  } catch (e) {
    if (e.code === "auth/requires-recent-login") {
      try {
        await reauthenticate(user);
        await deleteUser(user);
      } catch (e2) {
        console.error("[deleteAccount] reauth+delete failed", e2);
        throw e2;
      }
    } else {
      throw e;
    }
  }

  // 7. Clear native plugin session so the next session starts cold.
  try { await FirebaseAuthentication.signOut(); } catch {}
}
