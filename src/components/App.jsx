// App — Traverse — fixed: no emoji loading, OAuth retry, edit support, restructured nav
import { useState, useEffect, lazy, Suspense } from "react";
import { useAuth } from "../hooks/useAuth";
import { useStays } from "../hooks/useStays";
import { useFriends } from "../hooks/useFriends";
import { addStay, deleteStay, updateStay } from "../services/stays";
import { saveUserProfile, invalidateDirectoryCache } from "../services/friends";
import { cacheHotelPhoto } from "../services/photos";
import { reverseGeocode } from "../services/geocode";
import { requestNotificationPermission, scheduleStayNotifications } from "../services/notifications";
import Auth from "./Auth";
import Header from "./Header";
// MapView lazy-loaded — Mapbox GL spawns a Web Worker at module-eval time
// which iOS WebView treats as cross-origin and throws an opaque "Script
// error :0" that crashes the whole app *before the auth screen renders*.
// Deferring the import means Mapbox doesn't load until a signed-in user
// actually hits the home tab.
const MapView = lazy(() => import("./MapView"));
import StayList from "./StayList";
import StayCard from "./StayCard";
import ScrollContextHeader from "./ScrollContextHeader";
import AddStayModal from "./AddStayModal";
import EditStayModal from "./EditStayModal";
import StatsView from "./StatsView";
import FriendsView from "./FriendsView";
import LeaderboardView from "./LeaderboardView";
import WrappedView from "./WrappedView";
import CalendarView from "./CalendarView";

export default function App() {
  const { user, loading } = useAuth();
  useEffect(() => {
    if (!user) return;
    // Save profile (writes displayNameLower for legacy accounts), then
    // bust the in-memory directory cache so the next friend search sees
    // the freshly-backfilled fields instead of a stale snapshot.
    saveUserProfile(user).then(invalidateDirectoryCache).catch(console.error);
    requestNotificationPermission();
  }, [user]);
  if (loading) return (
    <div className="auth-screen">
      <div className="auth-logo"><div className="auth-logo-dot" /></div>
      <div className="loading-text">Loading…</div>
    </div>
  );
  if (!user) return <Auth />;
  return <Dashboard user={user} />;
}

