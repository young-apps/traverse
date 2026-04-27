import { useState } from "react";
import { signInWithGoogle } from "../services/auth";

export default function Auth() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleSignIn = async () => {
    setLoading(true); setError(null);
    try {
      await signInWithGoogle();
    } catch (e) {
      console.error("Auth error:", e);
      // User-friendly error messages for common OAuth issues
      if (e.code === "auth/popup-closed-by-user") {
        setError(null); // User just closed the popup — not an error
      } else if (e.code === "auth/popup-blocked") {
        setError("Pop-up blocked by your browser. Allow pop-ups for this site and try again.");
      } else if (e.code === "auth/cancelled-popup-request") {
        setError(null); // Multiple popups — ignore
      } else if (e.code === "auth/network-request-failed") {
        setError("Network error. Check your connection and try again.");
      } else {
        setError("Sign-in didn't go through. This sometimes happens — please try again.");
      }
    }
    setLoading(false);
  };

  return (
    <div className="auth-screen">
      <div className="auth-logo"><div className="auth-logo-dot" /></div>
      <div className="auth-brand">Traverse</div>
      <h1 className="auth-title">Your hotel passport</h1>
      <p className="auth-subtitle">Track every stay · Build your story · See where friends are going</p>
      <button className="auth-btn" onClick={handleSignIn} disabled={loading}>
        <GoogleLogo />{loading ? "Signing in…" : "Continue with Google"}
      </button>
      {error && (
        <div className="auth-error">
          {error}
          <button onClick={handleSignIn} style={{ display: "block", marginTop: 8, background: "none", border: "none", color: "var(--accent)", font: "600 12px var(--font-sans)", cursor: "pointer", textDecoration: "underline" }}>
            Try again
          </button>
        </div>
      )}
    </div>
  );
}

function GoogleLogo() {
  return <svg width="18" height="18" viewBox="0 0 18 18"><path d="M17.64 9.2a10.34 10.34 0 0 0-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.79 2.71v2.26h2.9c1.7-1.57 2.69-3.88 2.69-6.61z" fill="#4285F4"/><path d="M9 18c2.43 0 4.47-.81 5.96-2.18l-2.9-2.26c-.81.54-1.84.86-3.06.86-2.34 0-4.32-1.58-5.03-3.71H.96v2.33A9 9 0 0 0 9 18z" fill="#34A853"/><path d="M3.97 10.71a5.4 5.4 0 0 1 0-3.43V4.96H.96a9 9 0 0 0 0 8.08l3.01-2.33z" fill="#FBBC05"/><path d="M9 3.58c1.32 0 2.5.45 3.43 1.35l2.57-2.57A9 9 0 0 0 .96 4.96l3.01 2.33C4.68 5.16 6.66 3.58 9 3.58z" fill="#EA4335"/></svg>;
}
