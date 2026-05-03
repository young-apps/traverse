// FX conversion service.
//
// Strategy: convert at booking time (one-shot), store both native and
// USD on the stay document. Stats / leaderboard / wrapped sum the USD
// field. Display can show native.
//
// Backend: Frankfurter (https://www.frankfurter.app/) — free, no key,
// ECB-sourced. Historical rates supported via /YYYY-MM-DD path. Past
// rates are immutable, so we cache them forever in localStorage and
// never refetch. Latest rates cache for 24h.
//
// Cost profile per design ask:
//   - 0 API calls for USD entries
//   - 0 API calls for repeat (date, currency) entries (cache hit)
//   - 1 API call for first stay in a new (date, currency) combo
//
// Failure mode: if the network call fails OR the currency isn't in
// Frankfurter's coverage, we return null and the caller skips the
// USD field. Stats then fall back to native amount, which is still
// useful for personal totals (just not cross-currency-correct).

const STORAGE_KEY = "fx_rate_cache_v1";
const ENDPOINT = "https://api.frankfurter.app";
const STALE_MS = 24 * 60 * 60 * 1000; // 24h for "latest"

function loadCache() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}"); }
  catch { return {}; }
}
function saveCache(cache) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(cache)); } catch {}
}

/**
 * Convert `amount` from `currency` to USD using the rate on `dateStr`
 * (YYYY-MM-DD). Returns { usd, rate, rateDate } or null on failure.
 *
 * For USD, returns immediately with rate=1, no network call.
 */
export async function convertToUSD(amount, currency, dateStr) {
  const num = parseFloat(amount);
  if (!isFinite(num) || num <= 0) return null;
  if (!currency || currency === "USD") {
    return { usd: Math.round(num * 100) / 100, rate: 1, rateDate: dateStr || "" };
  }

  const cache = loadCache();
  const today = new Date().toISOString().slice(0, 10);
  const isHistorical = dateStr && dateStr < today;
  const key = `${isHistorical ? dateStr : "latest"}:${currency}`;
  const hit = cache[key];

  // Historical = cache forever. Latest = cache 24h.
  if (hit && (isHistorical || Date.now() - hit.fetchedAt < STALE_MS)) {
    return { usd: Math.round(num * hit.rate * 100) / 100, rate: hit.rate, rateDate: hit.rateDate };
  }

  try {
    const url = isHistorical
      ? `${ENDPOINT}/${dateStr}?from=${currency}&to=USD`
      : `${ENDPOINT}/latest?from=${currency}&to=USD`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`fx ${res.status}`);
    const data = await res.json();
    const rate = data?.rates?.USD;
    if (!rate || !isFinite(rate)) throw new Error("no USD rate");
    cache[key] = { rate, rateDate: data.date || dateStr || today, fetchedAt: Date.now() };
    saveCache(cache);
    return { usd: Math.round(num * rate * 100) / 100, rate, rateDate: cache[key].rateDate };
  } catch (e) {
    console.warn("[fx] conversion failed", currency, dateStr, e?.message || e);
    return null;
  }
}

// Display helper — native-currency formatting for stay cards.
const SYMBOLS = {
  USD: "$", EUR: "€", GBP: "£", JPY: "¥", CNY: "¥", KRW: "₩", INR: "₹",
  AUD: "A$", CAD: "C$", NZD: "NZ$", HKD: "HK$", SGD: "S$", CHF: "CHF",
  MXN: "MX$", BRL: "R$",
};
export function formatMoney(amount, currency = "USD") {
  if (amount == null) return "";
  const n = Number(amount).toLocaleString();
  const sym = SYMBOLS[currency];
  if (sym) return `${sym}${n}`;
  return `${currency} ${n}`;
}
