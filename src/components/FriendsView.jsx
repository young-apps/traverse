// FriendsView — with privacy disclaimer + opt-in stay-sharing toggle
import { useState, useEffect } from "react";
import { searchUsers, listAllUsers, sendFriendRequest, acceptFriendRequest, declineFriendRequest, removeFriend, getUserProfile, setShareStaysWithFriends } from "../services/friends";
import { TERMS_URL } from "../services/links";

const fmt = (d) => d ? new Date(d + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "";
const fmtS = (d) => d ? new Date(d + "T00:00:00").toLocaleDateString("en-US", { month: "short", year: "numeric" }) : "";

export default function FriendsView({ user, friends, requests, friendStays, onRefresh }) {
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState([]); // name-search candidates
  const [allUsers, setAllUsers] = useState([]); // full directory shown when search is empty
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [expandedFriend, setExpandedFriend] = useState(null);
  // Sharing is OFF by default — users explicitly opt in to expose their stays.
  const [sharing, setSharing] = useState(false);
  const [savingShare, setSavingShare] = useState(false);

  useEffect(() => {
    if (!user?.uid) return;
    getUserProfile(user.uid)
      .then((p) => setSharing(p?.shareStaysWithFriends === true))
      .catch(() => setSharing(false));
  }, [user?.uid]);

  const toggleSharing = async () => {
    const next = !sharing;
    setSavingShare(true);
    try {
      await setShareStaysWithFriends(user.uid, next);
      setSharing(next);
      onRefresh && onRefresh();
    } catch (e) { console.error("toggle sharing failed", e); }
    setSavingShare(false);
  };

  // Preload the full directory on mount AND every time the friends list
  // mutates (add, accept, remove). Without re-fetching after a
  // membership change the cached directory will keep showing a removed
  // friend in the wrong bucket until the 5-minute TTL expires — that's
  // the zombie-profile bug. We deliberately skip the cache here so the
  // first render after a remove is canonical.
  useEffect(() => {
    let cancelled = false;
    // Light-touch invalidation so listAllUsers re-reads from Firestore.
    import("../services/friends").then((m) => m.invalidateDirectoryCache && m.invalidateDirectoryCache());
    listAllUsers()
      .then((list) => {
        if (cancelled) return;
        setAllUsers(list.filter((p) => p.uid !== user.uid));
      })
      .catch((e) => console.warn("directory load failed", e));
    return () => { cancelled = true; };
  }, [user.uid, friends.length]);

  // Fuzzy search across displayName + email. The directory is fetched
  // once and cached in memory by services/friends.js, so each keystroke
  // is a near-instant in-memory filter -- no debounce needed, no extra
  // Firestore reads per keystroke.
  useEffect(() => {
    setError(null); setSuccess(null);
    const q = searchQuery.trim();
    if (q.length < 1) { setSearchResults([]); return; }
    let cancelled = false;
    setSearching(true);
    searchUsers(q).then((list) => {
      if (cancelled) return;
      const filtered = list.filter((p) => p.uid !== user.uid && !friends.some((f) => f.friendUid === p.uid));
      setSearchResults(filtered);
      if (!filtered.length) setError("No matches.");
      setSearching(false);
    }).catch((e) => {
      if (cancelled) return;
      console.error("search error", e);
      if (e.code === "permission-denied") setError("Permission denied. Firestore rules need updating.");
      else setError(`Search failed: ${e.message || "unknown"}`);
      setSearchResults([]);
      setSearching(false);
    });
    return () => { cancelled = true; };
  }, [searchQuery, user.uid, friends]);

  const handleSendRequestTo = async (profile) => {
    setError(null); setSuccess(null);
    try {
      if (profile.uid === user.uid) { setError("That's you!"); return; }
      if (friends.some((f) => f.friendUid === profile.uid)) { setError("Already in your friends list."); return; }
      await sendFriendRequest(user, profile.uid);
      setSuccess(`Request sent to ${profile.displayName || profile.email}!`);
      setSearchQuery(""); setSearchResults([]);
    } catch (e) {
      console.error("Send request error:", e);
      if (e.code === "permission-denied") setError("Permission denied. Update your Firestore rules (see README).");
      else setError(`Failed: ${e.message || "Unknown error"}`);
    }
  };

  // Share sheet (iOS / Android / supported browsers) → falls back to
  // clipboard. Until the App Store listing is live, link points at the
  // GitHub Pages site which can host a "Get Traverse" landing page.
  const handleInvite = async () => {
    const myName = user.displayName?.split(" ")[0] || "your friend";
    const text = `${myName} invited you to Traverse — track your hotel stays. ${TERMS_URL}`;
    try {
      if (navigator.share) {
        await navigator.share({ title: "Traverse", text, url: TERMS_URL });
      } else if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
        setSuccess("Invite link copied!");
      } else {
        window.prompt("Copy and share this link:", text);
      }
    } catch (e) {
      // User cancelled the share sheet — that's fine, swallow.
      if (e?.name !== "AbortError") console.warn("share failed", e);
    }
  };

  const handleAccept = async (req) => {
    try {
      await acceptFriendRequest(user.uid, { displayName: user.displayName, email: user.email, photoURL: user.photoURL }, req);
      onRefresh();
    } catch (e) { console.error(e); }
  };

  const handleDecline = async (id) => { try { await declineFriendRequest(user.uid, id); } catch (e) { console.error(e); } };
  const handleRemove = async (uid) => { try { await removeFriend(user.uid, uid); if (expandedFriend === uid) setExpandedFriend(null); onRefresh(); } catch (e) { console.error(e); } };

  return (
    <div style={{ padding: "0 20px 40px" }}>

      {/* Privacy / sharing opt-in — defaults to OFF */}
      <div style={{
        padding: "14px 16px", borderRadius: 12, marginBottom: 16,
        background: "var(--surface)", border: "1px solid var(--border)",
        display: "flex", alignItems: "flex-start", gap: 12,
      }}>
        <div style={{ flex: 1 }}>
          <div style={{ font: "600 13px var(--font-sans)", color: "var(--text)", marginBottom: 4 }}>
            Share my stays with friends
          </div>
          <div style={{ font: "12px/1.5 var(--font-sans)", color: "var(--text-secondary)" }}>
            {sharing
              ? "Friends can see your past and upcoming stays (hotel names, cities, dates). Costs, loyalty numbers, and notes stay private."
              : "Your stays are private. Turn this on to let friends see your hotel names, cities, and dates. Costs and notes are never shared."}
          </div>
        </div>
        <button
          onClick={toggleSharing}
          disabled={savingShare}
          aria-pressed={sharing}
          aria-label="Toggle stay sharing"
          style={{
            position: "relative", width: 44, height: 26, flexShrink: 0,
            borderRadius: 999, border: "none", cursor: savingShare ? "wait" : "pointer",
            background: sharing ? "var(--accent)" : "var(--surface-active)",
            transition: "background .15s",
          }}
        >
          <span style={{
            position: "absolute", top: 3, left: sharing ? 21 : 3,
            width: 20, height: 20, borderRadius: "50%", background: "#FFFFFF",
            boxShadow: "0 1px 3px rgba(15,23,42,.25)", transition: "left .15s",
          }} />
        </button>
      </div>

      {/* Incoming requests */}
      {requests.length > 0 && (
        <div style={{ marginBottom: 16 }}>
          <div style={{ font: "600 10px var(--font-mono)", color: "var(--accent)", textTransform: "uppercase", letterSpacing: 1.2, marginBottom: 10, display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ background: "var(--accent)", color: "var(--bg)", width: 18, height: 18, borderRadius: "50%", display: "inline-flex", alignItems: "center", justifyContent: "center", font: "700 10px var(--font-mono)" }}>{requests.length}</span>
            Friend Request{requests.length > 1 ? "s" : ""}
          </div>
          {requests.map((req) => (
            <div key={req.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 16px", background: "var(--accent-muted)", border: "1px solid var(--accent-border)", borderRadius: 14, marginBottom: 8 }}>
              <div style={{ width: 36, height: 36, borderRadius: 10, background: "var(--surface)", border: "1px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden", flexShrink: 0 }}>
                {req.photoURL ? <img src={req.photoURL} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : <span style={{ font: "600 14px var(--font-mono)", color: "var(--text-secondary)" }}>{(req.displayName || "?").charAt(0)}</span>}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ font: "500 14px var(--font-sans)", color: "var(--text)" }}>{req.displayName || req.email}</div>
                <div style={{ font: "11px var(--font-mono)", color: "var(--text-dim)" }}>wants to connect</div>
              </div>
              <button onClick={() => handleAccept(req)} style={{ padding: "6px 14px", borderRadius: 8, border: "none", background: "var(--green)", color: "var(--bg)", font: "700 12px var(--font-sans)", cursor: "pointer" }}>Accept</button>
              <button onClick={() => handleDecline(req.id)} style={{ padding: "6px 10px", borderRadius: 8, border: "1px solid var(--border)", background: "none", color: "var(--text-dim)", font: "12px var(--font-sans)", cursor: "pointer" }}>✕</button>
            </div>
          ))}
        </div>
      )}

      {/* Add / invite friends */}
      <div style={{ padding: 16, borderRadius: 14, background: "var(--surface)", border: "1px solid var(--border)", marginBottom: 16 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
          <div style={{ font: "600 10px var(--font-mono)", color: "var(--text-dim)", textTransform: "uppercase", letterSpacing: 1.2 }}>Add a Friend</div>
          <button onClick={handleInvite} style={{
            padding: "5px 10px", borderRadius: 8, background: "transparent", border: "1px solid var(--accent-border)",
            color: "var(--accent)", font: "600 11px var(--font-sans)", cursor: "pointer",
          }}>Invite via link</button>
        </div>
        <input style={{ width: "100%", padding: "10px 14px", background: "var(--bg-2)", border: "1px solid var(--border)", borderRadius: 10, color: "var(--text)", font: "13px var(--font-sans)", outline: "none", boxSizing: "border-box" }}
          placeholder="Search any name or email…" value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)} />

        {/* Candidate list — when there's a query, show fuzzy matches; otherwise
            show the entire directory minus self + already-friends, so users
            can browse who's on the app without having to guess names. */}
        {(() => {
          const hasQuery = searchQuery.trim().length > 0;
          const browseList = allUsers.filter((p) => !friends.some((f) => f.friendUid === p.uid));
          const list = hasQuery ? searchResults : browseList;
          const showSection = searching || list.length > 0;
          if (!showSection) return null;
          return (
            <div style={{ marginTop: 8, borderRadius: 10, overflow: "hidden", background: "var(--bg-2)", border: "1px solid var(--border)" }}>
              {!hasQuery && list.length > 0 && (
                <div style={{ padding: "8px 12px", font: "600 10px var(--font-mono)", color: "var(--text-dim)", textTransform: "uppercase", letterSpacing: 1.2, background: "var(--surface)" }}>
                  Everyone on Traverse · {list.length}
                </div>
              )}
              {searching && <div style={{ padding: "10px 12px", font: "12px var(--font-mono)", color: "var(--text-dim)" }}>Searching…</div>}
              {!searching && list.map((p) => (
                <div key={p.uid} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", borderTop: "1px solid var(--border)" }}>
                  <div style={{ width: 28, height: 28, borderRadius: 8, background: "var(--surface)", border: "1px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden", flexShrink: 0 }}>
                    {p.photoURL ? <img src={p.photoURL} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : <span style={{ font: "600 11px var(--font-mono)", color: "var(--text-dim)" }}>{(p.displayName || p.email || "?").charAt(0).toUpperCase()}</span>}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ font: "500 13px var(--font-sans)", color: "var(--text)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.displayName || p.email}</div>
                    <div style={{ font: "11px var(--font-mono)", color: "var(--text-dim)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.email}</div>
                  </div>
                  <button onClick={() => handleSendRequestTo(p)} style={{
                    padding: "6px 12px", borderRadius: 8, border: "none", background: "var(--accent)",
                    color: "var(--bg)", font: "700 11px var(--font-sans)", cursor: "pointer", flexShrink: 0,
                  }}>Add</button>
                </div>
              ))}
            </div>
          );
        })()}

        {error && <div style={{ marginTop: 8, padding: "8px 12px", borderRadius: 8, background: "rgba(240,96,80,0.08)", border: "1px solid rgba(240,96,80,0.15)", color: "var(--red)", font: "12px var(--font-sans)", lineHeight: 1.4 }}>{error}</div>}
        {success && <div style={{ marginTop: 8, padding: "8px 12px", borderRadius: 8, background: "var(--green-muted)", border: "1px solid rgba(61,214,140,0.2)", color: "var(--green)", font: "12px var(--font-mono)" }}>{success}</div>}
      </div>

      {/* Friends list */}
      {friends.length === 0 ? (
        <div style={{ padding: "40px 0", textAlign: "center" }}>
          <div style={{ fontSize: 32, marginBottom: 12 }}>👥</div>
          <div style={{ font: "italic 14px var(--font-display)", color: "var(--text-dim)", marginBottom: 6 }}>No friends yet</div>
          <div style={{ font: "12px var(--font-sans)", color: "var(--text-dim)" }}>Send a request above. They'll need to accept first.</div>
        </div>
      ) : (
        friends.map((friend) => {
          // friendStays now stores { stays, shared } — fall back gracefully
          // if any old shape leaks through.
          const entry = friendStays[friend.friendUid];
          const shared = entry && typeof entry === "object" && !Array.isArray(entry) ? entry.shared : true;
          const stays = Array.isArray(entry) ? entry : (entry?.stays || []);
          const isExpanded = expandedFriend === friend.friendUid;
          const upcoming = stays.filter((s) => s.status === "upcoming");
          const past = stays.filter((s) => s.status === "past");
          return (
            <div key={friend.friendUid} style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 14, marginBottom: 12, overflow: "hidden" }}>
              <div onClick={() => setExpandedFriend(isExpanded ? null : friend.friendUid)} style={{ display: "flex", alignItems: "center", gap: 12, padding: "14px 16px", cursor: "pointer" }}>
                <div style={{ width: 36, height: 36, borderRadius: 10, background: "var(--accent-muted)", border: "1px solid var(--accent-border)", display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden", flexShrink: 0 }}>
                  {friend.photoURL ? <img src={friend.photoURL} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : <span style={{ font: "600 14px var(--font-mono)", color: "var(--accent)" }}>{(friend.displayName || "?").charAt(0)}</span>}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ font: "500 14px var(--font-sans)", color: "var(--text)" }}>{friend.displayName || friend.email}</div>
                  <div style={{ font: "11px var(--font-mono)", color: "var(--text-dim)" }}>
                    {!shared ? (
                      <span>Stays private</span>
                    ) : (
                      <>
                        {stays.length} stay{stays.length !== 1 ? "s" : ""}
                        {upcoming.length > 0 && <span style={{ color: "var(--green)" }}> · {upcoming.length} upcoming</span>}
                      </>
                    )}
                  </div>
                </div>
                <span style={{ font: "14px var(--font-sans)", color: "var(--text-dim)", transition: "transform 0.2s", transform: isExpanded ? "rotate(180deg)" : "rotate(0)" }}>▼</span>
              </div>
              {isExpanded && (
                <div style={{ borderTop: "1px solid var(--border)" }}>
                  {!shared && (
                    <div style={{ padding: "16px", font: "12px/1.5 var(--font-sans)", color: "var(--text-secondary)", background: "var(--bg-2)" }}>
                      This friend hasn't opted in to share their stays. Only they can change that from their own privacy settings.
                    </div>
                  )}
                  {shared && upcoming.length > 0 && (
                    <div style={{ padding: "12px 16px", background: "var(--green-muted)" }}>
                      <div style={{ font: "600 10px var(--font-mono)", color: "var(--green)", textTransform: "uppercase", letterSpacing: 1, marginBottom: 8 }}>Upcoming</div>
                      {upcoming.map((s) => <div key={s.id} style={{ padding: "6px 0" }}><div style={{ font: "500 13px var(--font-sans)", color: "var(--text)" }}>{s.hotel}</div><div style={{ font: "11px var(--font-mono)", color: "var(--text-dim)" }}>{s.city} · {fmt(s.checkIn)} → {fmt(s.checkOut)}</div></div>)}
                    </div>
                  )}
                  {shared && past.length > 0 && (
                    <div style={{ padding: "12px 16px" }}>
                      <div style={{ font: "600 10px var(--font-mono)", color: "var(--text-dim)", textTransform: "uppercase", letterSpacing: 1, marginBottom: 8 }}>Past</div>
                      {past.slice(0, 10).map((s) => (
                        <div key={s.id} style={{ padding: "6px 0", borderBottom: "1px solid var(--border)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                          <div><div style={{ font: "500 13px var(--font-sans)", color: "var(--text-secondary)" }}>{s.hotel}</div><div style={{ font: "11px var(--font-mono)", color: "var(--text-dim)" }}>{s.city} · {fmtS(s.checkIn)} · {s.nights}n</div></div>
                          {s.rating && <span style={{ color: "var(--accent)", fontSize: 11 }}>{"★".repeat(s.rating)}</span>}
                        </div>
                      ))}
                    </div>
                  )}
                  <div style={{ padding: "8px 16px 12px", borderTop: "1px solid var(--border)" }}>
                    <button onClick={() => handleRemove(friend.friendUid)} style={{ padding: "6px 12px", borderRadius: 6, background: "rgba(240,96,80,0.06)", border: "1px solid rgba(240,96,80,0.15)", color: "var(--red)", font: "11px var(--font-mono)", cursor: "pointer" }}>Remove friend</button>
                  </div>
                </div>
              )}
            </div>
          );
        })
      )}
    </div>
  );
}
