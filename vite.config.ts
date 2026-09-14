import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

const base = "/projects/dungeon-manager/";

export default defineConfig({
  base,
  plugins: [react()],
  build: {
    // Mirrors the URL path so Workers Assets serves files without rewriting.
    outDir: `dist${base}`,
    emptyOutDir: true,
  },
  server: {
    proxy: {
      [`${base}api`]: "http://localhost:8787",
    },
  },
});
