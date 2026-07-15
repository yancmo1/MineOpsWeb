import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
export default defineConfig({ plugins: [react()], server: { hmr: { clientPort: 8080 }, proxy: { "/kolibri": { target: "https://capsule.kolibrigames.com/api/client/v1", changeOrigin: true, rewrite: (path) => path.replace(/^\/kolibri/, "") }, "/master": { target: "https://idle-miners.com", changeOrigin: true, rewrite: (path) => path.replace(/^\/master/, "") } } } });
