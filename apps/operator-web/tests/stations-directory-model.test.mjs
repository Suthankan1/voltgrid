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
  buildDirectoryStationHref,
  buildStationsDirectoryHref,
  buildStationsDirectoryModel,
  formatUtcRetrievalTime,
  normalizeStationDirectoryFilters,
  resolveLegacyOverviewRedirectTarget,
} = loadTs("stations-directory-model.ts");

test("stations directory filters normalize whitespace, arrays, and unsupported values safely", () => {
  assert.deepEqual(normalizeStationDirectoryFilters({}), { query: "", status: "" });
  assert.deepEqual(normalizeStationDirectoryFilters({ q: "   " }), { query: "", status: "" });
  assert.deepEqual(
    normalizeStationDirectoryFilters({
      q: ["  Colombo  ", "ignored"],
      status: ["ONLINE", "OFFLINE"],
    }),
    { query: "Colombo", status: "ONLINE" },
  );
  assert.deepEqual(
    normalizeStationDirectoryFilters({ q: "cp-1", status: "FAULTED" }),
    { query: "cp-1", status: "" },
  );
  assert.deepEqual(
    normalizeStationDirectoryFilters({ status: " OFFLINE " }),
    { query: "", status: "OFFLINE" },
  );
});

test("stations directory search matches name and identifier case-insensitively with combined status filters", () => {
  const sourceStations = [
    { id: "CP-10", name: "Colombo Central", status: "ONLINE" },
    { id: "CP-2", name: "Kandy Depot", status: "OFFLINE" },
    { id: "LONG%ID-3", name: "Colombo South Hub", status: "OFFLINE" },
  ];
  const snapshotCopy = sourceStations.map(station => ({ ...station }));
  const snapshot = { state: "live", stations: sourceStations };

  const idSearch = buildStationsDirectoryModel(
    snapshot,
    normalizeStationDirectoryFilters({ q: "long%id" }),
  );
  assert.equal(idSearch.directoryState, "results");
  assert.equal(idSearch.matchingCount, 1);
  assert.equal(idSearch.stations[0]?.id, "LONG%ID-3");
  assert.equal(idSearch.totalStations, 3);
  assert.equal(idSearch.onlineStations, 1);
  assert.equal(idSearch.offlineStations, 2);

  const combined = buildStationsDirectoryModel(
    snapshot,
    normalizeStationDirectoryFilters({ q: "COLOMBO", status: "OFFLINE" }),
  );
  assert.equal(combined.matchingCount, 1);
  assert.equal(combined.stations[0]?.id, "LONG%ID-3");
  assert.equal(combined.totalStations, 3);

  const noMatch = buildStationsDirectoryModel(
    snapshot,
    normalizeStationDirectoryFilters({ q: "Kandy", status: "ONLINE" }),
  );
  assert.equal(noMatch.directoryState, "no-matches");
  assert.equal(noMatch.matchingCount, 0);
  assert.equal(noMatch.totalStations, 3);
  assert.equal(noMatch.onlineStations, 1);
  assert.equal(noMatch.offlineStations, 2);

  // Source snapshot remains unmutated
  assert.deepEqual(sourceStations, snapshotCopy);
});

test("stations directory orders offline first deterministically including tie-breaks on identifier", () => {
  const model = buildStationsDirectoryModel(
    {
      state: "live",
      stations: [
        { id: "CP-9", name: "Zulu Station", status: "ONLINE" },
        { id: "CP-2", name: "Same Name", status: "OFFLINE" },
        { id: "CP-1", name: "Same Name", status: "OFFLINE" },
        { id: "CP-5", name: "Alpha Station", status: "ONLINE" },
      ],
    },
    normalizeStationDirectoryFilters({}),
  );

  assert.deepEqual(
    model.stations.map(s => s.id),
    ["CP-1", "CP-2", "CP-5", "CP-9"],
  );
  assert.equal(model.stations.length, 4);
});

test("stations directory distinguishes empty fleet from unavailable API and omits invented values", () => {
  const emptyModel = buildStationsDirectoryModel(
    { state: "live", stations: [] },
    normalizeStationDirectoryFilters({ q: "anything" }),
    { retrievedAtIso: "2026-10-08T09:00:00Z" },
  );
  assert.equal(emptyModel.availability, "live");
  assert.equal(emptyModel.directoryState, "empty");
  assert.equal(emptyModel.totalStations, 0);
  assert.equal(emptyModel.onlineStations, 0);
  assert.equal(emptyModel.offlineStations, 0);
  assert.match(formatUtcRetrievalTime(emptyModel.retrievedAtIso), /Oct 08, 2026, 09:00 UTC/);

  const unavailableModel = buildStationsDirectoryModel(
    { state: "unavailable", stations: [], message: "Station API could not be reached." },
    normalizeStationDirectoryFilters({ status: "OFFLINE" }),
  );
  assert.equal(unavailableModel.availability, "unavailable");
  assert.equal(unavailableModel.directoryState, "unavailable");
  assert.equal(unavailableModel.totalStations, null);
  assert.equal(unavailableModel.onlineStations, null);
  assert.equal(unavailableModel.offlineStations, null);
  assert.equal(unavailableModel.retrievedAtIso, null);
  assert.equal(unavailableModel.errorMessage, "Station API could not be reached.");
});

test("directory href builders preserve encoding and legacy overview redirects discard unsafe params", () => {
  assert.equal(buildStationsDirectoryHref({}), "/stations");
  assert.equal(
    buildStationsDirectoryHref({ query: "Kandy Depot", status: "OFFLINE" }),
    "/stations?q=Kandy+Depot&status=OFFLINE",
  );
  assert.equal(buildDirectoryStationHref("CP%1", {}), "/stations/CP%251");
  assert.equal(
    buildDirectoryStationHref("CP%1", { status: "OFFLINE" }),
    "/stations/CP%251?returnTo=%2Fstations%3Fstatus%3DOFFLINE",
  );

  assert.equal(resolveLegacyOverviewRedirectTarget({}), null);
  assert.equal(resolveLegacyOverviewRedirectTarget({ q: "   ", status: "BOGUS" }), null);
  assert.equal(resolveLegacyOverviewRedirectTarget({ all: "1" }), "/stations");
  assert.equal(
    resolveLegacyOverviewRedirectTarget({ q: "Colombo", status: "OFFLINE", all: "1" }),
    "/stations?q=Colombo&status=OFFLINE",
  );
});
