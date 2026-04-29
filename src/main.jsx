import React from "react";
import { createRoot } from "react-dom/client";

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

window.addEventListener("error", (e) => {
  const detail = e.error
    ? formatError(e.error)
    : `${e.message || "(no message — likely cross-origin script error)"}` +
      `\nFile: ${e.filename || "(redacted)"}` +
      `\nLine: ${e.lineno || 0}:${e.colno || 0}`;
  showError("Runtime error", detail);
});
window.addEventListener("unhandledrejection", (e) => {
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
