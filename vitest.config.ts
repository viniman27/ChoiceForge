import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
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
