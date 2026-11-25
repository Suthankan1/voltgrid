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

const { decodePathIdentifier } = loadTs("path-identifier.ts");
const {
  NAV_ITEMS,
  ROUTE_COMPATIBILITY_PLAN,
  buildCanonicalSessionHref,
  buildSessionHref,
  buildStationHref,
  resolveRouteMeta,
  sanitizeInternalReturnPath,
  sanitizeStationsReturnPath,
} = loadTs("routes.ts");

test("decodePathIdentifier decodes once and rejects malformed percent sequences", () => {
  assert.equal(decodePathIdentifier("CP%251"), "CP%1");
  assert.equal(decodePathIdentifier("TX%2F1"), "TX/1");
  assert.equal(decodePathIdentifier("%ZZ"), null);
  assert.equal(decodePathIdentifier("%E0%A4%A"), null);
});

test("route builders encode special and literal-percent identifiers safely", () => {
  assert.equal(buildStationHref("CP%1"), "/stations/CP%251");
  assert.equal(buildSessionHref("CP%1", "TX%1"), "/stations/CP%251/sessions/TX%251");
  assert.equal(buildCanonicalSessionHref("CP%1", "TX/1"), "/stations/CP%251/sessions/TX%2F1");
});

test("resolveRouteMeta handles static /stations/new, encoded dynamic routes, and malformed IDs", () => {
  const dirMeta = resolveRouteMeta("/stations");
  assert.equal(dirMeta.activeNav, "stations");
  assert.equal(dirMeta.contextNav, null);
  assert.deepEqual(dirMeta.breadcrumbs, [
    { label: "Overview", href: "/" },
    { label: "Charging stations", current: true },
  ]);

  const newMeta = resolveRouteMeta("/stations/new");
  assert.equal(newMeta.contextNav, "stations");
  assert.equal(newMeta.breadcrumbs[1]?.href, "/stations");
  assert.deepEqual(
    newMeta.breadcrumbs.map(b => b.label),
    ["Overview", "Stations", "Add station"],
  );

  const malformed = resolveRouteMeta("/stations/%ZZ");
  assert.equal(malformed.breadcrumbs[2]?.label, "Invalid station");

  const canonicalSession = resolveRouteMeta("/stations/CP%251/sessions/TX%251");
  assert.equal(canonicalSession.activeNav, "sessions");
  assert.equal(canonicalSession.breadcrumbs[2]?.href, "/stations/CP%251");
  assert.equal(canonicalSession.breadcrumbs[3]?.label, "TX%1");
});

test("sanitizeInternalReturnPath prevents open redirects and preserves safe queries", () => {
  assert.equal(sanitizeInternalReturnPath("/transactions?station=CP-1&page=1"), "/transactions?station=CP-1&page=1");
  assert.equal(sanitizeInternalReturnPath("/operations?status=OFFLINE"), "/operations?status=OFFLINE");
  assert.equal(sanitizeInternalReturnPath("https://evil.example/phish"), "/");
  assert.equal(sanitizeInternalReturnPath("//evil.example/phish"), "/");
  assert.equal(sanitizeInternalReturnPath("///evil.example/phish"), "/");
  assert.equal(sanitizeInternalReturnPath("/\\evil.example"), "/");
  assert.equal(sanitizeInternalReturnPath("javascript:alert(1)"), "/");
  assert.equal(sanitizeInternalReturnPath("/stations/CP-1\nHeader: bad"), "/");
  assert.equal(sanitizeInternalReturnPath(undefined, "/transactions"), "/transactions");

  assert.equal(sanitizeStationsReturnPath("/stations?status=OFFLINE"), "/stations?status=OFFLINE");
  assert.equal(sanitizeStationsReturnPath("/stations"), "/stations");
  assert.equal(sanitizeStationsReturnPath("/attention"), "/attention");
  assert.equal(sanitizeStationsReturnPath("/operations?status=OFFLINE"), null);
  assert.equal(sanitizeStationsReturnPath("https://evil.example/stations"), null);

  const attentionMeta = resolveRouteMeta("/attention");
  assert.equal(attentionMeta.activeNav, "attention");
  assert.equal(attentionMeta.breadcrumbs[1]?.label, "Needs attention");

  const diagMeta = resolveRouteMeta("/diagnostics");
  assert.equal(diagMeta.activeNav, "diagnostics");
  assert.equal(diagMeta.breadcrumbs[1]?.label, "Diagnostics");

  const helpMeta = resolveRouteMeta("/help");
  assert.equal(helpMeta.activeNav, "help");
  assert.equal(helpMeta.breadcrumbs[1]?.label, "Help");
});

test("route compatibility plan activates all six operator destinations cleanly", () => {
  for (const entry of ROUTE_COMPATIBILITY_PLAN) {
    if (
      entry.canonical === "/stations" ||
      entry.canonical === "/sessions" ||
      entry.canonical === "/stations/[stationId]/sessions/[sessionId]" ||
      entry.canonical === "/attention" ||
      entry.canonical === "/diagnostics" ||
      entry.canonical === "/help"
    ) {
      assert.equal(entry.redirectActive, true);
    } else {
      assert.equal(entry.redirectActive, false, `unexpected redirect on ${entry.canonical}`);
    }
  }
  const activeNavTargets = NAV_ITEMS.filter(item => item.href !== null).map(item => item.href);
  assert.deepEqual(activeNavTargets, ["/", "/stations", "/sessions", "/attention", "/diagnostics", "/help"]);
});
