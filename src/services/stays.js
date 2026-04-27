// Stays CRUD via Firestore — optimistic writes for fast saves
// Each user's stays live at: /users/{uid}/stays/{stayId}

import {
  collection,
  doc,
  addDoc,
  updateDoc,
  deleteDoc,
  onSnapshot,
  query,
  orderBy,
  serverTimestamp,
} from "firebase/firestore";
import { db } from "./firebase";

function staysRef(uid) {
  return collection(db, "users", uid, "stays");
}

/**
 * Subscribe to a user's stays in realtime.
 * Returns an unsubscribe function.
 */
export function subscribeToStays(uid, callback) {
  const q = query(staysRef(uid), orderBy("checkIn", "desc"));
  return onSnapshot(
    q,
    (snapshot) => {
      const stays = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
      callback(stays);
    },
    (error) => {
      console.error("Firestore subscription error:", error);
    }
  );
}

/**
 * Add a new stay. Returns immediately with a local ID for optimistic UI.
 * Firestore write happens async in background.
 */
export function addStay(uid, stayData) {
  // Fire-and-forget — don't await. The onSnapshot listener will pick it up.
  const promise = addDoc(staysRef(uid), {
    ...stayData,
    createdAt: serverTimestamp(),
  });
  // Still return promise in case caller wants to handle errors
  return promise.then((ref) => ref.id);
}

/**
 * Update an existing stay.
 */
export function updateStay(uid, stayId, updates) {
  return updateDoc(doc(db, "users", uid, "stays", stayId), {
    ...updates,
    updatedAt: serverTimestamp(),
  });
}

/**
 * Delete a stay.
 */
export function deleteStay(uid, stayId) {
  return deleteDoc(doc(db, "users", uid, "stays", stayId));
}
