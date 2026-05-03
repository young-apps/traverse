// Google Places API (New) — Text Search for hotels
//
// Key restriction notes:
//  - "iOS apps" restriction is verified by Google via the
//    X-Ios-Bundle-Identifier header. The Places SDK adds it for you;
//    a raw fetch() from a WebView does NOT — so we add it manually
//    below, otherwise the App Store build gets PERMISSION_DENIED even
//    when the bundle ID is allowlisted.
//  - "HTTP referrers" restriction must include capacitor://localhost/*
//    AND https://localhost/* AND your dev origin (e.g. http://localhost:5173/*).
//
// Either restriction works for us — we send the bundle id header on
// native so iOS-app restrictions pass. The Referer header is set
// automatically by the WebView.

import { Capacitor } from "@capacitor/core";

// A single GCP API key can only have ONE application restriction
// (HTTP referrers OR iOS apps, not both), so we ship two keys and
// pick by surface at runtime. Each key falls back to the legacy
// VITE_GOOGLE_PLACES_KEY so a half-configured env still boots:
//  - Native (Capacitor / TestFlight): iOS-restricted key
//  - Browser (Vercel / local dev):    HTTP-referrer-restricted key
// If only the legacy key is set, both surfaces use it (works fine
// as long as the key has the right restriction for the surface
// you're testing).
const LEGACY_KEY = import.meta.env.VITE_GOOGLE_PLACES_KEY;
const IOS_KEY = import.meta.env.VITE_GOOGLE_PLACES_KEY_IOS || LEGACY_KEY;
const WEB_KEY = import.meta.env.VITE_GOOGLE_PLACES_KEY_WEB || LEGACY_KEY;
const PLACES_KEY = Capacitor.isNativePlatform() ? IOS_KEY : WEB_KEY;
const ENDPOINT = "https://places.googleapis.com/v1/places:searchText";
const IOS_BUNDLE_ID = "com.youngapps.traverse";

// Surface which key surface is active so the in-app diag panel can
// show it. Helps diagnose "why does search work in browser but not
// on device" without needing Web Inspector.
console.log(
  "[places] surface=%s key=%s",
  Capacitor.isNativePlatform() ? "ios" : "web",
  PLACES_KEY ? `${PLACES_KEY.slice(0, 6)}…` : "(none)"
);

/**
 * Search hotels by free-text query.
 * Returns array of { name, city, country, lat, lng, address, rating, placeId }.
 */
export async function searchHotels(query) {
  if (!PLACES_KEY) {
    console.warn("Google Places API key not set — see .env.example");
    return [];
  }
  if (!query || query.length < 3) return [];

  const headers = {
    "Content-Type": "application/json",
    "X-Goog-Api-Key": PLACES_KEY,
    "X-Goog-FieldMask":
      "places.id,places.displayName,places.formattedAddress,places.location,places.rating,places.addressComponents,places.photos.name",
  };
  // On native iOS, advertise the bundle ID so Google's "iOS apps" key
  // restriction validates this request. Browsers ignore the header.
  if (Capacitor.isNativePlatform()) headers["X-Ios-Bundle-Identifier"] = IOS_BUNDLE_ID;

  try {
    const response = await fetch(ENDPOINT, {
      method: "POST",
      headers,
      body: JSON.stringify({
        textQuery: query,
        includedType: "lodging",
        maxResultCount: 8,
      }),
    });

    if (!response.ok) {
      const body = await response.text();
      console.error("[places] API error", response.status, body);
      // Throw so the caller (AddStayModal) can surface a real error to
      // the user instead of an empty results list.
      throw new Error(`Places ${response.status}: ${body.slice(0, 240)}`);
    }

    const data = await response.json();
    return (data.places || []).map(normalizePlace);
  } catch (error) {
    console.error("[places] search failed", error);
    throw error;
  }
}

function normalizePlace(place) {
  // Extract city / country from address components
  let city = "";
  let country = "";
  for (const comp of place.addressComponents || []) {
    if (comp.types?.includes("locality")) city = comp.longText;
    else if (comp.types?.includes("administrative_area_level_1") && !city) city = comp.longText;
    else if (comp.types?.includes("country")) country = comp.longText;
  }

  return {
    placeId: place.id,
    name: place.displayName?.text || "Unknown Hotel",
    address: place.formattedAddress || "",
    lat: place.location?.latitude || 0,
    lng: place.location?.longitude || 0,
    rating: place.rating || null,
    photoName: place.photos?.[0]?.name || null,
    city,
    country,
  };
}
