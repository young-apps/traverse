// City-level geocoding via Mapbox.
//
// Used for "home" stays where the user is staying with friends/family
// and we don't want a Google Places hotel search. We geocode "City,
// Country" -> centroid lat/lng so the stay still pins on the map.
//
// Mapbox Geocoding is free up to 100K requests/month on the same
// public token used by MapView, so no extra setup or billing.
//
// Cache: keyed by lower-cased "city|country" in localStorage. Once
// resolved, never refetched (city centroids do not move).

const TOKEN = import.meta.env.VITE_MAPBOX_TOKEN;
const STORAGE_KEY = "geocode_city_v1";

function loadCache() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}"); }
  catch { return {}; }
}
function saveCache(c) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(c)); } catch {}
}

/**
 * Resolve "City, Country" to { lat, lng, city, country, placeName } or null.
 * Returns null when the geocoder finds no result or fails.
 */
export async function geocodeCity(city, country) {
  const c = (city || "").trim();
  const cy = (country || "").trim();
  if (!c) return null;
  if (!TOKEN) {
    console.warn("[geocode] VITE_MAPBOX_TOKEN missing");
    return null;
  }

  const key = `${c}|${cy}`.toLowerCase();
  const cache = loadCache();
  if (cache[key]) return cache[key];

  try {
    const q = encodeURIComponent(cy ? `${c}, ${cy}` : c);
    const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${q}.json?types=place,locality,district&limit=1&access_token=${TOKEN}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`geocode ${res.status}`);
    const data = await res.json();
    const f = data?.features?.[0];
    if (!f) return null;
    // Mapbox returns center as [lng, lat]. Normalize city/country from
    // the result so misspellings get corrected automatically.
    const ctx = f.context || [];
    const countryFromCtx = ctx.find((x) => (x.id || "").startsWith("country"))?.text || cy;
    const result = {
      lat: f.center[1],
      lng: f.center[0],
      city: f.text || c,
      country: countryFromCtx || cy,
      placeName: f.place_name || `${c}, ${cy}`,
    };
    cache[key] = result;
    saveCache(cache);
    return result;
  } catch (e) {
    console.warn("[geocode] failed", c, cy, e?.message || e);
    return null;
  }
}
