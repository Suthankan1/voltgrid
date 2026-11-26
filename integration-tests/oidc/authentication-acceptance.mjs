import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { setTimeout } from "node:timers/promises";

const { chromium } = createRequire(new URL("../../apps/operator-web/package.json", import.meta.url))("@playwright/test");
const base = "http://127.0.0.1:3000";
const browser = await chromium.launch();
try {
  for (const [port, query] of [
    [8080, "{ stations { id } }"],
    [8081, "{ stationStatuses { edges { node { stationId } } } }"],
  ]) {
    for (const authorization of [undefined, "Bearer", "Bearer invalid-token", "Bearer voltgrid-dev-token"]) {
      const headers = { "Content-Type": "application/json", "X-Tenant-Id": "org_fixture_a" };
      if (authorization) headers.Authorization = authorization;
      const response = await fetch(`http://127.0.0.1:${port}/graphql`, {
        method: "POST", headers, body: JSON.stringify({ query }),
      });
      assert.equal(response.status, 401);
      const result = await response.json();
      assert.equal(result.errors?.[0]?.extensions?.code, "UNAUTHORIZED");
      assert.equal(result.data, undefined);
    }
  }
  console.log("Both GraphQL APIs denied missing, empty, malformed and development bearer tokens");

  const page = await browser.newPage();
  const routes = [
    "/", "/stations", "/stations/VG-FIXTURE-A-STATION", "/stations/new",
    "/sessions", "/stations/VG-FIXTURE-A-STATION/sessions/example",
    "/attention", "/diagnostics", "/admin", "/admin/organizations",
    "/admin/members", "/admin/credentials", "/admin/audit",
  ];
  const active = async () => {
    const response = await page.request.get(base + "/api/auth/session");
    assert.equal(response.headers()["cache-control"], "private, no-store");
    return (await response.json()).authenticated;
  };
  for (const route of routes) {
    const response = await page.request.get(base + route, { maxRedirects: 0 });
    assert.equal(new URL(response.headers().location, base).pathname, "/login", route);
    assert.equal((await response.text()).includes("Fixture A Charging Station"), false, route);
  }
  assert.equal(await active(), false);
  console.log("Anonymous access denied on 13 operator routes");

  const callback = base + "/api/auth/callback";
  const beginLogin = async () => {
    const result = await page.request.get(base + "/api/auth/login", { maxRedirects: 0 });
    assert.equal(result.status(), 307);
    const target = new URL(result.headers().location);
    assert.equal(target.origin, "http://127.0.0.1:8180");
    assert.equal(target.searchParams.get("redirect_uri"), callback);
    assert.equal(target.searchParams.get("response_type"), "code");
    assert.equal(target.searchParams.get("code_challenge_method"), "S256");
    assert.ok(target.searchParams.get("nonce"));
    return target.searchParams.get("state");
  };
  assert.equal((await page.request.get(callback)).status(), 401);
  await beginLogin();
  assert.equal((await page.request.get(callback)).status(), 401);
  const state = await beginLogin();
  const providerError = new URL(callback);
  providerError.searchParams.set("state", state);
  providerError.searchParams.set("error", "access_denied");
  assert.equal((await page.request.get(providerError.href)).status(), 401);
  assert.equal((await page.request.get(providerError.href)).status(), 401);
  assert.equal(await active(), false);
  console.log("Callback denied missing login data and provider denial; login requests used S256 and a fixed redirect");

  await page.goto(base + "/login");
  await page.getByRole("button", { name: "Continue to sign in" }).click();
  await page.locator("#username").fill("operator-a");
  await page.locator("#password").fill(process.env.VG_TEST_OIDC_PASSWORD);
  await page.locator("#kc-login").click();
  await page.waitForURL(base + "/");
  assert.equal(await active(), true);
  const cookies = await page.context().cookies(base);
  const session = cookies.find(cookie => cookie.name === "voltgrid_session");
  assert.ok(session?.httpOnly);
  assert.equal(session.sameSite, "Lax");
  assert.ok(/^[A-Za-z0-9_-]{43}$/.test(session.value));

  for (const endpoint of ["/api/auth/logout", "/api/auth/switch-org"]) {
    const result = await page.request.post(base + endpoint, {
      headers: { Origin: "https://unrelated.example.test" },
      data: { organizationId: "org_fixture_a" },
    });
    assert.equal(result.status(), 403);
  }
  assert.equal(await active(), true);
  console.log("Cross-origin logout and organization switching were denied");

  await page.goto(base + "/stations");
  await page.getByRole("link", { name: "Fixture A Charging Station", exact: true }).waitFor();
  await page.goto(base + "/diagnostics");
  await page.getByText("VG-FIXTURE-A-STATION", { exact: true }).first().waitFor();
  console.log("Keycloak sign-in and authenticated reads from Station and Operations passed");

  await setTimeout(122_000);
  assert.equal(await active(), true);
  await page.reload();
  await page.getByText("VG-FIXTURE-A-STATION", { exact: true }).first().waitFor();
  console.log("Session and Operations read remained authenticated beyond the original access-token lifetime");

  await page.getByRole("button", { name: "Sign out" }).click();
  await page.waitForURL(base + "/login");
  assert.equal(await active(), false);
  await page.context().addCookies([session]);
  assert.equal(await active(), false);
  await page.goto(base + "/stations");
  await page.waitForURL(base + "/login");
  console.log("Logout invalidated the session, including the old handle");
} finally {
  await browser.close();
}
