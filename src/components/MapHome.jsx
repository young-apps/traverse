// MapHome — full-screen map with a detent bottom-sheet drawer.
//
// Default state: globe is full-bleed, drawer peeks at the bottom showing
// only "X countries · Y stays · Z upcoming". Drag/tap the handle to
// half-detent (list visible) or full-detent (list dominant). Tapping a
// pin on the map auto-expands to half-detent and FILTERS the drawer to
// only show stays in that city, so the user isn't dumped into the full
// 37-stay list when they're focused on Tulsa.
//
// "Show all stays" reset bar appears at the top of the drawer body
// whenever a city filter is active.

import { lazy, Suspense, useState, useEffect, useMemo, useCallback } from "react";
import StayCard from "./StayCard";
import BottomSheet from "./BottomSheet";
import HomeHighlights from "./HomeHighlights";
import LayoutToggle from "./LayoutToggle";
import { tap as hapticTap } from "../services/haptics";

const fmtShort = (d) => d ? new Date(d + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" }) : "";

// PeekCard — the content shown in the drawer's peek state. Replaces
// the old "X countries · Y stays" summary line. Showing real data
// (next-up trip details, or last stay if there's nothing upcoming)
// makes the peek state feel like the top of a list rather than a
// label, so users instinctively understand there's more below.
//
// Empty state stays text-only because that's the moment we want to
// drive the "Add your first stay" CTA, not preview a non-existent one.
function PeekCard({ stays, upcoming, past }) {
  if (!stays.length) {
    return <span className="bottom-sheet-summary">No stays yet — tap to add</span>;
  }
  const next = upcoming[0];
  const last = past[0];
  if (next) {
    const days = Math.max(0, Math.ceil((new Date(next.checkIn + "T00:00:00") - Date.now()) / 864e5));
    return (
      <div style={{ display: "flex", alignItems: "center", gap: 10, textAlign: "left", padding: "0 4px" }}>
        <div style={{ flexShrink: 0, width: 36, height: 36, borderRadius: 10, background: "var(--green-muted, rgba(61,214,140,.18))", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--green, #3DD68C)", font: "700 11px var(--font-mono)" }}>
          {days === 0 ? "Now" : `${days}d`}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ font: "600 13px var(--font-sans)", color: "var(--text)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {next.hotel || next.city}
          </div>
          <div style={{ font: "11px var(--font-mono)", color: "var(--text-secondary)", marginTop: 1 }}>
            Up next · {fmtShort(next.checkIn)}{next.nights ? ` · ${next.nights}n` : ""}
          </div>
        </div>
        <span style={{ font: "10px var(--font-mono)", color: "var(--text-dim)", letterSpacing: ".5px" }}>{stays.length} total</span>
      </div>
    );
  }
  if (last) {
    return (
      <div style={{ display: "flex", alignItems: "center", gap: 10, textAlign: "left", padding: "0 4px" }}>
        <div style={{ flexShrink: 0, width: 36, height: 36, borderRadius: 10, background: "rgba(100,116,139,.14)", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--text-secondary)", font: "700 11px var(--font-mono)" }}>
          ★
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ font: "600 13px var(--font-sans)", color: "var(--text)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {last.hotel || last.city}
          </div>
          <div style={{ font: "11px var(--font-mono)", color: "var(--text-secondary)", marginTop: 1 }}>
            Last stay · {fmtShort(last.checkIn)}
          </div>
        </div>
        <span style={{ font: "10px var(--font-mono)", color: "var(--text-dim)", letterSpacing: ".5px" }}>{stays.length} total</span>
      </div>
    );
  }
  return <span className="bottom-sheet-summary">{stays.length} stays</span>;
}

const MapView = lazy(() => import("./MapView"));

export default function MapHome({
  stays, upcoming, past, selectedId, onSelect,
  onDelete, onEdit, onAdd, celebrate,
}) {
  // Smart default: returning users with stays land in split view
  // (they want to see what they have); first-run users land at peek
  // (the empty list would crowd the empty-state CTA, and the goal is
  // to push them toward "+ Log Your First Stay"). Using a lazy
  // initializer so the count is checked once on mount, not every
  // render — once the user manually picks a detent, that decision
  // sticks for the session.
  const [detent, setDetent] = useState(() => (stays.length > 0 ? "half" : "peek"));
  // Visible drawer height in px, fed up from BottomSheet on every
  // detent change. Passed straight into MapView as padding.bottom so
  // flyTo centers selected pins in the visible slice of the globe
  // (above the drawer) rather than under it.
  const [drawerPx, setDrawerPx] = useState(110);
  const handleVisibleHeight = useCallback((h) => setDrawerPx(h), []);
  const nextUpId = upcoming[0]?.id;

  // Derive a city filter from the selected stay (set when a pin is
  // tapped). When the user picks Tulsa from the map, the drawer shows
  // only Tulsa stays. Clearing the selection or hitting "Show all"
  // returns to the full list.
  const selectedStay = useMemo(() => stays.find((s) => s.id === selectedId), [stays, selectedId]);
  const focusKey = selectedStay ? `${selectedStay.country}::${selectedStay.city}` : null;
  const focusLabel = selectedStay ? `${selectedStay.city}, ${selectedStay.country}` : null;

  // Auto-snap to half detent when a pin is tapped — the user wants to
  // see what's at that location without losing the map context. Don't
  // re-snap if they've already manually expanded to full.
  useEffect(() => {
    if (!selectedId) return;
    setDetent((d) => d === "full" ? "full" : "half");
    hapticTap();
  }, [selectedId]);

  const handleDetent = (next) => {
    setDetent(next);
    hapticTap();
  };

  const filteredUpcoming = focusKey
    ? upcoming.filter((s) => `${s.country}::${s.city}` === focusKey)
    : upcoming;
  const filteredPast = focusKey
    ? past.filter((s) => `${s.country}::${s.city}` === focusKey)
    : past;

  return (
    <div className="map-home-drawer">
      <div className="map-home-canvas">
        <Suspense fallback={<div className="loading-text" style={{ padding: 40, textAlign: "center" }}>Loading map…</div>}>
          <MapView stays={stays} selectedId={selectedId} onSelect={onSelect}
            celebrateAt={celebrate} paddingBottom={drawerPx} />
        </Suspense>
        {/* Floating storyteller card — ambient YTD highlights that
            rotate every few seconds. Kept above the map, hidden when
            there's nothing meaningful to show. */}
        <HomeHighlights stays={stays} />
        {/* Layout toggle — visible affordance for the same state
            machine the bottom-sheet handle drives. Most users won't
            think to drag a 4 px gray bar; this button makes the
            three layouts a one-tap operation. Hidden when the user
            has no stays (peek is the only sensible state then). */}
        {stays.length > 0 && (
          <LayoutToggle value={detent} onChange={handleDetent} />
        )}
      </div>

      <BottomSheet
        detent={detent}
        onDetentChange={handleDetent}
        onVisibleHeightChange={handleVisibleHeight}
        peekContent={<PeekCard stays={stays} upcoming={upcoming} past={past} />}
      >
        <div className="split-list-head">
          <div className="split-list-title">
            {focusLabel ? `${focusLabel} · ${filteredUpcoming.length + filteredPast.length} stays`
              : stays.length === 0 ? "No stays yet"
              : upcoming.length > 0 ? `${upcoming.length} upcoming · ${past.length} past`
              : `${past.length} stays`}
          </div>
          {focusLabel
            ? <button className="btn-ghost btn-sm" onClick={() => onSelect(null)}>Show all</button>
            : <button className="btn-primary btn-sm" onClick={onAdd}>+ Add</button>}
        </div>

        <div className="split-list-body">
          {stays.length === 0 ? (
            <div className="empty-hero" style={{ padding: 24 }}>
              <div className="empty-title">Track your hotel journey</div>
              <div className="empty-sub">Log your first stay to build your passport with stats, maps, and a history of everywhere you've been.</div>
              <button className="btn-primary btn-lg" onClick={onAdd}>+ Log Your First Stay</button>
            </div>
          ) : (
            <>
              {filteredUpcoming.length > 0 && (
                <div className="section">
                  <div className="section-title">Upcoming Stays</div>
                  {filteredUpcoming.map((s) => (
                    <StayCard key={s.id} stay={s} isSelected={selectedId === s.id}
                      isNext={s.id === nextUpId}
                      onSelect={onSelect}
                      onDelete={onDelete} onEdit={onEdit} />
                  ))}
                </div>
              )}
              {filteredPast.length > 0 && (
                <div className="section">
                  <div className="section-title" style={{ color: "var(--text-dim)" }}>Recent Stays</div>
                  {filteredPast.map((s) => (
                    <StayCard key={s.id} stay={s} isSelected={selectedId === s.id}
                      onSelect={onSelect}
                      onDelete={onDelete} onEdit={onEdit} />
                  ))}
                </div>
              )}
              {focusKey && filteredUpcoming.length + filteredPast.length === 0 && (
                <div className="empty-hero" style={{ padding: 24 }}>
                  <div className="empty-sub">No stays for {focusLabel} yet.</div>
                </div>
              )}
            </>
          )}
        </div>
      </BottomSheet>
    </div>
  );
}
