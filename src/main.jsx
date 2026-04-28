import React from "react";
import { createRoot } from "react-dom/client";

// On-device error overlay — replaces silent failures with visible diagnostics
// when running on TestFlight where Safari Web Inspector is blocked.
function showError(title, detail) {
  const root = document.getElementById("root");
  if (!root) return;
  root.innerHTML = `
    <div style="padding:24px;font:14px/1.5 -apple-system,sans-serif;color:#fff;background:#080B12;min-height:100vh;box-sizing:border-box;">
      <div style="color:#f06050;font-weight:600;font-size:16px;margin-bottom:12px;">${title}</div>
      <pre style="white-space:pre-wrap;word-break:break-word;background:#1a1d24;padding:12px;border-radius:8px;font:12px ui-monospace,monospace;color:#aaa;">${detail}</pre>
    </div>`;
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

    createRoot(document.getElementById("root")).render(
      <React.StrictMode>
        <App />
      </React.StrictMode>
    );
  } catch (e) {
    showError("Module load failed", formatError(e));
  }
})();
