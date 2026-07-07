import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  esbuild: {
    loader: "tsx",
    include: /app\/.*\.[jt]sx?$/,
    exclude: [],
  },
  optimizeDeps: {
    esbuildOptions: {
      loader: {
        ".js": "jsx",
        ".ts": "ts",
      },
    },
  },
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./vitest.setup.js"],
    include: ["**/*.{test,spec}.{js,jsx}"],
    exclude: ["node_modules", ".next", "e2e/**"],
  },
});
