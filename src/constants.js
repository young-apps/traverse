// Shared data constants for stay fields

export const ROOM_TYPES = [
  "Standard", "Superior", "Deluxe", "Studio", "Junior Suite", "Suite",
  "Executive Suite", "Presidential Suite", "Penthouse",
  "Apartment / Residence", "Villa", "Connecting Room", "Accessible Room", "Day Use",
];

export const BED_TYPES = ["King", "Queen", "Twin", "Double", "2 Queen", "2 Double", "Bunk", "Sofa Bed"];

export const VIEW_TYPES = [
  "City View", "Ocean / Sea View", "Pool View", "Garden View", "Mountain View",
  "River View", "Park View", "High Floor", "Corner Room", "Balcony", "No View",
];

export const CLUB_ACCESS = ["None", "Club Level", "Executive Floor", "Lounge Access", "Concierge Level"];

export const UPGRADE_STATUS = ["None", "Paid Upgrade", "Complimentary Upgrade", "Auto-upgraded", "Points Upgrade"];

export const BOOKING_SOURCES = [
  "Direct", "Amex FHR", "Amex Travel", "Bilt Travel", "Chase Travel", "Capital One Travel",
  "Expedia", "Booking.com", "Hotels.com", "Priceline", "Orbitz", "Travelocity", "Google Hotels",
  "Airbnb", "Vrbo", "Agoda",
  "Marriott Bonvoy", "Hilton Honors", "IHG Rewards", "Hyatt", "World of Hyatt",
  "Virtuoso", "Concur", "Navan", "Corporate Travel",
  "Walk-in / Front Desk", "Other",
];

export const TRIP_PURPOSES = ["Personal", "Work", "Bleisure", "Family", "Event", "Wedding"];

// Currencies supported by Frankfurter (https://www.frankfurter.app/docs/).
// Listed roughly by traveller frequency. Anything outside this list would
// fail the FX call; for ~edge cases (AED, TWD) the user can enter USD.
export const CURRENCIES = [
  "USD", "EUR", "GBP", "JPY", "CAD", "AUD", "CHF", "CNY",
  "MXN", "BRL", "INR", "SGD", "HKD", "ZAR", "NZD", "KRW",
  "THB", "SEK", "NOK", "DKK", "PLN", "TRY", "PHP", "MYR",
  "IDR", "HUF", "CZK", "ILS", "RON", "BGN", "ISK",
];

