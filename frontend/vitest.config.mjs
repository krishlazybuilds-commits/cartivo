import { defineConfig } from "vitest/config";

export default defineConfig({
  // App components and tests use JSX inside .js/.jsx files (Next.js convention).
  // Tell esbuild to parse both as JSX with React's automatic runtime so no
  // explicit `import React` is needed and Vite's import analysis doesn't choke.
  esbuild: {
    loader: "jsx",
    include: /app\/.*\.jsx?$/,
    exclude: [],
    jsx: "automatic",
  },
  optimizeDeps: {
    esbuildOptions: {
      loader: { ".js": "jsx" },
    },
  },
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./vitest.setup.js"],
    include: ["**/*.{test,spec}.{js,jsx}"],
    exclude: ["node_modules", ".next"],
  },
});
