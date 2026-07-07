import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import tsconfigPaths from "vite-tsconfig-paths";

// Test-only config. Deliberately does NOT include the tanstackRouter plugin —
// tests must never regenerate src/routeTree.gen.ts.
export default defineConfig({
  plugins: [tsconfigPaths(), react()],
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./src/__tests__/setup.ts"],
    include: ["src/__tests__/**/*.test.{ts,tsx}"],
    // apiClient reads import.meta.env.VITE_API_URL at module load.
    env: {
      VITE_API_URL: "http://api.test",
    },
  },
});
