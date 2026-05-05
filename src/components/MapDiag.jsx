// MapDiag — temporary diagnostic overlay for the Mapbox container.
//
// Why this exists: on iOS Capacitor builds, the friend map renders
// the legend and the city list (plain HTML) but its WebGL canvas
// stays blank. Could be a Mapbox token URL allowlist that doesn't
// include `capacitor://localhost`, a style/tile request being blocked
// by WKWebView's network stack, or a WebGL2 capability mismatch.
//
// This overlay sits on top of any Mapbox map and reports, live:
//   • Container width × height (so we can confirm the size gate fired)
//   • WebGL2 availability + which renderer is in use
//   • Style load status, source data status, every error event
//   • Last network request the Mapbox SDK fired and its outcome
//
// Toggle with a `?diag=map` query param OR by setting
// localStorage.mapDiag = "1". Off by default so it doesn't ship to
// production users — but a developer or anyone running TestFlight
// can flip the flag from the diag panel without rebuilding.

import { useEffect, useRef, useState } from "react";

export function isMapDiagEnabled() {
  if (typeof window === "undefined") return false;
  try {
    if (new URLSearchParams(window.location.search).get("diag") === "map") return true;
    if (window.localStorage?.getItem("mapDiag") === "1") return true;
  } catch {}
  return false;
}

// Quick WebGL capability probe — done outside React so it runs once
// per session and the result is just a string we render.
function detectGL() {
  try {
    const c = document.createElement("canvas");
    const gl2 = c.getContext("webgl2");
    if (gl2) {
      const ext = gl2.getExtension("WEBGL_debug_renderer_info");
      const renderer = ext ? gl2.getParameter(ext.UNMASKED_RENDERER_WEBGL) : "(renderer hidden)";
      return `WebGL2 · ${renderer}`;
    }
    const gl1 = c.getContext("webgl") || c.getContext("experimental-webgl");
    if (gl1) return "WebGL1 only (mapbox-gl needs WebGL2 from v3)";
    return "NO WebGL — map will never render";
  } catch (e) { return `WebGL probe threw: ${e.message}`; }
}

export default function MapDiag({ map, container, label = "map" }) {
  const [size, setSize] = useState({ w: 0, h: 0 });
  // Mapbox's actual GL drawing buffer. If this stays 0×0 while the
  // container has size, the canvas was sized AFTER context creation
  // and never reconciled — exactly the iOS WKWebView bug.
  const [canvasSize, setCanvasSize] = useState({ w: 0, h: 0, dpr: 1 });
  const [styleLoaded, setStyleLoaded] = useState(false);
  const [sourceLoaded, setSourceLoaded] = useState(false);
  const [tilesLoaded, setTilesLoaded] = useState(false);
  const [errors, setErrors] = useState([]);
  const [net, setNet] = useState({ ok: 0, fail: 0, lastUrl: "", lastStatus: "" });
  const glRef = useRef(detectGL());

  // Watch the container for size changes — confirms layout is sane.
  useEffect(() => {
    if (!container) return;
    const measure = () => {
      const r = container.getBoundingClientRect();
      setSize({ w: Math.round(r.width), h: Math.round(r.height) });
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(container);
    return () => ro.disconnect();
  }, [container]);

  // Subscribe to every Mapbox lifecycle event. The events themselves
  // tell us a lot: "load" only fires once the style is parsed; "data"
  // fires when each source finishes loading; "error" fires for tile
  // 401s, style 403s, missing glyphs, etc. — all the silent failures.
  useEffect(() => {
    if (!map) return;
    const onLoad = () => setStyleLoaded(true);
    const onSourceData = (e) => {
      if (e.isSourceLoaded) setSourceLoaded(true);
      if (e.tile) setTilesLoaded(true);
    };
    const onError = (e) => {
      const m = e?.error?.message || e?.error?.statusText || String(e?.error || e);
      const url = e?.error?.url || e?.error?.target?.responseURL || "";
      setErrors((prev) => [...prev.slice(-4), `${m}${url ? ` (${url.slice(0, 60)})` : ""}`]);
    };
    map.on("load", onLoad);
    map.on("sourcedata", onSourceData);
    map.on("error", onError);
    if (map.loaded()) setStyleLoaded(true);

    // Poll the GL drawing buffer 4×/sec. If the CSS box has size but
    // the canvas backbuffer is 0×0 we know the resize never reconciled.
    const id = setInterval(() => {
      try {
        const c = map.getCanvas();
        setCanvasSize({ w: c.width, h: c.height, dpr: window.devicePixelRatio || 1 });
      } catch {}
    }, 250);

    return () => {
      clearInterval(id);
      map.off("load", onLoad);
      map.off("sourcedata", onSourceData);
      map.off("error", onError);
    };
  }, [map]);

  // Hook the Mapbox transform-request pipeline if available. Confirms
  // whether tile / style URLs are even being fired off the device,
  // and what URL scheme they go out under (https vs capacitor://).
  useEffect(() => {
    if (!map) return;
    const orig = map._requestManager?.transformRequest;
    if (!map._requestManager) return;
    map._requestManager.transformRequest = (url, type) => {
      // Don't log every tile, but capture the most recent one.
      setNet((n) => ({ ...n, lastUrl: `${type}: ${url.slice(0, 70)}` }));
      const out = orig ? orig.call(map._requestManager, url, type) : { url };
      return out;
    };
    return () => { if (map._requestManager && orig) map._requestManager.transformRequest = orig; };
  }, [map]);

  // Manual force-resize. If tapping this and tiles suddenly start
  // rendering, we've confirmed the resize-after-layout race.
  const forceResize = () => {
    if (!map) return;
    try {
      map.resize();
      map.triggerRepaint();
    } catch {}
  };

  const canvasZero = canvasSize.w === 0 || canvasSize.h === 0;

  return (
    <div className="map-diag">
      <div className="map-diag-row"><b>{label}</b> · css {size.w}×{size.h}</div>
      <div className="map-diag-row">
        canvas: <span className={canvasZero ? "fail" : "ok"}>{canvasSize.w}×{canvasSize.h}</span>
        {" "}@ dpr {canvasSize.dpr}
      </div>
      <div className="map-diag-row">{glRef.current}</div>
      <div className="map-diag-row">
        style: <span className={styleLoaded ? "ok" : "fail"}>{styleLoaded ? "loaded" : "pending"}</span>
        {" · "}source: <span className={sourceLoaded ? "ok" : "fail"}>{sourceLoaded ? "loaded" : "pending"}</span>
        {" · "}tiles: <span className={tilesLoaded ? "ok" : "fail"}>{tilesLoaded ? "loaded" : "pending"}</span>
      </div>
      {net.lastUrl && <div className="map-diag-row map-diag-net">↳ {net.lastUrl}</div>}
      {errors.length > 0 && (
        <div className="map-diag-row map-diag-err">
          {errors.map((m, i) => <div key={i}>! {m}</div>)}
        </div>
      )}
      <div className="map-diag-row map-diag-origin">origin: {typeof window !== "undefined" ? window.location.origin : "?"}</div>
      <div className="map-diag-row">
        <button onClick={forceResize} className="map-diag-btn">Force resize</button>
      </div>
    </div>
  );
}
