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

const { buildAttentionModel } = loadTs("attention-model.ts");

const stationA = { id: "CP%1", name: "Kandy Depot", status: "OFFLINE" };
const stationB = { id: "CP-1", name: "Colombo Central", status: "ONLINE" };
const stationC = { id: "CP-2", name: "Anuradhapura Hub", status: "OFFLINE" };

const incompleteRow = {
  transaction: {
    stationId: "CP%1",
    transactionId: "TX%1",
    evseId: 1,
    connectorId: 2,
    status: "ENDED",
    startedAt: "2026-10-08T08:00:00Z",
    endedAt: "2026-10-08T08:30:00Z",
    lastSequenceNumber: 12,
  },
  completeness: {
    status: "INCOMPLETE",
    firstSequenceNumber: 0,
    lastSequenceNumber: 12,
    missingSequenceNumbers: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
  },
};

test("buildAttentionModel derives independent offline and incomplete counts, verified station names, and safe links", () => {
  const model = buildAttentionModel(
    { state: "live", stations: [stationB, stationA, stationC] },
    {
      state: "live",
      transactions: [incompleteRow],
      page: 0,
      size: 8,
      totalElements: 14,
      totalPages: 2,
      hasNext: true,
    },
    { stationPreviewLimit: 1, sessionPreviewLimit: 8 },
  );

  assert.equal(model.stationSection.availability, "live");
  assert.equal(model.stationSection.registeredCount, 3);
  assert.equal(model.stationSection.offlineCount, 2);
  assert.equal(model.stationSection.items.length, 1);
  // Deterministic offline sort places Anuradhapura Hub before Kandy Depot
  assert.equal(model.stationSection.items[0].station.id, "CP-2");
  assert.equal(model.stationSection.items[0].href, "/stations/CP-2?returnTo=%2Fattention");
  assert.equal(model.stationSection.hasMore, true);

  assert.equal(model.sessionSection.availability, "live");
  assert.equal(model.sessionSection.incompleteCount, 14);
  assert.equal(model.sessionSection.hasMore, true);
  assert.equal(model.sessionSection.items[0].stationDisplayName, "Kandy Depot");
  assert.equal(
    model.sessionSection.items[0].sessionHref,
    "/stations/CP%251/sessions/TX%251?section=technical&returnTo=%2Fattention",
  );
  assert.equal(model.sessionSection.items[0].missingCount, 10);
  assert.equal(model.sessionSection.items[0].missingPreview.length, 8);
  assert.equal(model.sessionSection.items[0].missingOverflowCount, 2);
  assert.equal(model.isConfirmedClear, false);
});

test("buildAttentionModel keeps sections strictly independent on partial failure and never coerces unknown counts to zero", () => {
  const stationFail = buildAttentionModel(
    { state: "unavailable", message: "Stations API down" },
    {
      state: "live",
      transactions: [incompleteRow],
      page: 0,
      size: 8,
      totalElements: 1,
      totalPages: 1,
      hasNext: false,
    },
  );
  assert.equal(stationFail.stationSection.availability, "unavailable");
  assert.equal(stationFail.stationSection.offlineCount, null);
  assert.equal(stationFail.sessionSection.availability, "live");
  assert.equal(stationFail.sessionSection.incompleteCount, 1);
  // Falls back safely to stationId when verified station names are unavailable
  assert.equal(stationFail.sessionSection.items[0].stationDisplayName, "CP%1");
  assert.equal(stationFail.isConfirmedClear, false);

  const sessionFail = buildAttentionModel(
    { state: "live", stations: [stationB] },
    {
      state: "unavailable",
      transactions: [],
      page: 0,
      size: 8,
      totalElements: 0,
      totalPages: 0,
      hasNext: false,
      message: "Sessions API down",
    },
  );
  assert.equal(sessionFail.stationSection.availability, "live");
  assert.equal(sessionFail.stationSection.offlineCount, 0);
  assert.equal(sessionFail.sessionSection.availability, "unavailable");
  assert.equal(sessionFail.sessionSection.incompleteCount, null);
  assert.equal(sessionFail.isConfirmedClear, false);
});

test("buildAttentionModel sets isConfirmedClear only when both live sources confirm zero issues", () => {
  const clear = buildAttentionModel(
    { state: "live", stations: [stationB] },
    {
      state: "live",
      transactions: [],
      page: 0,
      size: 8,
      totalElements: 0,
      totalPages: 0,
      hasNext: false,
    },
  );
  assert.equal(clear.isConfirmedClear, true);

  const unknownStatus = buildAttentionModel(
    { state: "live", stations: [{ id: "CP-9", name: "Weird", status: "MYSTERY" }] },
    {
      state: "live",
      transactions: [],
      page: 0,
      size: 8,
      totalElements: 0,
      totalPages: 0,
      hasNext: false,
    },
  );
  assert.equal(unknownStatus.stationSection.unknownStatusCount, 1);
  assert.equal(unknownStatus.isConfirmedClear, false);
});
