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

const PLACES_KEY = import.meta.env.VITE_GOOGLE_PLACES_KEY;
const ENDPOINT = "https://places.googleapis.com/v1/places:searchText";
const IOS_BUNDLE_ID = "com.youngapps.traverse";

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
