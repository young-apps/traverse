import React from "react";
import { createRoot } from "react-dom/client";
import { installDiag } from "./services/diag";

// Install the in-app diagnostic logger BEFORE anything else so it captures
// all console output, fetches, and errors from app start.
installDiag();

// On-device error overlay — renders a fixed-position banner above #root.
// Critical: never clobber #root.innerHTML, since React owns that subtree
// and overwriting it triggers a cascade of removeChild errors during the
// next commit, masking whatever error actually fired first.
const OVERLAY_ID = "__traverse_error_overlay";
function showError(title, detail) {
  let overlay = document.getElementById(OVERLAY_ID);
  if (!overlay) {
    overlay = document.createElement("div");
    overlay.id = OVERLAY_ID;
    overlay.style.cssText = "position:fixed;inset:0;z-index:2147483647;padding:24px;font:14px/1.5 -apple-system,sans-serif;color:#fff;background:#080B12;overflow:auto;box-sizing:border-box;";
    document.body.appendChild(overlay);
  }
  // Append (not replace) so multiple errors stack — the first one is usually
  // the most informative. Cap at 5 to avoid runaway growth.
  if (overlay.childElementCount >= 5) return;
  const block = document.createElement("div");
  block.style.cssText = "margin-bottom:16px;";
  const titleEl = document.createElement("div");
  titleEl.style.cssText = "color:#f06050;font-weight:600;font-size:16px;margin-bottom:8px;";
  titleEl.textContent = title;
  const pre = document.createElement("pre");
  pre.style.cssText = "white-space:pre-wrap;word-break:break-word;background:#1a1d24;padding:12px;border-radius:8px;font:12px ui-monospace,monospace;color:#aaa;margin:0;";
  pre.textContent = detail;
  block.appendChild(titleEl);
  block.appendChild(pre);
  overlay.appendChild(block);
}

function formatError(e) {
  if (!e) return "(no error object)";
  return [
    e.message || "(no message)",
    e.stack ? "\nStack:\n" + e.stack : "",
    e.cause ? "\n\nCause: " + (e.cause.stack || e.cause.message || String(e.cause)) : "",
  ].join("");
}

// Detect "stale SPA shell" errors: a deploy replaced chunk hashes, but
// the user's browser still has the old index.html cached, so when React
// tries to lazy-load a chunk (e.g. FriendsMapView), the old hash 404s.
// Symptoms: "Importing a module script failed", "Failed to fetch
// dynamically imported module", "Loading chunk N failed".
//
// Recovery: hard-reload once with a cache-busting query string. Use
// sessionStorage as a one-shot guard so a genuine bug doesn't loop.
const STALE_SHELL_KEY = "__traverse_stale_reload";
const STALE_PATTERNS = [
  /Importing a module script failed/i,
  /Failed to fetch dynamically imported module/i,
  /Loading chunk [\w-]+ failed/i,
  /error loading dynamically imported module/i,
];
function isStaleChunkError(msg) {
  return typeof msg === "string" && STALE_PATTERNS.some((p) => p.test(msg));
}
function maybeReloadForStaleShell(msg) {
  if (!isStaleChunkError(msg)) return false;
  if (sessionStorage.getItem(STALE_SHELL_KEY)) return false; // already tried
  sessionStorage.setItem(STALE_SHELL_KEY, String(Date.now()));
  // Cache-bust by adding a timestamp; the SW or CDN edge will serve a
  // fresh index.html which references the new chunk hashes.
  const url = new URL(window.location.href);
  url.searchParams.set("_v", String(Date.now()));
  window.location.replace(url.toString());
  return true;
}
// Clear the guard once the app has been alive for ~10s — if we got
// this far without crashing again, the reload succeeded.
setTimeout(() => sessionStorage.removeItem(STALE_SHELL_KEY), 10_000);

