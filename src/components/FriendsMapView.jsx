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
import MapDiag, { isMapDiagEnabled } from "./MapDiag";
// Shared mapbox-gl module — single workerClass + accessToken across
// the whole app. Importing mapbox-gl in two files with `?worker&inline`
// in each was the bug: Vite created TWO worker classes, and whichever
// component initialized last clobbered the previous one's worker —
// the older map kept running but its tile worker had been replaced
// with a class it didn't know about, so requests silently never
// rendered. See services/mapbox.js.
import mapboxgl, { MAPBOX_STYLE_LIGHT, whenSized } from "../services/mapbox";

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
  // Re-render when the map instance is set, so MapDiag receives it.
  const [mapInstance, setMapInstance] = useState(null);
  const diagOn = isMapDiagEnabled();

  // Mount the map once. Defer construction until the container has
  // real pixel dimensions — mapbox-gl creates a 0×0 GL canvas if the
  // container is unsized at construction time, never fires `load`,
  // and a later resize() doesn't always recover on iOS WebView.
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    if (!mapboxgl.accessToken) { setError("Set VITE_MAPBOX_TOKEN in .env"); return; }
    let cancelled = false;
    whenSized(containerRef.current).then((r) => {
      if (cancelled || !containerRef.current || mapRef.current) return;
      console.log("[friends-map] init", r.width, "×", r.height);
      const map = new mapboxgl.Map({
        container: containerRef.current, style: MAPBOX_STYLE_LIGHT,
        center: [10, 30], zoom: 1.4, attributionControl: false,
      });
      map.addControl(new mapboxgl.NavigationControl({ showCompass: false }), "bottom-right");
      map.on("error", (e) => console.error("[friends-map]", e?.error?.message || e));

      map.on("load", () => {
        // iOS WKWebView fix: on Capacitor builds the GL drawing buffer
        // is sometimes locked at 0×0 even when the CSS box has size,
        // because layout commits AFTER mapbox samples devicePixelRatio
        // and getBoundingClientRect during canvas creation. Symptom:
        // style + glyphs + iconset all 200, but ZERO vector tile fetches
        // because the painter thinks viewport area is zero.
        //
        // Fix: poll for the next ~2 seconds — whenever the CSS box and
        // GL drawing buffer disagree, force a resize + repaint. Bails
        // as soon as they match for two consecutive ticks.
        const reconcile = () => {
          const el = containerRef.current;
          if (!el || !map || map._removed) return false;
          const r = el.getBoundingClientRect();
          const c = map.getCanvas();
          const dpr = window.devicePixelRatio || 1;
          const expectedW = Math.round(r.width * dpr);
          const expectedH = Math.round(r.height * dpr);
          if (c.width !== expectedW || c.height !== expectedH) {
            map.resize();
            map.triggerRepaint();
            return false;
          }
          return true;
        };
        let stable = 0;
        const id = setInterval(() => {
          if (reconcile()) stable++; else stable = 0;
          if (stable >= 2) clearInterval(id);
        }, 150);
        // Stop reconciling no matter what after 3s.
        setTimeout(() => clearInterval(id), 3000);
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
      setMapInstance(map);

      // Watch the container for size changes (passport-tabs scrolling
      // in, virtual keyboard, orientation flips) and tell Mapbox to
      // redraw its canvas. Without this the tiles render at the
      // initial size and stay there even after the pane grows.
      const ro = new ResizeObserver(() => { try { map.resize(); } catch {} });
      ro.observe(containerRef.current);
      mapRef.current._ro = ro;
    }).catch((e) => {
      console.error("[friends-map] init failed", e);
      setError("Map failed to load");
    });
    return () => {
      cancelled = true;
      if (mapRef.current?._ro) mapRef.current._ro.disconnect();
      if (mapRef.current) { mapRef.current.remove(); mapRef.current = null; }
    };
  }, []);

  // Push features whenever friends or shared stays change. Memoized so
  // the list pane can iterate the same cities without recomputing.
  const [features, setFeatures] = useState([]);
  useEffect(() => {
    const f = buildCityFeatures(friends, friendStays);
    setFeatures(f);
    if (!mapRef.current || !ready) return;
    const src = mapRef.current.getSource(SOURCE);
    if (src) src.setData({ type: "FeatureCollection", features: f });
    if (f.length) {
      const bounds = new mapboxgl.LngLatBounds();
      f.forEach((feat) => bounds.extend(feat.geometry.coordinates));
      mapRef.current.fitBounds(bounds, { padding: 60, maxZoom: 4, duration: 600 });
    }
  }, [friends, friendStays, ready]);

  const flyToCity = (feature) => {
    if (!mapRef.current) return;
    mapRef.current.flyTo({ center: feature.geometry.coordinates, zoom: 8, duration: 1000 });
  };

  const resetView = () => {
    if (!mapRef.current) return;
    if (features.length) {
      const bounds = new mapboxgl.LngLatBounds();
      features.forEach((f) => bounds.extend(f.geometry.coordinates));
      mapRef.current.fitBounds(bounds, { padding: 60, maxZoom: 4, duration: 800 });
    } else {
      mapRef.current.flyTo({ center: [10, 30], zoom: 1.5, duration: 800 });
    }
  };

  // Count helpers for the empty-state copy.
  const sharedFriends = friends.filter((f) => {
    const entry = friendStays?.[f.friendUid];
    const shared = entry && typeof entry === "object" && !Array.isArray(entry) ? entry.shared : true;
    return shared && (Array.isArray(entry) ? entry.length : (entry?.stays?.length || 0)) > 0;
  });

  // Sort cities for the list pane: any with upcoming visits first
  // (soonest checkIn ascending), then past-only by most recent.
  const cityRows = [...features].sort((a, b) => {
    const aUp = a.properties.upcoming, bUp = b.properties.upcoming;
    if ((aUp > 0) !== (bUp > 0)) return bUp - aUp;
    const aVisits = JSON.parse(a.properties.visits);
    const bVisits = JSON.parse(b.properties.visits);
    const aSoonest = aVisits.filter((v) => v.status === "upcoming").map((v) => v.checkIn).sort()[0] || "";
    const bSoonest = bVisits.filter((v) => v.status === "upcoming").map((v) => v.checkIn).sort()[0] || "";
    if (aSoonest && bSoonest) return aSoonest.localeCompare(bSoonest);
    if (aSoonest) return -1;
    if (bSoonest) return 1;
    const aLatest = aVisits.map((v) => v.checkIn).sort().slice(-1)[0] || "";
    const bLatest = bVisits.map((v) => v.checkIn).sort().slice(-1)[0] || "";
    return bLatest.localeCompare(aLatest);
  });

  return (
    // Inline-style sizing as a hard contract: stale CDN CSS or any
    // future class-based override can't make this collapse to 0 px,
    // because element-style beats every author-stylesheet rule short
    // of !important. The map pane gets a fixed 60dvh slice, the list
    // pane gets the rest, and the parent enforces a 480 px floor so
    // landscape phones don't squash either pane to nothing.
    <div className="friends-map-split" style={{ display: "flex", flexDirection: "column", minHeight: 480, height: "calc(100dvh - 168px)", overflow: "hidden" }}>
      <div className="map-home-pane map-pane" style={{ flex: "1 1 auto", minHeight: 280, position: "relative" }}>
        <div ref={containerRef} className="friends-map" style={{ position: "absolute", inset: 0 }} />
        {error && <div className="map-loading">{error}</div>}
        {diagOn && <MapDiag map={mapInstance} container={containerRef.current} label="friends-map" />}
        <button className="map-reset-btn" onClick={resetView} aria-label="Reset map view"
          title="Zoom out to see all friends">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10"/><path d="M2 12h20"/><path d="M12 2a15 15 0 010 20"/><path d="M12 2a15 15 0 000 20"/>
          </svg>
        </button>
        <div className="map-legend friends-map-legend">
          <span className="legend-item"><span className="legend-dot" style={{ background: "#3DD68C" }} /> Upcoming</span>
          <span className="legend-item"><span className="legend-dot" style={{ background: "#475569" }} /> Past</span>
          <span className="legend-item friends-map-count">{sharedFriends.length} sharing</span>
        </div>
      </div>

      <div className="map-home-pane list-pane" style={{ flex: "0 1 auto", minHeight: 180, maxHeight: "50%", overflowY: "auto", display: "flex", flexDirection: "column" }}>
        <div className="split-list-head">
          <div className="split-list-title">
            {features.length > 0
              ? `${features.length} ${features.length === 1 ? "city" : "cities"} · ${sharedFriends.length} sharing`
              : "Friends Map"}
          </div>
        </div>

        <div className="split-list-body">
          {features.length === 0 ? (
            <div style={{ padding: "32px 20px", textAlign: "center" }}>
              <div style={{ font: "italic 14px var(--font-display)", color: "var(--text-dim)", marginBottom: 6 }}>
                {friends.length === 0 ? "No friends yet" : "Nothing to show yet"}
              </div>
              <div style={{ font: "12px/1.5 var(--font-sans)", color: "var(--text-dim)", maxWidth: 320, margin: "0 auto" }}>
                {friends.length === 0
                  ? "Add friends from the Friends tab — once they accept and turn on stay sharing, their cities will pin here."
                  : "Your friends haven't turned on stay sharing yet. Each friend opts in from their own privacy settings."}
              </div>
            </div>
          ) : (
            <div className="friend-city-list">
              {cityRows.map((feat) => {
                const p = feat.properties;
                const visits = JSON.parse(p.visits);
                const upcomingVisits = visits.filter((v) => v.status === "upcoming");
                return (
                  <button key={`${p.country}-${p.city}`} className="friend-city-row"
                    onClick={() => flyToCity(feat)}>
                    <span className={`friend-city-dot ${p.upcoming > 0 ? "up" : "past"}`} />
                    <div style={{ flex: 1, minWidth: 0, textAlign: "left" }}>
                      <div className="friend-city-name">{p.city}</div>
                      <div className="friend-city-meta">
                        {p.country} · {visits.length} {visits.length === 1 ? "visit" : "visits"}
                        {upcomingVisits.length > 0 && (
                          <span className="friend-city-up"> · {upcomingVisits.length} upcoming</span>
                        )}
                      </div>
                      <div className="friend-city-friends">
                        {[...new Set(visits.map((v) => v.friend))].slice(0, 3).join(", ")}
                        {[...new Set(visits.map((v) => v.friend))].length > 3 && ` +${[...new Set(visits.map((v) => v.friend))].length - 3}`}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function esc(s) { return String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])); }
