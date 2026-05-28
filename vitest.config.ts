import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import { readFileSync } from "node:fs";

const pkgVersion = JSON.parse(readFileSync("./package.json", "utf8")).version as string;

export default defineConfig({
  plugins: [react()],
  define: {
    __APP_VERSION__: JSON.stringify(pkgVersion),
  },
  test: {
    environment: "jsdom",
    globals: false,
    setupFiles: ["./tests/ui/setup.ts"],
    include: ["tests/ui/**/*.test.{ts,tsx}"],
    css: false,
    coverage: {
      provider: "v8",
      include: ["src/**/*.{ts,tsx}"],
      exclude: ["src/main.tsx", "src/vite-env.d.ts", "src/workers/**", "src-tauri/**"],
      reporter: ["text", "html"],
    },
    restoreMocks: true,
    clearMocks: true,
  },
});
