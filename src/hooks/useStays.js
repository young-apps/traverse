// useStays — subscribe to a user's stays in realtime
import { useEffect, useState } from "react";
import { subscribeToStays } from "../services/stays";

export function useStays(uid) {
  const [stays, setStays] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!uid) {
      setStays([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const unsubscribe = subscribeToStays(uid, (data) => {
      setStays(data);
      setLoading(false);
    });
    return unsubscribe;
  }, [uid]);

  return { stays, loading };
}
