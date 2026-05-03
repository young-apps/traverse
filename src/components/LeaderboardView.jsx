// LeaderboardView — Hotels, Nights, Nights per Year
// (Total spend is intentionally excluded from social comparisons; lives
// in the user's own Insights tab only.)
function calcStats(stays) {
  const past = stays.filter((s) => s.status === "past");
  // "Hotels Visited" means actual hotels — friend/family-home stays count
  // toward nights and other metrics but not toward this hotel-leaderboard.
  const totalHotels = past.filter((s) => s.stayType !== "home").length;
  const totalNights = past.reduce((sum, s) => sum + (s.nights || 0), 0);
  const years = new Set(past.map((s) => s.checkIn ? new Date(s.checkIn + "T00:00:00").getFullYear() : null).filter(Boolean));
  const nightsPerYear = years.size > 0 ? totalNights / years.size : 0;
  return { totalHotels, totalNights, nightsPerYear, yearsActive: years.size };
}

function RankBadge({ rank }) {
  const e = { 1: "🥇", 2: "🥈", 3: "🥉" };
  return <span style={{ font: "700 14px var(--font-mono)", color: "var(--text-dim)", minWidth: 28, textAlign: "center" }}>{e[rank] || `#${rank}`}</span>;
}

function Board({ title, emoji, entries }) {
  return (
    <div style={{ padding: 16, borderRadius: 14, background: "var(--surface)", border: "1px solid var(--border)", marginBottom: 12 }}>
      <div style={{ font: "600 10px var(--font-mono)", color: "var(--text-dim)", textTransform: "uppercase", letterSpacing: 1.5, marginBottom: 12 }}>{emoji} {title}</div>
      {entries.map((e, i) => (
        <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 0", borderBottom: i < entries.length - 1 ? "1px solid var(--border)" : "none" }}>
          <RankBadge rank={i + 1} />
          <div style={{ width: 28, height: 28, borderRadius: 8, flexShrink: 0, background: e.isMe ? "var(--accent-muted)" : "var(--surface-hover)", border: `1px solid ${e.isMe ? "var(--accent-border)" : "var(--border)"}`, display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden" }}>
            {e.photoURL ? <img src={e.photoURL} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : <span style={{ font: "600 11px var(--font-mono)", color: e.isMe ? "var(--accent)" : "var(--text-dim)" }}>{e.initial}</span>}
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ font: "500 13px var(--font-sans)", color: e.isMe ? "var(--text)" : "var(--text-secondary)" }}>
              {e.name} {e.isMe && <span style={{ font: "10px var(--font-mono)", color: "var(--accent)" }}>(you)</span>}
            </div>
          </div>
          <div style={{ font: "600 14px var(--font-mono)", color: e.isMe ? "var(--accent)" : "var(--text)" }}>{e.value}</div>
        </div>
      ))}
    </div>
  );
}

export default function LeaderboardView({ user, stays, friends, friendStays }) {
  const myStats = calcStats(stays);
  const myName = user.displayName?.split(" ")[0] || "You";
  const me = { name: myName, initial: myName.charAt(0).toUpperCase(), photoURL: user.photoURL, isMe: true, stats: myStats };

  const all = [me, ...friends.map((f) => {
    // friendStays now stores { stays, shared }; non-opted-in friends get [].
    const entry = friendStays[f.friendUid];
    const list = Array.isArray(entry) ? entry : (entry?.stays || []);
    const stats = calcStats(list);
    return { name: f.displayName?.split(" ")[0] || "Friend", initial: (f.displayName || "?").charAt(0), photoURL: f.photoURL, isMe: false, stats };
  })];

  const boards = [
    { title: "Hotels Visited", emoji: "🏨", entries: [...all].sort((a, b) => b.stats.totalHotels - a.stats.totalHotels).map((e) => ({ ...e, value: e.stats.totalHotels })) },
    { title: "Total Nights", emoji: "🌙", entries: [...all].sort((a, b) => b.stats.totalNights - a.stats.totalNights).map((e) => ({ ...e, value: e.stats.totalNights })) },
    { title: "Nights per Year", emoji: "📅", entries: [...all].sort((a, b) => b.stats.nightsPerYear - a.stats.nightsPerYear).map((e) => ({ ...e, value: e.stats.nightsPerYear.toFixed(1) })) },
  ];

  return (
    <div style={{ padding: "0 20px 40px" }}>
      {friends.length === 0 && (
        <div style={{ padding: 16, borderRadius: 14, background: "var(--accent-muted)", border: "1px solid var(--accent-border)", marginBottom: 16, font: "13px var(--font-sans)", color: "var(--text-secondary)", lineHeight: 1.5 }}>
          Add friends to see how you compare! Leaderboards rank you against your travel circle.
        </div>
      )}
      {boards.map((b) => <Board key={b.title} {...b} />)}
    </div>
  );
}
