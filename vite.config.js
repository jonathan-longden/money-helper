import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { VitePWA } from "vite-plugin-pwa";

// GitHub Pages serves a project site from /<repo>/, so CI sets BASE_PATH.
// Locally it stays at the root for `npm run dev` / `npm run preview`.
const base = process.env.BASE_PATH ?? "/";

export default defineConfig({
  base,
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: "prompt",
      // UpdateToast registers the worker through the virtual module, so the
      // plugin must not also inject its own registration script.
      injectRegister: null,
      includeAssets: ["favicon.svg", "apple-touch-icon.png"],
      workbox: {
        globPatterns: ["**/*.{js,css,html,svg,png,woff2}"],
        // Any unknown path falls back to the app shell, so a deep link or a
        // cold offline launch still boots the installed app.
        navigateFallback: `${base}index.html`,
      },
      manifest: {
        name: "Household Ledger",
        short_name: "Ledger",
        description:
          "What's committed, what's left, what to set aside — a private household budget ledger.",
        id: base,
        start_url: base,
        scope: base,
        display: "standalone",
        orientation: "portrait",
        background_color: "#0E1712",
        theme_color: "#0E1712",
        categories: ["finance", "productivity"],
        icons: [
          { src: "icon-192.png", sizes: "192x192", type: "image/png" },
          { src: "icon-512.png", sizes: "512x512", type: "image/png" },
          {
            src: "icon-192-maskable.png",
            sizes: "192x192",
            type: "image/png",
            purpose: "maskable",
          },
          {
            src: "icon-512-maskable.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "maskable",
          },
        ],
      },
    }),
  ],
});
