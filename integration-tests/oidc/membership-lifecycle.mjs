import assert from "node:assert/strict";
import { createRequire } from "node:module";

const require = createRequire(new URL("../../apps/operator-web/package.json", import.meta.url));
const { chromium } = require("@playwright/test");
const oidc = await import(require.resolve("openid-client"));
const web = process.env.OPERATOR_WEB_ORIGIN || "http://127.0.0.1:3000";
const station = process.env.STATION_ORIGIN || "http://127.0.0.1:18080";
const operations = process.env.OPERATIONS_ORIGIN || "http://127.0.0.1:18081";
const organization = "org_fixture_a";
const callback = web + "/api/auth/callback";
const password = process.env.VG_TEST_OIDC_PASSWORD;
if (!password) throw new Error("The local OIDC fixture password is required");

const config = await oidc.discovery(
  new URL(process.env.OIDC_ISSUER),
  process.env.OIDC_CLIENT_ID,
  process.env.OIDC_CLIENT_SECRET,
  undefined,
  { execute: [oidc.allowInsecureRequests, oidc.enableNonRepudiationChecks] }
);

const browser = await chromium.launch();
async function authenticate(page, username) {
  await page.locator("#username").fill(username);
  await page.locator("#password").fill(password);
  await page.locator("#kc-login").click();
}

async function grant(username) {
  const page = await browser.newPage();
  try {
    const verifier = oidc.randomPKCECodeVerifier();
    const state = oidc.randomState();
    const nonce = oidc.randomNonce();
    const login = oidc.buildAuthorizationUrl(config, {
      redirect_uri: callback,
      scope: "openid",
      code_challenge_method: "S256",
      code_challenge: await oidc.calculatePKCECodeChallenge(verifier),
      state,
      nonce,
    });
    await page.route(callback + "?**", route => route.fulfill({ status: 200, body: "Fixture completed" }));
    await page.goto(login.href);
    const callbackRequest = page.waitForRequest(req => req.url().startsWith(callback + "?"));
    await authenticate(page, username);
    const responseUrl = new URL((await callbackRequest).url());
    const tokens = await oidc.authorizationCodeGrant(config, responseUrl, {
      pkceCodeVerifier: verifier, expectedState: state, expectedNonce: nonce, idTokenExpected: true,
    });
    return tokens.access_token;
  } finally {
    await page.close();
  }
}

async function graph(origin, token, query, variables) {
  const response = await fetch(origin + "/graphql", {
    method: "POST",
    headers: { "Content-Type": "application/json", "Authorization": "Bearer " + token, "X-Tenant-Id": organization },
    signal: AbortSignal.timeout(5000),
    body: JSON.stringify({ query, variables }),
  });
  if (response.status !== 200) return { status: response.status };
  const body = await response.json();
  return { status: response.status, ...body };
}

try {
  const actor = await grant("operator-b");
  const subject = await grant("operator-a");
  const page = await browser.newPage();
  await page.goto(web + "/api/auth/login");
  await authenticate(page, "operator-a");
  await page.waitForURL(web + "/");

  const session = async () => {
    const response = await page.request.get(web + "/api/auth/session", { timeout: 5000 });
    assert.equal(response.status(), 200);
    return response.json();
  };
  const readProjection = () => graph(operations, subject,
    '{ stationStatus(stationId: "VG-FIXTURE-A-STATION") { stationId } }');
  const userId = "65203c33-875b-499b-97d3-5851bc2eec61";
  assert.deepEqual((await session()).user.roles, ["ORG_OWNER"]);
  assert.equal((await readProjection()).data.stationStatus.stationId, "VG-FIXTURE-A-STATION");

  const downgrade = await graph(station, actor,
    "mutation Update($org: ID!, $user: String!) { updateMemberRole(organizationId: $org, userId: $user, role: \"SUPPORT\") { role } }",
    { org: organization, user: userId });
  assert.equal(downgrade.data?.updateMemberRole?.role, "SUPPORT");
  let started = performance.now();
  assert.deepEqual((await session()).user.roles, ["SUPPORT"]);
  const browserDowngrade = performance.now() - started;
  assert.equal((await readProjection()).data.stationStatus.stationId, "VG-FIXTURE-A-STATION");

  const revoked = await graph(station, actor,
    "mutation Revoke($org: ID!, $user: String!) { revokeMember(organizationId: $org, userId: $user) }",
    { org: organization, user: userId });
  assert.equal(revoked.data?.revokeMember, true);
  started = performance.now();
  const browserCheck = session().then(value => {
    assert.deepEqual(value, { authenticated: false, user: null });
    return performance.now() - started;
  });
  const operationsCheck = readProjection().then(value => {
    assert.equal(value.status, 403);
    return performance.now() - started;
  });
  const [browserRevoke, operationsRevoke] = await Promise.all([browserCheck, operationsCheck]);
  const deniedPage = await page.request.get(web + "/stations", { maxRedirects: 0 });
  assert.equal(deniedPage.status(), 307);
  assert.equal(deniedPage.headers().location, "/login");
  console.log(JSON.stringify({
    browserDowngradeMs: Math.round(browserDowngrade),
    browserRevokeMs: Math.round(browserRevoke),
    operationsRevokeMs: Math.round(operationsRevoke),
  }));
} finally {
  await browser.close();
}
