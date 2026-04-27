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
export function saveUserProfile(user) {
  return setDoc(
    doc(db, "users", user.uid, "profile", "main"),
    { uid: user.uid, displayName: user.displayName || "", email: user.email || "", photoURL: user.photoURL || "", updatedAt: serverTimestamp() },
    { merge: true }
  );
}

export async function findUserByEmail(email) {
  const q = query(collectionGroup(db, "profile"), where("email", "==", email.toLowerCase().trim()));
  const snapshot = await getDocs(q);
  if (snapshot.empty) return null;
  return snapshot.docs[0].data();
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
  const q = query(collection(db, "users", friendUid, "stays"), orderBy("checkIn", "desc"));
  const snapshot = await getDocs(q);
  return snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
}
