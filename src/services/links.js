// External-link helper.
//
// On Capacitor's WKWebView, an `<a href="/foo.html">` resolves to
// capacitor://localhost/foo.html — which 404s, since only Vite-built
// assets exist in the bundle. Even an absolute https `<a>` can mis-fire
// if the WebView isn't configured to defer navigation. This helper
// uses window.open(url, "_blank") with absolute URLs, which Capacitor
// 7 routes to the system browser by default, and which falls through
// to a normal new-tab on web.
//
// Used by Auth.jsx and Header.jsx to open the privacy / terms page
// hosted on GitHub Pages.

export const TERMS_URL = "https://young-apps.github.io/traverse/";

export function openExternal(url) {
  try {
    window.open(url, "_blank", "noopener,noreferrer");
  } catch {
    // Last-ditch fallback if window.open is blocked: navigate the
    // current frame. The user can hit "back" to return to the app.
    window.location.href = url;
  }
}
