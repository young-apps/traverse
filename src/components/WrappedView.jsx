// WrappedView — multi-year support, Instagram story export
import { useRef, useMemo, useState, useEffect } from "react";

const BRAND_PATTERNS = [
  { match: /marriott|bonvoy|ritz.carlton|st\.?\s*regis|westin|sheraton/i, brand: "Marriott" },
  { match: /hilton|waldorf|conrad|doubletree/i, brand: "Hilton" },
  { match: /hyatt|andaz|park hyatt|grand hyatt|alila/i, brand: "Hyatt" },
  { match: /ihg|intercontinental|kimpton/i, brand: "IHG" },
  { match: /accor|sofitel|fairmont|raffles/i, brand: "Accor" },
  { match: /four seasons/i, brand: "Four Seasons" },
  { match: /mandarin oriental/i, brand: "Mandarin Oriental" },
  { match: /aman/i, brand: "Aman" }, { match: /belmond/i, brand: "Belmond" },
  { match: /rosewood/i, brand: "Rosewood" }, { match: /shangri.la/i, brand: "Shangri-La" },
  { match: /six senses/i, brand: "Six Senses" }, { match: /loews/i, brand: "Loews" },
];
function detectBrand(n) { if (!n) return "Independent"; for (const p of BRAND_PATTERNS) if (p.match.test(n)) return p.brand; return "Independent"; }

function calcYearData(stays) {
  // "Hotels" tile counts only true hotels — friend/family-home stays are
  // still part of cities, countries, and total nights, just not the
  // hotel-brand stats.
  const hotelStays = stays.filter((s) => s.stayType !== "home");
  const totalHotels = hotelStays.length;
  const totalNights = stays.reduce((s, r) => s + (r.nights || 0), 0);
  const cities = [...new Set(stays.map((s) => s.city).filter(Boolean))];
  const countries = [...new Set(stays.map((s) => s.country).filter(Boolean))];
  const rated = stays.filter((s) => s.rating);
  const avgRating = rated.length ? rated.reduce((s, r) => s + r.rating, 0) / rated.length : 0;
  const topRated = stays.filter((s) => s.rating === 5).slice(0, 3);
  const brands = {}; hotelStays.forEach((s) => { const b = detectBrand(s.hotel); brands[b] = (brands[b] || 0) + 1; });
  const topBrand = Object.entries(brands).sort(([, a], [, b]) => b - a)[0];
  const cityNights = {}; stays.forEach((s) => { if (s.city) cityNights[s.city] = (cityNights[s.city] || 0) + (s.nights || 0); });
  const topCity = Object.entries(cityNights).sort(([, a], [, b]) => b - a)[0];
  // Total spend is intentionally NOT included — kept private in Insights only.
  return { totalHotels, totalNights, cities, countries, avgRating, topRated, topBrand, topCity };
}

