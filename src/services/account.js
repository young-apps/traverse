// Account deletion — required for App Store approval.
// Wipes all Firestore data for the user, then deletes the auth account.

import { collection, doc, getDocs, deleteDoc } from "firebase/firestore";
import { deleteUser, GoogleAuthProvider, OAuthProvider, reauthenticateWithPopup } from "firebase/auth";
import { auth, db } from "./firebase";

async function deleteCollection(path) {
  const snap = await getDocs(collection(db, ...path));
  await Promise.all(snap.docs.map((d) => deleteDoc(d.ref)));
}

export async function deleteAccount() {
  const user = auth.currentUser;
  if (!user) throw new Error("Not signed in");
  const uid = user.uid;

  // 1. Wipe Firestore data — stays, friends, and the user doc itself
  await deleteCollection(["users", uid, "stays"]);
  await deleteCollection(["users", uid, "friends"]);
  try {
    await deleteDoc(doc(db, "users", uid));
  } catch {
    // user doc may not exist — ignore
  }

  // 2. Delete the auth account.
  // If the credential is too old Firebase requires reauth — try once.
  try {
    await deleteUser(user);
  } catch (e) {
    if (e.code === "auth/requires-recent-login") {
      const provider = user.providerData[0]?.providerId === "apple.com"
        ? new OAuthProvider("apple.com")
        : new GoogleAuthProvider();
      await reauthenticateWithPopup(user, provider);
      await deleteUser(user);
    } else {
      throw e;
    }
  }
}
