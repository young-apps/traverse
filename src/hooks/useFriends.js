// useFriends — friends + incoming requests
import { useEffect, useState, useCallback } from "react";
import { subscribeToFriends, subscribeToFriendRequests, getFriendStays } from "../services/friends";

export function useFriends(uid) {
  const [friends, setFriends] = useState([]);
  const [requests, setRequests] = useState([]);
  const [friendStays, setFriendStays] = useState({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!uid) { setFriends([]); setRequests([]); setLoading(false); return; }
    setLoading(true);

    const unsub1 = subscribeToFriends(uid, async (friendList) => {
      setFriends(friendList);
      const staysMap = {};
      await Promise.all(friendList.map(async (f) => {
        try { staysMap[f.friendUid] = await getFriendStays(f.friendUid); }
        catch (e) { staysMap[f.friendUid] = []; }
      }));
      setFriendStays(staysMap);
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
      try { staysMap[f.friendUid] = await getFriendStays(f.friendUid); }
      catch (e) { staysMap[f.friendUid] = []; }
    }));
    setFriendStays(staysMap);
  }, [friends]);

  return { friends, requests, friendStays, loading, refreshFriendStays };
}
