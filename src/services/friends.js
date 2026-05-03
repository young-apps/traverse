// Friends service — request/accept flow
// Data model:
//   /users/{uid}/profile/main        — public profile
//   /users/{uid}/friendRequests/{id}  — incoming requests (from others)
//   /users/{uid}/friends/{friendUid}  — accepted friends
//   /users/{uid}/stays               — hotel stays

import {
  collection, doc, setDoc, deleteDoc, getDocs, onSnapshot,
  query, where, orderBy, collectionGroup, serverTimestamp, getDoc,
} from "firebase/firestore";
import { db } from "./firebase";

// ── Profile ──
// NOTE: shareStaysWithFriends defaults to FALSE — users must explicitly opt
// in before any of their stays are exposed to friends via getFriendStays().
export function saveUserProfile(user) {
  // displayNameLower mirrors displayName for case-insensitive prefix
  // search (Firestore can't lower-case in queries). Updated on every
  // login so renames flow through.
  const displayName = user.displayName || "";
  return setDoc(
    doc(db, "users", user.uid, "profile", "main"),
    {
      uid: user.uid,
      displayName,
      displayNameLower: displayName.toLowerCase(),
      email: user.email || "",
      photoURL: user.photoURL || "",
      updatedAt: serverTimestamp(),
    },
    { merge: true }
  );
}

/** Read the current user's profile (used to reflect privacy preferences). */
export async function getUserProfile(uid) {
  const snap = await getDoc(doc(db, "users", uid, "profile", "main"));
  return snap.exists() ? snap.data() : null;
}

/** Toggle whether friends can see this user's stays. */
export function setShareStaysWithFriends(uid, enabled) {
  return setDoc(
    doc(db, "users", uid, "profile", "main"),
    { shareStaysWithFriends: !!enabled, updatedAt: serverTimestamp() },
    { merge: true }
  );
}

export async function findUserByEmail(email) {
  const q = query(collectionGroup(db, "profile"), where("email", "==", email.toLowerCase().trim()));
  const snapshot = await getDocs(q);
  if (snapshot.empty) return null;
  return snapshot.docs[0].data();
}

/**
 * Case-insensitive prefix search by display name. Returns up to 8
 * profiles. Requires Firestore rule allowing collectionGroup reads
 * on `profile` where the query filter is on displayNameLower (the
 * same rule shape that already works for findUserByEmail).
 */
export async function findUsersByName(nameQuery) {
  const q = nameQuery.trim().toLowerCase();
  if (q.length < 2) return [];
  const ref = collectionGroup(db, "profile");
  const snap = await getDocs(
    query(ref, where("displayNameLower", ">=", q), where("displayNameLower", "<=", q + "\uf8ff"))
  );
  return snap.docs.map((d) => d.data()).slice(0, 8);
}

// ── Friend Requests ──

/** Send a friend request to another user */
export async function sendFriendRequest(fromUser, toUid) {
  // Write into the recipient's friendRequests subcollection
  await setDoc(doc(db, "users", toUid, "friendRequests", fromUser.uid), {
    fromUid: fromUser.uid,
    displayName: fromUser.displayName || "",
    email: fromUser.email || "",
    photoURL: fromUser.photoURL || "",
    sentAt: serverTimestamp(),
    status: "pending",
  });
}

/** Subscribe to incoming friend requests */
export function subscribeToFriendRequests(uid, callback) {
  const ref = collection(db, "users", uid, "friendRequests");
  return onSnapshot(ref, (snapshot) => {
    callback(snapshot.docs.map((d) => ({ id: d.id, ...d.data() })));
  });
}

/** Accept a friend request — adds both directions, deletes the request */
export async function acceptFriendRequest(myUid, myProfile, request) {
  // Add friend to my list
  await setDoc(doc(db, "users", myUid, "friends", request.fromUid), {
    friendUid: request.fromUid,
    displayName: request.displayName || "",
    email: request.email || "",
    photoURL: request.photoURL || "",
    addedAt: serverTimestamp(),
  });
  // Add me to their list
  await setDoc(doc(db, "users", request.fromUid, "friends", myUid), {
    friendUid: myUid,
    displayName: myProfile.displayName || "",
    email: myProfile.email || "",
    photoURL: myProfile.photoURL || "",
    addedAt: serverTimestamp(),
  });
  // Delete the request
  await deleteDoc(doc(db, "users", myUid, "friendRequests", request.fromUid));
}

/** Decline a friend request */
export async function declineFriendRequest(myUid, requestId) {
  await deleteDoc(doc(db, "users", myUid, "friendRequests", requestId));
}

// ── Friends ──
export function removeFriend(myUid, friendUid) {
  // Remove from both sides
  return Promise.all([
    deleteDoc(doc(db, "users", myUid, "friends", friendUid)),
    deleteDoc(doc(db, "users", friendUid, "friends", myUid)),
  ]);
}

export function subscribeToFriends(uid, callback) {
  return onSnapshot(collection(db, "users", uid, "friends"), (snapshot) => {
    callback(snapshot.docs.map((d) => ({ id: d.id, ...d.data() })));
  });
}

export async function getFriendStays(friendUid) {
  // Privacy gate: only return stays if the friend has opted in to sharing.
  // Default (no flag set) is treated as OFF — opt-in only.
  try {
    const profileSnap = await getDoc(doc(db, "users", friendUid, "profile", "main"));
    const optedIn = profileSnap.exists() && profileSnap.data().shareStaysWithFriends === true;
    if (!optedIn) return { stays: [], shared: false };
  } catch (e) {
    // If we can't verify consent, default closed.
    return { stays: [], shared: false };
  }
  const q = query(collection(db, "users", friendUid, "stays"), orderBy("checkIn", "desc"));
  const snapshot = await getDocs(q);
  return { stays: snapshot.docs.map((d) => ({ id: d.id, ...d.data() })), shared: true };
}
