// AddStayModal — expanded data model, cost visible by default
import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { searchHotels } from "../services/places";
import DateRangePicker from "./DateRangePicker";
import { ROOM_TYPES, BED_TYPES, VIEW_TYPES, CLUB_ACCESS, UPGRADE_STATUS, BOOKING_SOURCES, TRIP_PURPOSES } from "../constants";

function ChipPicker({ options, value, onChange, label }) {
  return (<>
    <label className="field-label">{label}</label>
    <div style={{ display: "flex", flexWrap: "wrap", gap: 5, marginBottom: 14 }}>
      {options.map((o) => (
        <button key={o} onClick={() => onChange(value === o ? "" : o)} style={{
          padding: "4px 10px", borderRadius: 8,
          border: `1px solid ${value === o ? "var(--accent-border)" : "var(--border)"}`,
          background: value === o ? "var(--accent-muted)" : "transparent",
          color: value === o ? "var(--accent)" : "var(--text-dim)",
          font: "500 11px var(--font-sans)", cursor: "pointer",
        }}>{o}</button>
      ))}
    </div>
  </>);
}

export default function AddStayModal({ onClose, onAdd }) {
  const [query, setQuery] = useState(""); const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false); const [searchError, setSearchError] = useState(null);
  const [selected, setSelected] = useState(null);
  const [checkIn, setCI] = useState(""); const [checkOut, setCO] = useState("");
  const [notes, setN] = useState(""); const [rating, setR] = useState(0);
  const [roomType, setRT] = useState(""); const [bedType, setBT] = useState("");
  const [viewType, setVT] = useState(""); const [clubAccess, setCA] = useState("");
  const [upgradeStatus, setUS] = useState(""); const [bookedVia, setBV] = useState("");
  const [loyaltyNumber, setLN] = useState("");
  const [costPerNight, setCPN] = useState(""); const [totalCostM, setTCM] = useState("");
  const [costMode, setCM] = useState("nightly"); const [showMore, setSM] = useState(false);
  const [tripPurpose, setTP] = useState("");
  const debRef = useRef(null);

  const doSearch = useCallback(async (q) => {
    setSearching(true); setSearchError(null);
    try { const h = await searchHotels(q); setResults(h); if (!h.length) setSearchError("No hotels found."); }
    catch (e) { setSearchError("Search failed."); setResults([]); }
    setSearching(false);
  }, []);

  useEffect(() => {
    clearTimeout(debRef.current);
    if (query.length >= 3 && !selected) debRef.current = setTimeout(() => doSearch(query), 500);
    else { setResults([]); setSearchError(null); }
    return () => clearTimeout(debRef.current);
  }, [query, selected, doSearch]);

  const nights = useMemo(() => { if (!checkIn || !checkOut) return 0; return Math.max(0, Math.round((new Date(checkOut) - new Date(checkIn)) / 864e5)); }, [checkIn, checkOut]);
  const isPast = useMemo(() => !checkOut || checkOut < new Date().toISOString().split("T")[0], [checkOut]);
  const total = costMode === "nightly" && costPerNight && nights > 0 ? Math.round(parseFloat(costPerNight) * nights) : costMode === "total" && totalCostM ? parseInt(totalCostM) : null;
  const canAdd = selected && checkIn && checkOut && nights > 0;

  const handleSubmit = () => {
    if (!canAdd) return;
    onAdd({
      hotel: selected.name, city: selected.city, country: selected.country,
      lat: selected.lat, lng: selected.lng, address: selected.address, placeId: selected.placeId || null,
      photoName: selected.photoName || null,
      checkIn, checkOut, nights, rating: isPast ? rating : null,
      roomType: roomType || null, bedType: bedType || null, viewType: viewType || null,
      clubAccess: clubAccess || null, upgradeStatus: upgradeStatus || null,
      bookedVia: bookedVia || null, loyaltyNumber: loyaltyNumber || null,
      costPerNight: costMode === "nightly" && costPerNight ? parseFloat(costPerNight) : null,
      totalCost: total, tripPurpose: tripPurpose || null, notes,
    });
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <span className="modal-title">Log a Stay</span>
          <button className="btn-icon" onClick={onClose}>✕</button>
        </div>
        <div className="modal-body">
          <label className="field-label">Hotel</label>
          <div style={{ position: "relative", marginBottom: 4 }}>
            <span style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "var(--text-dim)" }}>{searching ? <span className="spin">⏳</span> : "🔍"}</span>
            <input className="field-input" style={{ paddingLeft: 36 }} placeholder='Search "Marriott London"' value={query} onChange={(e) => { setQuery(e.target.value); setSelected(null); }} autoFocus />
          </div>
          {searching && <div className="search-status">Searching…</div>}
          {!selected && !searching && results.length > 0 && (
            <div className="search-results">{results.map((r, i) => (
              <div key={r.placeId || i} className="search-result" onClick={() => { setSelected(r); setQuery(r.name); setResults([]); }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <span style={{ color: "var(--accent)" }}>📍</span>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ font: "500 14px var(--font-sans)", color: "var(--text)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.name}</div>
                    <div style={{ font: "11px var(--font-mono)", color: "var(--text-dim)" }}>{r.city}{r.city && r.country ? ", " : ""}{r.country}</div>
                  </div>
                </div>
              </div>
            ))}</div>
          )}
          {!selected && !searching && searchError && <div className="search-status empty">{searchError}</div>}
          {selected && (
            <div className="selected-pill">
              <span style={{ color: "var(--accent)" }}>📍</span>
              <div style={{ flex: 1 }}><div style={{ font: "600 14px var(--font-sans)", color: "var(--text)" }}>{selected.name}</div><div style={{ font: "11px var(--font-mono)", color: "var(--text-secondary)" }}>{selected.address}</div></div>
              <button className="btn-icon" style={{ flexShrink: 0, width: 24, height: 24, fontSize: 11 }} onClick={() => { setSelected(null); setQuery(""); }}>✕</button>
            </div>
          )}

          <label className="field-label">Dates</label>
          <DateRangePicker startDate={checkIn} endDate={checkOut} onChange={(s, e) => { setCI(s); setCO(e); }} />
          {nights > 0 && <div className="nights-display">{nights} night{nights !== 1 ? "s" : ""} <span style={{ marginLeft: 8, padding: "2px 8px", borderRadius: 4, background: isPast ? "rgba(255,255,255,0.05)" : "var(--green-muted)", color: isPast ? "var(--text-dim)" : "var(--green)", font: "600 10px var(--font-mono)", textTransform: "uppercase" }}>{isPast ? "Past" : "Upcoming"}</span></div>}

          {isPast && nights > 0 && (<><label className="field-label">Rating</label><div className="rating-btns">{[1,2,3,4,5].map((n) => <button key={n} className={`rating-btn ${rating >= n ? "filled" : ""}`} onClick={() => setR(rating === n ? 0 : n)}><svg width="18" height="18" viewBox="0 0 24 24" fill={rating >= n ? "#D4A44C" : "none"} stroke="#D4A44C" strokeWidth="1.5"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" /></svg></button>)}</div></>)}

          {/* Trip Purpose — visible by default */}
          <ChipPicker label="Trip Type" options={TRIP_PURPOSES} value={tripPurpose} onChange={setTP} />

          {/* Cost — visible by default */}
          <label className="field-label">Cost</label>
          <div style={{ display: "flex", gap: 6, marginBottom: 10 }}>
            {["nightly", "total"].map((m) => <button key={m} onClick={() => setCM(m)} style={{ padding: "5px 12px", borderRadius: 8, border: `1px solid ${costMode === m ? "var(--accent-border)" : "var(--border)"}`, background: costMode === m ? "var(--accent-muted)" : "transparent", color: costMode === m ? "var(--accent)" : "var(--text-dim)", font: "500 11px var(--font-sans)", cursor: "pointer" }}>{m === "nightly" ? "Per Night" : "Total"}</button>)}
          </div>
          <div style={{ position: "relative", marginBottom: 14 }}>
            <span style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "var(--text-dim)" }}>$</span>
            {costMode === "nightly" ? <input className="field-input" type="number" min="0" placeholder="e.g. 350" value={costPerNight} onChange={(e) => setCPN(e.target.value)} style={{ paddingLeft: 28 }} /> : <input className="field-input" type="number" min="0" placeholder="e.g. 1050" value={totalCostM} onChange={(e) => setTCM(e.target.value)} style={{ paddingLeft: 28 }} />}
          </div>
          {total > 0 && costMode === "nightly" && <div style={{ font: "12px var(--font-mono)", color: "var(--accent)", marginBottom: 14, marginTop: -8 }}>Total: ${total.toLocaleString()}</div>}

          {/* More details */}
          <button onClick={() => setSM(!showMore)} style={{ width: "100%", padding: "10px 14px", marginBottom: 14, background: "var(--bg-2)", border: "1px solid var(--border)", borderRadius: 10, color: "var(--text-secondary)", font: "500 13px var(--font-sans)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <span>{showMore ? "Less" : "Room, view, booking details"}</span>
            <span style={{ fontSize: 11, transform: showMore ? "rotate(180deg)" : "rotate(0)", transition: "transform 0.2s" }}>▼</span>
          </button>
          {showMore && (
            <div style={{ animation: "fadeSlideUp 0.2s ease" }}>
              <ChipPicker label="Room Type" options={ROOM_TYPES} value={roomType} onChange={setRT} />
              <ChipPicker label="Bed Type" options={BED_TYPES} value={bedType} onChange={setBT} />
              <ChipPicker label="View" options={VIEW_TYPES} value={viewType} onChange={setVT} />
              <ChipPicker label="Club / Lounge" options={CLUB_ACCESS} value={clubAccess} onChange={setCA} />
              <ChipPicker label="Upgrade Status" options={UPGRADE_STATUS} value={upgradeStatus} onChange={setUS} />
              <label className="field-label">Booked Via</label>
              <select className="field-input" value={bookedVia} onChange={(e) => setBV(e.target.value)} style={{ marginBottom: 14, colorScheme: "dark", appearance: "auto" }}>
                <option value="">Select…</option>
                {BOOKING_SOURCES.map((bs) => <option key={bs} value={bs}>{bs}</option>)}
              </select>
              <label className="field-label">Loyalty Number</label>
              <input className="field-input" placeholder="e.g. Bonvoy #123456789" value={loyaltyNumber} onChange={(e) => setLN(e.target.value)} style={{ marginBottom: 14 }} />
            </div>
          )}

          <label className="field-label">Notes</label>
          <textarea className="field-input" placeholder="Room tips, highlights…" rows={2} value={notes} onChange={(e) => setN(e.target.value)} style={{ resize: "vertical", marginBottom: 20 }} />
          <button className="btn-submit" onClick={handleSubmit} disabled={!canAdd}>{canAdd ? `Log ${nights}-Night Stay` : "Search a hotel & set dates"}</button>
        </div>
      </div>
    </div>
  );
}
