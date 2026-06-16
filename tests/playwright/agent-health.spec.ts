import { test, expect } from "@playwright/test";

test("platform health and agent entry stay available for CI smoke", async ({ page, request }) => {
  const health = await request.get("/api/health");
  expect(health.ok()).toBeTruthy();

  const agentPage = await page.goto("/agent");
  expect(agentPage?.ok()).toBeTruthy();
});
