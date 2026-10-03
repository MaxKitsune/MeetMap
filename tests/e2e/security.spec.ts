import { test, expect } from "@playwright/test";

test("private API surface requires authentication", async ({ request }) => {
  for (const path of [
    "data",
    "people",
    "memories",
    "settings",
    "status",
    "search?q=test",
    "geocode?q=Berlin",
    "attachments/unknown",
    "export",
  ]) {
    const r = await request.get(`/api/${path}`);
    expect(r.status(), path).toBe(401);
  }
});
test("cross-origin mutations are rejected", async ({ request }) => {
  for (const path of [
    "auth/setup",
    "auth/login",
    "auth/logout",
    "people",
    "memories",
    "upload",
    "demo",
    "settings",
  ]) {
    const r = await request.post(`/api/${path}`, {
      headers: { Origin: "https://attacker.invalid" },
      data: {},
    });
    expect(r.status(), path).toBe(403);
  }
});
test("missing Origin is rejected", async ({ request }) => {
  const r = await request.post("/api/auth/login", {
    data: { email: "nobody@example.com", password: "invalid-password" },
  });
  expect(r.status()).toBe(403);
});
test("health endpoints expose no private data", async ({ request }) => {
  const r = await request.get("/api/healthz");
  expect(r.ok()).toBeTruthy();
  expect(await r.json()).toEqual({ status: "ok" });
});
test("private page redirects to authentication", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveURL(/\/(setup|login)$/);
  await expect(
    page.getByRole("button", { name: /erstellen|Anmelden/ }),
  ).toBeVisible();
});
