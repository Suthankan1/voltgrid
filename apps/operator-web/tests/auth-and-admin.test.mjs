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

const { createAuthStore } = loadTs("auth-store.ts");
const { ADMIN_NAV_ITEMS, resolveRouteMeta } = loadTs("routes.ts");

test("opaque session handles resolve only while their record is active", () => {
  const sessions = createAuthStore(3);
  const record = { expiresAt: Date.now() + 60_000, token: "server-side-token" };
  const id = sessions.create(record);

  assert.match(id, /^[A-Za-z0-9_-]{43}$/);
  assert.notEqual(sessions.create(record), id);
  assert.equal(sessions.get(id), record);
  assert.equal(sessions.get("unknown"), undefined);

  sessions.delete(id);
  assert.equal(sessions.get(id), undefined);
});

test("expired records are rejected and their storage can be reclaimed", () => {
  const sessions = createAuthStore(1);
  const id = sessions.create({ expiresAt: Date.now() - 1 });
  const active = sessions.create({ expiresAt: Date.now() + 60_000 });

  assert.equal(sessions.get(id), undefined);
  assert.ok(sessions.get(active));
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
