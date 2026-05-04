// MapHome — split-pane home: map on top, stays list below.
//
// The earlier swipe-up sheet hid the map whenever you wanted to read
// the list and hid the list whenever you wanted to see the map. The new
// rule: both visible, always. Map is the visual anchor (default ~58% of
// available height), list scrolls beneath. A single "expand" toggle in
// the map's top-right corner swaps modes:
//
//   - default  → map ~58% / list ~42%
//   - map-max  → map ~88% / list ~12% (just headers + first card)
//   - list-max → map ~28% / list ~72% (skim a long history)
//
// Tapping a card calls `onSelect`, which the parent forwards to MapView
// — which already has flyTo-on-select wired up. So clicking a stay
// always pans the map underneath without the user losing the list.

import { useState, lazy, Suspense } from "react";
import StayCard from "./StayCard";

const MapView = lazy(() => import("./MapView"));

const MODES = {
  "default": { map: 58, list: 42, icon: "expand" },
  "map-max": { map: 88, list: 12, icon: "shrink" },
  "list-max": { map: 28, list: 72, icon: "expand" },
};

export default function MapHome({
  stays, upcoming, past, selectedId, onSelect,
  onDelete, onEdit, onAdd, celebrate,
}) {
  const [mode, setMode] = useState("default");
  const dims = MODES[mode];

  const cycleMode = () => {
    setMode((m) => m === "default" ? "map-max" : m === "map-max" ? "list-max" : "default");
  };

  // When a card is tapped, flip toward map-max so the user can see the
  // pin they just selected. We don't go all the way — leave the list
  // peeking so they can pick another stay without re-toggling.
  const handleSelect = (id) => {
    onSelect(id === selectedId ? null : id);
    if (id !== selectedId && mode === "list-max") setMode("default");
  };

  return (
    <div className="map-home-split">
      <div className="map-home-pane map-pane" style={{ flexBasis: `${dims.map}%` }}>
        <Suspense fallback={<div className="loading-text" style={{ padding: 40, textAlign: "center" }}>Loading map…</div>}>
          <MapView stays={stays} selectedId={selectedId} onSelect={onSelect} celebrateAt={celebrate} />
        </Suspense>
        <button className="map-mode-btn" onClick={cycleMode} aria-label="Toggle map size"
          title={mode === "map-max" ? "Show more of the list" : mode === "list-max" ? "Show more of the map" : "Maximize map"}>
          {mode === "map-max" ? (
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 21H3v-6"/><path d="M21 3h-6"/><path d="M3 21l7-7"/><path d="M21 3l-7 7"/>
            </svg>
          ) : (
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M15 3h6v6"/><path d="M9 21H3v-6"/><path d="M21 3l-7 7"/><path d="M3 21l7-7"/>
            </svg>
          )}
        </button>
      </div>

      <div className="map-home-pane list-pane" style={{ flexBasis: `${dims.list}%` }}>
        <div className="split-list-head">
          <div className="split-list-title">
            {stays.length === 0 ? "No stays yet" :
              upcoming.length > 0 ? `${upcoming.length} upcoming · ${past.length} past`
              : `${past.length} stays`}
          </div>
          <button className="btn-primary btn-sm" onClick={onAdd}>+ Add</button>
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
              {upcoming.length > 0 && (
                <div className="section">
                  <div className="section-title">Upcoming Stays</div>
                  {upcoming.map((s) => (
                    <StayCard key={s.id} stay={s} isSelected={selectedId === s.id}
                      onSelect={handleSelect}
                      onDelete={onDelete} onEdit={onEdit} />
                  ))}
                </div>
              )}
              {past.length > 0 && (
                <div className="section">
                  <div className="section-title" style={{ color: "var(--text-dim)" }}>Recent Stays</div>
                  {past.map((s) => (
                    <StayCard key={s.id} stay={s} isSelected={selectedId === s.id}
                      onSelect={handleSelect}
                      onDelete={onDelete} onEdit={onEdit} />
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