export default function WrappedView({ user, stays }) {
  const cardRef = useRef(null);
  const [saving, setSaving] = useState(false);
  const [h2cLoaded, setH2cLoaded] = useState(false);

  useEffect(() => {
    if (window.html2canvas) { setH2cLoaded(true); return; }
    const s = document.createElement("script");
    s.src = "https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js";
    s.onload = () => setH2cLoaded(true);
    document.head.appendChild(s);
  }, []);

  // Get available years
  const years = useMemo(() => {
    const past = stays.filter((s) => s.status === "past" && s.checkIn);
    const yrs = [...new Set(past.map((s) => new Date(s.checkIn + "T00:00:00").getFullYear()))].sort((a, b) => b - a);
    return yrs;
  }, [stays]);

  const [selectedYear, setSelectedYear] = useState("all");

  const data = useMemo(() => {
    const past = stays.filter((s) => s.status === "past");
    if (selectedYear === "all") return { ...calcYearData(past), period: "All Time" };
    const yearStays = past.filter((s) => s.checkIn && new Date(s.checkIn + "T00:00:00").getFullYear() === selectedYear);
    return { ...calcYearData(yearStays), period: `${selectedYear}` };
  }, [stays, selectedYear]);

  const handleSave = async () => {
    if (!cardRef.current || !window.html2canvas) return;
    setSaving(true);
    try {
      const canvas = await window.html2canvas(cardRef.current, { scale: 2, backgroundColor: "#FFFFFF", useCORS: true });
      const link = document.createElement("a");
      link.download = `traverse-wrapped-${data.period.toLowerCase().replace(" ", "-")}.png`;
      link.href = canvas.toDataURL("image/png");
      link.click();
    } catch (e) { console.error(e); }
    setSaving(false);
  };

  const firstName = user.displayName?.split(" ")[0] || "Traveler";
  // Light, sleek share-card palette — indigo accent on a soft paper gradient.
  const INK = "#0F172A";        // primary text
  const INK_DIM = "#475569";    // secondary text
  const INK_FAINT = "#94A3B8";  // tertiary/labels
  const ACCENT = "#4F46E5";     // indigo
  const SANS = "'Inter', system-ui, sans-serif";
  const MONO = "'JetBrains Mono', ui-monospace, monospace";
  const mc = { padding: 10, borderRadius: 10, background: "rgba(15,23,42,0.03)", border: "1px solid rgba(15,23,42,0.08)" };
  const ml = { font: `600 8px ${MONO}`, color: INK_FAINT, textTransform: "uppercase", letterSpacing: 1, marginBottom: 3 };

  return (
    <div style={{ padding: "0 20px 40px" }}>
      {/* Year selector */}
      {years.length > 1 && (
        <div style={{ display: "flex", gap: 6, marginBottom: 16, flexWrap: "wrap" }}>
          <button onClick={() => setSelectedYear("all")} style={{
            padding: "6px 14px", borderRadius: 8,
            border: `1px solid ${selectedYear === "all" ? "var(--accent-border)" : "var(--border)"}`,
            background: selectedYear === "all" ? "var(--accent-muted)" : "none",
            color: selectedYear === "all" ? "var(--accent)" : "var(--text-dim)",
            font: "600 12px var(--font-mono)", cursor: "pointer",
          }}>All Time</button>
          {years.map((y) => (
            <button key={y} onClick={() => setSelectedYear(y)} style={{
              padding: "6px 14px", borderRadius: 8,
              border: `1px solid ${selectedYear === y ? "var(--accent-border)" : "var(--border)"}`,
              background: selectedYear === y ? "var(--accent-muted)" : "none",
              color: selectedYear === y ? "var(--accent)" : "var(--text-dim)",
              font: "600 12px var(--font-mono)", cursor: "pointer",
            }}>{y}</button>
          ))}
        </div>
      )}

      {/* Card — Instagram story aspect ratio (light theme) */}
      <div ref={cardRef} style={{
        width: "100%", maxWidth: 420, aspectRatio: "9/16", margin: "0 auto",
        background: "linear-gradient(155deg, #FFFFFF 0%, #F4F6FB 35%, #ECEEFB 70%, #FFFFFF 100%)",
        borderRadius: 24, padding: "32px 24px", position: "relative", overflow: "hidden",
        border: "1px solid rgba(79,70,229,0.18)",
        boxShadow: "0 12px 40px rgba(15,23,42,0.08)",
        display: "flex", flexDirection: "column", justifyContent: "space-between",
        fontFamily: SANS,
        color: INK,
      }}>
        <div style={{ position: "absolute", top: -80, right: -80, width: 260, height: 260, borderRadius: "50%", background: "radial-gradient(circle, rgba(79,70,229,0.10), transparent 70%)" }} />
        <div style={{ position: "absolute", bottom: -50, left: -50, width: 180, height: 180, borderRadius: "50%", background: "radial-gradient(circle, rgba(14,165,233,0.08), transparent 70%)" }} />

        <div>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24 }}>
            <div>
              <div style={{ font: `700 10px ${MONO}`, color: ACCENT, textTransform: "uppercase", letterSpacing: 3, marginBottom: 6 }}>Traverse</div>
              <div style={{ font: `600 24px/1.1 ${SANS}`, color: INK }}>{firstName}'s</div>
              <div style={{ font: `600 24px/1.1 ${SANS}`, color: INK }}>Travel Wrapped</div>
            </div>
            <div style={{ padding: "6px 14px", borderRadius: 20, background: "rgba(79,70,229,0.10)", border: "1px solid rgba(79,70,229,0.28)", font: `700 12px ${MONO}`, color: ACCENT }}>{data.period}</div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12, marginBottom: 24 }}>
            {[{ v: data.totalHotels, l: "Hotels" }, { v: data.totalNights, l: "Nights" }, { v: data.cities.length, l: "Cities" }].map((s, i) => (
              <div key={i} style={{ textAlign: "center" }}>
                <div style={{ font: `700 36px/1 ${SANS}`, color: INK, marginBottom: 4, letterSpacing: "-0.02em" }}>{s.v}</div>
                <div style={{ font: `600 9px ${MONO}`, color: INK_FAINT, textTransform: "uppercase", letterSpacing: 1 }}>{s.l}</div>
              </div>
            ))}
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 20 }}>
            {data.countries.length > 0 && <div style={mc}><div style={ml}>🌍 Countries</div><div style={{ font: `600 16px ${SANS}`, color: INK }}>{data.countries.length}</div><div style={{ font: `10px ${MONO}`, color: INK_FAINT, marginTop: 2 }}>{data.countries.slice(0, 4).join(", ")}</div></div>}
            {data.topCity && <div style={mc}><div style={ml}>📍 Top City</div><div style={{ font: `600 16px ${SANS}`, color: INK }}>{data.topCity[0]}</div><div style={{ font: `10px ${MONO}`, color: INK_FAINT, marginTop: 2 }}>{data.topCity[1]} nights</div></div>}
            {data.avgRating > 0 && <div style={mc}><div style={ml}>★ Avg Rating</div><div style={{ font: `600 16px ${SANS}`, color: "#F59E0B" }}>{data.avgRating.toFixed(1)}</div></div>}
            {data.topBrand && <div style={mc}><div style={ml}>🏨 Top Brand</div><div style={{ font: `600 14px ${SANS}`, color: INK }}>{data.topBrand[0]}</div><div style={{ font: `10px ${MONO}`, color: INK_FAINT, marginTop: 2 }}>{data.topBrand[1]} stays</div></div>}
          </div>

          {data.topRated.length > 0 && (
            <div style={{ marginBottom: 16 }}>
              <div style={{ ...ml, marginBottom: 8 }}>★ Top Stays</div>
              {data.topRated.map((s, i) => (
                <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, padding: "3px 0" }}>
                  <span style={{ font: "11px sans-serif", color: "#F59E0B" }}>★★★★★</span>
                  <span style={{ font: `500 13px ${SANS}`, color: INK }}>{s.hotel}</span>
                  <span style={{ font: `10px ${MONO}`, color: INK_FAINT }}>{s.city}</span>
                </div>
              ))}
            </div>
          )}

          {data.cities.length > 0 && (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
              {data.cities.map((c, i) => (
                <span key={i} style={{ padding: "3px 9px", borderRadius: 16, background: "rgba(15,23,42,0.04)", border: "1px solid rgba(15,23,42,0.08)", font: `500 11px ${SANS}`, color: INK_DIM }}>{c}</span>
              ))}
            </div>
          )}
        </div>

        <div style={{ textAlign: "center", paddingTop: 12, borderTop: "1px solid rgba(15,23,42,0.08)" }}>
          <div style={{ font: `700 9px ${MONO}`, color: ACCENT, textTransform: "uppercase", letterSpacing: 3 }}>Traverse</div>
          <div style={{ font: `10px ${MONO}`, color: INK_FAINT, marginTop: 4 }}>Your Travel Passport</div>
        </div>
      </div>

      <button onClick={handleSave} disabled={saving || !h2cLoaded} style={{
        width: "100%", maxWidth: 420, margin: "16px auto 0", display: "block",
        padding: "14px", borderRadius: 12, border: "none",
        background: saving ? "var(--surface-hover)" : "var(--accent)",
        color: saving ? "var(--text-dim)" : "#FFFFFF",
        font: "700 15px var(--font-sans)", cursor: saving ? "not-allowed" : "pointer",
        boxShadow: saving ? "none" : "0 2px 8px rgba(79,70,229,0.20)",
      }}>
        {saving ? "Generating…" : "📸 Save to Photos"}
      </button>
      <div style={{ marginTop: 10, font: "11px var(--font-sans)", color: "var(--text-dim)", textAlign: "center" }}>
        Saves as a 1080×1920 image — perfect for Instagram Stories
      </div>
    </div>
  );
}
