import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import { nodePolyfills } from "vite-plugin-node-polyfills";
import tsConfigPaths from "vite-tsconfig-paths";

export default defineConfig({
  plugins: [
    nodePolyfills({
      include: ["buffer", "process"],
    }),
    tsConfigPaths({
      projects: ["./tsconfig.json"],
    }),
    react(),
  ],
  server: {
    host: true, // Expose on local network
    port: 5173,
    allowedHosts: [
      "localhost",
      "127.0.0.1",
      "0.0.0.0",
      "exiguously-breathless-prudence.ngrok-free.dev",
    ],
    proxy: {
      "/api": {
        target: "http://localhost:8787",
        changeOrigin: true,
      },
    },
  },
});
