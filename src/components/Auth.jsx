// Auth screen.
//
// The visible flow is Apple + Google OAuth — that's what real users see
// and the only path Apple's marketing wants surfaced. There is also a
// hidden email/password "reviewer backdoor" used for Apple App Review.
//
// To reveal it: tap the Traverse logo five times within ~3 seconds. A
// small email/password form drops in below the OAuth buttons. Apple's
// reviewer notes should describe exactly that gesture along with the
// seeded credentials. The form is gated behind the gesture (rather
// than always visible) so curious end users don't try to "create an
// account" via a flow we don't want to support long-term.
//
// Setup required outside this file:
//   1. Firebase Console → Authentication → Sign-in method → enable
//      Email/Password.
//   2. Create a reviewer account (e.g. apple-review@traverseapp.com)
//      and seed it with a handful of stays + one friend so the
//      reviewer sees the app's value, not an empty shell.

import { useState, useRef } from "react";
import { signInWithGoogle, signInWithApple, signInWithEmail } from "../services/auth";
import { TERMS_URL, openExternal } from "../services/links";

export default function Auth() {
  const [loading, setLoading] = useState(null); // "google" | "apple" | "email" | null
  const [error, setError] = useState(null);
  const [showReviewer, setShowReviewer] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  // Tap counter for the hidden reveal. Resets if the gap between taps
  // exceeds 3s so a stray double-tap doesn't slowly accumulate to 5.
  const tapsRef = useRef({ count: 0, last: 0 });
  const onLogoTap = () => {
    const now = Date.now();
    const t = tapsRef.current;
    if (now - t.last > 3000) t.count = 0;
    t.count += 1;
    t.last = now;
    if (t.count >= 5) {
      t.count = 0;
      setShowReviewer(true);
    }
  };

  const handleSignIn = async (provider) => {
    setLoading(provider); setError(null);
    try {
      if (provider === "google") await signInWithGoogle();
      else if (provider === "apple") await signInWithApple();
    } catch (e) {
      console.error("Auth error:", e);
      if (e.code === "auth/popup-closed-by-user" || e.code === "auth/cancelled-popup-request") {
        setError(null);
      } else if (e.code === "auth/popup-blocked") {
        setError("Pop-up blocked by your browser. Allow pop-ups for this site and try again.");
      } else if (e.code === "auth/network-request-failed") {
        setError("Network error. Check your connection and try again.");
      } else {
        setError(`${e.code || "error"}: ${e.message || String(e)}`);
      }
    }
    setLoading(null);
  };

  const handleEmailSubmit = async (e) => {
    e.preventDefault();
    if (!email.trim() || !password) return;
    setLoading("email"); setError(null);
    try {
      await signInWithEmail(email.trim(), password);
    } catch (err) {
      console.error("Email auth error:", err);
      // Map Firebase codes to short reviewer-friendly messages. Avoid
      // leaking which half of the credential was wrong.
      if (err.code === "auth/invalid-credential" || err.code === "auth/wrong-password" || err.code === "auth/user-not-found") {
        setError("Email or password is incorrect.");
      } else if (err.code === "auth/too-many-requests") {
        setError("Too many attempts. Wait a minute and try again.");
      } else if (err.code === "auth/network-request-failed") {
        setError("Network error. Check your connection and try again.");
      } else {
        setError(`${err.code || "error"}: ${err.message || String(err)}`);
      }
    }
    setLoading(null);
  };

  return (
    <div className="auth-screen">
      <div
        className="auth-logo"
        onClick={onLogoTap}
        // Make the gesture target generous without changing visuals.
        style={{ cursor: "pointer", WebkitTapHighlightColor: "transparent" }}
      >
        <div className="auth-logo-dot" />
      </div>
      <div className="auth-brand">Traverse</div>
      <h1 className="auth-title">Your hotel passport</h1>
      <p className="auth-subtitle">Track every stay · Build your story · See where friends are going</p>

      <button className="auth-btn auth-btn-apple" onClick={() => handleSignIn("apple")} disabled={loading !== null}>
        <AppleLogo />{loading === "apple" ? "Signing in…" : "Continue with Apple"}
      </button>

      <button className="auth-btn" onClick={() => handleSignIn("google")} disabled={loading !== null}>
        <GoogleLogo />{loading === "google" ? "Signing in…" : "Continue with Google"}
      </button>

      {showReviewer && (
        <form
          onSubmit={handleEmailSubmit}
          style={{
            width: "100%",
            maxWidth: 320,
            marginTop: 16,
            padding: 14,
            borderRadius: 12,
            border: "1px solid var(--border)",
            background: "rgba(255,255,255,.6)",
            display: "flex",
            flexDirection: "column",
            gap: 8,
          }}
        >
          <div style={{ font: "600 11px var(--font-mono)", letterSpacing: ".5px", color: "var(--text-secondary)", textTransform: "uppercase" }}>
            Reviewer sign-in
          </div>
          <input
            type="email"
            autoComplete="username"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={loading !== null}
            style={inputStyle}
          />
          <input
            type="password"
            autoComplete="current-password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            disabled={loading !== null}
            style={inputStyle}
          />
          <button
            type="submit"
            className="auth-btn"
            disabled={loading !== null || !email.trim() || !password}
            style={{ marginTop: 4 }}
          >
            {loading === "email" ? "Signing in…" : "Sign in"}
          </button>
        </form>
      )}

      {error && (
        <div className="auth-error">
          {error}
        </div>
      )}

      <p className="auth-legal">
        By continuing you agree to our{" "}
        <a href={TERMS_URL} onClick={(e) => { e.preventDefault(); openExternal(TERMS_URL); }}>Terms &amp; Privacy Policy</a>.
      </p>
    </div>
  );
}

const inputStyle = {
  width: "100%",
  padding: "10px 12px",
  borderRadius: 8,
  border: "1px solid var(--border)",
  background: "#fff",
  font: "14px var(--font-sans)",
  color: "var(--text)",
  outline: "none",
  boxSizing: "border-box",
};

function GoogleLogo() {
  return <svg width="18" height="18" viewBox="0 0 18 18"><path d="M17.64 9.2a10.34 10.34 0 0 0-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.79 2.71v2.26h2.9c1.7-1.57 2.69-3.88 2.69-6.61z" fill="#4285F4"/><path d="M9 18c2.43 0 4.47-.81 5.96-2.18l-2.9-2.26c-.81.54-1.84.86-3.06.86-2.34 0-4.32-1.58-5.03-3.71H.96v2.33A9 9 0 0 0 9 18z" fill="#34A853"/><path d="M3.97 10.71a5.4 5.4 0 0 1 0-3.43V4.96H.96a9 9 0 0 0 0 8.08l3.01-2.33z" fill="#FBBC05"/><path d="M9 3.58c1.32 0 2.5.45 3.43 1.35l2.57-2.57A9 9 0 0 0 .96 4.96l3.01 2.33C4.68 5.16 6.66 3.58 9 3.58z" fill="#EA4335"/></svg>;
}

function AppleLogo() {
  // Previous path had negative coordinates that bled past the 0 0 18 18
  // viewBox top-left and got clipped on iOS Safari. This version is
  // drawn in a 0 0 24 24 box and stays well inside it.
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M17.05 20.28c-.98.95-2.05.8-3.08.35-1.09-.46-2.09-.48-3.24 0-1.44.62-2.2.44-3.06-.35C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09l.01-.01zM12 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z"/>
    </svg>
  );
}
