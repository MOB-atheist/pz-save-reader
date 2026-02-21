import path from "path";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

const API_PORT = parseInt(process.env.VITE_API_PORT || "3000", 10);

export default defineConfig({
  plugins: [react()],
  root: ".",
  publicDir: "public",
  build: {
    outDir: "dist",
    emptyOutDir: true,
  },
  server: {
    proxy: {
      "/api": {
        target: `http://localhost:${API_PORT}`,
        changeOrigin: true,
      },
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
