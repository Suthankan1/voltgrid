import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { test } from "node:test";
import vm from "node:vm";

const require = createRequire(import.meta.url);
const ts = require("typescript");

const libDir = path.resolve(new URL("../src/lib", import.meta.url).pathname);
const cache = new Map();

function loadTs(relPath) {
  const absPath = path.resolve(libDir, relPath);
  if (cache.has(absPath)) return cache.get(absPath);
  const source = readFileSync(absPath, "utf8");
  const { outputText } = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
      esModuleInterop: true,
    },
  });
  const mod = { exports: {} };
  cache.set(absPath, mod.exports);
  const localRequire = id => {
    if (id.startsWith("./")) {
      return loadTs(`${id.slice(2)}.ts`);
    }
    return require(id);
  };
  const fn = vm.runInThisContext(`(function(exports, require, module) {\n${outputText}\n})`);
  fn(mod.exports, localRequire, mod);
  cache.set(absPath, mod.exports);
  return mod.exports;
}

const {
  PRESET_PERSONAS,
  createBearerToken,
  encodeSession,
  decodeSession,
  getSession,
  getAuthHeaders,
} = loadTs("auth.ts");

const { ADMIN_NAV_ITEMS, resolveRouteMeta } = loadTs("routes.ts");

test("PRESET_PERSONAS defines all five commercial roles with expected properties", () => {
  const expectedRoles = [
    "PLATFORM_ADMIN",
    "ORG_OWNER",
    "STATION_OPERATOR",
    "BILLING_ANALYST",
    "READ_ONLY",
  ];

  for (const [key, persona] of Object.entries(PRESET_PERSONAS)) {
    assert.ok(persona.userId.startsWith("usr_"), `${key} userId must start with usr_`);
    assert.ok(persona.email.includes("@"), `${key} email must be valid`);
    assert.ok(persona.roles.length > 0, `${key} must have at least one role`);
    assert.ok(persona.activeOrganizationId, `${key} must have activeOrganizationId`);
    assert.ok(Array.isArray(persona.availableOrganizations), `${key} must list availableOrganizations`);
  }

  const configuredRoles = Object.values(PRESET_PERSONAS).flatMap(p => p.roles);
  for (const role of expectedRoles) {
    assert.ok(configuredRoles.includes(role), `Missing role in preset personas: ${role}`);
  }
});

test("createBearerToken produces valid three-part JWT token with claims", () => {
  const user = PRESET_PERSONAS.platform_admin;
  const token = createBearerToken(user);
  const parts = token.split(".");

  assert.equal(parts.length, 3, "JWT must contain header, payload, and signature");

  const header = JSON.parse(Buffer.from(parts[0], "base64url").toString());
  assert.equal(header.alg, "HS256");
  assert.equal(header.typ, "JWT");

  const payload = JSON.parse(Buffer.from(parts[1], "base64url").toString());
  assert.equal(payload.sub, user.userId);
  assert.equal(payload.email, user.email);
  assert.deepEqual(payload.roles, user.roles);
  assert.equal(payload.tenantId, user.activeOrganizationId);
  assert.ok(payload.exp > payload.iat, "exp must be after iat");
});

test("encodeSession and decodeSession round-trip correctly", () => {
  const user = PRESET_PERSONAS.station_operator;
  const token = createBearerToken(user);

  const encoded = encodeSession(user, token);
  assert.ok(typeof encoded === "string" && encoded.length > 20);

  const decoded = decodeSession(encoded);
  assert.ok(decoded !== null);
  assert.equal(decoded.user.userId, user.userId);
  assert.equal(decoded.user.email, user.email);
  assert.equal(decoded.token, token);

  assert.equal(decodeSession("not-valid-base64-json"), null);
});

test("getSession returns fallback developer session in standalone environment", async () => {
  const session = await getSession();
  assert.ok(session.isAuthenticated);
  assert.ok(session.user);
  assert.ok(session.token);
  assert.equal(session.user.activeOrganizationId, "org_voltgrid_default");
});

test("getAuthHeaders includes Bearer token and X-Tenant-Id header", async () => {
  const headers = await getAuthHeaders();
  assert.ok(headers["Authorization"]?.startsWith("Bearer "));
  assert.equal(headers["X-Tenant-Id"], "org_voltgrid_default");
});

test("ADMIN_NAV_ITEMS defines all four administrative areas", () => {
  assert.equal(ADMIN_NAV_ITEMS.length, 4);

  const ids = ADMIN_NAV_ITEMS.map(i => i.id);
  assert.deepEqual(ids, ["organizations", "members", "credentials", "audit"]);

  for (const item of ADMIN_NAV_ITEMS) {
    assert.ok(item.href.startsWith("/admin/"));
    assert.ok(item.label.length > 0);
    assert.ok(item.description.length > 0);
  }
});

test("resolveRouteMeta correctly resolves admin and login breadcrumbs", () => {
  const adminMeta = resolveRouteMeta("/admin");
  assert.equal(adminMeta.activeNav, "admin");
  assert.equal(adminMeta.breadcrumbs.length, 2);
  assert.equal(adminMeta.breadcrumbs[1].label, "Administration");
  assert.equal(adminMeta.breadcrumbs[1].current, true);

  const orgsMeta = resolveRouteMeta("/admin/organizations");
  assert.equal(orgsMeta.activeNav, "admin");
  assert.equal(orgsMeta.breadcrumbs.length, 3);
  assert.equal(orgsMeta.breadcrumbs[1].label, "Administration");
  assert.equal(orgsMeta.breadcrumbs[1].href, "/admin");
  assert.equal(orgsMeta.breadcrumbs[2].label, "Organizations & Sites");
  assert.equal(orgsMeta.breadcrumbs[2].current, true);

  const membersMeta = resolveRouteMeta("/admin/members");
  assert.equal(membersMeta.breadcrumbs[2].label, "Members & Roles");

  const credsMeta = resolveRouteMeta("/admin/credentials");
  assert.equal(credsMeta.breadcrumbs[2].label, "Station Credentials");

  const auditMeta = resolveRouteMeta("/admin/audit");
  assert.equal(auditMeta.breadcrumbs[2].label, "Audit Trail");

  const loginMeta = resolveRouteMeta("/login");
  assert.equal(loginMeta.activeNav, null);
  assert.equal(loginMeta.breadcrumbs[1].label, "Sign in");
});
