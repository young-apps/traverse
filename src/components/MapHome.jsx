// MapHome — full-bleed map with a draggable swipe-up sheet of stays.
//
// Phase 3 of the Traverse rebuild. The map is the home page's center of
// gravity; stay cards live in a sheet that the user can peek, half-open,
// or pull all the way up to browse. Tapping a card selects + flies to
// the pin on the map below.
//
// The sheet has three snap points expressed as a translateY in pixels
// from the *bottom* of the home view:
//   - peek:  shows just the handle + section title (~140px tall)
//   - half:  ~55% of available height
//   - full:  ~88% of available height (leaves the map peeking up top)
// Pointer events drive a live translate while dragging; on release we
// snap to whichever point is closest, with a velocity boost so a quick
// flick goes one snap further.
//
// We use pointer events (not touch) so the same code works in iOS
// WebView, desktop Safari, and trackpad-emulation in dev. The sheet's
// scroll content gets `overflow: auto` only when we're at the full
// snap — otherwise dragging anywhere on the body moves the sheet.

import { useEffect, useRef, useState, lazy, Suspense } from "react";
import StayCard from "./StayCard";

const MapView = lazy(() => import("./MapView"));

const SNAPS = { peek: 0.18, half: 0.55, full: 0.88 }; // fraction of available height

export default function MapHome({
  stays, upcoming, past, selectedId, onSelect,
  onDelete, onEdit, onAdd, celebrate,
}) {
  const wrapRef = useRef(null);
  const sheetRef = useRef(null);
  const dragRef = useRef(null); // {startY, startHeight, lastY, lastT}
  const [sheetH, setSheetH] = useState(0);   // current rendered height (px)
  const [snap, setSnap] = useState("peek");  // which snap we're resting on
  const [dragging, setDragging] = useState(false);

  // Compute target height for a snap given the wrap's available height.
  const targetFor = (s) => {
    const wrap = wrapRef.current;
    if (!wrap) return 0;
    const avail = wrap.clientHeight;
    return Math.round(avail * SNAPS[s]);
  };

  // Resize on mount + window resize: snap to current label so the height
  // tracks orientation changes.
  useEffect(() => {
    const recalc = () => setSheetH(targetFor(snap));
    recalc();
    window.addEventListener("resize", recalc);
    return () => window.removeEventListener("resize", recalc);
  }, [snap]);

  // When a stay is selected from the map, drop the sheet to peek so the
  // map stays visible. When the celebration fires, also collapse to peek
  // so the new pin is visible behind the sheet.
  useEffect(() => { if (celebrate) setSnap("peek"); }, [celebrate?.key]);

  const onPointerDown = (e) => {
    // Don't start a drag from interactive elements inside cards.
    if (e.target.closest("button, a, input")) return;
    const sheet = sheetRef.current;
    if (!sheet) return;
    // If we're at full snap and the body is scrolled, let the body scroll
    // instead of dragging the sheet.
    const body = sheet.querySelector(".sheet-body");
    if (snap === "full" && body && body.scrollTop > 0 && !e.target.closest(".sheet-handle")) return;
    sheet.setPointerCapture?.(e.pointerId);
    dragRef.current = { startY: e.clientY, startH: sheetH, lastY: e.clientY, lastT: performance.now() };
    setDragging(true);
  };
  const onPointerMove = (e) => {
    if (!dragRef.current) return;
    const dy = e.clientY - dragRef.current.startY;
    const next = clamp(dragRef.current.startH - dy, 60, wrapRef.current.clientHeight - 40);
    setSheetH(next);
    dragRef.current.lastY = e.clientY;
    dragRef.current.lastT = performance.now();
  };
  const onPointerUp = () => {
    if (!dragRef.current) return;
    const startH = dragRef.current.startH;
    const endH = sheetH;
    const dt = Math.max(1, performance.now() - dragRef.current.lastT);
    // Velocity (px/ms): negative = downward swipe, positive = upward
    // because higher h = sheet pulled up.
    const v = (endH - startH) / Math.max(dt, 16);
    dragRef.current = null;
    setDragging(false);
    // Snap: pick nearest of {peek, half, full}; flick (|v|>0.5) bumps one
    // notch in the swipe direction.
    const order = ["peek", "half", "full"];
    const heights = order.map(targetFor);
    let nearest = 0;
    let nd = Infinity;
    heights.forEach((h, i) => { const d = Math.abs(h - endH); if (d < nd) { nd = d; nearest = i; } });
    if (v > 0.6 && nearest < 2) nearest += 1;
    if (v < -0.6 && nearest > 0) nearest -= 1;
    setSnap(order[nearest]);
    setSheetH(heights[nearest]);
  };

  const isFull = snap === "full";

  return (
    <div className="map-home" ref={wrapRef}>
      <div className="map-home-map">
        <Suspense fallback={<div className="loading-text" style={{ padding: 40, textAlign: "center" }}>Loading map…</div>}>
          <MapView stays={stays} selectedId={selectedId} onSelect={onSelect} celebrateAt={celebrate} />
        </Suspense>
      </div>

      <div
        ref={sheetRef}
        className={`map-sheet ${dragging ? "dragging" : ""} snap-${snap}`}
        style={{ height: sheetH }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      >
        <div className="sheet-handle"><span /></div>
        <div className="sheet-head">
          <div className="sheet-title">
            {stays.length === 0 ? "No stays yet" :
              upcoming.length > 0 ? `${upcoming.length} upcoming · ${past.length} past`
              : `${past.length} stays`}
          </div>
          <button className="btn-primary btn-sm" onClick={onAdd}>+ Add</button>
        </div>

        <div className="sheet-body" style={{ overflowY: isFull ? "auto" : "hidden" }}>
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
                      onSelect={(id) => onSelect(id === selectedId ? null : id)}
                      onDelete={onDelete} onEdit={onEdit} />
                  ))}
                </div>
              )}
              {past.length > 0 && (
                <div className="section">
                  <div className="section-title" style={{ color: "var(--text-dim)" }}>Recent Stays</div>
                  {past.map((s) => (
                    <StayCard key={s.id} stay={s} isSelected={selectedId === s.id}
                      onSelect={(id) => onSelect(id === selectedId ? null : id)}
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

function clamp(n, lo, hi) { return Math.max(lo, Math.min(hi, n)); }
