import { useState } from "react";
import { signInWithGoogle, signInWithApple } from "../services/auth";

export default function Auth() {
  const [loading, setLoading] = useState(null); // "google" | "apple" | null
  const [error, setError] = useState(null);

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

  return (
    <div className="auth-screen">
      <div className="auth-logo"><div className="auth-logo-dot" /></div>
      <div className="auth-brand">Traverse</div>
      <h1 className="auth-title">Your hotel passport</h1>
      <p className="auth-subtitle">Track every stay · Build your story · See where friends are going</p>

      <button className="auth-btn auth-btn-apple" onClick={() => handleSignIn("apple")} disabled={loading !== null}>
        <AppleLogo />{loading === "apple" ? "Signing in…" : "Continue with Apple"}
      </button>

      <button className="auth-btn" onClick={() => handleSignIn("google")} disabled={loading !== null}>
        <GoogleLogo />{loading === "google" ? "Signing in…" : "Continue with Google"}
      </button>

      {error && (
        <div className="auth-error">
          {error}
        </div>
      )}

      <p className="auth-legal">
        By continuing you agree to our{" "}
        <a href="/privacy.html" target="_blank" rel="noopener noreferrer">Privacy Policy</a>.
      </p>
    </div>
  );
}

function GoogleLogo() {
  return <svg width="18" height="18" viewBox="0 0 18 18"><path d="M17.64 9.2a10.34 10.34 0 0 0-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.79 2.71v2.26h2.9c1.7-1.57 2.69-3.88 2.69-6.61z" fill="#4285F4"/><path d="M9 18c2.43 0 4.47-.81 5.96-2.18l-2.9-2.26c-.81.54-1.84.86-3.06.86-2.34 0-4.32-1.58-5.03-3.71H.96v2.33A9 9 0 0 0 9 18z" fill="#34A853"/><path d="M3.97 10.71a5.4 5.4 0 0 1 0-3.43V4.96H.96a9 9 0 0 0 0 8.08l3.01-2.33z" fill="#FBBC05"/><path d="M9 3.58c1.32 0 2.5.45 3.43 1.35l2.57-2.57A9 9 0 0 0 .96 4.96l3.01 2.33C4.68 5.16 6.66 3.58 9 3.58z" fill="#EA4335"/></svg>;
}

function AppleLogo() {
  return <svg width="18" height="18" viewBox="0 0 18 18" fill="currentColor"><path d="M14.5 13.4c-.3.7-.6 1.3-1 1.9-.6.8-1 1.4-1.4 1.6-.5.4-1.1.6-1.7.6-.4 0-1-.1-1.6-.4-.6-.3-1.2-.4-1.7-.4-.5 0-1.1.1-1.7.4-.6.3-1.1.4-1.5.4-.6 0-1.2-.2-1.8-.6-.4-.3-.9-.8-1.5-1.7C.6 14.2.1 13.1-.2 11.8c-.3-1.4-.5-2.7-.5-4 0-1.5.3-2.7.9-3.8.5-.8 1.1-1.5 1.9-2 .8-.5 1.7-.7 2.6-.7.4 0 1 .1 1.7.4.7.3 1.2.4 1.4.4.2 0 .7-.1 1.5-.4.8-.3 1.5-.4 2-.4 1.4.1 2.5.7 3.3 1.7-1.3.8-1.9 1.9-1.9 3.3 0 1.1.4 2 1.2 2.7.4.3.8.6 1.2.8-.1.3-.2.5-.3.8zM10.7.4c0 1-.4 2-1.1 2.9-.9 1-1.9 1.6-3.1 1.5 0-.1 0-.2 0-.4 0-1 .4-2 1.2-2.9.4-.5.9-.8 1.5-1.1.6-.3 1.2-.4 1.7-.4 0 .1 0 .3-.2.4z"/></svg>;
}
