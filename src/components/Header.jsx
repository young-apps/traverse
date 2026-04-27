import { useState, useEffect, useRef } from "react";
import { signOut } from "../services/auth";
import { deleteAccount } from "../services/account";

export default function Header({ user, stays }) {
  const [open, setOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const ref = useRef(null);
  useEffect(() => { const h = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); }; document.addEventListener("mousedown", h); return () => document.removeEventListener("mousedown", h); }, []);

  const past = stays.filter((s) => s.status === "past");
  const nights = past.reduce((s, r) => s + (r.nights || 0), 0);
  const cities = new Set(stays.map((s) => s.city).filter(Boolean)).size;
  const countries = new Set(stays.map((s) => s.country).filter(Boolean)).size;

  const handleDelete = async () => {
    const confirmed = window.confirm(
      "Delete your account?\n\nThis will permanently erase all your stays, friends, and account data. This cannot be undone."
    );
    if (!confirmed) return;
    setDeleting(true);
    try {
      await deleteAccount();
      // After delete, Firebase auto-signs out; the app will return to the auth screen.
    } catch (e) {
      console.error("Account deletion failed:", e);
      alert("Couldn't delete your account: " + (e.message || "unknown error") + "\n\nPlease try again or contact support.");
      setDeleting(false);
    }
  };

  return (
    <header className="header">
      <div className="header-row">
        <div className="brand-mark">Traverse</div>
        <div ref={ref} style={{ position: "relative" }}>
          <button className="user-menu-btn" onClick={() => setOpen((v) => !v)}>
            <div className="user-avatar">
              {user.photoURL ? <img src={user.photoURL} alt="" /> : (user.displayName || user.email || "?").charAt(0)}
            </div>
          </button>
          {open && (
            <div className="user-menu-dropdown">
              <div className="user-menu-info">
                <div className="user-menu-name">{user.displayName || "Signed in"}</div>
                <div className="user-menu-email">{user.email}</div>
              </div>
              <a className="user-menu-item" href="/privacy.html" target="_blank" rel="noopener noreferrer" onClick={() => setOpen(false)}>
                Privacy policy
              </a>
              <button className="user-menu-item" onClick={async () => { setOpen(false); await signOut(); }}>
                Sign out
              </button>
              <button className="user-menu-item danger" disabled={deleting} onClick={handleDelete}>
                {deleting ? "Deleting…" : "Delete account"}
              </button>
            </div>
          )}
        </div>
      </div>
      {/* Compact inline stats — no wrapping */}
      <div className="stats-inline">
        <span><b>{stays.length}</b> stays</span>
        <span className="stats-dot">·</span>
        <span><b>{cities}</b> cities</span>
        <span className="stats-dot">·</span>
        <span><b>{countries}</b> countries</span>
        <span className="stats-dot">·</span>
        <span><b>{nights}</b> nights</span>
      </div>
    </header>
  );
}
