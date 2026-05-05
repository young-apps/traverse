// MapView — interactive Mapbox map with tappable markers + clean popovers
import { useEffect, useRef, useState, useCallback } from "react";
// Shared mapbox-gl module — ensures the workerClass + accessToken are
// set exactly once across MapView and FriendsMapView. See
// services/mapbox.js for the rationale.
import mapboxgl, { MAPBOX_STYLE_LIGHT, whenSized } from "../services/mapbox";

const SOURCE = "stays-src";

// Build the geojson source for the map. We pre-compute an `opacity`
// property per upcoming stay so the next trip is a vivid, fully-opaque
// green and the further-out trips fade toward translucent — a visual
// "this is the trip that's actually next" cue. Past stays are uniform
// slate. Selected stays always render at full opacity regardless.
function staysToGeoJSON(stays, selectedId) {
  // Order upcoming by checkIn ascending so rank 0 = soonest.
  const upcoming = stays
    .filter((s) => s.status === "upcoming" && typeof s.lat === "number" && s.checkIn)
    .sort((a, b) => new Date(a.checkIn) - new Date(b.checkIn));
  const opacityFor = (id) => {
    const idx = upcoming.findIndex((s) => s.id === id);
    if (idx < 0) return 1;                          // not in the upcoming list
    if (upcoming.length === 1) return 1;            // only one upcoming → full
    // Linear ramp 1.0 (next) → 0.35 (furthest). Anything past the
    // top-10 stays at 0.35 so a long backlog of plans still reads as
    // "less urgent" without disappearing.
    const t = Math.min(idx / Math.max(1, Math.min(upcoming.length - 1, 9)), 1);
    return Number((1 - t * 0.65).toFixed(2));
  };
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
        opacity: s.status === "upcoming" ? opacityFor(s.id) : 0.6,
      },
    })),
  };
}

