// MapHome — split-pane home: map on top, stays list below.
//
// Both panes are always visible. The earlier swipe-up sheet hid the map
// whenever you wanted to read the list and hid the list whenever you
// wanted to see the map. The earlier 3-mode toggle button worked in
// theory but in practice the map didn't redraw cleanly when the pane
// resized. So we keep the layout fixed: map on top (~58%), list below.
// Tapping a card calls `onSelect`, which forwards to MapView's
// flyTo-on-select so the map underneath always pans to the chosen stay.

import { lazy, Suspense } from "react";
import StayCard from "./StayCard";

const MapView = lazy(() => import("./MapView"));

export default function MapHome({
  stays, upcoming, past, selectedId, onSelect,
  onDelete, onEdit, onAdd, celebrate,
}) {
  // The "next up" stay is the soonest upcoming one. App.jsx has already
  // sorted upcoming by checkIn ascending; we just take [0] here.
  const nextUpId = upcoming[0]?.id;

  return (
    <div className="map-home-split">
      <div className="map-home-pane map-pane">
        <Suspense fallback={<div className="loading-text" style={{ padding: 40, textAlign: "center" }}>Loading map…</div>}>
          <MapView stays={stays} selectedId={selectedId} onSelect={onSelect} celebrateAt={celebrate} />
        </Suspense>
      </div>

      <div className="map-home-pane list-pane">
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
                      isNext={s.id === nextUpId}
                      onSelect={onSelect}
                      onDelete={onDelete} onEdit={onEdit} />
                  ))}
                </div>
              )}
              {past.length > 0 && (
                <div className="section">
                  <div className="section-title" style={{ color: "var(--text-dim)" }}>Recent Stays</div>
                  {past.map((s) => (
                    <StayCard key={s.id} stay={s} isSelected={selectedId === s.id}
                      onSelect={onSelect}
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
