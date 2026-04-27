// StayList — clear sections, Flighty-like filter chips
import { useState, useMemo } from "react";
import StayCard from "./StayCard";

export default function StayList({ stays, selectedId, onSelect, onDelete, onAdd, onEdit }) {
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");
  const [sortBy, setSortBy] = useState("date-desc");

  const filtered = useMemo(() => {
    let list = [...stays];
    if (filter === "upcoming") list = list.filter((s) => s.status === "upcoming");
    if (filter === "past") list = list.filter((s) => s.status === "past");
    if (search) { const q = search.toLowerCase(); list = list.filter((s) => s.hotel?.toLowerCase().includes(q) || s.city?.toLowerCase().includes(q) || s.country?.toLowerCase().includes(q)); }
    if (sortBy === "date-desc") list.sort((a, b) => new Date(b.checkIn) - new Date(a.checkIn));
    if (sortBy === "date-asc") list.sort((a, b) => new Date(a.checkIn) - new Date(b.checkIn));
    if (sortBy === "rating") list.sort((a, b) => (b.rating || 0) - (a.rating || 0));
    if (sortBy === "nights") list.sort((a, b) => (b.nights || 0) - (a.nights || 0));
    return list;
  }, [stays, search, filter, sortBy]);

  const upcoming = filtered.filter((s) => s.status === "upcoming");
  const past = filtered.filter((s) => s.status === "past");

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

      {(filter === "all" ? past : filtered.filter((s) => filter === "upcoming" ? s.status === "upcoming" : filter === "past" ? s.status === "past" : true)).length > 0 && (
        <div className="stay-section">
          {filter === "all" && past.length > 0 && <div className="stay-section-header past">Past · {past.length}</div>}
          {(filter === "all" ? past : filtered).map((s) => <StayCard key={s.id} stay={s} isSelected={selectedId === s.id} onSelect={onSelect} onDelete={onDelete} onEdit={onEdit} />)}
        </div>
      )}

      {filtered.length === 0 && <div className="empty-state">{stays.length === 0 ? "No stays yet" : "No stays match your search"}</div>}
    </div>
  );
}
