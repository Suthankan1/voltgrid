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
  const fn = vm.runInThisContext(
    `(function(exports, require, module) {\n${outputText}\n})`,
  );
  fn(mod.exports, localRequire, mod);
  return mod.exports;
}

const {
  buildDiagnosticsHref,
  buildDiagnosticsModel,
  normalizeDiagnosticsParams,
  resolveLegacyOperationsRedirectTarget,
} = loadTs("diagnostics-model.ts");

test("normalizeDiagnosticsParams preserves exact casing, drops invalid statuses, and drops cursor on station lookup", () => {
  assert.deepEqual(
    normalizeDiagnosticsParams({
      status: ["OFFLINE", "ONLINE"],
      after: "  cursor-2  ",
    }),
    { status: "OFFLINE", stationId: "", after: "cursor-2" },
  );

  assert.deepEqual(
    normalizeDiagnosticsParams({
      status: "FAULTED",
      stationId: " cp-MixedCase ",
      after: "cursor-2",
    }),
    { status: "", stationId: "cp-MixedCase", after: null },
  );

  assert.equal(
    resolveLegacyOperationsRedirectTarget({
      status: "UNAVAILABLE",
      after: "cur-9",
      evil: "https://evil.example",
    }),
    "/diagnostics?status=UNAVAILABLE&after=cur-9",
  );
});

test("buildDiagnosticsModel builds bounded cursor pagination links and distinguishes missing lookup from error", () => {
  const paged = buildDiagnosticsModel(
    { status: "OFFLINE", stationId: "", after: "cur-1" },
    {
      mode: "cursor-page",
      snapshot: {
        state: "live",
        stations: [
          {
            stationId: "CP%1",
            currentStatus: "OFFLINE",
            lastEventId: "evt-1",
            statusChangedAt: "2026-10-08T08:00:00Z",
            updatedAt: "2026-10-08T08:00:02Z",
          },
        ],
        hasNextPage: true,
        endCursor: "cur-2",
      },
    },
    { retrievedAtIso: "2026-10-08T08:05:00Z" },
  );

  assert.equal(paged.nextHref, "/diagnostics?status=OFFLINE&after=cur-2");
  assert.equal(paged.firstPageHref, "/diagnostics?status=OFFLINE");
  assert.equal(paged.records[0].stationHref, "/stations/CP%251");
  assert.equal(paged.retrievedAtUtc, "Oct 08, 2026, 08:05 UTC");

  const notFound = buildDiagnosticsModel(
    { status: "", stationId: "CP-UNKNOWN", after: null },
    { mode: "station-lookup", snapshot: { state: "not-found" } },
    { retrievedAtIso: "2026-10-08T08:05:00Z" },
  );
  assert.equal(notFound.availability, "not-found");
  assert.equal(notFound.records.length, 0);
  assert.equal(notFound.retrievedAtUtc, "Oct 08, 2026, 08:05 UTC");

  assert.equal(buildDiagnosticsHref({}), "/diagnostics");
});
