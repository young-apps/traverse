// FriendsView — with privacy disclaimer
import { useState } from "react";
import { findUserByEmail, sendFriendRequest, acceptFriendRequest, declineFriendRequest, removeFriend } from "../services/friends";

const fmt = (d) => d ? new Date(d + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "";
const fmtS = (d) => d ? new Date(d + "T00:00:00").toLocaleDateString("en-US", { month: "short", year: "numeric" }) : "";

export default function FriendsView({ user, friends, requests, friendStays, onRefresh }) {
  const [email, setEmail] = useState("");
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [expandedFriend, setExpandedFriend] = useState(null);

  const handleSendRequest = async () => {
    if (!email.trim()) return;
    setSearching(true); setError(null); setSuccess(null);
    try {
      if (email.toLowerCase().trim() === user.email?.toLowerCase()) { setError("That's your own email!"); setSearching(false); return; }
      const found = await findUserByEmail(email);
      if (!found) { setError("No Traverse account found with that email."); setSearching(false); return; }
      if (friends.some((f) => f.friendUid === found.uid)) { setError("Already in your friends list."); setSearching(false); return; }
      await sendFriendRequest(user, found.uid);
      setSuccess(`Request sent to ${found.displayName || found.email}!`);
      setEmail("");
    } catch (e) {
      console.error("Send request error:", e);
      if (e.code === "permission-denied") setError("Permission denied. Update your Firestore rules (see README).");
      else setError(`Failed: ${e.message || "Unknown error"}`);
    }
    setSearching(false);
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

      {/* Privacy disclaimer */}
      <div style={{
        padding: "12px 16px", borderRadius: 12, marginBottom: 16,
        background: "rgba(78,158,245,0.06)", border: "1px solid rgba(78,158,245,0.15)",
        font: "12px/1.5 var(--font-sans)", color: "var(--text-secondary)",
      }}>
        <span style={{ font: "600 12px var(--font-sans)", color: "var(--blue)" }}>🔒 Privacy note: </span>
        When you add a friend, they can see your past and upcoming stays including hotel names, cities, and dates. They cannot see your costs, loyalty numbers, or private notes. You can remove a friend at any time.
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

      {/* Send request */}
      <div style={{ padding: 16, borderRadius: 14, background: "var(--surface)", border: "1px solid var(--border)", marginBottom: 16 }}>
        <div style={{ font: "600 10px var(--font-mono)", color: "var(--text-dim)", textTransform: "uppercase", letterSpacing: 1.2, marginBottom: 8 }}>Add a Friend</div>
        <div style={{ display: "flex", gap: 8 }}>
          <input style={{ flex: 1, padding: "10px 14px", background: "var(--bg-2)", border: "1px solid var(--border)", borderRadius: 10, color: "var(--text)", font: "13px var(--font-sans)", outline: "none" }}
            placeholder="Enter their email address…" value={email}
            onChange={(e) => { setEmail(e.target.value); setError(null); setSuccess(null); }}
            onKeyDown={(e) => e.key === "Enter" && handleSendRequest()} />
          <button onClick={handleSendRequest} disabled={searching || !email.trim()} style={{
            padding: "10px 16px", borderRadius: 10, background: email.trim() ? "var(--accent)" : "var(--surface-hover)",
            border: "none", color: email.trim() ? "var(--bg)" : "var(--text-dim)", font: "700 13px var(--font-sans)", cursor: email.trim() ? "pointer" : "not-allowed",
          }}>{searching ? "…" : "Send"}</button>
        </div>
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
          const stays = friendStays[friend.friendUid] || [];
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
                    {stays.length} stay{stays.length !== 1 ? "s" : ""}
                    {upcoming.length > 0 && <span style={{ color: "var(--green)" }}> · {upcoming.length} upcoming</span>}
                  </div>
                </div>
                <span style={{ font: "14px var(--font-sans)", color: "var(--text-dim)", transition: "transform 0.2s", transform: isExpanded ? "rotate(180deg)" : "rotate(0)" }}>▼</span>
              </div>
              {isExpanded && (
                <div style={{ borderTop: "1px solid var(--border)" }}>
                  {upcoming.length > 0 && (
                    <div style={{ padding: "12px 16px", background: "var(--green-muted)" }}>
                      <div style={{ font: "600 10px var(--font-mono)", color: "var(--green)", textTransform: "uppercase", letterSpacing: 1, marginBottom: 8 }}>Upcoming</div>
                      {upcoming.map((s) => <div key={s.id} style={{ padding: "6px 0" }}><div style={{ font: "500 13px var(--font-sans)", color: "var(--text)" }}>{s.hotel}</div><div style={{ font: "11px var(--font-mono)", color: "var(--text-dim)" }}>{s.city} · {fmt(s.checkIn)} → {fmt(s.checkOut)}</div></div>)}
                    </div>
                  )}
                  {past.length > 0 && (
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