const fmtD = (d) => d ? new Date(d + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" }) : "";

export default function MapView({ stays, selectedId, onSelect, celebrateAt, paddingBottom = 0 }) {
  // Why paddingBottom matters: the home view overlays a drawer on the
  // bottom of the map. Without telling Mapbox about that occlusion,
  // flyTo and fitBounds center their target in the *full* canvas — so
  // the selected pin lands underneath the drawer. Passing the drawer's
  // current pixel height as padding.bottom shifts the effective
  // viewport up so the pin stays in the visible slice above the sheet.
  const padRef = useRef(paddingBottom);
  padRef.current = paddingBottom;
  const containerRef = useRef(null);
  const mapRef = useRef(null);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    if (!mapboxgl.accessToken) { setError("Set VITE_MAPBOX_TOKEN in .env"); return; }
    let cancelled = false;
    // Defer construction until the container actually has pixels.
    whenSized(containerRef.current).then((r) => {
      if (cancelled || !containerRef.current || mapRef.current) return;
      console.log("[map] init", r.width, "×", r.height);
      const map = new mapboxgl.Map({
        container: containerRef.current, style: MAPBOX_STYLE_LIGHT,
        center: [10, 30], zoom: 1.5, attributionControl: false,
      });
      map.addControl(new mapboxgl.NavigationControl({ showCompass: false }), "bottom-right");

      // Pipe Mapbox-internal errors into the diag panel. Without this, a
      // failed tile/style/glyph fetch is silent and the map renders blank
      // forever — exactly the symptom seen on the App Store build.
      map.on("error", (e) => {
        const m = e?.error?.message || e?.error?.statusText || String(e?.error || e);
        const url = e?.error?.url || e?.error?.target?.responseURL || "";
        console.error("[mapbox] error", m, url);
      });
      map.on("styleimagemissing", (e) => console.warn("[mapbox] missing image", e?.id));

      map.on("load", () => {
        console.log("[mapbox] style loaded — adding stay layers");
        map.addSource(SOURCE, { type: "geojson", data: { type: "FeatureCollection", features: [] } });

        // Glow for selected — green for upcoming, slate for past so the
        // halo matches the dot color now that past is no longer purple.
        map.addLayer({ id: "glow", type: "circle", source: SOURCE, filter: ["==", ["get", "isSelected"], true],
          paint: { "circle-radius": 24, "circle-color": ["case", ["==", ["get", "status"], "upcoming"], "#3DD68C", "#64748B"], "circle-opacity": 0.18, "circle-blur": 1 } });

        // Past dots — uniform slate gray so the eye can ignore them and
        // focus on what's coming up next.
        map.addLayer({ id: "past", type: "circle", source: SOURCE,
          filter: ["all", ["==", ["get", "status"], "past"], ["==", ["get", "isSelected"], false]],
          paint: { "circle-radius": 7, "circle-color": "#64748B", "circle-stroke-width": 2, "circle-stroke-color": "rgba(15,23,42,0.18)", "circle-opacity": 0.55 } });

        // Upcoming dots — uniform green hue, but per-feature opacity that
        // ramps from 1.0 (the very next stay) down to ~0.35 (furthest
        // out). The opacity lives on the feature itself in
        // staysToGeoJSON so reordering happens automatically as trips
        // pass and re-rank.
        map.addLayer({ id: "upcoming", type: "circle", source: SOURCE,
          filter: ["all", ["==", ["get", "status"], "upcoming"], ["==", ["get", "isSelected"], false]],
          paint: { "circle-radius": 9, "circle-color": "#3DD68C",
            "circle-stroke-width": 2, "circle-stroke-color": "rgba(15,23,42,0.3)",
            "circle-opacity": ["get", "opacity"] } });

        // Selected — prominent, always full opacity.
        map.addLayer({ id: "selected", type: "circle", source: SOURCE,
          filter: ["==", ["get", "isSelected"], true],
          paint: { "circle-radius": 12, "circle-color": ["case", ["==", ["get", "status"], "upcoming"], "#3DD68C", "#64748B"],
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
    }).catch((e) => {
      console.error("[map] init failed", e);
      setError("Map failed to load");
    });
    return () => {
      cancelled = true;
      if (mapRef.current) { mapRef.current.remove(); mapRef.current = null; }
    };
  }, []);

  // Update data
  useEffect(() => {
    if (!mapRef.current || !ready) return;
    const src = mapRef.current.getSource(SOURCE);
    if (src) src.setData(staysToGeoJSON(stays, selectedId));
  }, [stays, selectedId, ready]);

  // Fly to selected. padding.bottom is the drawer height — Mapbox
  // treats it as occluded and offsets the center upward by half of it.
  useEffect(() => {
    if (!mapRef.current || !selectedId) return;
    const s = stays.find((x) => x.id === selectedId);
    if (s?.lat) mapRef.current.flyTo({
      center: [s.lng, s.lat], zoom: 11, duration: 1200,
      padding: { top: 20, bottom: padRef.current, left: 20, right: 20 },
    });
  }, [selectedId, paddingBottom]);

  // When the drawer detent changes (paddingBottom updates) and a stay
  // is selected, easeTo re-centers it for the new visible slice.
  // Keeps the active pin in view as the drawer grows or shrinks.
  useEffect(() => {
    if (!mapRef.current || !selectedId) return;
    const s = stays.find((x) => x.id === selectedId);
    if (s?.lat) mapRef.current.easeTo({
      center: [s.lng, s.lat], duration: 320,
      padding: { top: 20, bottom: paddingBottom, left: 20, right: 20 },
    });
  }, [paddingBottom]);

  // Pin-drop celebration: when a stay is saved, fly to it and pulse a marker.
  useEffect(() => {
    if (!mapRef.current || !ready || !celebrateAt) return;
    const { lat, lng, key } = celebrateAt;
    if (typeof lat !== "number" || typeof lng !== "number") return;
    mapRef.current.flyTo({
      center: [lng, lat], zoom: 6, duration: 1400, essential: true,
      padding: { top: 20, bottom: padRef.current, left: 20, right: 20 },
    });
    const el = document.createElement("div");
    el.className = "pin-drop";
    el.innerHTML = '<span class="pin-drop-pulse"></span><span class="pin-drop-dot"></span>';
    const marker = new mapboxgl.Marker({ element: el, anchor: "bottom" })
      .setLngLat([lng, lat]).addTo(mapRef.current);
    const t = setTimeout(() => marker.remove(), 3000);
    return () => { clearTimeout(t); marker.remove(); };
  }, [celebrateAt?.key, ready]);

  // Fit all on load. padding.bottom keeps the bounds out from under
  // the drawer; we add a little extra side padding so coastal stays
  // don't hug the edge.
  useEffect(() => {
    if (!mapRef.current || !ready || !stays.length) return;
    const valid = stays.filter((s) => typeof s.lat === "number");
    if (!valid.length) return;
    const bounds = new mapboxgl.LngLatBounds();
    valid.forEach((s) => bounds.extend([s.lng, s.lat]));
    mapRef.current.fitBounds(bounds, {
      padding: { top: 60, bottom: padRef.current + 40, left: 50, right: 50 },
      maxZoom: 5, duration: 0,
    });
  }, [stays.length, ready]);

  // Reset the view: clear any selection and either fit all valid stays
  // (preferred — the user can still see where they've been) or fall
  // back to a true world view if there are no stays yet.
  const resetView = () => {
    if (!mapRef.current) return;
    onSelect && onSelect(null);
    const valid = stays.filter((s) => typeof s.lat === "number");
    if (valid.length) {
      const bounds = new mapboxgl.LngLatBounds();
      valid.forEach((s) => bounds.extend([s.lng, s.lat]));
      mapRef.current.fitBounds(bounds, {
        padding: { top: 60, bottom: padRef.current + 40, left: 60, right: 60 },
        maxZoom: 4, duration: 800,
      });
    } else {
      mapRef.current.flyTo({ center: [10, 30], zoom: 1.5, duration: 800 });
    }
  };

  return (
    <div className="map-section">
      <div ref={containerRef} className="map-container" />
      {error && <div className="map-loading">{error}</div>}
      <button className="map-reset-btn" onClick={resetView} aria-label="Reset map view"
        title="Zoom out to see all stays">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10"/>
          <path d="M2 12h20"/>
          <path d="M12 2a15 15 0 010 20"/>
          <path d="M12 2a15 15 0 000 20"/>
        </svg>
      </button>
      <div className="map-legend">
        <span className="legend-item"><span className="legend-dot" style={{ background: "#64748B" }} /> Past</span>
        <span className="legend-item"><span className="legend-dot" style={{ background: "#3DD68C", boxShadow: "0 0 6px #3DD68C80" }} /> Next up</span>
        <span className="legend-item"><span className="legend-dot" style={{ background: "#3DD68C", opacity: 0.4 }} /> Later</span>
      </div>
    </div>
  );
}

function esc(s) { return String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])); }