function Dashboard({ user }) {
  const { stays } = useStays(user.uid);
  const { friends, requests, friendStays, refreshFriendStays } = useFriends(user.uid);
  const [selectedId, setSelectedId] = useState(null);
  const [tab, setTab] = useState("home");
  const [exploreSub, setExploreSub] = useState("calendar");
  const [showAdd, setShowAdd] = useState(false);
  const [editStay, setEditStay] = useState(null);
  const [justAdded, setJustAdded] = useState(null);
  const [celebrate, setCelebrate] = useState(null); // {lat, lng, key} for pin-drop animation

  useEffect(() => { if (stays.length) scheduleStayNotifications(stays); }, [stays]);

  // Soonest upcoming first; most recent past first.
  const upcoming = stays.filter((s) => s.status === "upcoming").sort((a, b) => new Date(a.checkIn) - new Date(b.checkIn));
  const past = stays.filter((s) => s.status === "past").sort((a, b) => new Date(b.checkIn) - new Date(a.checkIn));

  const handleAdd = (data) => {
    const today = new Date().toISOString().split("T")[0];
    const { photoName, ...stayData } = data;
    addStay(user.uid, { ...stayData, status: stayData.checkOut >= today ? "upcoming" : "past" })
      .then((stayId) => {
        setJustAdded(stayData.hotel);
        setTimeout(() => setJustAdded(null), 3000);
        // Trigger pin-drop celebration on the home map.
        if (stayData.lat != null && stayData.lng != null) {
          setCelebrate({ lat: stayData.lat, lng: stayData.lng, key: Date.now() });
          setTab("home");
          setTimeout(() => setCelebrate(null), 3200);
        }
        if (photoName && stayId) {
          cacheHotelPhoto(user.uid, stayId, photoName)
            .then((photoUrl) => { if (photoUrl) updateStay(user.uid, stayId, { photoUrl }); })
            .catch(console.error);
        }
        // Reverse-geocode lat/lng -> metroArea so suburbs like Assago
        // roll up to Milan in city/metro stats. Backfilled async so the
        // optimistic save isn't slowed by the Mapbox round-trip; the
        // onSnapshot listener will re-render once it lands.
        if (stayId && stayData.lat != null && stayData.lng != null) {
          reverseGeocode(stayData.lat, stayData.lng)
            .then((geo) => {
              if (!geo) return;
              const patch = { metroArea: geo.metroArea || null, region: geo.region || null };
              updateStay(user.uid, stayId, patch).catch(console.error);
            })
            .catch(console.error);
        }
      })
      .catch(console.error);
    setShowAdd(false);
  };

  const handleEdit = (stayId, updates) => {
    updateStay(user.uid, stayId, updates).catch(console.error);
    setEditStay(null);
  };

  const handleDelete = (id) => { setSelectedId(null); deleteStay(user.uid, id).catch(console.error); };

  return (
    <div className="app-shell">
      <Header user={user} stays={stays} />

      {justAdded && <div className="toast"><span className="toast-check">✓</span> Added {justAdded}</div>}

      {/* ─── HOME ─── */}
      {tab === "home" && (
        <>
          <Suspense fallback={<div className="loading-text" style={{ padding: 40, textAlign: "center" }}>Loading map…</div>}>
            <MapView stays={stays} selectedId={selectedId} onSelect={setSelectedId} celebrateAt={celebrate} />
          </Suspense>
          <ScrollContextHeader />
          {upcoming.length > 0 && (
            <div className="section">
              <div className="section-title">Upcoming Stays</div>
              {upcoming.slice(0, 3).map((s) => (
                <StayCard key={s.id} stay={s} isSelected={selectedId === s.id}
                  onSelect={(id) => setSelectedId(id === selectedId ? null : id)}
                  onDelete={handleDelete} onEdit={setEditStay} />
              ))}
              {upcoming.length > 3 && <button className="link-btn" onClick={() => setTab("stays")}>View all {upcoming.length} upcoming →</button>}
            </div>
          )}
          {past.length > 0 && (
            <div className="section">
              <div className="section-title" style={{ color: "var(--text-dim)" }}>Recent Stays</div>
              {past.slice(0, 2).map((s) => (
                <StayCard key={s.id} stay={s} isSelected={selectedId === s.id}
                  onSelect={(id) => setSelectedId(id === selectedId ? null : id)}
                  onDelete={handleDelete} onEdit={setEditStay} />
              ))}
              {past.length > 2 && <button className="link-btn" onClick={() => setTab("stays")}>View all {stays.length} stays →</button>}
            </div>
          )}
          {stays.length === 0 && (
            <div className="empty-hero">
              <div style={{ width: 48, height: 48, borderRadius: "50%", background: "var(--accent-muted)", border: "1px solid var(--accent-border)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px" }}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="1.8"><path d="M3 21V7l9-4 9 4v14"/><path d="M9 21v-4h6v4"/></svg>
              </div>
              <div className="empty-title">Track your hotel journey</div>
              <div className="empty-sub">Log your first stay to build your passport with stats, maps, and a history of everywhere you've been.</div>
              <button className="btn-primary btn-lg" onClick={() => setShowAdd(true)}>+ Log Your First Stay</button>
            </div>
          )}
        </>
      )}

      {/* ─── MY STAYS ─── */}
      {tab === "stays" && (
        <>
          <ScrollContextHeader />
          <StayList stays={stays} selectedId={selectedId}
            onSelect={(id) => setSelectedId(id === selectedId ? null : id)}
            onDelete={handleDelete} onAdd={() => setShowAdd(true)} onEdit={setEditStay} />
        </>
      )}

      {/* ─── INSIGHTS ─── */}
      {tab === "insights" && <StatsView stays={stays} />}

      {/* ─── EXPLORE ─── */}
      {tab === "explore" && (
        <>
          <div className="passport-tabs">
            {[
              { id: "calendar", label: "Calendar" },
              { id: "friends", label: `Friends${requests.length > 0 ? " ●" : ""}` },
              { id: "ranks", label: "Ranks" },
              { id: "wrapped", label: "Wrapped" },
            ].map((t) => (
              <button key={t.id} className={`passport-tab ${exploreSub === t.id ? "active" : ""}`}
                onClick={() => setExploreSub(t.id)}>{t.label}</button>
            ))}
          </div>
          {exploreSub === "calendar" && <CalendarView stays={stays} />}
          {exploreSub === "friends" && <FriendsView user={user} friends={friends} requests={requests} friendStays={friendStays} onRefresh={refreshFriendStays} />}
          {exploreSub === "ranks" && <LeaderboardView user={user} stays={stays} friends={friends} friendStays={friendStays} />}
          {exploreSub === "wrapped" && <WrappedView user={user} stays={stays} />}
        </>
      )}

      {/* ─── BOTTOM NAV ─── */}
      <nav className="bottom-nav">
        <button className={`nav-item ${tab === "home" ? "active" : ""}`} onClick={() => setTab("home")}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2V9z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
          <span>Home</span>
        </button>
        <button className={`nav-item ${tab === "stays" ? "active" : ""}`} onClick={() => setTab("stays")}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
          <span>My Stays</span>
        </button>
        <button className="fab" onClick={() => setShowAdd(true)}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
        </button>
        <button className={`nav-item ${tab === "insights" ? "active" : ""}`} onClick={() => setTab("insights")}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>
          <span>Insights</span>
        </button>
        <button className={`nav-item ${tab === "explore" ? "active" : ""}`} onClick={() => setTab("explore")}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><circle cx="12" cy="12" r="10"/><polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76"/></svg>
          <span>Explore</span>
        </button>
      </nav>

      {showAdd && <AddStayModal onClose={() => setShowAdd(false)} onAdd={handleAdd} />}
      {editStay && <EditStayModal stay={editStay} onClose={() => setEditStay(null)} onSave={handleEdit} />}
    </div>
  );
}