// ─── Continents ──────────────────────────────────────────────────
// Country -> continent for the Continental Footprint metric. Names match
// what Mapbox geocoding returns (the "country" context text). Aliases
// are listed alongside their canonical so "USA" and "United States" both
// resolve. Coverage skews toward the 80-ish most-travelled countries;
// anything not in the table maps to null and is excluded from footprint
// percentages so we don't make up coverage we can't verify.
//
// Total country counts per continent (denominator) come from the UN
// member-state list:
//   Africa 54, Asia 49, Europe 44, North America 23, South America 12,
//   Oceania 14, Antarctica 0 (no permanent population, excluded).
// These are what the percentages are computed against.
export const CONTINENT_TOTALS = {
  Africa: 54, Asia: 49, Europe: 44,
  "North America": 23, "South America": 12, Oceania: 14,
};
export const COUNTRY_TO_CONTINENT = {
  // North America
  "United States": "North America", "USA": "North America", "United States of America": "North America",
  "Canada": "North America", "Mexico": "North America", "Cuba": "North America",
  "Bahamas": "North America", "Jamaica": "North America", "Dominican Republic": "North America",
  "Costa Rica": "North America", "Panama": "North America", "Guatemala": "North America",
  "Honduras": "North America", "Nicaragua": "North America", "El Salvador": "North America",
  "Belize": "North America", "Haiti": "North America", "Trinidad and Tobago": "North America",
  "Barbados": "North America", "Saint Lucia": "North America",
  // South America
  "Brazil": "South America", "Argentina": "South America", "Chile": "South America",
  "Peru": "South America", "Colombia": "South America", "Ecuador": "South America",
  "Bolivia": "South America", "Uruguay": "South America", "Paraguay": "South America",
  "Venezuela": "South America", "Guyana": "South America", "Suriname": "South America",
  // Europe
  "United Kingdom": "Europe", "UK": "Europe", "England": "Europe", "Scotland": "Europe",
  "Ireland": "Europe", "France": "Europe", "Germany": "Europe", "Italy": "Europe",
  "Spain": "Europe", "Portugal": "Europe", "Netherlands": "Europe", "Belgium": "Europe",
  "Switzerland": "Europe", "Austria": "Europe", "Greece": "Europe", "Turkey": "Europe",
  "Sweden": "Europe", "Norway": "Europe", "Denmark": "Europe", "Finland": "Europe",
  "Iceland": "Europe", "Poland": "Europe", "Czech Republic": "Europe", "Czechia": "Europe",
  "Hungary": "Europe", "Slovakia": "Europe", "Slovenia": "Europe", "Croatia": "Europe",
  "Serbia": "Europe", "Romania": "Europe", "Bulgaria": "Europe", "Ukraine": "Europe",
  "Russia": "Europe", "Estonia": "Europe", "Latvia": "Europe", "Lithuania": "Europe",
  "Luxembourg": "Europe", "Malta": "Europe", "Monaco": "Europe", "Vatican City": "Europe",
  "San Marino": "Europe", "Andorra": "Europe", "Liechtenstein": "Europe", "Albania": "Europe",
  "North Macedonia": "Europe", "Montenegro": "Europe", "Bosnia and Herzegovina": "Europe",
  "Cyprus": "Europe",
  // Asia
  "Japan": "Asia", "China": "Asia", "South Korea": "Asia", "Korea": "Asia",
  "India": "Asia", "Thailand": "Asia", "Vietnam": "Asia", "Singapore": "Asia",
  "Malaysia": "Asia", "Indonesia": "Asia", "Philippines": "Asia", "Hong Kong": "Asia",
  "Taiwan": "Asia", "Cambodia": "Asia", "Laos": "Asia", "Myanmar": "Asia",
  "Sri Lanka": "Asia", "Nepal": "Asia", "Bangladesh": "Asia", "Pakistan": "Asia",
  "United Arab Emirates": "Asia", "UAE": "Asia", "Saudi Arabia": "Asia", "Qatar": "Asia",
  "Israel": "Asia", "Jordan": "Asia", "Lebanon": "Asia", "Oman": "Asia",
  "Bahrain": "Asia", "Kuwait": "Asia", "Iran": "Asia", "Iraq": "Asia",
  "Kazakhstan": "Asia", "Uzbekistan": "Asia", "Mongolia": "Asia", "Maldives": "Asia",
  "Bhutan": "Asia", "Brunei": "Asia",
  // Africa
  "South Africa": "Africa", "Egypt": "Africa", "Morocco": "Africa", "Tunisia": "Africa",
  "Kenya": "Africa", "Tanzania": "Africa", "Ethiopia": "Africa", "Nigeria": "Africa",
  "Ghana": "Africa", "Senegal": "Africa", "Rwanda": "Africa", "Uganda": "Africa",
  "Botswana": "Africa", "Namibia": "Africa", "Zimbabwe": "Africa", "Zambia": "Africa",
  "Mozambique": "Africa", "Madagascar": "Africa", "Mauritius": "Africa", "Seychelles": "Africa",
  // Oceania
  "Australia": "Oceania", "New Zealand": "Oceania", "Fiji": "Oceania",
  "French Polynesia": "Oceania", "Tahiti": "Oceania", "Samoa": "Oceania",
  "Tonga": "Oceania", "Vanuatu": "Oceania", "Papua New Guinea": "Oceania",
};
export function continentFor(country) {
  if (!country) return null;
  return COUNTRY_TO_CONTINENT[country] || COUNTRY_TO_CONTINENT[country.trim()] || null;
}
