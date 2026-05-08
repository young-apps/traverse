// LayoutToggle — three-state segmented pill that lets the user snap
// the Home view into one of three layouts:
//
//   🌍 Map   →  full-bleed globe, drawer at peek (handle only)
//   ⊟ Split  →  globe top, list bottom
//   ☰ List   →  list dominant, globe peeks behind
//
// Why this exists: the bottom sheet handle is a perfectly fine pull
// gesture for users who already know the iOS sheet idiom, but a huge
// share of users don't think to drag a 4 px gray bar. This toggle
// provides a *visible* affordance for the same state machine, with
// recognizable iconography borrowed from Apple Maps / Airbnb / Zillow.
//
// Inline-styled so a stale CDN'd stylesheet can't make it disappear.

import { tap as hapticTap } from "../services/haptics";

const OPTIONS = [
  { value: "peek", label: "Map",   title: "Show map full-screen" },
  { value: "half", label: "Split", title: "Show map and list together" },
  { value: "full", label: "List",  title: "Show stays list" },
];

// Icons drawn inline instead of imported so we don't pay an extra
// roundtrip for a 6-line SVG. Stroke currentColor so the active item
// inherits accent.
const ICON = {
  peek: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="9"/><path d="M3 12h18"/><path d="M12 3a13 13 0 010 18"/><path d="M12 3a13 13 0 000 18"/>
    </svg>
  ),
  half: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="18" height="18" rx="2"/><line x1="3" y1="12" x2="21" y2="12"/>
    </svg>
  ),
  full: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/>
    </svg>
  ),
};

export default function LayoutToggle({ value = "peek", onChange }) {
  const handle = (next) => {
    if (next === value) return;
    hapticTap();
    onChange?.(next);
  };
  return (
    <div
      role="tablist"
      aria-label="Home layout"
      style={{
        position: "absolute",
        top: "max(60px, calc(env(safe-area-inset-top, 0px) + 56px))", // below highlights pill
        right: 12,
        zIndex: 7,
        display: "flex",
        gap: 2,
        padding: 3,
        borderRadius: 999,
        background: "rgba(255,255,255,0.92)",
        WebkitBackdropFilter: "blur(12px) saturate(1.4)",
        backdropFilter: "blur(12px) saturate(1.4)",
        border: "1px solid var(--border)",
        boxShadow: "0 4px 14px rgba(15,23,42,.10)",
      }}
    >
      {OPTIONS.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={o.value}
            role="tab"
            aria-selected={active}
            title={o.title}
            onClick={() => handle(o.value)}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 5,
              padding: "6px 10px",
              borderRadius: 999,
              border: "none",
              background: active ? "var(--accent-muted, rgba(212,164,76,.18))" : "transparent",
              color: active ? "var(--accent, #B8860B)" : "var(--text-secondary, #475569)",
              font: "600 11px var(--font-sans)",
              cursor: "pointer",
              transition: "background 0.18s ease, color 0.18s ease",
              WebkitTapHighlightColor: "transparent",
              minHeight: 30,
            }}
          >
            {ICON[o.value]}
            <span>{o.label}</span>
          </button>
        );
      })}
    </div>
  );
}
