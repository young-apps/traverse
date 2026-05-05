// BottomSheet — detent drawer that animates with transform: translateY
// instead of height. Older WebKit and Android WebView builds choke on
// height transitions because every frame triggers layout + paint;
// translateY runs entirely on the compositor (GPU) so even a translucent
// blurred sheet stays at 60fps on a 2018 iPhone.
//
// The trick: the sheet always has a fixed render height (the "full"
// detent height). We slide it down behind the bottom edge so only a
// strip is visible. Each detent is just a translateY value:
//
//   peek →  translateY(SHEET_H - 110px)   ← only the handle bar peeks
//   half →  translateY(SHEET_H - 0.55 * vh)
//   full →  translateY(0)                  ← whole sheet visible
//
// Background is translucent + backdrop-filter blurred so the globe
// remains visible through the drawer.

import { useEffect, useRef, useState, useCallback } from "react";

const DETENTS = ["peek", "half", "full"];
// Visible heights at each detent (px). Computed at runtime against the
// current viewport so iPhone SE → iPad all snap to the right pixels.
function detentVisible(d, vh) {
  if (d === "peek") return 110;
  if (d === "half") return Math.round(vh * 0.55);
  return Math.round(vh * 0.92);
}
const SHEET_H_FRAC = 0.92; // sheet's render height as fraction of viewport

export default function BottomSheet({ detent = "peek", onDetentChange, onVisibleHeightChange, peekContent, children }) {
  const sheetRef = useRef(null);
  const dragRef = useRef(null);   // { startY, startTranslate } during drag
  const tapRef = useRef(null);    // { y, t } to disambiguate tap vs drag

  // dragTranslate is the live translateY (px) during a finger drag. When
  // null we fall back to the detent's static translate, animated by CSS.
  const [dragTranslate, setDragTranslate] = useState(null);

  // Bubble up the current visible drawer height. MapHome uses this to
  // pass padding.bottom into MapView's flyTo so the selected pin lands
  // in the visible map slice instead of hiding behind the drawer.
  useEffect(() => {
    if (!onVisibleHeightChange) return;
    const vh = window.innerHeight;
    onVisibleHeightChange(detentVisible(detent, vh));
  }, [detent, onVisibleHeightChange]);

  const cycle = useCallback(() => {
    const i = DETENTS.indexOf(detent);
    onDetentChange?.(DETENTS[(i + 1) % DETENTS.length]);
  }, [detent, onDetentChange]);

  // Given a translateY (px), pick the detent whose visible height is
  // closest. Lower translateY = more sheet visible.
  const snapToNearest = useCallback((translateY) => {
    const vh = window.innerHeight;
    const sheetH = vh * SHEET_H_FRAC;
    const visible = sheetH - translateY;
    let best = "peek", bestDist = Infinity;
    for (const k of DETENTS) {
      const d = Math.abs(detentVisible(k, vh) - visible);
      if (d < bestDist) { best = k; bestDist = d; }
    }
    onDetentChange?.(best);
  }, [onDetentChange]);

  // Compute the static translateY for the current detent.
  const detentTranslate = (() => {
    if (typeof window === "undefined") return 0;
    const vh = window.innerHeight;
    return vh * SHEET_H_FRAC - detentVisible(detent, vh);
  })();

  const onPointerDown = (e) => {
    const y = e.touches ? e.touches[0].clientY : e.clientY;
    dragRef.current = { startY: y, startTranslate: detentTranslate };
    tapRef.current = { y, t: Date.now() };
  };

  const onPointerMove = (e) => {
    if (!dragRef.current) return;
    if (e.cancelable) e.preventDefault();
    const y = e.touches ? e.touches[0].clientY : e.clientY;
    const dy = y - dragRef.current.startY;
    const vh = window.innerHeight;
    const sheetH = vh * SHEET_H_FRAC;
    // Clamp: can't go above 0 (full sheet visible) or below sheetH-80
    // (would hide the handle entirely).
    const next = Math.max(0, Math.min(sheetH - 80, dragRef.current.startTranslate + dy));
    setDragTranslate(next);
  };

  const onPointerUp = (e) => {
    if (!dragRef.current) return;
    const endY = e.changedTouches ? e.changedTouches[0].clientY : e.clientY;
    const totalDy = Math.abs(endY - tapRef.current.y);
    const elapsed = Date.now() - tapRef.current.t;
    if (totalDy < 6 && elapsed < 300) {
      cycle();
    } else if (dragTranslate != null) {
      snapToNearest(dragTranslate);
    }
    dragRef.current = null;
    tapRef.current = null;
    setDragTranslate(null);
  };

  // Window-level listeners so the drag survives a finger that strays
  // off the handle. touchmove uses passive:false so we can preventDefault
  // and stop iOS rubber-banding the page underneath.
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
  }, [dragTranslate]);

  const translate = dragTranslate != null ? dragTranslate : detentTranslate;
  const style = {
    transform: `translate3d(0, ${translate}px, 0)`,
    transition: dragTranslate != null ? "none" : "transform 0.32s cubic-bezier(.22,1,.36,1)",
  };

  return (
    <div className={`bottom-sheet detent-${detent} ${dragTranslate != null ? "dragging" : ""}`}
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
