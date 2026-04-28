import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  base: './',  // required for Capacitor — assets must use relative paths
  build: {
    outDir: 'dist',
  },
  server: { port: 5173 },
  // Exclude mapbox-gl from Vite pre-bundling — it manages its own worker
  // and pre-bundling breaks the CSP worker import below.
  optimizeDeps: {
    exclude: ['mapbox-gl'],
  },
});
