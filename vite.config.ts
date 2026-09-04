import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import legacy from "@vitejs/plugin-legacy";
import path from "path";
import { componentTagger } from "lovable-tagger";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
  },
  plugins: [
    react(),
    mode === "development" && componentTagger(),
    // Ship an additional ES5 bundle + polyfills so older / non-updated browsers
    // (older Chrome, Edge, Safari) can run the app instead of showing a blank page.
    mode !== "development" &&
      legacy({
        targets: ["defaults", "chrome >= 79", "edge >= 79", "safari >= 13", "firefox >= 78", "not IE 11"],
        modernPolyfills: true,
        renderLegacyChunks: true,
      }),
  ].filter(Boolean),
  build: {
    target: "es2018",
  },
  esbuild: {
    target: "es2018",
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
}));
