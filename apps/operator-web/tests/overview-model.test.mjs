import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { test } from "node:test";
import vm from "node:vm";

const require = createRequire(import.meta.url);
const ts = require("typescript");

function loadOverviewModule() {
  const absPath = path.resolve(new URL("../src/lib/overview-model.ts", import.meta.url).pathname);
  const source = readFileSync(absPath, "utf8");
  const { outputText } = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
      esModuleInterop: true,
    },
  });
  const mod = { exports: {} };
  const fn = vm.runInThisContext(`(function(exports, require, module) {\n${outputText}\n})`);
  fn(mod.exports, require, mod);
  return mod.exports;
}

const {
  buildOverviewHref,
  buildOverviewModel,
  formatUtcRetrievalTime,
  normalizeOverviewFilters,
} = loadOverviewModule();

test("empty network produces valid zero counts and null (N/A) connectivity", () => {
  const model = buildOverviewModel(
    { state: "live", stations: [] },
    normalizeOverviewFilters({}),
    { retrievedAtIso: "2026-10-08T09:00:00Z" },
  );

  assert.equal(model.availability, "live");
  assert.equal(model.totalStations, 0);
  assert.equal(model.onlineStations, 0);
  assert.equal(model.offlineStations, 0);
  assert.equal(model.connectivityPercent, null);
  assert.equal(model.conditionKind, "empty");
  assert.deepEqual(model.visibleStations, []);
});

test("all-online and all-offline networks calculate exact percentages and conditions", () => {
  const allOnline = buildOverviewModel(
    {
      state: "live",
      stations: [
        { id: "CP-1", name: "Colombo Central", status: "ONLINE" },
        { id: "CP-2", name: "Galle Harbor", status: "ONLINE" },
      ],
    },
    normalizeOverviewFilters({}),
  );
  assert.equal(allOnline.totalStations, 2);
  assert.equal(allOnline.onlineStations, 2);
  assert.equal(allOnline.offlineStations, 0);
  assert.equal(allOnline.connectivityPercent, 100);
  assert.equal(allOnline.conditionKind, "all-online");

  const allOffline = buildOverviewModel(
    {
      state: "live",
      stations: [
        { id: "CP-3", name: "Kandy Depot", status: "OFFLINE" },
        { id: "CP-4", name: "Negombo Hub", status: "OFFLINE" },
      ],
    },
    normalizeOverviewFilters({}),
  );
  assert.equal(allOffline.totalStations, 2);
  assert.equal(allOffline.onlineStations, 0);
  assert.equal(allOffline.offlineStations, 2);
  assert.equal(allOffline.connectivityPercent, 0);
  assert.equal(allOffline.conditionKind, "attention");
});

test("mixed connectivity rounds percentage and keeps totals independent of list filters", () => {
  const snapshot = {
    state: "live",
    stations: [
      { id: "CP-1", name: "Colombo Central", status: "ONLINE" },
      { id: "CP-2", name: "Kandy Depot", status: "OFFLINE" },
      { id: "CP-3", name: "Galle Plaza", status: "ONLINE" },
    ],
  };

  const filtered = buildOverviewModel(
    snapshot,
    normalizeOverviewFilters({ q: "Colombo", status: "OFFLINE" }),
  );
  assert.equal(filtered.totalStations, 3);
  assert.equal(filtered.onlineStations, 2);
  assert.equal(filtered.offlineStations, 1);
  assert.equal(filtered.connectivityPercent, 67);
  assert.equal(filtered.filteredCount, 0);
  assert.deepEqual(filtered.visibleStations, []);
});

test("unavailable snapshot produces unknown (null) metrics rather than zero", () => {
  const model = buildOverviewModel(
    { state: "unavailable", stations: [], message: "Station API could not be reached." },
    normalizeOverviewFilters({}),
  );
  assert.equal(model.availability, "unavailable");
  assert.equal(model.totalStations, null);
  assert.equal(model.onlineStations, null);
  assert.equal(model.offlineStations, null);
  assert.equal(model.connectivityPercent, null);
  assert.equal(model.conditionKind, "unavailable");
  assert.equal(model.retrievedAtIso, null);
  assert.equal(model.errorMessage, "Station API could not be reached.");
});

test("unknown status values are never silently treated as online or offline", () => {
  const model = buildOverviewModel(
    {
      state: "live",
      stations: [
        { id: "CP-1", name: "Station A", status: "ONLINE" },
        { id: "CP-2", name: "Station B", status: "UNEXPECTED" },
      ],
    },
    normalizeOverviewFilters({}),
  );
  assert.equal(model.totalStations, 2);
  assert.equal(model.onlineStations, 1);
  assert.equal(model.offlineStations, 0);
  assert.equal(model.unknownStatusStations, 1);
  assert.equal(model.connectivityPercent, 50);
  assert.equal(model.conditionKind, "attention");
});

test("station ordering prioritizes offline deterministically without mutating source array and supports preview expansion", () => {
  const original = [
    { id: "CP-1", name: "Zulu Online", status: "ONLINE" },
    { id: "CP-2", name: "Beta Offline", status: "OFFLINE" },
    { id: "CP-3", name: "Alpha Online", status: "ONLINE" },
    { id: "CP-4", name: "Alpha Offline", status: "OFFLINE" },
    { id: "CP-5", name: "Charlie Online", status: "ONLINE" },
    { id: "CP-6", name: "Delta Online", status: "ONLINE" },
    { id: "CP-7", name: "Echo Online", status: "ONLINE" },
    { id: "CP-8", name: "Very Long Station Name That Exceeds Normal Widths For Testing", status: "OFFLINE" },
  ];
  const snapshotCopy = original.map(s => ({ ...s }));

  const preview = buildOverviewModel(
    { state: "live", stations: original },
    normalizeOverviewFilters({}),
    { previewLimit: 6 },
  );

  // Source array order must remain untouched
  assert.deepEqual(original, snapshotCopy);
  assert.equal(preview.isTruncated, true);
  assert.equal(preview.filteredCount, 8);
  assert.equal(preview.visibleStations.length, 6);
  assert.deepEqual(
    preview.visibleStations.slice(0, 3).map(s => s.id),
    ["CP-4", "CP-2", "CP-8"],
  );

  const expanded = buildOverviewModel(
    { state: "live", stations: original },
    normalizeOverviewFilters({ all: "1" }),
    { previewLimit: 6 },
  );
  assert.equal(expanded.isTruncated, false);
  assert.equal(expanded.visibleStations.length, 8);
});

test("buildOverviewHref and formatUtcRetrievalTime preserve filters and UTC formatting", () => {
  assert.equal(
    buildOverviewHref({ query: "Kandy", status: "OFFLINE", showAll: true }, "stations"),
    "/?q=Kandy&status=OFFLINE&all=1#stations",
  );
  assert.equal(buildOverviewHref({}), "/");
  assert.match(formatUtcRetrievalTime("2026-10-08T09:00:00Z"), /Oct 08, 2026, 09:00 UTC/);
  assert.equal(formatUtcRetrievalTime("not-a-date"), null);
});
