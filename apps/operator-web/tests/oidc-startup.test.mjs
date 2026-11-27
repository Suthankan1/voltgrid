import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { test } from "node:test";
import { readOidcConfig } from "../src/lib/oidc-config.mjs";

const config = {
  OPERATOR_WEB_ORIGIN: "https://console.example.test",
  OIDC_ISSUER: "https://identity.example.test/realms/operators",
  OIDC_CLIENT_ID: "fixture-console",
  OIDC_CLIENT_SECRET: "fixture-client-value",
  OIDC_AUDIENCE: "voltgrid-api",
};

test("OIDC startup accepts secure HTTPS configuration and explicit loopback fixtures", () => {
  assert.equal(readOidcConfig(config).local, false);
  assert.equal(readOidcConfig({
    ...config,
    OPERATOR_WEB_ORIGIN: "http://127.0.0.1:4310",
    OIDC_ISSUER: "http://127.0.0.1:8180/realms/fixture",
    OIDC_LOCAL_HTTP: "true",
  }).local, true);
});

for (const [name, value, expected] of [
  ...Object.keys(config).map(name => [name, "", new RegExp(name)]),
  ["OPERATOR_WEB_ORIGIN", "https://console.example.test/path", /must be an origin/],
  ["OPERATOR_WEB_ORIGIN", "http://console.example.test", /HTTPS/],
  ["OIDC_ISSUER", "http://identity.example.test", /HTTPS/],
  ["OIDC_ISSUER", "https://identity.example.test/.well-known/openid-configuration", /issuer identifier/],
  ["OIDC_ISSUER", "https://identity.example.test/realms/operators?invalid", /query/],
  ["OIDC_AUDIENCE", "fixture-console", /must differ/],
  ["OIDC_CLIENT_SECRET", "   ", /OIDC_CLIENT_SECRET/],
  ["OIDC_LOCAL_HTTP", "true", /requires a loopback/],
  ["OPERATOR_LOCAL_WRITES", "true", /requires loopback/],
  ["NEXT_PUBLIC_AUTH_DISABLED", "true", /cannot be disabled/],
]) {
  test("OIDC startup rejects " + name + " (" + expected.source + ")", () => {
    assert.throws(() => readOidcConfig({ ...config, [name]: value }), expected);
  });
}

test("Next production server rejects missing OIDC configuration with a nonzero exit status", () => {
  const result = spawnSync(process.execPath, ["node_modules/next/dist/bin/next", "start", "--port", "0"], {
    env: { ...process.env, ...config, OIDC_AUDIENCE: "", NEXT_PUBLIC_AUTH_DISABLED: "", OIDC_LOCAL_HTTP: "" },
    encoding: "utf8",
    timeout: 15_000,
  });
  assert.ifError(result.error);
  assert.equal(result.status, 1, result.stderr);
  assert.match(result.stderr, /OIDC_AUDIENCE is required/);
});
