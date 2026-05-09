// AddStayModal — stepped wizard.
//
// Replaces the previous single-scroll form with a 3-step flow:
//   1. "Where + When" — stay type, location, dates (the only required step)
//   2. "Vibe"          — trip type tiles, rating (if past)
//   3. "Cost & Notes"  — large numeric keypad, currency, optional details
//
// A persistent "Skip & Save" appears the moment Step 1 is valid so users
// can save in one tap if all they want is a pin on the map. The body
// slides between steps; state lives at the modal root, so any value the
// user touched in a later step survives navigating back.

import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { searchHotels } from "../services/places";
import { convertToUSD, formatMoney } from "../services/fx";
import { geocodeCity } from "../services/geocode";
import DateRangePicker from "./DateRangePicker";
import { ROOM_TYPES, BED_TYPES, VIEW_TYPES, CLUB_ACCESS, UPGRADE_STATUS, BOOKING_SOURCES, TRIP_PURPOSES, CURRENCIES } from "../constants";

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

// Touch-friendly numeric keypad — Step 3's primary input. Decimal key
// is suppressed once a "." is already present so amounts stay valid.
function NumericKeypad({ value, onChange }) {
  const press = (k) => {
    if (k === "⌫") return onChange((value || "").slice(0, -1));
    if (k === ".") { if ((value || "").includes(".")) return; if (!value) return onChange("0."); }
    onChange((value || "") + k);
  };
  const keys = ["1","2","3","4","5","6","7","8","9",".","0","⌫"];
  return (
    <div className="keypad">
      {keys.map((k) => (
        <button key={k} className={`keypad-key ${k === "⌫" ? "keypad-back" : ""}`} onClick={() => press(k)}>
          {k}
        </button>
      ))}
    </div>
  );
}

