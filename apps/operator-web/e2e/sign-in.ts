import type { Page } from "@playwright/test";

export async function signIn(page: Page, origin: string) {
  const password = process.env.VG_TEST_OIDC_PASSWORD;
  if (!password) throw new Error("Start the local OIDC fixture and export its test password");

  await page.goto(origin + "/api/auth/login");
  const login = page.locator("#username");
  if (await login.isVisible()) {
    await login.fill("operator-a");
    await page.locator("#password").fill(password);
    await page.locator("#kc-login").click();
  }
  await page.waitForURL(origin + "/", { timeout: 25_000 });
}
