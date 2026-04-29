// Hotel photo caching — Google Places Photo → Firebase Storage.
// Strategy: pay Google once per stay. Fetch the photo bytes at add-time,
// upload to /users/{uid}/stays/{stayId}.jpg, and store the resulting
// download URL on the stay doc. All future renders are served from
// Firebase Storage's free egress tier — no further Places API charges.

import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { storage } from "./firebase";

const PLACES_KEY = import.meta.env.VITE_GOOGLE_PLACES_KEY;

/**
 * Fetch photo from Google Places, upload to Firebase Storage,
 * return a public download URL. Returns null on any failure
 * (caller should treat photo as optional).
 *
 * @param {string} uid       Firebase auth uid
 * @param {string} stayId    Firestore stay doc id
 * @param {string} photoName Places API photo resource name
 *                           (e.g. "places/ChIJ.../photos/AeXyZ...")
 */
export async function cacheHotelPhoto(uid, stayId, photoName) {
  if (!photoName || !PLACES_KEY || !uid || !stayId) return null;

  try {
    const photoUrl = `https://places.googleapis.com/v1/${photoName}/media?maxWidthPx=800&key=${PLACES_KEY}`;
    const res = await fetch(photoUrl);
    if (!res.ok) return null;

    const blob = await res.blob();
    const storageRef = ref(storage, `users/${uid}/stays/${stayId}.jpg`);
    await uploadBytes(storageRef, blob, { contentType: "image/jpeg" });
    return await getDownloadURL(storageRef);
  } catch (e) {
    console.error("cacheHotelPhoto failed:", e);
    return null;
  }
}
