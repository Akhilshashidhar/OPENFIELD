import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    include: ["src/**/*.test.ts", "src/**/*.spec.ts"],
  },
  resolve: {
    alias: {
      "@openfield/core": path.resolve(__dirname, "../core/src"),
      "@openfield/agent": path.resolve(__dirname, "./src"),
    },
  },
});
