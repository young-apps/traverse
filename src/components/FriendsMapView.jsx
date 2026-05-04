// FriendsMapView — interactive map of every opted-in friend's stays.
//
// Privacy model is unchanged: only friends who toggled
// `shareStaysWithFriends` ON in their profile show up here. We rely on
// the upstream `friendStays` map (keyed by friendUid → { stays, shared })
// that Explore already loads, so this view does no extra Firestore reads.
//
// "City level, not address level": we deliberately don't drop a pin at
// each hotel's exact lat/lng. Instead we cluster stays by their metro
// area (falling back to city) and place a single marker at the
// *centroid* of that cluster's coordinates. This is friendlier — friends
// know what city someone's heading to, not which boutique they booked.
//
// Click a city marker → popup that lists which friends are going there,
// with their next upcoming stay date or their most recent past visit.

import { useEffect, useRef, useState } from "react";
// Same Mapbox CSP-worker pattern as MapView.jsx — see those comments
// for why the regular esm build silently fails in WKWebView.
import mapboxgl from "mapbox-gl/dist/mapbox-gl-csp";
import MapboxWorker from "mapbox-gl/dist/mapbox-gl-csp-worker?worker&inline";
mapboxgl.workerClass = MapboxWorker;
import "mapbox-gl/dist/mapbox-gl.css";

const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_TOKEN;
mapboxgl.accessToken = MAPBOX_TOKEN;

const SOURCE = "friend-cities";

