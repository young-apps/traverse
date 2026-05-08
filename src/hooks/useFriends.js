// useFriends — friends + incoming requests.
//
// Friend stays come in with a stored `status` field that was a write-time
// snapshot ("upcoming" / "past"). That goes stale the moment the calendar
// rolls past a checkOut, so a friend's "upcoming" Conrad Istanbul shows
// up as Upcoming on our friend map weeks after they checked out. We
// mirror useStays here: re-derive status on every read against today's
// date and re-tick at local midnight so an open session updates without
// a refresh.
import { useEffect, useState, useCallback, useMemo } from "react";
import { subscribeToFriends, subscribeToFriendRequests, getFriendStays } from "../services/friends";

const todayISO = () => new Date().toISOString().split("T")[0];
const deriveStatus = (s, today) => {
  if (!s.checkOut) return s.status || "past";
  return s.checkOut > today ? "upcoming" : "past";
};
// Decorate either shape ({stays, shared} or a bare array) with fresh
// status. Returns a new object/array so React picks up the change.
const decorateEntry = (entry, today) => {
  if (Array.isArray(entry)) {
    return entry.map((s) => {
      const next = deriveStatus(s, today);
      return next === s.status ? s : { ...s, status: next };
    });
  }
  if (entry && Array.isArray(entry.stays)) {
    return { ...entry, stays: entry.stays.map((s) => {
      const next = deriveStatus(s, today);
      return next === s.status ? s : { ...s, status: next };
    }) };
  }
  return entry;
};

export function useFriends(uid) {
  const [friends, setFriends] = useState([]);
  const [requests, setRequests] = useState([]);
  const [rawFriendStays, setRawFriendStays] = useState({});
  const [loading, setLoading] = useState(true);
  const [today, setToday] = useState(todayISO());

  // Tick at next local midnight so a session left open over a date
  // boundary re-derives Upcoming → Past without a manual refresh.
  useEffect(() => {
    const now = new Date();
    const nextMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 0, 0, 5);
    const ms = Math.max(1000, nextMidnight - now);
    const t = setTimeout(() => setToday(todayISO()), ms);
    return () => clearTimeout(t);
  }, [today]);

  useEffect(() => {
    if (!uid) { setFriends([]); setRequests([]); setLoading(false); return; }
    setLoading(true);

    const unsub1 = subscribeToFriends(uid, async (friendList) => {
      setFriends(friendList);
      const staysMap = {};
      await Promise.all(friendList.map(async (f) => {
        try {
          const res = await getFriendStays(f.friendUid);
          // getFriendStays returns { stays, shared } — preserve both so the UI
          // can distinguish "no stays yet" from "this friend hasn't opted in".
          staysMap[f.friendUid] = res;
        } catch (e) {
          staysMap[f.friendUid] = { stays: [], shared: false };
        }
      }));
      setRawFriendStays(staysMap);
      setLoading(false);
    });

    const unsub2 = subscribeToFriendRequests(uid, (reqs) => {
      setRequests(reqs.filter((r) => r.status === "pending"));
    });

    return () => { unsub1(); unsub2(); };
  }, [uid]);

  const refreshFriendStays = useCallback(async () => {
    const staysMap = {};
    await Promise.all(friends.map(async (f) => {
      try {
        staysMap[f.friendUid] = await getFriendStays(f.friendUid);
      } catch (e) {
        staysMap[f.friendUid] = { stays: [], shared: false };
      }
    }));
    setRawFriendStays(staysMap);
  }, [friends]);

  // Re-derive status across every friend's stays on each render where
  // raw data or `today` changed. Memoized so the object identity stays
  // stable when nothing has shifted.
  const friendStays = useMemo(() => {
    const out = {};
    for (const k of Object.keys(rawFriendStays)) {
      out[k] = decorateEntry(rawFriendStays[k], today);
    }
    return out;
  }, [rawFriendStays, today]);

  return { friends, requests, friendStays, loading, refreshFriendStays };
}
