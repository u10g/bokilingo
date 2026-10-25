/// <reference types="vitest/config" />
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

// GitHub Pages はリポジトリ名のサブパス（/bokilingo/）で配信される
export default defineConfig({
  base: "/bokilingo/",
  plugins: [react(), tailwindcss()],
  test: {
    environment: "jsdom",
  },
});
