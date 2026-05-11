// StatsView — tappable cities/countries with full lists, larger fonts
import { useState } from "react";
import { continentalFootprint, travelCadence, longestStreak, leadTimeStats, yoyNightsToDate } from "../services/insights";

const fmtShort = (d) => d ? new Date(d + "T00:00:00").toLocaleDateString("en-US", { month: "short", year: "numeric" }) : "";

const BRAND_PATTERNS = [
  { match: /marriott|bonvoy|ritz.carlton|st\.?\s*regis|westin|sheraton/i, brand: "Marriott" },
  { match: /hilton|waldorf|conrad|doubletree|garden inn|hampton|embassy/i, brand: "Hilton" },
  { match: /hyatt|andaz|park hyatt|grand hyatt|alila|thompson/i, brand: "Hyatt" },
  { match: /ihg|intercontinental|kimpton|indigo|crowne plaza|holiday inn/i, brand: "IHG" },
  { match: /accor|sofitel|fairmont|raffles|novotel/i, brand: "Accor" },
  { match: /four seasons/i, brand: "Four Seasons" },
  { match: /mandarin oriental/i, brand: "Mandarin Oriental" },
  { match: /aman/i, brand: "Aman" }, { match: /belmond/i, brand: "Belmond" },
  { match: /rosewood/i, brand: "Rosewood" }, { match: /shangri.la/i, brand: "Shangri-La" },
  { match: /loews/i, brand: "Loews" }, { match: /six senses/i, brand: "Six Senses" },
];
function detectBrand(n) { if (!n) return "Independent"; for (const p of BRAND_PATTERNS) if (p.match.test(n)) return p.brand; return "Independent"; }

// Loyalty-tier ladders, simplified to nights-only requirements (most
// programs ALSO accept stays-or-points-or-revenue, but nights is the
// universal currency we already track). Source: each program's public
// elite-status page as of 2026. Numbers are intentionally conservative
// — we'd rather under-promise the user's progress than show "1 night
// to Diamond" and have them book a stay only to learn they needed
// stays/points too.
const BRAND_TIERS = {
  Marriott: [{ name: "Silver", n: 10 }, { name: "Gold", n: 25 }, { name: "Platinum", n: 50 }, { name: "Titanium", n: 75 }, { name: "Ambassador", n: 100 }],
  Hilton:   [{ name: "Silver", n: 10 }, { name: "Gold", n: 40 }, { name: "Diamond", n: 60 }],
  Hyatt:    [{ name: "Discoverist", n: 10 }, { name: "Explorist", n: 30 }, { name: "Globalist", n: 60 }],
  IHG:      [{ name: "Silver", n: 10 }, { name: "Gold", n: 20 }, { name: "Platinum", n: 40 }, { name: "Diamond", n: 70 }],
  Accor:    [{ name: "Silver", n: 10 }, { name: "Gold", n: 30 }, { name: "Platinum", n: 60 }, { name: "Diamond", n: 100 }],
};

// Progress toward the next tier *this calendar year*, since loyalty
// status resets annually. Returns { current, next, ytd, pct } or null.
//
// IMPORTANT: only stays the user explicitly marked as "I booked this"
// count toward elite status. Loyalty programs only credit qualifying
// nights when the booking is made by the member under their own account
// — comped rooms, family-booked trips, business travel where the
// company is the booker, or third-party OTA stays often don't qualify.
// We err on the side of underreporting (require an opt-in) rather than
// telling someone they're "on track for Diamond" off nights that won't
// actually credit. Beta tester feedback: "I didn't book any of these
// stays but it shows me on track for status."
function statusProgress(brand, stays) {
  const ladder = BRAND_TIERS[brand];
  if (!ladder) return null;
  const year = new Date().getFullYear();
  const yearStart = `${year}-01-01`;
  const ytd = stays
    .filter((s) => s.status === "past" && s.checkIn && s.checkIn >= yearStart)
    .filter((s) => detectBrand(s.hotel) === brand)
    .filter((s) => s.bookedByMe === true)
    .reduce((n, s) => n + (s.nights || 0), 0);
  // The "current" tier is the highest threshold YTD has crossed.
  let current = null;
  for (const t of ladder) if (ytd >= t.n) current = t;
  // The "next" tier is the first one above YTD.
  const next = ladder.find((t) => t.n > ytd);
  if (!next) return { current, next: null, ytd, pct: 100, nightsToNext: 0 };
  const prevN = current?.n || 0;
  const span = Math.max(1, next.n - prevN);
  const pct = Math.min(100, Math.round(((ytd - prevN) / span) * 100));
  return { current, next, ytd, pct, nightsToNext: next.n - ytd };
}

