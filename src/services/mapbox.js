// Single source of truth for the mapbox-gl module.
//
// Why this exists: MapView and FriendsMapView both used to import
// mapbox-gl-csp + the inline CSP worker independently. Vite's
// `?worker&inline` syntax creates a DIFFERENT worker class per import
// site. Whoever was the last to set `mapboxgl.workerClass = ...` won
// the singleton — and the loser's tiles silently failed to render.
// (MapHome's MapView mounted first; switching to the Friend Map tab
// stomped its workerClass with a different worker, but the running
// MapView no longer existed to care; meanwhile FriendsMapView's tile
// requests went out through the new worker, which sometimes never
// produced a single rendered frame on iOS WKWebView.)
//
// Centralizing the import means:
//   • Exactly one inlined worker chunk in the bundle.
//   • Exactly one workerClass assignment.
//   • Token + style URL constants live next to the module so we can
//     surface a clear error if the env var didn't make it into the
//     production build.

import mapboxgl from "mapbox-gl/dist/mapbox-gl-csp";
import MapboxWorker from "mapbox-gl/dist/mapbox-gl-csp-worker?worker&inline";
import "mapbox-gl/dist/mapbox-gl.css";

mapboxgl.workerClass = MapboxWorker;

const TOKEN = import.meta.env.VITE_MAPBOX_TOKEN;
if (!TOKEN) console.error("[mapbox] VITE_MAPBOX_TOKEN missing from build");
mapboxgl.accessToken = TOKEN;

export default mapboxgl;
export const MAPBOX_STYLE_LIGHT = "mapbox://styles/mapbox/light-v11";

// Wait for an element to have non-zero pixel dimensions before
// constructing a Mapbox Map against it. Mapbox needs the container
// to already be sized — if it's 0×0 at construction, the GL canvas
// is created but never renders, the load event never fires, and even
// a later resize() can leave the tiles permanently blank on iOS
// WebView. We poll via rAF until laid out (cheap; usually 1 frame),
// give up after ~30 frames so we don't hang forever on a misconfigured
// page.
export function whenSized(el) {
  return new Promise((resolve, reject) => {
    let frames = 0;
    const tick = () => {
      if (!el) return reject(new Error("element gone"));
      const r = el.getBoundingClientRect();
      if (r.width > 0 && r.height > 0) return resolve(r);
      if (++frames > 30) return reject(new Error(`container 0×0 after ${frames} frames`));
      requestAnimationFrame(tick);
    };
    tick();
  });
}
