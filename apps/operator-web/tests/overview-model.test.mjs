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
  buildOverviewModel,
  formatUtcRetrievalTime,
} = loadTs("overview-model.ts");

test("empty network produces valid zero counts and null (N/A) connectivity", () => {
  const model = buildOverviewModel(
    { state: "live", stations: [] },
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
  const allOnline = buildOverviewModel({
    state: "live",
    stations: [
      { id: "CP-1", name: "Colombo Central", status: "ONLINE" },
      { id: "CP-2", name: "Galle Harbor", status: "ONLINE" },
    ],
  });
  assert.equal(allOnline.totalStations, 2);
  assert.equal(allOnline.onlineStations, 2);
  assert.equal(allOnline.offlineStations, 0);
  assert.equal(allOnline.connectivityPercent, 100);
  assert.equal(allOnline.conditionKind, "all-online");

  const allOffline = buildOverviewModel({
    state: "live",
    stations: [
      { id: "CP-3", name: "Kandy Depot", status: "OFFLINE" },
      { id: "CP-4", name: "Negombo Hub", status: "OFFLINE" },
    ],
  });
  assert.equal(allOffline.totalStations, 2);
  assert.equal(allOffline.onlineStations, 0);
  assert.equal(allOffline.offlineStations, 2);
  assert.equal(allOffline.connectivityPercent, 0);
  assert.equal(allOffline.conditionKind, "attention");
});

test("mixed connectivity rounds percentage accurately", () => {
  const model = buildOverviewModel({
    state: "live",
    stations: [
      { id: "CP-1", name: "Colombo Central", status: "ONLINE" },
      { id: "CP-2", name: "Kandy Depot", status: "OFFLINE" },
      { id: "CP-3", name: "Galle Plaza", status: "ONLINE" },
    ],
  });

  assert.equal(model.totalStations, 3);
  assert.equal(model.onlineStations, 2);
  assert.equal(model.offlineStations, 1);
  assert.equal(model.connectivityPercent, 67);
});

test("unavailable snapshot produces unknown (null) metrics rather than zero", () => {
  const model = buildOverviewModel({
    state: "unavailable",
    stations: [],
    message: "Station API could not be reached.",
  });
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
  const model = buildOverviewModel({
    state: "live",
    stations: [
      { id: "CP-1", name: "Station A", status: "ONLINE" },
      { id: "CP-2", name: "Station B", status: "UNEXPECTED" },
    ],
  });
  assert.equal(model.totalStations, 2);
  assert.equal(model.onlineStations, 1);
  assert.equal(model.offlineStations, 0);
  assert.equal(model.unknownStatusStations, 1);
  assert.equal(model.connectivityPercent, 50);
  assert.equal(model.conditionKind, "attention");
});

test("station preview orders offline deterministically without mutating source array and bounds results", () => {
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
    { previewLimit: 6 },
  );

  // Source array order must remain untouched
  assert.deepEqual(original, snapshotCopy);
  assert.equal(preview.isTruncated, true);
  assert.equal(preview.totalStations, 8);
  assert.equal(preview.visibleStations.length, 6);
  assert.deepEqual(
    preview.visibleStations.slice(0, 3).map(s => s.id),
    ["CP-4", "CP-2", "CP-8"],
  );
  assert.match(formatUtcRetrievalTime("2026-10-08T09:00:00Z"), /Oct 08, 2026, 09:00 UTC/);
  assert.equal(formatUtcRetrievalTime("not-a-date"), null);
});
