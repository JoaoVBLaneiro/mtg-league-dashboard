import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  base: "/mtg-league-dashboard/",

  plugins: [
    react(),

    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["favicon.svg", "apple-touch-icon.png"],

      manifest: {
        name: "Liga Commander",
        short_name: "Liga CMD",
        description: "Dashboard e marcador de vida da Liga Commander",
        theme_color: "#020617",
        background_color: "#020617",
        display: "standalone",
        orientation: "any",
        start_url: "/mtg-league-dashboard/life",
        scope: "/mtg-league-dashboard/",
        icons: [
          {
            src: "/mtg-league-dashboard/pwa-192.png",
            sizes: "192x192",
            type: "image/png",
          },
          {
            src: "/mtg-league-dashboard/pwa-512.png",
            sizes: "512x512",
            type: "image/png",
          },
          {
            src: "/mtg-league-dashboard/pwa-512-maskable.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "maskable",
          },
        ],
      },
    }),
  ],
});