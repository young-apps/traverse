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
import { tap as hapticTap } from "../services/haptics";

const MapView = lazy(() => import("./MapView"));

export default function MapHome({
  stays, upcoming, past, selectedId, onSelect,
  onDelete, onEdit, onAdd, celebrate,
}) {
  const [detent, setDetent] = useState("peek");
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

  const countries = new Set(stays.map((s) => s.country).filter(Boolean)).size;
  const summary = stays.length === 0
    ? "No stays yet — tap to add"
    : `${countries} countries · ${stays.length} stays${upcoming.length ? ` · ${upcoming.length} upcoming` : ""}`;

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
      </div>

      <BottomSheet
        detent={detent}
        onDetentChange={handleDetent}
        onVisibleHeightChange={handleVisibleHeight}
        peekContent={<span className="bottom-sheet-summary">{summary}</span>}
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
