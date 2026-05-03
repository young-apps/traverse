// DiagPanel — full-screen overlay showing the captured log buffer.
// Open it by tapping the brand mark 5 times. No build flag, no menu —
// just tap-to-summon for production debugging on TestFlight/App Store.
import { useState, useEffect } from "react";
import { getLogs, subscribe, clearLogs } from "../services/diag";
import { Capacitor } from "@capacitor/core";

export default function DiagPanel({ onClose }) {
  const [logs, setLogs] = useState(getLogs());
  useEffect(() => subscribe(setLogs), []);

  const env = {
    platform: Capacitor.getPlatform(),
    native: Capacitor.isNativePlatform(),
    href: window.location.href,
    origin: window.location.origin,
    ua: navigator.userAgent,
    online: navigator.onLine,
    mapboxToken: !!import.meta.env.VITE_MAPBOX_TOKEN,
    placesKey: !!import.meta.env.VITE_GOOGLE_PLACES_KEY,
    firebaseKey: !!import.meta.env.VITE_FIREBASE_API_KEY,
  };

  const colorFor = (l) => l === "error" ? "#EF4444" : l === "warn" ? "#F59E0B" : "#475569";

  const copyAll = async () => {
    const text = [
      `# env\n${JSON.stringify(env, null, 2)}`,
      `# logs`,
      ...logs.map((l) => `[${l.ts}] ${l.level.toUpperCase()} ${l.text}`),
    ].join("\n");
    try { await navigator.clipboard.writeText(text); alert("Copied to clipboard"); }
    catch { prompt("Copy:", text); }
  };

  return (
    <div style={{
      position: "fixed", inset: 0, background: "#FFFFFF", zIndex: 99999,
      display: "flex", flexDirection: "column", fontFamily: "var(--font-mono)",
    }}>
      <div style={{ padding: "14px 16px", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", gap: 8 }}>
        <div style={{ font: "700 13px var(--font-mono)", color: "var(--accent)", textTransform: "uppercase", letterSpacing: 2, flex: 1 }}>Diagnostics</div>
        <button onClick={copyAll} style={{ padding: "6px 10px", borderRadius: 6, border: "1px solid var(--border)", background: "var(--surface)", font: "11px var(--font-mono)" }}>Copy</button>
        <button onClick={() => clearLogs()} style={{ padding: "6px 10px", borderRadius: 6, border: "1px solid var(--border)", background: "var(--surface)", font: "11px var(--font-mono)" }}>Clear</button>
        <button onClick={onClose} style={{ padding: "6px 10px", borderRadius: 6, border: "1px solid var(--border)", background: "var(--surface)", font: "11px var(--font-mono)" }}>Close</button>
      </div>
      <div style={{ padding: "10px 14px", borderBottom: "1px solid var(--border)", background: "var(--bg-2)", font: "10px/1.5 var(--font-mono)", color: "var(--text-secondary)" }}>
        platform={env.platform} native={String(env.native)} online={String(env.online)}<br/>
        mapboxToken={String(env.mapboxToken)} placesKey={String(env.placesKey)} firebaseKey={String(env.firebaseKey)}<br/>
        origin={env.origin}
      </div>
      <div style={{ flex: 1, overflowY: "auto", padding: "8px 12px", font: "11px/1.45 var(--font-mono)" }}>
        {logs.length === 0 && <div style={{ color: "var(--text-dim)", padding: 20, textAlign: "center" }}>No logs yet — interact with the app to generate output.</div>}
        {logs.map((l, i) => (
          <div key={i} style={{ padding: "4px 0", borderBottom: "1px solid var(--border)", color: colorFor(l.level), whiteSpace: "pre-wrap", wordBreak: "break-all" }}>
            <span style={{ color: "var(--text-dim)" }}>{l.ts} </span>
            <b style={{ textTransform: "uppercase" }}>{l.level}</b>{" "}
            {l.text}
          </div>
        ))}
      </div>
    </div>
  );
}
