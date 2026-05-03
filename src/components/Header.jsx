import { useState, useEffect, useRef } from "react";
import { signOut } from "../services/auth";
import { deleteAccount } from "../services/account";
import { TERMS_URL, openExternal } from "../services/links";
import DiagPanel from "./DiagPanel";

export default function Header({ user, stays }) {
  const [open, setOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [diag, setDiag] = useState(false);
  const tapsRef = useRef({ count: 0, last: 0 });
  const ref = useRef(null);

  // Tap the brand mark 5 times within 3s to open the diagnostic panel.
  // No menu, no build flag — works on TestFlight/App Store.
  const handleBrandTap = () => {
    const now = Date.now();
    const t = tapsRef.current;
    t.count = now - t.last < 3000 ? t.count + 1 : 1;
    t.last = now;
    if (t.count >= 5) { t.count = 0; setDiag(true); }
  };
  useEffect(() => { const h = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); }; document.addEventListener("mousedown", h); return () => document.removeEventListener("mousedown", h); }, []);

  const past = stays.filter((s) => s.status === "past");
  const nights = past.reduce((s, r) => s + (r.nights || 0), 0);
  // Country-first summary: high-level travel scope. City count lives on
  // the Insights tab to keep this header focused.
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
      {diag && <DiagPanel onClose={() => setDiag(false)} user={user} stays={stays} />}
      <div className="header-row">
        <div className="brand-mark" onClick={handleBrandTap} style={{ cursor: "default", userSelect: "none" }}>Traverse</div>
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
              <a
                className="user-menu-item"
                href={TERMS_URL}
                onClick={(e) => { e.preventDefault(); setOpen(false); openExternal(TERMS_URL); }}
              >
                Terms &amp; Privacy
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
      {/* Compact inline stats — countries first, then breadth/depth metrics. */}
      <div className="stats-inline">
        <span><b>{countries}</b> countries</span>
        <span className="stats-dot">·</span>
        <span><b>{stays.length}</b> stays</span>
        <span className="stats-dot">·</span>
        <span><b>{nights}</b> nights</span>
      </div>
    </header>
  );
}