export default function AddStayModal({ onClose, onAdd }) {
  // ─── Step state ─────────────────────────────────────────────────
  const [step, setStep] = useState(1);
  const STEP_COUNT = 3;

  // ─── Data state (preserved from the pre-wizard version) ─────────
  const [stayType, setStayType] = useState("hotel");
  const [homeName, setHomeName] = useState("");
  const [homeCity, setHomeCity] = useState("");
  const [homeCountry, setHomeCountry] = useState("");
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
  const [currency, setCurrency] = useState("USD");
  const [submitting, setSubmitting] = useState(false);
  const debRef = useRef(null);

  const doSearch = useCallback(async (q) => {
    setSearching(true); setSearchError(null);
    try { const h = await searchHotels(q); setResults(h); if (!h.length) setSearchError("No hotels found."); }
    catch (e) {
      const detail = (e?.message || String(e)).slice(0, 180);
      setSearchError(`Search failed: ${detail}`);
      setResults([]);
    }
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
  const total = costMode === "nightly" && costPerNight && nights > 0
    ? Math.round(parseFloat(costPerNight) * nights)
    : costMode === "total" && totalCostM ? parseInt(totalCostM, 10) : null;

  // Step 1 validity is the only gate for save — Steps 2 and 3 are optional.
  const step1Valid = stayType === "hotel"
    ? Boolean(selected && checkIn && checkOut && nights > 0)
    : Boolean(homeName.trim() && homeCity.trim() && checkIn && checkOut && nights > 0);
  const canAdd = step1Valid;

  const handleSubmit = async () => {
    if (!canAdd || submitting) return;
    setSubmitting(true);

    let totalCostUSD = null, fxRate = null, fxDate = null;
    if (total > 0) {
      const conv = await convertToUSD(total, currency, checkIn);
      if (conv) { totalCostUSD = conv.usd; fxRate = conv.rate; fxDate = conv.rateDate; }
    }

    let payload;
    if (stayType === "home") {
      const geo = await geocodeCity(homeCity, homeCountry);
      payload = {
        stayType: "home",
        hotel: homeName.trim(),
        city: geo?.city || homeCity.trim(),
        country: geo?.country || homeCountry.trim(),
        lat: geo?.lat ?? null,
        lng: geo?.lng ?? null,
        address: geo?.placeName || `${homeCity.trim()}${homeCountry.trim() ? ", " + homeCountry.trim() : ""}`,
        placeId: null, photoName: null,
        roomType: null, bedType: null, viewType: null,
        clubAccess: null, upgradeStatus: null,
        bookedVia: null, loyaltyNumber: null,
      };
    } else {
      payload = {
        stayType: "hotel",
        hotel: selected.name, city: selected.city, country: selected.country,
        lat: selected.lat, lng: selected.lng, address: selected.address, placeId: selected.placeId || null,
        photoName: selected.photoName || null,
        roomType: roomType || null, bedType: bedType || null, viewType: viewType || null,
        clubAccess: clubAccess || null, upgradeStatus: upgradeStatus || null,
        bookedVia: bookedVia || null, loyaltyNumber: loyaltyNumber || null,
      };
    }

    onAdd({
      ...payload,
      checkIn, checkOut, nights, rating: isPast ? rating : null,
      costPerNight: costMode === "nightly" && costPerNight ? parseFloat(costPerNight) : null,
      totalCost: total,
      currency: total > 0 ? currency : null,
      totalCostUSD, fxRate, fxDate,
      tripPurpose: tripPurpose || null, notes,
    });
  };

  // ─── Step bodies ────────────────────────────────────────────────
  const Step1 = (
    <div className="wizard-step">
      <div className="wizard-prompt">Where are you staying?</div>

      <div style={{ display: "flex", gap: 6, marginBottom: 14 }}>
        {[{ id: "hotel", label: "Hotel" }, { id: "home", label: "Friend / Family" }].map((t) => (
          <button key={t.id} onClick={() => setStayType(t.id)} style={{
            flex: 1, padding: "10px 12px", borderRadius: 10,
            border: `1px solid ${stayType === t.id ? "var(--accent-border)" : "var(--border)"}`,
            background: stayType === t.id ? "var(--accent-muted)" : "transparent",
            color: stayType === t.id ? "var(--accent)" : "var(--text-dim)",
            font: "600 13px var(--font-sans)", cursor: "pointer",
          }}>{t.label}</button>
        ))}
      </div>

      {stayType === "hotel" && (<>
        <div style={{ position: "relative", marginBottom: 4 }}>
          <span style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "var(--text-dim)" }}>{searching ? <span className="spin">⏳</span> : "🔍"}</span>
          <input className="field-input field-input-lg" style={{ paddingLeft: 36 }} placeholder='Search "Marriott London"' value={query} onChange={(e) => { setQuery(e.target.value); setSelected(null); }} autoFocus />
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
      </>)}

      {stayType === "home" && (<>
        <input className="field-input field-input-lg" placeholder="Place name (e.g. Mom's house)" value={homeName} onChange={(e) => setHomeName(e.target.value)} style={{ marginBottom: 8 }} autoFocus />
        <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
          <input className="field-input" placeholder="City" value={homeCity} onChange={(e) => setHomeCity(e.target.value)} style={{ flex: 1 }} />
          <input className="field-input" placeholder="Country" value={homeCountry} onChange={(e) => setHomeCountry(e.target.value)} style={{ flex: 1 }} />
        </div>
        <div style={{ font: "11px var(--font-mono)", color: "var(--text-dim)", marginBottom: 12 }}>
          We'll pin the city center on your map.
        </div>
      </>)}

      <div className="wizard-prompt" style={{ marginTop: 18 }}>When?</div>
      <DateRangePicker startDate={checkIn} endDate={checkOut} onChange={(s, e) => { setCI(s); setCO(e); }} />
      {nights > 0 && (
        <div className="nights-display">
          {nights} night{nights !== 1 ? "s" : ""}
          <span style={{ marginLeft: 8, padding: "2px 8px", borderRadius: 4, background: isPast ? "rgba(255,255,255,0.05)" : "var(--green-muted)", color: isPast ? "var(--text-dim)" : "var(--green)", font: "600 10px var(--font-mono)", textTransform: "uppercase" }}>{isPast ? "Past" : "Upcoming"}</span>
        </div>
      )}
    </div>
  );

  const Step2 = (
    <div className="wizard-step">
      <div className="wizard-prompt">
        What kind of trip?
        <span style={{ marginLeft: 8, font: "500 11px var(--font-mono)", color: "var(--text-dim)", letterSpacing: ".3px", textTransform: "uppercase" }}>Optional</span>
      </div>
      <div className="wizard-tiles">
        {TRIP_PURPOSES.map((p) => (
          <button key={p}
            className={`wizard-tile ${tripPurpose === p ? "active" : ""}`}
            onClick={() => setTP(tripPurpose === p ? "" : p)}>
            {p}
          </button>
        ))}
      </div>
      {isPast && (
        <>
          <div className="wizard-prompt" style={{ marginTop: 22 }}>How was it?</div>
          <div className="rating-btns" style={{ justifyContent: "center" }}>
            {[1,2,3,4,5].map((n) => (
              <button key={n} className={`rating-btn ${rating >= n ? "filled" : ""}`} onClick={() => setR(rating === n ? 0 : n)}>
                <svg width="28" height="28" viewBox="0 0 24 24" fill={rating >= n ? "#D4A44C" : "none"} stroke="#D4A44C" strokeWidth="1.5"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" /></svg>
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );

  const activeCostValue = costMode === "nightly" ? costPerNight : totalCostM;
  const setActiveCostValue = costMode === "nightly" ? setCPN : setTCM;

  const Step3 = (
    <div className="wizard-step">
      <div className="wizard-prompt">
        What did it cost?
        <span style={{ marginLeft: 8, font: "500 11px var(--font-mono)", color: "var(--text-dim)", letterSpacing: ".3px", textTransform: "uppercase" }}>Optional</span>
      </div>
      <div style={{ display: "flex", gap: 6, marginBottom: 12 }}>
        {["nightly", "total"].map((m) => (
          <button key={m} onClick={() => setCM(m)} style={{
            flex: 1, padding: "8px 12px", borderRadius: 10,
            border: `1px solid ${costMode === m ? "var(--accent-border)" : "var(--border)"}`,
            background: costMode === m ? "var(--accent-muted)" : "transparent",
            color: costMode === m ? "var(--accent)" : "var(--text-dim)",
            font: "600 12px var(--font-sans)", cursor: "pointer",
          }}>
            {m === "nightly" ? "Per Night" : "Total"}
          </button>
        ))}
      </div>

      <div className="cost-display">
        <select className="cost-currency" value={currency} onChange={(e) => setCurrency(e.target.value)} aria-label="Currency">
          {CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
        <div className="cost-amount">{activeCostValue || "0"}</div>
        <button className="cost-clear" onClick={() => setActiveCostValue("")} aria-label="Clear">✕</button>
      </div>
      {total > 0 && (
        <div style={{ font: "12px var(--font-mono)", color: "var(--accent)", margin: "0 0 10px", textAlign: "center" }}>
          {costMode === "nightly" && <>Total: {formatMoney(total, currency)}</>}
          {currency !== "USD" && <span style={{ color: "var(--text-dim)", marginLeft: 8 }}>· converts to USD on save</span>}
        </div>
      )}

      <NumericKeypad value={activeCostValue} onChange={setActiveCostValue} />

      {/* Hotel-only: room/bed/view/booking details collapsed by default. */}
      {stayType === "hotel" && (<>
        <button onClick={() => setSM(!showMore)} style={{ width: "100%", padding: "10px 14px", marginTop: 16, marginBottom: 12, background: "var(--bg-2)", border: "1px solid var(--border)", borderRadius: 10, color: "var(--text-secondary)", font: "500 13px var(--font-sans)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
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
      </>)}

      <label className="field-label" style={{ marginTop: 8 }}>Notes</label>
      <textarea className="field-input" placeholder="Room tips, highlights…" rows={2} value={notes} onChange={(e) => setN(e.target.value)} style={{ resize: "vertical", marginBottom: 8 }} />
    </div>
  );

  // ─── Navigation ─────────────────────────────────────────────────
  const stepBody = step === 1 ? Step1 : step === 2 ? Step2 : Step3;

  // Tap-outside intentionally does NOT close — users were treating the
  // gray overlay like a no-op and losing partially-typed stays. Closing
  // has to be deliberate (Cancel button or backswipe).
  return (
    <div className="modal-overlay">
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head wizard-head">
          {step > 1 ? (
            <button className="btn-icon" onClick={() => setStep(step - 1)} aria-label="Back">←</button>
          ) : <span style={{ width: 24 }} />}
          <div className="wizard-progress">
            {Array.from({ length: STEP_COUNT }).map((_, i) => (
              <span key={i} className={`wizard-dot ${i + 1 === step ? "active" : i + 1 < step ? "done" : ""}`} />
            ))}
          </div>
          {/* "Cancel" beats a bare ✕ — beta testers were tapping the X
              expecting it to save, then losing their entry. The text
              label makes it unambiguous that this is a discard action;
              the bottom button is the only path that saves. */}
          <button
            className="btn-text"
            onClick={onClose}
            aria-label="Cancel and discard this stay"
            style={{
              background: "transparent",
              border: "none",
              padding: "6px 4px",
              font: "500 14px var(--font-sans)",
              color: "var(--text-secondary, #475569)",
              cursor: "pointer",
            }}
          >
            Cancel
          </button>
        </div>

        <div className="modal-body wizard-body" key={step /* re-mount to retrigger slide */}>
          {stepBody}
        </div>

        {/* Optionality hint — appears the moment Step 1 is valid so the
            user knows the bottom button is the only thing they need to
            tap. Beta testers were dutifully filling out every field
            because the wizard implied all 3 steps were required. */}
        {step < STEP_COUNT && step1Valid && (
          <div
            style={{
              padding: "6px 16px 0",
              textAlign: "center",
              font: "11px var(--font-mono)",
              color: "var(--text-dim)",
              letterSpacing: ".3px",
            }}
          >
            Everything below is optional — you can save now.
          </div>
        )}

        <div className="wizard-footer">
          {/* Once Step 1 is valid: SAVE is the primary action. "Add
              details" is the secondary, dimmer alternative. Previously
              this was inverted — Continue was the prominent button and
              Save was muted, which led testers to think they had to
              progress through every step. */}
          {step < STEP_COUNT && step1Valid ? (
            <>
              <button
                className="btn-secondary"
                onClick={() => setStep(step + 1)}
                disabled={submitting}
              >
                Add details
              </button>
              <button className="btn-submit" onClick={handleSubmit} disabled={submitting}>
                {submitting ? "Saving…" : `Save ${nights}-night stay`}
              </button>
            </>
          ) : step < STEP_COUNT ? (
            <button
              className="btn-submit"
              onClick={() => setStep(step + 1)}
              disabled={step === 1 && !step1Valid}
            >
              {step === 1 && !step1Valid
                ? (stayType === "hotel" ? "Pick a hotel & dates" : "Add a place & dates")
                : "Continue"}
            </button>
          ) : (
            <button className="btn-submit" onClick={handleSubmit} disabled={!canAdd || submitting}>
              {submitting ? "Saving…" : `Save ${nights}-night stay`}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
