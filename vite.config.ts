/// <reference types="vitest/config" />
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { VitePWA } from "vite-plugin-pwa";

// GitHub Pages はリポジトリ名のサブパス（/bokilingo/）で配信される
const BASE = "/bokilingo/";

export default defineConfig({
  base: BASE,
  plugins: [
    react(),
    tailwindcss(),
    // オフライン対応：初回表示時にアプリ本体を端末に保存し、電波がなくても起動できるようにする。
    // 新しい版は裏で取得し、次に開いたときに切り替わる（解答中に再読み込みはしない）
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["icon.svg", "apple-touch-icon.png"],
      manifest: {
        name: "ボキリンゴ 簿記3級",
        short_name: "ボキリンゴ",
        description: "Duolingo風の日商簿記3級 学習アプリ",
        lang: "ja",
        start_url: BASE,
        scope: BASE,
        display: "standalone",
        orientation: "portrait",
        theme_color: "#22c55e",
        background_color: "#ffffff",
        icons: [
          { src: "pwa-192.png", sizes: "192x192", type: "image/png" },
          { src: "pwa-512.png", sizes: "512x512", type: "image/png" },
          { src: "pwa-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
        ],
      },
      workbox: {
        globPatterns: ["**/*.{js,css,html,svg,png,webmanifest}"],
        navigateFallback: `${BASE}index.html`,
      },
    }),
  ],
  test: {
    environment: "jsdom",
  },
});
