import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Capacitor's iOS WebView serves bundled assets from capacitor://localhost
// with no Access-Control-Allow-Origin header. Vite emits <script type="module"
// crossorigin>, which forces the WebView to treat the bundle as cross-origin
// and strip every thrown error down to "Script error. :0". Removing the
// crossorigin attribute lets real error messages reach window.onerror.
const stripCrossorigin = () => ({
  name: "strip-crossorigin",
  transformIndexHtml(html) {
    return html.replace(/\s+crossorigin(=["'][^"']*["'])?/g, "");
  },
});

export default defineConfig({
  plugins: [react(), stripCrossorigin()],
  base: './',  // required for Capacitor — assets must use relative paths
  build: {
    outDir: 'dist',
    // Disable runtime modulepreload. Vite's __vitePreload helper injects
    // <link rel="modulepreload" crossorigin> tags at runtime for dynamic
    // import chunks. iOS WebView treats those as cross-origin (no
    // Access-Control-Allow-Origin from capacitor://localhost) and redacts
    // any error thrown by the preloaded module to "Script error. :0".
    // Disabling entirely lets the browser handle dynamic imports natively
    // without CORS-flagged preload hints.
    modulePreload: false,
  },
  server: { port: 5173 },
  // Exclude mapbox-gl from Vite pre-bundling — it manages its own worker
  // and pre-bundling breaks the CSP worker import below.
  optimizeDeps: {
    exclude: ['mapbox-gl'],
  },
});