function BarChart({ data, color, labelWidth = 80 }) {
  const max = Math.max(...Object.values(data), 1);
  return Object.entries(data).sort(([, a], [, b]) => b - a).map(([label, value]) => (
    <div key={label} className="bar-row">
      <span style={{ width: labelWidth, font: "13px var(--font-sans)", color: "var(--text-secondary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flexShrink: 0 }}>{label}</span>
      <div className="bar-track">
        <div className="bar-fill" style={{ width: `${(value / max) * 100}%`, background: color, opacity: 0.7, height: "100%", minWidth: 22, paddingRight: 6 }}>
          {value > 1 && <span className="bar-value">{value}</span>}
        </div>
      </div>
      {value <= 1 && <span style={{ font: "11px var(--font-mono)", color: "var(--text-dim)" }}>{value}</span>}
    </div>
  ));
}

// Brand-aware variant of ExpandableList: shows the same nights tally
// but adds a passive "X nights to Gold" progress bar under any row
// whose brand we know the loyalty ladder for. Independent / boutique
// rows render as plain rows — no fake status to chase.
function BrandsList({ items, allStays }) {
  const [expanded, setExpanded] = useState(false);
  const display = expanded ? items : items.slice(0, 5);
  return (
    <div className="chart-section">
      <div className="chart-title">🏨 Brands ({items.length})</div>
      {display.map(([name, val], i) => {
        const sp = statusProgress(name, allStays);
        return (
          <div key={name} style={{
            padding: "10px 0",
            borderBottom: i < display.length - 1 ? "1px solid var(--border)" : "none",
          }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ font: "14px var(--font-sans)", color: "var(--text)" }}>
                {name}
                {sp?.current && <span style={{ marginLeft: 8, font: "600 9px var(--font-mono)", color: "var(--accent)", textTransform: "uppercase", letterSpacing: 1 }}>{sp.current.name}</span>}
              </span>
              <span style={{ font: "600 13px var(--font-mono)", color: "var(--text-secondary)" }}>{val} nights</span>
            </div>
            {sp?.next && (
              <div className="brand-tier-progress">
                <div className="brand-tier-track">
                  <div className="brand-tier-fill" style={{ width: `${sp.pct}%` }} />
                </div>
                <div className="brand-tier-meta">
                  {sp.nightsToNext} night{sp.nightsToNext !== 1 ? "s" : ""} to {sp.next.name}
                  <span className="brand-tier-meta-dim"> · {sp.ytd}/{sp.next.n} this year</span>
                </div>
              </div>
            )}
          </div>
        );
      })}
      {items.length > 5 && (
        <button onClick={() => setExpanded(!expanded)} style={{
          marginTop: 8, background: "none", border: "none", color: "var(--accent)",
          font: "500 13px var(--font-sans)", cursor: "pointer", padding: 0,
        }}>
          {expanded ? "Show less" : `View all ${items.length} →`}
        </button>
      )}
    </div>
  );
}

function ExpandableList({ title, emoji, items, unit }) {
  const [expanded, setExpanded] = useState(false);
  const display = expanded ? items : items.slice(0, 5);

  return (
    <div className="chart-section">
      <div className="chart-title">{emoji} {title} ({items.length})</div>
      {display.map(([name, val], i) => (
        <div key={name} style={{
          display: "flex", justifyContent: "space-between", alignItems: "center",
          padding: "8px 0",
          borderBottom: i < display.length - 1 ? "1px solid var(--border)" : "none",
        }}>
          <span style={{ font: "14px var(--font-sans)", color: "var(--text)" }}>{name}</span>
          <span style={{ font: "600 13px var(--font-mono)", color: "var(--text-secondary)" }}>{val} {unit}</span>
        </div>
      ))}
      {items.length > 5 && (
        <button onClick={() => setExpanded(!expanded)} style={{
          marginTop: 8, background: "none", border: "none", color: "var(--accent)",
          font: "500 13px var(--font-sans)", cursor: "pointer", padding: 0,
        }}>
          {expanded ? "Show less" : `View all ${items.length} →`}
        </button>
      )}
    </div>
  );
}

export default function StatsView({ stays }) {
  const past = stays.filter((s) => s.status === "past");
  const countries = [...new Set(past.map((s) => s.country).filter(Boolean))];
  const cities = [...new Set(past.map((s) => s.metroArea || s.city).filter(Boolean))];
  const totalNights = past.reduce((sum, s) => sum + (s.nights || 0), 0);
  // Sum in USD. New entries store totalCostUSD (converted at booking
  // time); legacy entries pre-currency-feature stored only totalCost
  // and were always USD, so falling back to that is correct.
  const usdOf = (s) => (s.totalCostUSD ?? s.totalCost) || 0;
  const totalSpend = past.reduce((sum, s) => sum + usdOf(s), 0);
  const stayedWithCost = past.filter((s) => usdOf(s) > 0);
  const avgPerNight = stayedWithCost.length
    ? totalSpend / stayedWithCost.reduce((sum, s) => sum + (s.nights || 0), 0)
    : 0;
  const rated = past.filter((s) => s.rating);
  const avg = rated.length ? rated.reduce((s, r) => s + r.rating, 0) / rated.length : 0;
  const topRated = past.filter((s) => s.rating === 5);

  const byYear = {}; past.forEach((s) => { if (!s.checkIn) return; const y = new Date(s.checkIn + "T00:00:00").getFullYear(); byYear[y] = (byYear[y] || 0) + (s.nights || 0); });
  const byCountry = {}; past.forEach((s) => { if (s.country) byCountry[s.country] = (byCountry[s.country] || 0) + (s.nights || 0); });
  // Roll suburbs up into their primary metro area when we have one
  // (e.g. Assago -> Milan). Falls back to s.city for legacy stays that
  // pre-date the reverse-geocode flow.
  const byCity = {}; past.forEach((s) => { const c = s.metroArea || s.city; if (c) byCity[c] = (byCity[c] || 0) + (s.nights || 0); });
  // Brand detection is meaningless for "stayed at a friend's place" entries.
  // Weighted by *nights*, not booking count: a 14-night Ritz week says
  // more about loyalty than 14 one-night Holiday Inn stops.
  const byBrand = {};
  past.forEach((s) => {
    if (s.stayType === "home") return;
    const b = detectBrand(s.hotel);
    byBrand[b] = (byBrand[b] || 0) + (s.nights || 1);
  });
  const brandSorted = Object.entries(byBrand).sort(([, a], [, b]) => b - a);
  // "Unique Brands Explored" — a primary travel-variety stat. Excludes
  // the catch-all "Independent" bucket so a user with 12 boutique hotels
  // doesn't see "1 brand" when they really mean 12 distinct properties.
  const namedBrands = brandSorted.filter(([name]) => name !== "Independent");
  const independentCount = past.filter((s) => s.stayType !== "home" && detectBrand(s.hotel) === "Independent").length;
  const uniqueBrandCount = namedBrands.length;
  const topBrandLabel = namedBrands[0]?.[0] || (independentCount ? "Independent" : "—");
  const bySource = {}; stays.forEach((s) => { if (s.bookedVia) bySource[s.bookedVia] = (bySource[s.bookedVia] || 0) + 1; });
  const byRoom = {}; stays.forEach((s) => { if (s.roomType) byRoom[s.roomType] = (byRoom[s.roomType] || 0) + 1; });
  const byTrip = {}; stays.forEach((s) => { if (s.tripPurpose) byTrip[s.tripPurpose] = (byTrip[s.tripPurpose] || 0) + 1; });

  const countrySorted = Object.entries(byCountry).sort(([, a], [, b]) => b - a);
  const citySorted = Object.entries(byCity).sort(([, a], [, b]) => b - a);

  // ─── Phase 5 derived metrics ───────────────────────────────────
  const footprint = continentalFootprint(past);
  const cadenceDays = travelCadence(stays);
  const streak = longestStreak(stays);
  const leadTime = leadTimeStats(stays);
  const yoy = yoyNightsToDate(stays);

  if (!stays.length) return <div className="stats-section"><div className="empty-state">Add stays to see your insights.</div></div>;

  return (
    <div className="stats-section">
      {/* Summary */}
      <div className="stats-grid">
        {[
          { v: countries.length, l: "Countries", s: countrySorted.slice(0, 2).map(([c]) => c).join(", ") || "—" },
          { v: totalNights, l: "Nights", s: `${past.length} stays` },
          { v: cities.length, l: "Cities", s: citySorted.slice(0, 2).map(([c]) => c).join(", ") || "—" },
          // Brand variety is a primary stat — celebrates trying new
          // properties, not just booking the same chain on points.
          { v: uniqueBrandCount, l: "Brands", s: topBrandLabel === "—" ? "—" : `top: ${topBrandLabel}` },
        ].map((stat, i) => (
          <div key={i} className="stat-card" style={{ animationDelay: `${i * 0.08}s` }}>
            <div className="stat-value">{stat.v}</div>
            <div className="stat-label">{stat.l}</div>
            <div className="stat-sub">{stat.s}</div>
          </div>
        ))}
      </div>

      {/* Total spend — private to the user, lives only in Insights */}
      {totalSpend > 0 && (
        <div className="chart-section" style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <div style={{ flex: 1 }}>
            <div className="chart-title" style={{ marginBottom: 6 }}>💰 Total Spend</div>
            <div style={{ font: "600 28px var(--font-sans)", color: "var(--text)", letterSpacing: "-0.02em" }}>
              ${totalSpend.toLocaleString()}
            </div>
            <div style={{ font: "11px var(--font-mono)", color: "var(--text-dim)", marginTop: 4 }}>
              across {stayedWithCost.length} stay{stayedWithCost.length !== 1 ? "s" : ""}
            </div>
          </div>
          {avgPerNight > 0 && (
            <div style={{ textAlign: "right" }}>
              <div style={{ font: "600 9px var(--font-mono)", color: "var(--text-dim)", textTransform: "uppercase", letterSpacing: 1 }}>Avg / night</div>
              <div style={{ font: "600 18px var(--font-sans)", color: "var(--accent)", marginTop: 4 }}>
                ${avgPerNight.toFixed(0)}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ─── Year-over-year ─── */}
      {yoy && (yoy.thisYear || yoy.lastYear) > 0 && (
        <div className="chart-section">
          <div className="chart-title">📅 {yoy.currentYear} vs {yoy.prevYear}</div>
          <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
            <div style={{ flex: 1 }}>
              <div style={{ font: "600 28px var(--font-sans)", color: "var(--text)", letterSpacing: "-0.02em" }}>{yoy.thisYear}</div>
              <div style={{ font: "11px var(--font-mono)", color: "var(--text-dim)" }}>nights so far in {yoy.currentYear}</div>
            </div>
            <div style={{ flex: 1, textAlign: "right" }}>
              <div style={{ font: "600 14px var(--font-mono)", color: yoy.diff > 0 ? "var(--green)" : yoy.diff < 0 ? "var(--red)" : "var(--text-dim)" }}>
                {yoy.diff > 0 ? `+${yoy.diff}` : yoy.diff} vs last year
              </div>
              <div style={{ font: "10px var(--font-mono)", color: "var(--text-dim)", marginTop: 2 }}>
                {yoy.lastYear} by this date in {yoy.prevYear}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ─── Travel velocity ─── */}
      {(cadenceDays || streak > 0) && (
        <div className="chart-section">
          <div className="chart-title">⚡ Travel Velocity</div>
          <div style={{ display: "flex", gap: 12 }}>
            {cadenceDays && (
              <div style={{ flex: 1 }}>
                <div style={{ font: "600 22px var(--font-sans)", color: "var(--text)" }}>1 / {cadenceDays}d</div>
                <div style={{ font: "11px var(--font-mono)", color: "var(--text-dim)" }}>one stay every {cadenceDays} days</div>
              </div>
            )}
            {streak > 0 && (
              <div style={{ flex: 1, textAlign: cadenceDays ? "right" : "left" }}>
                <div style={{ font: "600 22px var(--font-sans)", color: "var(--text)" }}>{streak}</div>
                <div style={{ font: "11px var(--font-mono)", color: "var(--text-dim)" }}>longest streak (consecutive nights away)</div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ─── Lead-time / booking habits ─── */}
      {leadTime && (
        <div className="chart-section">
          <div className="chart-title">📆 Booking Lead Time</div>
          <div style={{ display: "flex", gap: 12 }}>
            <div style={{ flex: 1 }}>
              <div style={{ font: "600 22px var(--font-sans)", color: "var(--text)" }}>{leadTime.median}d</div>
              <div style={{ font: "11px var(--font-mono)", color: "var(--text-dim)" }}>typical days ahead (median)</div>
            </div>
            <div style={{ flex: 1, textAlign: "right" }}>
              <div style={{ font: "600 14px var(--font-mono)", color: "var(--text-secondary)" }}>avg {leadTime.avg}d</div>
              <div style={{ font: "10px var(--font-mono)", color: "var(--text-dim)", marginTop: 2 }}>
                across {leadTime.samples} stay{leadTime.samples !== 1 ? "s" : ""}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ─── Continental footprint ─── */}
      {footprint.length > 0 && (
        <div className="chart-section">
          <div className="chart-title">🌐 Continental Footprint</div>
          {footprint.map((c) => (
            <div key={c.continent} className="bar-row">
              <span style={{ width: 110, font: "13px var(--font-sans)", color: "var(--text-secondary)", flexShrink: 0 }}>{c.continent}</span>
              <div className="bar-track">
                <div className="bar-fill" style={{ width: `${Math.max(c.pct, 4)}%`, background: "var(--accent)", opacity: 0.65 }}>
                  <span className="bar-value">{c.pct < 1 ? "<1%" : `${Math.round(c.pct)}%`}</span>
                </div>
              </div>
              <span style={{ font: "11px var(--font-mono)", color: "var(--text-dim)", marginLeft: 8 }}>{c.visited}/{c.total}</span>
            </div>
          ))}
          <div style={{ font: "10px var(--font-mono)", color: "var(--text-dim)", marginTop: 8, lineHeight: 1.5 }}>
            Percentages count distinct UN-member countries visited. A trip to Vatican City weighs the same as one to France — coverage breadth, not territory size.
          </div>
        </div>
      )}

      {/* Expandable Cities */}
      {citySorted.length > 0 && <ExpandableList title="Cities" emoji="🏙" items={citySorted} unit="nights" />}

      {/* Expandable Countries */}
      {countrySorted.length > 0 && <ExpandableList title="Countries" emoji="🌍" items={countrySorted} unit="nights" />}

      {/* Brand affinity — every unique brand is shown so single-stay
          boutique properties get visibility too, not just the top-N
          chains. Ranked by total nights stayed (loyalty by depth, not
          booking volume). For known programs, BrandsList tucks a
          passive "X nights to next tier" bar under each row. */}
      {brandSorted.length > 0 && <BrandsList items={brandSorted} allStays={stays} />}

      {/* Nights by Year */}
      {Object.keys(byYear).length > 0 && (
        <div className="chart-section"><div className="chart-title">Nights per Year</div>
          {Object.entries(byYear).sort(([a], [b]) => b - a).map(([year, nights]) => {
            const max = Math.max(...Object.values(byYear));
            return (<div key={year} className="bar-row"><span className="bar-label" style={{ width: 40 }}>{year}</span><div className="bar-track"><div className="bar-fill" style={{ width: `${(nights / max) * 100}%`, background: "linear-gradient(90deg, var(--accent), rgba(212,164,76,0.7))" }}><span className="bar-value">{nights}</span></div></div></div>);
          })}
        </div>
      )}

      {Object.keys(bySource).length > 0 && <div className="chart-section"><div className="chart-title">🔖 How You Book</div><BarChart data={bySource} color="var(--blue)" labelWidth={100} /></div>}
      {Object.keys(byRoom).length > 0 && <div className="chart-section"><div className="chart-title">🛏 Room Types</div><BarChart data={byRoom} color="rgba(168,85,247,0.7)" labelWidth={110} /></div>}
      {Object.keys(byTrip).length > 0 && <div className="chart-section"><div className="chart-title">Trip Types</div><BarChart data={byTrip} color="var(--blue)" labelWidth={80} /></div>}

      {topRated.length > 0 && (
        <div className="chart-section"><div className="chart-title">★ Five-Star Stays</div>
          {topRated.map((stay, i) => (
            <div key={stay.id} style={{ padding: "8px 0", borderBottom: i < topRated.length - 1 ? "1px solid var(--border)" : "none", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <div style={{ font: "500 15px var(--font-display)", color: "var(--text)" }}>{stay.hotel}</div>
                <div style={{ font: "12px var(--font-mono)", color: "var(--text-dim)" }}>{stay.city} · {fmtShort(stay.checkIn)}{stay.roomType ? ` · ${stay.roomType}` : ""}</div>
              </div>
              <div style={{ color: "var(--accent)", fontSize: 12 }}>★★★★★</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
