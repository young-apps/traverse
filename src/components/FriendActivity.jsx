// FriendActivity — contextual "have any of my friends stayed here?"
// section that appears at the bottom of the stay-detail modal.
//
// We deliberately don't build a feed. The signal is: when looking at
// THIS hotel, am I missing tribal knowledge from a friend who also
// stayed here? If yes, surface their rating and the first sentence
// of their notes (a "tip"). If no, render nothing — the section
// itself is invisible until it has something useful to say.
//
// Privacy: same model as the friends map. We only look at stays that
// arrived via friendStays (which is gated server-side by each friend's
// shareStaysWithFriends flag). We never reach for a friend's full
// profile or stay list directly.

import { useMemo } from "react";

// Loose match: same hotel name in the same city, case- and
// punctuation-insensitive. Two stays with the hotel "Park Hyatt
// Tokyo" and "Park Hyatt — Tokyo" should both match. We require a
// city match too so that two different "Hilton Garden Inn" stays in
// different cities don't collide.
const norm = (s) => String(s || "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
function isSameHotel(a, b) {
  if (!a?.hotel || !b?.hotel) return false;
  if (norm(a.hotel) !== norm(b.hotel)) return false;
  // Allow either city OR metroArea to match — handles the case where
  // one stay was logged with the suburb and the other rolled up to
  // its primary metro.
  const ax = [norm(a.city), norm(a.metroArea)].filter(Boolean);
  const bx = [norm(b.city), norm(b.metroArea)].filter(Boolean);
  return ax.some((v) => bx.includes(v));
}

// Take the first sentence (or first 90 chars) of a friend's notes as
// a "tip." We'd rather show one crisp line than two ugly truncated
// ones; if the notes are pure punctuation or whitespace, fall back
// to nothing.
function firstSentence(notes) {
  if (!notes) return "";
  const trimmed = String(notes).trim();
  if (!trimmed) return "";
  const m = trimmed.match(/^(.{10,140}?[.!?])(?:\s|$)/);
  if (m) return m[1];
  return trimmed.length > 100 ? trimmed.slice(0, 97) + "…" : trimmed;
}

export default function FriendActivity({ stay, friends = [], friendStays = {} }) {
  const matches = useMemo(() => {
    if (!stay?.hotel) return [];
    const out = [];
    for (const f of friends) {
      const entry = friendStays?.[f.friendUid];
      const shared = entry && typeof entry === "object" && !Array.isArray(entry) ? entry.shared : true;
      if (!shared) continue;
      const list = Array.isArray(entry) ? entry : (entry?.stays || []);
      // Pick the friend's most-recent past stay at the same hotel,
      // or their earliest upcoming if they haven't been yet.
      const sameHotel = list.filter((s) => isSameHotel(s, stay));
      if (!sameHotel.length) continue;
      const past = sameHotel.filter((s) => s.status === "past")
        .sort((a, b) => (b.checkIn || "").localeCompare(a.checkIn || ""));
      const upcoming = sameHotel.filter((s) => s.status === "upcoming")
        .sort((a, b) => (a.checkIn || "").localeCompare(b.checkIn || ""));
      const pick = past[0] || upcoming[0];
      if (!pick) continue;
      out.push({
        uid: f.friendUid,
        name: f.displayName || f.email || "Friend",
        photoURL: f.photoURL || "",
        rating: pick.rating || 0,
        tip: firstSentence(pick.notes),
        when: pick.checkIn || "",
        upcoming: pick.status === "upcoming",
      });
    }
    // Highest rating first; ties broken by recency.
    return out.sort((a, b) => (b.rating || 0) - (a.rating || 0) || b.when.localeCompare(a.when));
  }, [stay, friends, friendStays]);

  if (matches.length === 0) return null;

  return (
    <div className="friend-activity">
      <div className="friend-activity-title">
        <span aria-hidden>👥</span> Friend Activity
      </div>
      {matches.map((m) => (
        <div key={m.uid} className="friend-activity-row">
          {m.photoURL
            ? <img className="friend-activity-avatar" src={m.photoURL} alt="" />
            : <span className="friend-activity-avatar friend-activity-avatar-fallback" aria-hidden>{m.name[0] || "?"}</span>}
          <div className="friend-activity-body">
            <div className="friend-activity-name">
              {m.name}
              {m.upcoming && <span className="friend-activity-upcoming">· Heading there</span>}
              {m.rating > 0 && (
                <span className="friend-activity-rating" aria-label={`${m.rating} of 5`}>
                  {"★".repeat(m.rating)}<span style={{ color: "var(--text-dim)" }}>{"★".repeat(5 - m.rating)}</span>
                </span>
              )}
            </div>
            {m.tip && <div className="friend-activity-tip">"{m.tip}"</div>}
          </div>
        </div>
      ))}
    </div>
  );
}
