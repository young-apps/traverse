// insights.js — derived travel metrics
//
// All exports are pure functions of the user's stays array. No
// network, no Firestore, no React. Easy to unit-test, cheap to call
// per render. Where a metric needs "today", we accept it as a param so
// tests can inject a fixed clock.

import { CONTINENT_TOTALS, continentFor } from "../constants";

// ─── Continental footprint ──────────────────────────────────────
// % of UN-member countries visited per continent. Returns sorted
// entries [{continent, visited, total, pct, countries: [...]}].
// Antarctica is excluded (no permanent population). Footnote in the
// UI explains the country-count denominator.
export function continentalFootprint(stays) {
  const visitedByContinent = {};
  for (const s of stays) {
    const c = continentFor(s.country);
    if (!c) continue;
    if (!visitedByContinent[c]) visitedByContinent[c] = new Set();
    visitedByContinent[c].add(s.country);
  }
  return Object.entries(CONTINENT_TOTALS)
    .map(([continent, total]) => {
      const set = visitedByContinent[continent] || new Set();
      const visited = set.size;
      return { continent, visited, total, pct: total ? (visited / total) * 100 : 0, countries: [...set].sort() };
    })
    .filter((x) => x.visited > 0)
    .sort((a, b) => b.pct - a.pct);
}

// ─── Travel velocity ─────────────────────────────────────────────
// "One stay every N days" — total days span / (count - 1) for past
// stays. Returns null when there are fewer than 2 past stays.
export function travelCadence(stays) {
  const past = stays.filter((s) => s.status === "past" && s.checkIn).slice().sort(
    (a, b) => new Date(a.checkIn) - new Date(b.checkIn)
  );
  if (past.length < 2) return null;
  const first = new Date(past[0].checkIn);
  const last = new Date(past[past.length - 1].checkIn);
  const days = Math.max(1, Math.round((last - first) / 864e5));
  return Math.round(days / (past.length - 1));
}

// ─── Longest streak ──────────────────────────────────────────────
// Longest run of consecutive days where every day was inside some
// stay. Strict: a single day at home breaks the streak. Stays may
// overlap; we union them on a per-day Set.
export function longestStreak(stays) {
  const days = new Set();
  for (const s of stays) {
    if (!s.checkIn || !s.checkOut) continue;
    const start = new Date(s.checkIn + "T00:00:00");
    const end = new Date(s.checkOut + "T00:00:00");
    // checkOut day is the morning of departure -> last *night* away is
    // the day before checkOut. We count nights, not days.
    for (let d = new Date(start); d < end; d.setDate(d.getDate() + 1)) {
      days.add(d.toISOString().slice(0, 10));
    }
  }
  if (!days.size) return 0;
  const sorted = [...days].sort();
  let longest = 1, cur = 1;
  for (let i = 1; i < sorted.length; i++) {
    const prev = new Date(sorted[i - 1] + "T00:00:00");
    const cur_ = new Date(sorted[i] + "T00:00:00");
    const diff = Math.round((cur_ - prev) / 864e5);
    if (diff === 1) { cur += 1; longest = Math.max(longest, cur); }
    else cur = 1;
  }
  return longest;
}

// ─── Lead time (booking habits) ──────────────────────────────────
// Days between when the user logged the stay (createdAt) and the
// check-in date. Returns { avg, median, samples } over stays that
// have a createdAt and a future-dated checkIn at log time.
//
// We deliberately ignore back-logged stays (createdAt > checkIn)
// because they say nothing about how far ahead the user *books* —
// they just mean the user added a past trip retroactively.
export function leadTimeStats(stays) {
  const samples = [];
  for (const s of stays) {
    if (!s.checkIn || !s.createdAt) continue;
    // Firestore Timestamps come through with a .toDate(); raw Dates and
    // ISO strings work too. Normalize.
    const created = s.createdAt?.toDate ? s.createdAt.toDate() : new Date(s.createdAt);
    if (Number.isNaN(+created)) continue;
    const checkIn = new Date(s.checkIn + "T00:00:00");
    const days = Math.round((checkIn - created) / 864e5);
    if (days < 0) continue; // back-logged trip
    samples.push(days);
  }
  if (!samples.length) return null;
  samples.sort((a, b) => a - b);
  const avg = Math.round(samples.reduce((a, b) => a + b, 0) / samples.length);
  const median = samples[Math.floor(samples.length / 2)];
  return { avg, median, samples: samples.length };
}

// ─── Year-over-year nights ───────────────────────────────────────
// Compare nights logged by *today's* day-of-year in the current year
// vs same day-of-year last year. Returns
//   { thisYear, lastYear, diff, currentYear, prevYear }
// or null if there's no comparable data.
export function yoyNightsToDate(stays, today = new Date()) {
  const currentYear = today.getFullYear();
  const prevYear = currentYear - 1;
  const cutoffMD = today.getMonth() * 100 + today.getDate(); // e.g. May 3 -> 403
  const tally = (year) =>
    stays.reduce((sum, s) => {
      if (!s.checkIn) return sum;
      const d = new Date(s.checkIn + "T00:00:00");
      if (d.getFullYear() !== year) return sum;
      const md = d.getMonth() * 100 + d.getDate();
      return md <= cutoffMD ? sum + (s.nights || 0) : sum;
    }, 0);
  const thisYear = tally(currentYear);
  const lastYear = tally(prevYear);
  if (thisYear === 0 && lastYear === 0) return null;
  return { thisYear, lastYear, diff: thisYear - lastYear, currentYear, prevYear };
}
