// useStays — subscribe to a user's stays in realtime
//
// Status is *derived from today's date*, not read from Firestore. The
// stored `status` field is a write-time snapshot ("upcoming" / "past")
// that goes stale the moment the calendar advances past a checkOut. We
// re-compute it on every read so a stay flips to "past" the morning
// after checkout without anyone touching the document.
//
// We also re-tick at midnight (local time) so a session left open over
// a date boundary updates without a refresh.

import { useEffect, useState } from "react";
import { subscribeToStays } from "../services/stays";

const todayISO = () => new Date().toISOString().split("T")[0];
const deriveStatus = (s, today) => {
  if (!s.checkOut) return s.status || "past";
  // checkOut is the morning of departure -> the stay is "past" once
  // today's date is on or after checkOut.
  return s.checkOut > today ? "upcoming" : "past";
};

export function useStays(uid) {
  const [raw, setRaw] = useState([]);
  const [loading, setLoading] = useState(true);
  const [today, setToday] = useState(todayISO());

  useEffect(() => {
    if (!uid) { setRaw([]); setLoading(false); return; }
    setLoading(true);
    const unsubscribe = subscribeToStays(uid, (data) => {
      setRaw(data);
      setLoading(false);
    });
    return unsubscribe;
  }, [uid]);

  // Tick at the next local-midnight so an open session re-derives
  // status when the date rolls over. setTimeout, not setInterval, so we
  // don't waste cycles re-rendering every minute.
  useEffect(() => {
    const now = new Date();
    const nextMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 0, 0, 5);
    const ms = Math.max(1000, nextMidnight - now);
    const t = setTimeout(() => setToday(todayISO()), ms);
    return () => clearTimeout(t);
  }, [today]);

  // Decorate raw stays with derived status. Cheap O(n) — runs only when
  // raw or today changes.
  const stays = raw.map((s) => {
    const next = deriveStatus(s, today);
    return next === s.status ? s : { ...s, status: next };
  });

  return { stays, loading };
}
