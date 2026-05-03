// Diag — tiny in-app log buffer so we can see network/Firestore failures
// without Safari Web Inspector. Patches console.error/warn/log so existing
// code paths feed into it automatically. Tap the avatar 5x to open the
// panel from anywhere in the app.

const MAX = 200;
const buf = [];
const subs = new Set();

function push(level, args) {
  const ts = new Date().toISOString().slice(11, 23);
  const text = args.map((a) => {
    if (a instanceof Error) return `${a.name}: ${a.message}\n${a.stack || ""}`;
    if (typeof a === "object") {
      try { return JSON.stringify(a, null, 2); } catch { return String(a); }
    }
    return String(a);
  }).join(" ");
  buf.push({ ts, level, text });
  if (buf.length > MAX) buf.shift();
  subs.forEach((fn) => fn(buf.slice()));
}

export function getLogs() { return buf.slice(); }
export function subscribe(fn) { subs.add(fn); return () => subs.delete(fn); }
export function clearLogs() { buf.length = 0; subs.forEach((fn) => fn([])); }
export function log(...a) { push("log", a); }

let installed = false;
export function installDiag() {
  if (installed) return;
  installed = true;
  const orig = { log: console.log, warn: console.warn, error: console.error };
  console.log = (...a) => { push("log", a); orig.log(...a); };
  console.warn = (...a) => { push("warn", a); orig.warn(...a); };
  console.error = (...a) => { push("error", a); orig.error(...a); };
  window.addEventListener("error", (e) => push("error", [`window.error: ${e.message}`, e.filename, e.lineno]));
  window.addEventListener("unhandledrejection", (e) => push("error", [`unhandledrejection:`, e.reason]));

  // Wrap fetch to capture URL + status of every outbound request.
  const origFetch = window.fetch.bind(window);
  window.fetch = async (...args) => {
    const url = typeof args[0] === "string" ? args[0] : args[0]?.url;
    const t0 = performance.now();
    try {
      const res = await origFetch(...args);
      const ms = Math.round(performance.now() - t0);
      if (!res.ok) push("warn", [`fetch ${res.status} ${ms}ms`, url]);
      else push("log", [`fetch ${res.status} ${ms}ms`, url]);
      return res;
    } catch (e) {
      const ms = Math.round(performance.now() - t0);
      push("error", [`fetch FAILED ${ms}ms`, url, e?.message || e]);
      throw e;
    }
  };
  push("log", ["[diag] installed"]);
}
