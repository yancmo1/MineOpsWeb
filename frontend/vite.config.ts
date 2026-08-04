import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    hmr: { clientPort: 8080 },
    proxy: {
      "/kolibri": {
        target: "https://capsule.kolibrigames.com/api/client/v1",
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/kolibri/, ""),
      },
      "/master": {
        target: "https://idle-miners.com",
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/master/, ""),
      },
    },
  },
  build: {
    cssCodeSplit: true,
    cssMinify: true,
    minify: "esbuild",
    rollupOptions: {
      output: {
        manualChunks: {
          // Split vendor code
          vendor: ["react", "react-dom"],
          // Split PocketBase
          pocketbase: ["pocketbase"],
          // Split Dexie
          dexie: ["dexie"],
        },
      },
    },
  },
  // Enable CSS minification
  css: {
    devSourcemap: true,
  },
});