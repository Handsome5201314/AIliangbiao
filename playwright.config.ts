import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/playwright",
  timeout: 30_000,
  use: {
    baseURL: process.env.NEXT_PUBLIC_APP_URL || "http://127.0.0.1:3000",
    headless: true,
  },
});
