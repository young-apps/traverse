// StayCard — tappable location, edit button, no emojis for status
import { formatMoney } from "../services/fx";
const fmtDate = (d) => d ? new Date(d + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" }) : "";
const fmtYear = (d) => d ? new Date(d + "T00:00:00").getFullYear() : "";
// "Jan 2026" — used by ScrollContextHeader's data-month-year attribute.
const fmtMonthYear = (d) => d ? new Date(d + "T00:00:00").toLocaleDateString("en-US", { month: "short", year: "numeric" }) : "";

export default function StayCard({ stay, isSelected, onSelect, onDelete, onEdit }) {
  const up = stay.status === "upcoming";

  const openInMaps = (e) => {
    e.stopPropagation();
    const q = encodeURIComponent(`${stay.hotel}, ${stay.address || ""} ${stay.city || ""} ${stay.country || ""}`);
    window.open(`https://www.google.com/maps/search/?api=1&query=${q}`, "_blank");
  };

  return (
    <div className={`stay-card ${isSelected ? "selected" : ""} ${up ? "upcoming" : "past"}`}
      data-stay-id={stay.id}
      data-country={stay.country || ""}
      data-month-year={fmtMonthYear(stay.checkIn)}
      onClick={() => onSelect(stay.id)}>
      <div className="stay-main">
        <div className="stay-left">
          <div className="stay-hotel">{stay.hotel}</div>
          <div className="stay-location">
            <button className="stay-location-link" onClick={openInMaps} title="Open in Google Maps">
              {stay.city}, {stay.country}
            </button>
            {stay.roomType && <span className="stay-room-badge">{stay.roomType}</span>}
            {stay.tripPurpose && <span className="stay-trip-badge">{stay.tripPurpose}</span>}
            {stay.upgradeStatus && stay.upgradeStatus !== "None" && (
              <span className="stay-upgrade-badge">{stay.upgradeStatus}</span>
            )}
          </div>
        </div>
        <div className="stay-right">
          {!up && stay.rating ? (
            <div className="stay-rating">{"★".repeat(stay.rating)}<span className="stay-rating-empty">{"★".repeat(5 - stay.rating)}</span></div>
          ) : null}
        </div>
      </div>

      {/* Single line: dates + nights + booking source. Saves vertical
          space vs. the previous two-row layout where nights lived in the
          right rail. */}
      <div className="stay-date-line">
        <span className="stay-date-big">{fmtDate(stay.checkIn)}</span>
        <span className="stay-date-arrow">→</span>
        <span className="stay-date-big">{fmtDate(stay.checkOut)}</span>
        <span className="stay-date-year">{fmtYear(stay.checkIn)}</span>
        <span className="stay-nights stay-nights-inline">· {stay.nights}n</span>
        {stay.bookedVia && <span className="stay-via">{stay.bookedVia}</span>}
      </div>

      {isSelected && (
        <div className="stay-detail">
          {stay.photoUrl && (
            <img className="stay-photo" src={stay.photoUrl} alt={stay.hotel} loading="lazy" />
          )}
          {stay.address && (
            <button className="detail-addr-link" onClick={openInMaps}>
              {stay.address}
            </button>
          )}

          {(stay.roomType || stay.bedType || stay.viewType || stay.clubAccess || stay.bookedVia || stay.totalCost > 0 || stay.loyaltyNumber || stay.tripPurpose) && (
            <div className="detail-chips">
              {stay.tripPurpose && <span className="chip chip-blue">{stay.tripPurpose}</span>}
              {stay.roomType && <span className="chip chip-amber">{stay.roomType}</span>}
              {stay.bedType && <span className="chip chip-blue">{stay.bedType}</span>}
              {stay.viewType && <span className="chip chip-blue">{stay.viewType}</span>}
              {stay.clubAccess && stay.clubAccess !== "None" && <span className="chip chip-purple">{stay.clubAccess}</span>}
              {stay.upgradeStatus && stay.upgradeStatus !== "None" && <span className="chip chip-green">{stay.upgradeStatus}</span>}
              {stay.bookedVia && <span className="chip chip-blue">{stay.bookedVia}</span>}
              {stay.totalCost > 0 && <span className="chip chip-green">{formatMoney(stay.totalCost, stay.currency || "USD")}</span>}
              {stay.loyaltyNumber && <span className="chip chip-purple">{stay.loyaltyNumber}</span>}
            </div>
          )}

          {stay.notes && <div className="detail-notes">{stay.notes}</div>}

          {/* Lat/lng intentionally hidden — they're technical noise that
              clutters the card. The address link above already opens
              Google Maps for users who want to see it on a map. */}
          <div className="detail-footer" style={{ justifyContent: "flex-end" }}>
            <div style={{ display: "flex", gap: 6 }}>
              {onEdit && <button className="btn-edit" onClick={(e) => { e.stopPropagation(); onEdit(stay); }}>Edit</button>}
              <button className="btn-danger" onClick={(e) => { e.stopPropagation(); onDelete(stay.id); }}>Remove</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
