import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { readFileSync } from "node:fs";

const isTauriBuild = process.env.TAURI_ENV_PLATFORM !== undefined;
const pkgVersion = JSON.parse(readFileSync("./package.json", "utf8")).version as string;

export default defineConfig({
  plugins: [react()],
  clearScreen: false,
  define: {
    __APP_VERSION__: JSON.stringify(pkgVersion),
  },
  server: {
    port: 5173,
    strictPort: true,
    watch: {
      ignored: ["**/src-tauri/**"],
    },
  },
  envPrefix: ["VITE_", "TAURI_ENV_"],
  build: {
    target: isTauriBuild
      ? process.env.TAURI_ENV_PLATFORM === "windows" ? "chrome105" : "safari13"
      : "es2022",
    minify: process.env.TAURI_ENV_DEBUG ? false : "esbuild",
    sourcemap: Boolean(process.env.TAURI_ENV_DEBUG),
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes("node_modules")) return undefined;
          if (id.includes("@codemirror") || id.includes("@lezer")) return "codemirror";
          if (id.includes("/react/") || id.includes("/react-dom/") || id.includes("/scheduler/")) return "react";
          if (id.includes("fflate")) return "fflate";
          return undefined;
        },
      },
    },
  },
});