const fmtDate = (d) => d ? new Date(d + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "";

// Bucket every (friend, stay) pair by city. Returns an array of features
// suitable for a Mapbox geojson source. Each feature carries a JSON
// payload of who's visiting so the popup can render without extra props.
function buildCityFeatures(friends, friendStays) {
  const buckets = new Map(); // cityKey -> { lat, lng, count, visits: [{friend, stay}] }
  for (const f of friends) {
    const entry = friendStays?.[f.friendUid];
    const shared = entry && typeof entry === "object" && !Array.isArray(entry) ? entry.shared : true;
    if (!shared) continue;
    const stays = Array.isArray(entry) ? entry : (entry?.stays || []);
    for (const s of stays) {
      if (typeof s.lat !== "number" || typeof s.lng !== "number") continue;
      const city = s.metroArea || s.city || "Unknown";
      const country = s.country || "";
      const key = `${country}::${city}`;
      let b = buckets.get(key);
      if (!b) { b = { city, country, lats: [], lngs: [], visits: [] }; buckets.set(key, b); }
      b.lats.push(s.lat); b.lngs.push(s.lng);
      b.visits.push({
        friendUid: f.friendUid,
        friend: f.displayName || f.email,
        photoURL: f.photoURL || "",
        hotel: s.hotel,
        checkIn: s.checkIn,
        checkOut: s.checkOut,
        status: s.status,
      });
    }
  }
  const features = [];
  for (const b of buckets.values()) {
    const lat = b.lats.reduce((a, c) => a + c, 0) / b.lats.length;
    const lng = b.lngs.reduce((a, c) => a + c, 0) / b.lngs.length;
    const upcoming = b.visits.filter((v) => v.status === "upcoming").length;
    features.push({
      type: "Feature",
      geometry: { type: "Point", coordinates: [lng, lat] },
      properties: {
        city: b.city, country: b.country,
        count: b.visits.length, upcoming,
        // Mapbox geojson properties must be primitives; stringify the
        // visit list and parse on click.
        visits: JSON.stringify(b.visits),
      },
    });
  }
  return features;
}

export default function FriendsMapView({ friends, friendStays }) {
  const containerRef = useRef(null);
  const mapRef = useRef(null);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState(null);

  // Mount the map once. Same pattern + workarounds as MapView.jsx.
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    if (!mapboxgl.accessToken) { setError("Set VITE_MAPBOX_TOKEN in .env"); return; }
    try {
      const map = new mapboxgl.Map({
        container: containerRef.current, style: "mapbox://styles/mapbox/light-v11",
        center: [10, 30], zoom: 1.4, attributionControl: false,
      });
      map.addControl(new mapboxgl.NavigationControl({ showCompass: false }), "bottom-right");
      map.on("error", (e) => console.error("[friends-map]", e?.error?.message || e));

      map.on("load", () => {
        map.addSource(SOURCE, { type: "geojson", data: { type: "FeatureCollection", features: [] } });
        // Past = slate, upcoming = green. We split layers by an
        // "upcoming > 0" property so the bias is toward forward travel.
        map.addLayer({ id: "fr-past", type: "circle", source: SOURCE,
          filter: ["==", ["get", "upcoming"], 0],
          paint: { "circle-radius": ["interpolate", ["linear"], ["get", "count"], 1, 7, 10, 14],
            "circle-color": "#475569", "circle-stroke-width": 2, "circle-stroke-color": "#fff", "circle-opacity": 0.85 } });
        map.addLayer({ id: "fr-upcoming", type: "circle", source: SOURCE,
          filter: [">", ["get", "upcoming"], 0],
          paint: { "circle-radius": ["interpolate", ["linear"], ["get", "count"], 1, 8, 10, 16],
            "circle-color": "#3DD68C", "circle-stroke-width": 2, "circle-stroke-color": "#fff" } });
        // Count label inside the dot when there are 2+ visits.
        map.addLayer({ id: "fr-count", type: "symbol", source: SOURCE,
          filter: [">", ["get", "count"], 1],
          layout: { "text-field": ["get", "count"], "text-font": ["Open Sans Bold", "Arial Unicode MS Bold"], "text-size": 11 },
          paint: { "text-color": "#fff" } });
        setReady(true);
      });

      const popup = new mapboxgl.Popup({ closeButton: true, closeOnClick: true, maxWidth: "300px", offset: 16, className: "traverse-popup" });
      const showPopup = (e) => {
        if (!e.features?.length) return;
        const p = e.features[0].properties;
        const coords = e.features[0].geometry.coordinates.slice();
        const visits = JSON.parse(p.visits || "[]");
        // Prefer upcoming first, then most recent past, max 6.
        visits.sort((a, b) => {
          if (a.status !== b.status) return a.status === "upcoming" ? -1 : 1;
          return new Date(b.checkIn) - new Date(a.checkIn);
        });
        const rows = visits.slice(0, 6).map((v) => `
          <div class="fpop-row ${v.status === "upcoming" ? "upcoming" : ""}">
            <div class="fpop-friend">${esc(v.friend)}</div>
            <div class="fpop-meta">${esc(v.hotel || "")} · ${fmtDate(v.checkIn)}${v.status === "upcoming" ? " · Upcoming" : ""}</div>
          </div>
        `).join("");
        popup.setLngLat(coords).setHTML(`
          <div class="popup-card">
            <div class="popup-hotel">${esc(p.city)}</div>
            <div class="popup-city">${esc(p.country)} · ${p.count} ${p.count == 1 ? "visit" : "visits"}</div>
            ${rows}
            ${visits.length > 6 ? `<div class="fpop-more">+${visits.length - 6} more</div>` : ""}
          </div>
        `).addTo(map);
      };
      ["fr-past", "fr-upcoming", "fr-count"].forEach((layer) => {
        map.on("click", layer, showPopup);
        map.on("mouseenter", layer, () => map.getCanvas().style.cursor = "pointer");
        map.on("mouseleave", layer, () => map.getCanvas().style.cursor = "");
      });

      mapRef.current = map;
    } catch (e) { console.error(e); setError("Map failed to load"); }
    return () => { if (mapRef.current) { mapRef.current.remove(); mapRef.current = null; } };
  }, []);

  // Push features whenever friends or shared stays change.
  useEffect(() => {
    if (!mapRef.current || !ready) return;
    const features = buildCityFeatures(friends, friendStays);
    const src = mapRef.current.getSource(SOURCE);
    if (src) src.setData({ type: "FeatureCollection", features });
    // Auto-fit when we have something to show.
    if (features.length) {
      const bounds = new mapboxgl.LngLatBounds();
      features.forEach((f) => bounds.extend(f.geometry.coordinates));
      mapRef.current.fitBounds(bounds, { padding: 60, maxZoom: 4, duration: 600 });
    }
  }, [friends, friendStays, ready]);

  // Count helpers for the empty-state copy.
  const sharedFriends = friends.filter((f) => {
    const entry = friendStays?.[f.friendUid];
    const shared = entry && typeof entry === "object" && !Array.isArray(entry) ? entry.shared : true;
    return shared && (Array.isArray(entry) ? entry.length : (entry?.stays?.length || 0)) > 0;
  });

  return (
    <div className="friends-map-wrap">
      <div ref={containerRef} className="friends-map" />
      {error && <div className="map-loading">{error}</div>}
      <div className="friends-map-legend">
        <span className="legend-item"><span className="legend-dot" style={{ background: "#3DD68C" }} /> Upcoming</span>
        <span className="legend-item"><span className="legend-dot" style={{ background: "#475569" }} /> Past</span>
        <span className="legend-item friends-map-count">{sharedFriends.length} sharing</span>
      </div>
      {!error && sharedFriends.length === 0 && (
        <div className="friends-map-empty">
          <div style={{ font: "italic 14px var(--font-display)", color: "var(--text-dim)", marginBottom: 6 }}>No friends sharing yet</div>
          <div style={{ font: "12px var(--font-sans)", color: "var(--text-dim)", maxWidth: 280, textAlign: "center" }}>
            Friends only appear here once they turn on stay sharing in their own privacy settings.
          </div>
        </div>
      )}
    </div>
  );
}

function esc(s) { return String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])); }
