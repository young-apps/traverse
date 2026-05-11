// EditStayModal — edit all stay fields
import { useState, useMemo } from "react";
import DateRangePicker from "./DateRangePicker";
import FriendActivity from "./FriendActivity";
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

export default function EditStayModal({ stay, onClose, onSave, friends = [], friendStays = {} }) {
  const [checkIn, setCI] = useState(stay.checkIn || "");
  const [checkOut, setCO] = useState(stay.checkOut || "");
  const [notes, setN] = useState(stay.notes || "");
  const [rating, setR] = useState(stay.rating || 0);
  const [roomType, setRT] = useState(stay.roomType || "");
  const [bedType, setBT] = useState(stay.bedType || "");
  const [viewType, setVT] = useState(stay.viewType || "");
  const [clubAccess, setCA] = useState(stay.clubAccess || "");
  const [upgradeStatus, setUS] = useState(stay.upgradeStatus || "");
  const [tripPurpose, setTP] = useState(stay.tripPurpose || "");
  const [bookedVia, setBV] = useState(stay.bookedVia || "");
  const [loyaltyNumber, setLN] = useState(stay.loyaltyNumber || "");
  const [costPerNight, setCPN] = useState(stay.costPerNight ? String(stay.costPerNight) : "");
  const [totalCostM, setTCM] = useState(stay.totalCost && !stay.costPerNight ? String(stay.totalCost) : "");
  const [costMode, setCM] = useState(stay.costPerNight ? "nightly" : "total");
  // Mirror AddStayModal: only stays the user affirms they personally
  // booked count toward elite tier progress. Lets users retroactively
  // mark legacy stays they actually did book.
  const [bookedByMe, setBBM] = useState(stay.bookedByMe === true);

  const nights = useMemo(() => { if (!checkIn || !checkOut) return 0; return Math.max(0, Math.round((new Date(checkOut) - new Date(checkIn)) / 864e5)); }, [checkIn, checkOut]);
  const isPast = useMemo(() => !checkOut || checkOut < new Date().toISOString().split("T")[0], [checkOut]);
  const total = costMode === "nightly" && costPerNight && nights > 0 ? Math.round(parseFloat(costPerNight) * nights) : costMode === "total" && totalCostM ? parseInt(totalCostM) : null;

  const handleSave = () => {
    const today = new Date().toISOString().split("T")[0];
    onSave(stay.id, {
      checkIn, checkOut, nights, status: checkOut >= today ? "upcoming" : "past",
      rating: isPast ? rating : null, roomType: roomType || null, bedType: bedType || null,
      viewType: viewType || null, clubAccess: clubAccess || null, upgradeStatus: upgradeStatus || null,
      bookedVia: bookedVia || null, loyaltyNumber: loyaltyNumber || null,
      costPerNight: costMode === "nightly" && costPerNight ? parseFloat(costPerNight) : null,
      totalCost: total, tripPurpose: tripPurpose || null, notes,
      bookedByMe: bookedByMe === true,
    });
    onClose();
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <span className="modal-title">Edit Stay</span>
          <button className="btn-icon" onClick={onClose}>✕</button>
        </div>
        <div className="modal-body">
          <div className="selected-pill" style={{ marginBottom: 16 }}>
            <span style={{ color: "var(--accent)" }}>📍</span>
            <div><div style={{ font: "600 14px var(--font-sans)", color: "var(--text)" }}>{stay.hotel}</div><div style={{ font: "11px var(--font-mono)", color: "var(--text-secondary)" }}>{stay.city}, {stay.country}</div></div>
          </div>

          <label className="field-label">Dates</label>
          <DateRangePicker startDate={checkIn} endDate={checkOut} onChange={(s, e) => { setCI(s); setCO(e); }} />
          {nights > 0 && <div className="nights-display">{nights} night{nights !== 1 ? "s" : ""} <span style={{ marginLeft: 8, padding: "2px 8px", borderRadius: 4, background: isPast ? "rgba(255,255,255,0.05)" : "var(--green-muted)", color: isPast ? "var(--text-dim)" : "var(--green)", font: "600 10px var(--font-mono)", textTransform: "uppercase" }}>{isPast ? "Past" : "Upcoming"}</span></div>}

          {isPast && (<><label className="field-label">Rating</label><div className="rating-btns">{[1,2,3,4,5].map((n) => <button key={n} className={`rating-btn ${rating >= n ? "filled" : ""}`} onClick={() => setR(rating === n ? 0 : n)}><svg width="18" height="18" viewBox="0 0 24 24" fill={rating >= n ? "#D4A44C" : "none"} stroke="#D4A44C" strokeWidth="1.5"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" /></svg></button>)}</div></>)}

          <ChipPicker label="Trip Type" options={TRIP_PURPOSES} value={tripPurpose} onChange={setTP} />
          <ChipPicker label="Room Type" options={ROOM_TYPES} value={roomType} onChange={setRT} />
          <ChipPicker label="Bed Type" options={BED_TYPES} value={bedType} onChange={setBT} />
          <ChipPicker label="View" options={VIEW_TYPES} value={viewType} onChange={setVT} />
          <ChipPicker label="Club / Lounge Access" options={CLUB_ACCESS} value={clubAccess} onChange={setCA} />
          <ChipPicker label="Upgrade Status" options={UPGRADE_STATUS} value={upgradeStatus} onChange={setUS} />

          <label className="field-label">Cost</label>
          <div style={{ display: "flex", gap: 6, marginBottom: 10 }}>
            {["nightly", "total"].map((m) => <button key={m} onClick={() => setCM(m)} style={{ padding: "5px 12px", borderRadius: 8, border: `1px solid ${costMode === m ? "var(--accent-border)" : "var(--border)"}`, background: costMode === m ? "var(--accent-muted)" : "transparent", color: costMode === m ? "var(--accent)" : "var(--text-dim)", font: "500 11px var(--font-sans)", cursor: "pointer", textTransform: "capitalize" }}>{m === "nightly" ? "Per Night" : "Total"}</button>)}
          </div>
          <div style={{ position: "relative", marginBottom: 14 }}>
            <span style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "var(--text-dim)" }}>$</span>
            {costMode === "nightly"
              ? <input className="field-input" type="number" min="0" placeholder="e.g. 350" value={costPerNight} onChange={(e) => setCPN(e.target.value)} style={{ paddingLeft: 28 }} />
              : <input className="field-input" type="number" min="0" placeholder="e.g. 1050" value={totalCostM} onChange={(e) => setTCM(e.target.value)} style={{ paddingLeft: 28 }} />}
          </div>
          {total > 0 && costMode === "nightly" && <div style={{ font: "12px var(--font-mono)", color: "var(--accent)", marginBottom: 14, marginTop: -8 }}>Total: ${total.toLocaleString()}</div>}

          <label className="field-label">Booked Via</label>
          <select className="field-input" value={bookedVia} onChange={(e) => setBV(e.target.value)} style={{ marginBottom: 14, colorScheme: "dark", appearance: "auto" }}>
            <option value="">Select…</option>
            {BOOKING_SOURCES.map((bs) => <option key={bs} value={bs}>{bs}</option>)}
          </select>

          <label className="field-label">Loyalty Number</label>
          <input className="field-input" placeholder="e.g. Bonvoy #123456789" value={loyaltyNumber} onChange={(e) => setLN(e.target.value)} style={{ marginBottom: 14 }} />

          {/* Booked-by-me opt-in — gates elite-tier progress in Insights. */}
          <button
            onClick={() => setBBM(!bookedByMe)}
            style={{
              width: "100%",
              padding: "12px 14px",
              marginBottom: 14,
              display: "flex",
              alignItems: "center",
              gap: 12,
              background: bookedByMe ? "var(--accent-muted)" : "var(--bg-2)",
              border: `1px solid ${bookedByMe ? "var(--accent-border)" : "var(--border)"}`,
              borderRadius: 10,
              cursor: "pointer",
              textAlign: "left",
              WebkitTapHighlightColor: "transparent",
            }}
          >
            <span
              aria-hidden
              style={{
                flexShrink: 0,
                width: 22,
                height: 22,
                borderRadius: 6,
                border: `1.5px solid ${bookedByMe ? "var(--accent)" : "var(--border)"}`,
                background: bookedByMe ? "var(--accent)" : "transparent",
                color: "#fff",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                font: "700 13px var(--font-sans)",
                lineHeight: 1,
              }}
            >
              {bookedByMe ? "✓" : ""}
            </span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ font: "600 13px var(--font-sans)", color: bookedByMe ? "var(--accent)" : "var(--text)" }}>
                I personally booked this stay
              </div>
              <div style={{ font: "11px var(--font-mono)", color: "var(--text-dim)", marginTop: 2 }}>
                Required for nights to count toward elite status
              </div>
            </div>
          </button>

          <label className="field-label">Notes</label>
          <textarea className="field-input" rows={2} value={notes} onChange={(e) => setN(e.target.value)} style={{ resize: "vertical", marginBottom: 20 }} />

          <button className="btn-submit" onClick={handleSave}>Save Changes</button>

          {/* Contextual social signal — only renders when a friend
              has stayed at this same hotel. Silent otherwise so the
              modal doesn't grow a permanent empty section. */}
          <FriendActivity stay={stay} friends={friends} friendStays={friendStays} />
        </div>
      </div>
    </div>
  );
}
