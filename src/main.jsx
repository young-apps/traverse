import React from "react";
import ReactDOM from "react-dom/client";
import App from "./components/App.jsx";
import "./styles/tokens.css";
import "./styles/app.css";

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

window.addEventListener("error", (e) => {
  showError("Error", `${e.message}\n\nat ${e.filename}:${e.lineno}`);
});
window.addEventListener("unhandledrejection", (e) => {
  showError("Promise rejection", String(e.reason?.stack || e.reason));
});

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
      missing.join("\n") +
      "\n\nSet them in Codemagic → Environment variables and rebuild."
  );
} else {
  ReactDOM.createRoot(document.getElementById("root")).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  );
}
