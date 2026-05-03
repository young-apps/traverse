// StayList — clear sections, Flighty-like filter chips
import { useState, useMemo } from "react";
import StayCard from "./StayCard";

export default function StayList({ stays, selectedId, onSelect, onDelete, onAdd, onEdit }) {
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");
  // "smart" (default) -> upcoming ascending (soonest first) + past
  // descending (most recent first). One global sort puts those in the
  // wrong order for one of the two sections, so we sort each section
  // independently below.
  const [sortBy, setSortBy] = useState("smart");

  const filtered = useMemo(() => {
    let list = [...stays];
    if (filter === "upcoming") list = list.filter((s) => s.status === "upcoming");
    if (filter === "past") list = list.filter((s) => s.status === "past");
    if (search) { const q = search.toLowerCase(); list = list.filter((s) => s.hotel?.toLowerCase().includes(q) || s.city?.toLowerCase().includes(q) || s.country?.toLowerCase().includes(q)); }
    return list;
  }, [stays, search, filter]);

  const sortStays = (arr, kind /* "upcoming" | "past" */) => {
    const a = [...arr];
    if (sortBy === "rating") return a.sort((x, y) => (y.rating || 0) - (x.rating || 0));
    if (sortBy === "nights") return a.sort((x, y) => (y.nights || 0) - (x.nights || 0));
    if (sortBy === "date-asc") return a.sort((x, y) => new Date(x.checkIn) - new Date(y.checkIn));
    if (sortBy === "date-desc") return a.sort((x, y) => new Date(y.checkIn) - new Date(x.checkIn));
    // smart: upcoming asc, past desc
    return kind === "upcoming"
      ? a.sort((x, y) => new Date(x.checkIn) - new Date(y.checkIn))
      : a.sort((x, y) => new Date(y.checkIn) - new Date(x.checkIn));
  };

  const upcoming = sortStays(filtered.filter((s) => s.status === "upcoming"), "upcoming");
  const past = sortStays(filtered.filter((s) => s.status === "past"), "past");

  return (
    <div className="stays-page">
      {/* Search */}
      <div className="stays-search-wrap">
        <svg className="stays-search-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" /></svg>
        <input className="stays-search" placeholder="Search hotels, cities…" value={search} onChange={(e) => setSearch(e.target.value)} />
      </div>

      {/* Filter chips */}
      <div className="stays-filters">
        {[
          { v: "all", l: `All ${stays.length}` },
          { v: "upcoming", l: `Upcoming ${stays.filter((s) => s.status === "upcoming").length}` },
          { v: "past", l: `Past ${stays.filter((s) => s.status === "past").length}` },
        ].map((f) => (
          <button key={f.v} className={`filter-chip ${filter === f.v ? "active" : ""}`} onClick={() => setFilter(f.v)}>{f.l}</button>
        ))}
        <select className="sort-select" value={sortBy} onChange={(e) => setSortBy(e.target.value)}>
          <option value="smart">Default</option>
          <option value="date-desc">Newest</option>
          <option value="date-asc">Oldest</option>
          <option value="rating">Rating</option>
          <option value="nights">Nights</option>
        </select>
      </div>

      {/* Sectioned list */}
      {filter === "all" && upcoming.length > 0 && (
        <div className="stay-section">
          <div className="stay-section-header upcoming">Upcoming · {upcoming.length}</div>
          {upcoming.map((s) => <StayCard key={s.id} stay={s} isSelected={selectedId === s.id} onSelect={onSelect} onDelete={onDelete} onEdit={onEdit} />)}
        </div>
      )}

      {(() => {
        // When the user picks the Upcoming or Past chip we render only that
        // already-sorted section; in "all" we render past below upcoming.
        const list = filter === "upcoming" ? upcoming : filter === "past" ? past : past;
        if (!list.length) return null;
        return (
          <div className="stay-section">
            {filter === "all" && past.length > 0 && <div className="stay-section-header past">Past · {past.length}</div>}
            {list.map((s) => <StayCard key={s.id} stay={s} isSelected={selectedId === s.id} onSelect={onSelect} onDelete={onDelete} onEdit={onEdit} />)}
          </div>
        );
      })()}

      {filtered.length === 0 && <div className="empty-state">{stays.length === 0 ? "No stays yet" : "No stays match your search"}</div>}
    </div>
  );
}
