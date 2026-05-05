// BottomSheet — detent-based drawer for the home screen.
//
// Design intent (mirrors UISheetPresentationController detents):
//   peek (~110px)  → just a handle + a single summary line; map dominates
//   half (~55dvh)  → list of stays visible, map still half-visible above
//   full (~92dvh)  → list dominant, map collapses to a thin strip
//
// Interactions:
//   • Drag the handle (touch or mouse): live-track the drawer height,
//     snap to the nearest detent on release.
//   • Tap the handle: cycle peek → half → full → peek.
//   • Programmatic snap via the `detent` prop, e.g. parent calls
//     setDetent("half") when a map pin is tapped.
//
// Accessibility: handle is a button so VoiceOver can fire it. Each
// detent change is announced via the title slot; we don't move focus
// (would steal it from the map).

import { useEffect, useRef, useState, useCallback } from "react";

const DETENTS = ["peek", "half", "full"];

// Heights expressed as either px (peek) or dvh fraction (half/full).
// Using dvh so iOS Safari's URL-bar collapse doesn't shift the sheet.
const HEIGHTS = {
  peek: "110px",
  half: "55dvh",
  full: "92dvh",
};

export default function BottomSheet({ detent = "peek", onDetentChange, peekContent, children }) {
  const sheetRef = useRef(null);
  const dragRef = useRef(null); // { startY, startHeightPx } during a drag
  const [dragHeight, setDragHeight] = useState(null); // px during active drag
  const [tapStart, setTapStart] = useState(null);

  // Cycle through detents on handle tap.
  const cycle = useCallback(() => {
    const i = DETENTS.indexOf(detent);
    onDetentChange?.(DETENTS[(i + 1) % DETENTS.length]);
  }, [detent, onDetentChange]);

  // Snap to whichever detent is closest to the current pixel height.
  const snapToNearest = useCallback((px) => {
    const vh = window.innerHeight;
    const targets = {
      peek: 110,
      half: vh * 0.55,
      full: vh * 0.92,
    };
    let best = "peek", bestDist = Infinity;
    for (const k of DETENTS) {
      const d = Math.abs(targets[k] - px);
      if (d < bestDist) { best = k; bestDist = d; }
    }
    onDetentChange?.(best);
  }, [onDetentChange]);

  const onPointerDown = (e) => {
    const y = e.touches ? e.touches[0].clientY : e.clientY;
    const rect = sheetRef.current.getBoundingClientRect();
    dragRef.current = { startY: y, startHeightPx: rect.height };
    setTapStart({ y, t: Date.now() });
  };

  const onPointerMove = (e) => {
    if (!dragRef.current) return;
    e.preventDefault();
    const y = e.touches ? e.touches[0].clientY : e.clientY;
    const dy = y - dragRef.current.startY;
    // Drag down = sheet shrinks; drag up = sheet grows.
    const next = Math.max(80, Math.min(window.innerHeight * 0.96, dragRef.current.startHeightPx - dy));
    setDragHeight(next);
  };

  const onPointerUp = (e) => {
    if (!dragRef.current) return;
    const endY = e.changedTouches ? e.changedTouches[0].clientY : e.clientY;
    const totalDy = Math.abs(endY - tapStart.y);
    const elapsed = Date.now() - tapStart.t;
    // Treat short, low-displacement gestures as taps (cycle through
    // detents). Otherwise snap to whichever detent is closest.
    if (totalDy < 6 && elapsed < 300) {
      cycle();
    } else if (dragHeight != null) {
      snapToNearest(dragHeight);
    }
    dragRef.current = null;
    setDragHeight(null);
    setTapStart(null);
  };

  // Wire window-level move/up so the gesture survives a finger that
  // strays outside the handle. Touch is passive:false so we can
  // preventDefault to keep iOS from rubber-banding the page underneath.
  useEffect(() => {
    if (!dragRef.current) return;
    const move = (e) => onPointerMove(e);
    const up = (e) => onPointerUp(e);
    window.addEventListener("touchmove", move, { passive: false });
    window.addEventListener("touchend", up);
    window.addEventListener("mousemove", move);
    window.addEventListener("mouseup", up);
    return () => {
      window.removeEventListener("touchmove", move);
      window.removeEventListener("touchend", up);
      window.removeEventListener("mousemove", move);
      window.removeEventListener("mouseup", up);
    };
  }, [dragHeight, tapStart]);

  const style = dragHeight != null
    ? { height: `${dragHeight}px`, transition: "none" }
    : { height: HEIGHTS[detent] };

  return (
    <div className={`bottom-sheet detent-${detent} ${dragHeight != null ? "dragging" : ""}`}
      ref={sheetRef} style={style}>
      <div className="bottom-sheet-handle"
        role="button" aria-label={`Drawer (${detent}). Tap to expand or drag to resize.`}
        onTouchStart={onPointerDown} onMouseDown={onPointerDown}>
        <div className="bottom-sheet-grabber" />
        {peekContent && <div className="bottom-sheet-peek">{peekContent}</div>}
      </div>
      <div className="bottom-sheet-body">{children}</div>
    </div>
  );
}
