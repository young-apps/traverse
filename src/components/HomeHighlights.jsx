// HomeHighlights — a small, frosted "fact-of-the-moment" card that
// floats at the top of the Home map. Rotates among year-to-date
// snapshots so each visit to Home tells a slightly different story
// without adding a new tab/route. Tap to cycle manually; otherwise
// auto-rotates every ~6s. Hides itself if there's nothing to say.
//
// Design intent: this is not a notification or a CTA — it's ambient
// flavor, like the kind of factoid you'd see on a passport stamp.

import { useEffect, useMemo, useState } from "react";

// Same lightweight brand detector used in StatsView. Duplicated here
// to keep this component dependency-free; if either grows, lift to
// services/brand.js.
const BRAND_PATTERNS = [
  { match: /marriott|bonvoy|ritz.carlton|st\.?\s*regis|westin|sheraton/i, brand: "Marriott" },
  { match: /hilton|waldorf|conrad|doubletree|garden inn|hampton|embassy/i, brand: "Hilton" },
  { match: /hyatt|andaz|park hyatt|grand hyatt|alila|thompson/i, brand: "Hyatt" },
  { match: /ihg|intercontinental|kimpton|indigo|crowne plaza|holiday inn/i, brand: "IHG" },
  { match: /accor|sofitel|fairmont|raffles|novotel/i, brand: "Accor" },
  { match: /four seasons/i, brand: "Four Seasons" },
  { match: /aman/i, brand: "Aman" }, { match: /belmond/i, brand: "Belmond" },
  { match: /rosewood/i, brand: "Rosewood" }, { match: /shangri.la/i, brand: "Shangri-La" },
];
const detectBrand = (n) => { if (!n) return null; for (const p of BRAND_PATTERNS) if (p.match.test(n)) return p.brand; return null; };

// Build the candidate fact list. Each entry is { icon, text } and the
// list is filtered to only entries that have meaningful data — we'd
// rather show three good facts on rotation than pad with "0 nights so
// far this year." Order is deliberate: most personal/recent first.
function buildHighlights(stays) {
  const out = [];
  if (!Array.isArray(stays) || stays.length === 0) return out;
  const year = new Date().getFullYear();
  const yearStart = `${year}-01-01`;
  const past = stays.filter((s) => s.status === "past");
  const upcoming = stays.filter((s) => s.status === "upcoming")
    .sort((a, b) => new Date(a.checkIn) - new Date(b.checkIn));
  const ytd = past.filter((s) => s.checkIn && s.checkIn >= yearStart);
  const ytdNights = ytd.reduce((n, s) => n + (s.nights || 0), 0);

  // 1) Next-up countdown — highest signal.
  if (upcoming[0]?.checkIn) {
    const days = Math.max(0, Math.ceil((new Date(upcoming[0].checkIn + "T00:00:00") - Date.now()) / 864e5));
    if (days <= 60) {
      out.push({
        icon: "✈",
        text: days === 0
          ? `Today: ${upcoming[0].hotel || upcoming[0].city || "Next stay"}`
          : `${days} day${days === 1 ? "" : "s"} until ${upcoming[0].city || upcoming[0].hotel}`,
      });
    }
  }

  // 2) Most-visited city YTD.
  if (ytd.length) {
    const byCity = {};
    ytd.forEach((s) => { const c = s.metroArea || s.city; if (c) byCity[c] = (byCity[c] || 0) + (s.nights || 0); });
    const top = Object.entries(byCity).sort(([, a], [, b]) => b - a)[0];
    if (top && top[1] >= 2) out.push({ icon: "🏙", text: `${top[0]} is your most-visited city of ${year}` });
  }

  // 3) Boutique-hotel count YTD — celebrates variety, not loyalty.
  const independentYtd = ytd.filter((s) => s.stayType !== "home" && !detectBrand(s.hotel));
  const independentNights = independentYtd.reduce((n, s) => n + (s.nights || 0), 0);
  if (independentNights >= 3) {
    out.push({ icon: "✦", text: `${independentNights} nights in independent hotels this year` });
  }

  // 4) Top brand YTD.
  if (ytd.length) {
    const byBrand = {};
    ytd.forEach((s) => { const b = detectBrand(s.hotel); if (b) byBrand[b] = (byBrand[b] || 0) + (s.nights || 0); });
    const top = Object.entries(byBrand).sort(([, a], [, b]) => b - a)[0];
    if (top && top[1] >= 3) out.push({ icon: "🏨", text: `${top[1]} nights with ${top[0]} this year` });
  }

  // 5) Country breadth YTD.
  const countriesYtd = new Set(ytd.map((s) => s.country).filter(Boolean));
  if (countriesYtd.size >= 2) out.push({ icon: "🌍", text: `${countriesYtd.size} countries visited in ${year}` });

  // 6) YTD nights baseline — always last so it never crowds out the
  //    more interesting facts on a busy traveler.
  if (ytdNights >= 5) out.push({ icon: "🌙", text: `${ytdNights} nights away in ${year} so far` });

  return out;
}

export default function HomeHighlights({ stays }) {
  const items = useMemo(() => buildHighlights(stays), [stays]);
  const [idx, setIdx] = useState(0);

  // Auto-rotate every 6s. Pause logic is intentionally absent — the
  // card is small enough that a steady pulse feels alive, not nagging.
  useEffect(() => {
    if (items.length <= 1) return;
    const id = setInterval(() => setIdx((i) => (i + 1) % items.length), 6000);
    return () => clearInterval(id);
  }, [items.length]);

  if (items.length === 0) return null;
  const cur = items[idx % items.length];

  // Tap to cycle — useful when the user wants to see the next fact
  // immediately rather than wait for the timer.
  const advance = () => setIdx((i) => (i + 1) % items.length);

  return (
    <button className="home-highlights" onClick={advance} aria-label="Cycle highlight">
      <span className="hh-icon" aria-hidden>{cur.icon}</span>
      <span className="hh-text" key={idx /* re-mount triggers fade-in */}>{cur.text}</span>
      {items.length > 1 && (
        <span className="hh-pips" aria-hidden>
          {items.map((_, i) => <span key={i} className={`hh-pip ${i === idx ? "on" : ""}`} />)}
        </span>
      )}
    </button>
  );
}
