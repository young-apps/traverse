// Haptics — light tactile feedback for snap-to-detent + map fly-to.
//
// We don't have @capacitor/haptics installed yet (it requires a pod
// re-sync), so this module degrades gracefully:
//   • iOS native: if window.Capacitor.Plugins.Haptics is registered at
//     runtime (when the plugin is added later) it'll be used.
//   • Web/PWA: navigator.vibrate, which is a no-op on iOS Safari but
//     fires real buzz on Android.
//   • Anywhere else: silent no-op.
//
// Keep effects subtle. Apple HIG: haptics should reinforce a discrete
// state change, never run continuously.

function safeNativeImpact(style) {
  try {
    const plugins = (typeof window !== "undefined" ? window.Capacitor?.Plugins : null);
    if (plugins?.Haptics?.impact) plugins.Haptics.impact({ style });
  } catch { /* swallow — haptics are non-critical */ }
}

function safeWebVibrate(ms) {
  try { if (typeof navigator !== "undefined" && navigator.vibrate) navigator.vibrate(ms); } catch {}
}

/** Light tap — for detent snaps, card selection. */
export function tap() {
  safeNativeImpact("LIGHT");
  safeWebVibrate(8);
}

/** Medium impact — for a successful save/celebration moment. */
export function impact() {
  safeNativeImpact("MEDIUM");
  safeWebVibrate(15);
}
