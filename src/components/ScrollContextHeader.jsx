// ScrollContextHeader — sticky bar that mirrors the country + month/year
// of the topmost visible stay card. Replaces static year/region filter
// chips with a contextual readout that updates as the user scrolls.
//
// Implementation: every StayCard tags itself with [data-stay-id],
// [data-country], [data-month-year]. We attach a single
// IntersectionObserver to all of them; when intersection state changes,
// we pick the visible card with the smallest top offset (i.e. the one
// just under our sticky header) and render its country/month.
//
// Self-contained: no props, no plumbing — just drop it in.

import { useEffect, useState } from "react";

export default function ScrollContextHeader() {
  const [ctx, setCtx] = useState(null); // { country, monthYear }

  useEffect(() => {
    const cards = Array.from(document.querySelectorAll("[data-stay-id]"));
    if (!cards.length) { setCtx(null); return; }

    // Track which cards are currently intersecting and recompute the
    // "topmost visible" each time intersection state flips.
    const visible = new Set();
    const recompute = () => {
      let topCard = null;
      let topY = Infinity;
      for (const id of visible) {
        const el = document.querySelector(`[data-stay-id="${id}"]`);
        if (!el) continue;
        const y = el.getBoundingClientRect().top;
        // Only consider cards whose top is below our sticky bar
        // (~44 px) to avoid flicker when one is half-scrolled-off.
        if (y < topY) { topY = y; topCard = el; }
      }
      if (!topCard) { setCtx(null); return; }
      const country = topCard.dataset.country || "";
      const monthYear = topCard.dataset.monthYear || "";
      setCtx({ country, monthYear });
    };

    const obs = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          const id = e.target.dataset.stayId;
          if (e.isIntersecting) visible.add(id); else visible.delete(id);
        }
        recompute();
      },
      // Slight negative top margin so a card "becomes the context" only
      // once it's actually below the sticky bar.
      { rootMargin: "-44px 0px 0px 0px", threshold: 0 }
    );

    cards.forEach((c) => obs.observe(c));
    return () => obs.disconnect();
  });

  if (!ctx || (!ctx.country && !ctx.monthYear)) return null;

  return (
    <div className="scroll-ctx">
      <span className="scroll-ctx-country">{ctx.country}</span>
      {ctx.country && ctx.monthYear && <span className="scroll-ctx-dot">·</span>}
      <span className="scroll-ctx-month">{ctx.monthYear}</span>
    </div>
  );
}
