// Google Places API (New) — Text Search for hotels
// Uses the modern Places API. Restrict your key by HTTP referrer in
// Google Cloud Console for security (it will still be visible in the
// browser, but only usable from your domain).

const PLACES_KEY = import.meta.env.VITE_GOOGLE_PLACES_KEY;
const ENDPOINT = "https://places.googleapis.com/v1/places:searchText";

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

  try {
    const response = await fetch(ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": PLACES_KEY,
        "X-Goog-FieldMask":
          "places.id,places.displayName,places.formattedAddress,places.location,places.rating,places.addressComponents,places.photos.name",
      },
      body: JSON.stringify({
        textQuery: query,
        includedType: "lodging",
        maxResultCount: 8,
      }),
    });

    if (!response.ok) {
      console.error("Places API error:", response.status, await response.text());
      return [];
    }

    const data = await response.json();
    return (data.places || []).map(normalizePlace);
  } catch (error) {
    console.error("Places search failed:", error);
    return [];
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
