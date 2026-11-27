import { setTimeout as delay } from "node:timers/promises";
import { expect, test } from "@playwright/test";
import { signIn } from "./sign-in";

test.use({ storageState: { cookies: [], origins: [] } });

test("refreshes an expired Keycloak access token and invalidates the browser handle on logout", async ({
  page, baseURL,
}) => {
  test.setTimeout(180_000);
  const origin = baseURL!;
  await signIn(page, origin);
  const session = (await page.context().cookies(origin)).find(cookie => cookie.name === "voltgrid_session");
  expect(session).toBeDefined();

  async function authenticated() {
    const response = await page.request.get("/api/auth/session");
    expect(response.ok()).toBe(true);
    return (await response.json()).authenticated;
  }

  expect(await authenticated()).toBe(true);
  // The isolated Keycloak realm issues access tokens with a 120-second lifetime.
  await delay(122_000);
  expect(await Promise.all([authenticated(), authenticated()])).toEqual([true, true]);
  expect((await page.context().cookies(origin)).find(cookie => cookie.name === "voltgrid_session")?.value)
    .toBe(session?.value);

  const logout = await page.request.post("/api/auth/logout", {
    headers: { origin },
    maxRedirects: 0,
  });
  expect(logout.status()).toBe(303);
  expect(await authenticated()).toBe(false);
  await page.context().addCookies([session!]);
  expect(await authenticated()).toBe(false);
});