// Debug overlay opt-in. The full-bleed black overlay is a developer
// aid — it dumps stacks so I can diagnose iOS WebView issues without
// USB debugging. Real users were seeing it for transient, non-fatal
// rejections (e.g. a Mapbox worker callback firing after teardown,
// "this.errorCb is not a function") and assuming the app had crashed.
//
// In production we silently log to console + diag instead. Power-users
// (and me, in TestFlight) can re-enable the overlay by appending
// ?debug=1 once — it sticks for the session via localStorage.
const DEBUG_KEY = "__traverse_debug_overlay";
try {
  const params = new URLSearchParams(window.location.search);
  if (params.get("debug") === "1") localStorage.setItem(DEBUG_KEY, "1");
  if (params.get("debug") === "0") localStorage.removeItem(DEBUG_KEY);
} catch {}
const isDebugOverlayEnabled = () => {
  try { return localStorage.getItem(DEBUG_KEY) === "1"; } catch { return false; }
};

// Errors we have decided are noise — non-fatal callbacks bubbling out
// of native bridges or Mapbox worker teardown. We log them but never
// show UI for them, even in debug mode, because they will keep firing
// and only obscure real signal.
const NOISE_PATTERNS = [
  // Capacitor/Cordova plugin error-callback fires after the registered
  // callback was cleared. Always benign; the plugin call already
  // resolved or the host component already unmounted.
  /errorCb is not a function/i,
  /this\.errorCb/i,
  // Mapbox GL worker tears down between style swaps and occasionally
  // rejects a pending tile request. Map keeps rendering fine.
  /AbortError/i,
  /The operation was aborted/i,
];
const isNoise = (msg) => typeof msg === "string" && NOISE_PATTERNS.some((p) => p.test(msg));

window.addEventListener("error", (e) => {
  const msg = e.error?.message || e.message || "";
  if (maybeReloadForStaleShell(msg)) return;
  if (isNoise(msg)) {
    console.warn("[traverse] suppressed noise error:", msg);
    return;
  }
  if (!isDebugOverlayEnabled()) {
    console.error("[traverse] runtime error:", e.error || msg);
    return;
  }
  const detail = e.error
    ? formatError(e.error)
    : `${e.message || "(no message — likely cross-origin script error)"}` +
      `\nFile: ${e.filename || "(redacted)"}` +
      `\nLine: ${e.lineno || 0}:${e.colno || 0}`;
  showError("Runtime error", detail);
});
window.addEventListener("unhandledrejection", (e) => {
  const msg = e.reason?.message || String(e.reason || "");
  if (maybeReloadForStaleShell(msg)) return;
  if (isNoise(msg)) {
    console.warn("[traverse] suppressed noise rejection:", msg);
    e.preventDefault?.();
    return;
  }
  if (!isDebugOverlayEnabled()) {
    console.error("[traverse] promise rejection:", e.reason);
    return;
  }
  showError("Promise rejection", formatError(e.reason) || String(e.reason));
});

(async () => {
  // Surface env-var problems immediately
  const missing = [
    "VITE_FIREBASE_API_KEY",
    "VITE_FIREBASE_AUTH_DOMAIN",
    "VITE_FIREBASE_PROJECT_ID",
    "VITE_FIREBASE_APP_ID",
    "VITE_MAPBOX_TOKEN",
  ].filter((k) => !import.meta.env[k]);

  if (missing.length) {
    showError(
      "Missing env vars at build time",
      "These VITE_* variables were empty when the app was built:\n\n" +
        missing.join("\n")
    );
    return;
  }

  // Dynamic imports so a module-load error becomes a visible message
  // rather than a cross-origin "Script error :0".
  try {
    await import("./styles/tokens.css");
    await import("./styles/app.css");
    const { default: App } = await import("./components/App.jsx");

    // StrictMode disabled: it double-mounts components in dev, which trips
    // up Mapbox's manual DOM management and surfaces a removeChild error
    // that doesn't occur in production builds.
    createRoot(document.getElementById("root")).render(<App />);
  } catch (e) {
    showError("Module load failed", formatError(e));
  }
})();
