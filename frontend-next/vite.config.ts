import { defineConfig } from "vite";
import { tanstackRouter } from "@tanstack/router-plugin/vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import tsconfigPaths from "vite-tsconfig-paths";

// Standard Vite SPA setup (no SSR / TanStack Start).
// - tanstackRouter: file-based routing, regenerates src/routeTree.gen.ts
// - tsconfigPaths: provides the "@/*" -> "./src/*" alias from tsconfig.json
export default defineConfig({
  plugins: [
    tsconfigPaths(),
    tanstackRouter({ target: "react", autoCodeSplitting: true }),
    react(),
    tailwindcss(),
  ],
  server: {
    port: 8080,
    host: true,
    strictPort: true,
  },
  preview: {
    port: 8080,
  },
});
