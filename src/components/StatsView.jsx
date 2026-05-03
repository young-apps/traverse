// StatsView — tappable cities/countries with full lists, larger fonts
import { useState } from "react";

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
  const cities = [...new Set(past.map((s) => s.city).filter(Boolean))];
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
  const byCity = {}; past.forEach((s) => { if (s.city) byCity[s.city] = (byCity[s.city] || 0) + (s.nights || 0); });
  const byBrand = {}; past.forEach((s) => { const b = detectBrand(s.hotel); byBrand[b] = (byBrand[b] || 0) + 1; });
  const bySource = {}; stays.forEach((s) => { if (s.bookedVia) bySource[s.bookedVia] = (bySource[s.bookedVia] || 0) + 1; });
  const byRoom = {}; stays.forEach((s) => { if (s.roomType) byRoom[s.roomType] = (byRoom[s.roomType] || 0) + 1; });
  const byTrip = {}; stays.forEach((s) => { if (s.tripPurpose) byTrip[s.tripPurpose] = (byTrip[s.tripPurpose] || 0) + 1; });

  const countrySorted = Object.entries(byCountry).sort(([, a], [, b]) => b - a);
  const citySorted = Object.entries(byCity).sort(([, a], [, b]) => b - a);

  if (!stays.length) return <div className="stats-section"><div className="empty-state">Add stays to see your insights.</div></div>;

  return (
    <div className="stats-section">
      {/* Summary */}
      <div className="stats-grid">
        {[
          { v: totalNights, l: "Nights", s: `${past.length} stays` },
          { v: avg.toFixed(1), l: "Avg Rating", s: `${rated.length} rated` },
          { v: cities.length, l: "Cities", s: citySorted.slice(0, 2).map(([c]) => c).join(", ") || "—" },
          { v: countries.length, l: "Countries", s: countrySorted.slice(0, 2).map(([c]) => c).join(", ") || "—" },
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

      {/* Expandable Cities */}
      {citySorted.length > 0 && <ExpandableList title="Cities" emoji="🏙" items={citySorted} unit="nights" />}

      {/* Expandable Countries */}
      {countrySorted.length > 0 && <ExpandableList title="Countries" emoji="🌍" items={countrySorted} unit="nights" />}

      {/* Brand Affinity */}
      {Object.keys(byBrand).length > 0 && <div className="chart-section"><div className="chart-title">🏨 Favorite Brands</div><BarChart data={byBrand} color="var(--accent)" labelWidth={110} /></div>}

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
