// MapView — interactive Mapbox map with tappable markers + clean popovers
import { useEffect, useRef, useState, useCallback } from "react";
// Import from the ESM build path explicitly. mapbox-gl's package.json
// resolves to a UMD bundle by default, and our optimizeDeps.exclude
// (needed for the inline worker below) blocks Vite from rewriting that
// UMD into ESM — leaving us with no `default` export at runtime.
import mapboxgl from "mapbox-gl/dist/esm-min/mapbox-gl.js";
// Inline the Mapbox worker so it's same-origin in Capacitor's WebView.
// Without this, the worker loads as a cross-origin script and throws
// an opaque "Script error :0" that crashes the entire app.
import MapboxWorker from "mapbox-gl/dist/mapbox-gl-csp-worker?worker&inline";
mapboxgl.workerClass = MapboxWorker;

// Surface missing-token early so iOS App Store builds don't render a
// silently-blank map when the env var didn't get baked in.
const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_TOKEN;
if (!MAPBOX_TOKEN) console.error("[MapView] VITE_MAPBOX_TOKEN missing from build");
mapboxgl.accessToken = MAPBOX_TOKEN;

const SOURCE = "stays-src";

function staysToGeoJSON(stays, selectedId) {
  return {
    type: "FeatureCollection",
    features: stays.filter((s) => typeof s.lat === "number").map((s) => ({
      type: "Feature",
      geometry: { type: "Point", coordinates: [s.lng, s.lat] },
      properties: {
        id: s.id, hotel: s.hotel || "", city: s.city || "", country: s.country || "",
        nights: s.nights || 0, rating: s.rating || 0, status: s.status || "past",
        checkIn: s.checkIn || "", checkOut: s.checkOut || "",
        isSelected: s.id === selectedId,
      },
    })),
  };
}

const fmtD = (d) => d ? new Date(d + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" }) : "";

export default function MapView({ stays, selectedId, onSelect }) {
  const containerRef = useRef(null);
  const mapRef = useRef(null);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    if (!mapboxgl.accessToken) { setError("Set VITE_MAPBOX_TOKEN in .env"); return; }
    try {
      const map = new mapboxgl.Map({
        container: containerRef.current, style: "mapbox://styles/mapbox/light-v11",
        center: [10, 30], zoom: 1.5, attributionControl: false,
      });
      map.addControl(new mapboxgl.NavigationControl({ showCompass: false }), "bottom-right");

      map.on("load", () => {
        map.addSource(SOURCE, { type: "geojson", data: { type: "FeatureCollection", features: [] } });

        // Glow for selected
        map.addLayer({ id: "glow", type: "circle", source: SOURCE, filter: ["==", ["get", "isSelected"], true],
          paint: { "circle-radius": 24, "circle-color": ["case", ["==", ["get", "status"], "upcoming"], "#3DD68C", "#D4A44C"], "circle-opacity": 0.12, "circle-blur": 1 } });

        // Past dots — grey, larger for tappability
        map.addLayer({ id: "past", type: "circle", source: SOURCE,
          filter: ["all", ["==", ["get", "status"], "past"], ["==", ["get", "isSelected"], false]],
          paint: { "circle-radius": 8, "circle-color": "#6B7280", "circle-stroke-width": 2, "circle-stroke-color": "rgba(255,255,255,0.2)", "circle-opacity": 0.6 } });

        // Upcoming dots — green, pulsing feel via larger size
        map.addLayer({ id: "upcoming", type: "circle", source: SOURCE,
          filter: ["all", ["==", ["get", "status"], "upcoming"], ["==", ["get", "isSelected"], false]],
          paint: { "circle-radius": 9, "circle-color": "#3DD68C", "circle-stroke-width": 2, "circle-stroke-color": "rgba(255,255,255,0.4)", "circle-opacity": 0.9 } });

        // Selected — prominent
        map.addLayer({ id: "selected", type: "circle", source: SOURCE,
          filter: ["==", ["get", "isSelected"], true],
          paint: { "circle-radius": 12, "circle-color": ["case", ["==", ["get", "status"], "upcoming"], "#3DD68C", "#D4A44C"],
            "circle-stroke-width": 3, "circle-stroke-color": "#fff", "circle-opacity": 1 } });

        setReady(true);
      });

      // Click → select + show popup
      const popup = new mapboxgl.Popup({ closeButton: true, closeOnClick: true, maxWidth: "260px", offset: 16, className: "traverse-popup" });

      ["past", "upcoming", "selected"].forEach((layer) => {
        map.on("click", layer, (e) => {
          if (!e.features?.length) return;
          const p = e.features[0].properties;
          const coords = e.features[0].geometry.coordinates.slice();
          onSelect(p.id);

          popup.setLngLat(coords).setHTML(`
            <div class="popup-card">
              <div class="popup-hotel">${esc(p.hotel)}</div>
              <div class="popup-city">${esc(p.city)}, ${esc(p.country)}</div>
              <div class="popup-dates">${fmtD(p.checkIn)} – ${fmtD(p.checkOut)} · ${p.nights}n</div>
              ${p.rating > 0 ? `<div class="popup-rating">${"★".repeat(p.rating)}${"☆".repeat(5 - p.rating)}</div>` : ""}
              ${p.status === "upcoming" ? '<div class="popup-badge-green">Upcoming</div>' : ""}
            </div>
          `).addTo(map);
        });
        map.on("mouseenter", layer, () => map.getCanvas().style.cursor = "pointer");
        map.on("mouseleave", layer, () => map.getCanvas().style.cursor = "");
      });

      mapRef.current = map;
    } catch (e) { setError("Map failed to load"); }
    return () => { if (mapRef.current) { mapRef.current.remove(); mapRef.current = null; } };
  }, []);

  // Update data
  useEffect(() => {
    if (!mapRef.current || !ready) return;
    const src = mapRef.current.getSource(SOURCE);
    if (src) src.setData(staysToGeoJSON(stays, selectedId));
  }, [stays, selectedId, ready]);

  // Fly to selected
  useEffect(() => {
    if (!mapRef.current || !selectedId) return;
    const s = stays.find((x) => x.id === selectedId);
    if (s?.lat) mapRef.current.flyTo({ center: [s.lng, s.lat], zoom: 11, duration: 1200 });
  }, [selectedId]);

  // Fit all on load
  useEffect(() => {
    if (!mapRef.current || !ready || !stays.length) return;
    const valid = stays.filter((s) => typeof s.lat === "number");
    if (!valid.length) return;
    const bounds = new mapboxgl.LngLatBounds();
    valid.forEach((s) => bounds.extend([s.lng, s.lat]));
    mapRef.current.fitBounds(bounds, { padding: 50, maxZoom: 5, duration: 0 });
  }, [stays.length, ready]);

  return (
    <div className="map-section">
      <div ref={containerRef} className="map-container" />
      {error && <div className="map-loading">{error}</div>}
      <div className="map-legend">
        <span className="legend-item"><span className="legend-dot" style={{ background: "#6B7280" }} /> Past</span>
        <span className="legend-item"><span className="legend-dot" style={{ background: "#3DD68C", boxShadow: "0 0 6px #3DD68C80" }} /> Upcoming</span>
      </div>
    </div>
  );
}

function esc(s) { return String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])); }
