import assert from "node:assert/strict";
import { createRequire } from "node:module";

const require = createRequire(new URL("../../apps/operator-web/package.json", import.meta.url));
const { chromium } = require("@playwright/test");
const base = "http://127.0.0.1:3000";
const password = process.env.VG_TEST_OIDC_PASSWORD;
if (!password) throw new Error("The local OIDC fixture password is required");

const browser = await chromium.launch();
try {
  const page = await browser.newPage();
  const currentSession = async () => {
    const response = await page.request.get(base + "/api/auth/session");
    assert.equal(response.headers()["cache-control"], "private, no-store");
    return response.json();
  };

  await page.goto(base);
  await page.waitForURL(base + "/login");
  assert.equal((await currentSession()).authenticated, false);
  console.log("Anonymous console and session denied");

  await page.getByRole("button", { name: "Continue to sign in" }).click();
  await page.locator("#username").fill("operator-a");
  await page.locator("#password").fill(password);
  await page.locator("#kc-login").click();
  await page.waitForURL(base + "/", { timeout: 25_000 });

  const { authenticated, user } = await currentSession();
  assert.equal(authenticated, true);
  assert.equal(user.activeOrganizationId, "org_fixture_a");
  assert.deepEqual(user.roles, ["ORG_OWNER"]);
  const cookie = (await page.context().cookies()).find(item => item.name === "voltgrid_session");
  assert.equal(cookie?.httpOnly, true);
  assert.equal(cookie.sameSite, "Lax");
  assert.match(cookie.value, /^[\w-]{43}$/);
  console.log("Keycloak sign-in, signed token verification and opaque browser session passed");

  await page.goto(base + "/stations");
  await page.getByRole("link", { name: "Fixture A Charging Station", exact: true }).waitFor();
  assert.equal(await page.getByRole("link", { name: "Fixture B Charging Station", exact: true }).count(), 0);

  const switchResponse = page.waitForResponse(response => response.url() === base + "/api/auth/switch-org");
  await page.getByLabel("Organization", { exact: true }).selectOption("org_fixture_b");
  assert.equal((await switchResponse).status(), 200);
  await page.waitForURL(base + "/");
  const switched = await currentSession();
  assert.equal(switched.user.activeOrganizationId, "org_fixture_b");
  assert.deepEqual(switched.user.roles, ["SUPPORT"]);

  await page.goto(base + "/stations");
  await page.getByRole("link", { name: "Fixture B Charging Station", exact: true }).waitFor();
  assert.equal(await page.getByRole("link", { name: "Fixture A Charging Station", exact: true }).count(), 0);
  console.log("Organization switch changed both the database role and station results");

  await page.getByRole("button", { name: "Sign out" }).click();
  await page.waitForURL(base + "/login");
  assert.equal((await currentSession()).authenticated, false);
  console.log("Logout invalidated the browser session");
} finally {
  await browser.close();
}
