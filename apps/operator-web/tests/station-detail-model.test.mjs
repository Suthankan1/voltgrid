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
  buildStationDetailModel,
  buildStationDetailSectionHref,
  formatConnectorCompositeId,
  formatSessionDuration,
  normalizeStationDetailSection,
} = loadTs("station-detail-model.ts");

test("station detail section helpers normalize unsupported sections and preserve return paths", () => {
  assert.equal(normalizeStationDetailSection(undefined), "overview");
  assert.equal(normalizeStationDetailSection("bogus"), "overview");
  assert.equal(normalizeStationDetailSection(["sessions", "connectors"]), "sessions");
  assert.equal(
    buildStationDetailSectionHref("CP%1", "connectors", "/stations?status=OFFLINE"),
    "/stations/CP%251?section=connectors&returnTo=%2Fstations%3Fstatus%3DOFFLINE",
  );
  assert.equal(
    buildStationDetailSectionHref("CP%1", "overview", "https://evil.example"),
    "/stations/CP%251",
  );
});

test("station detail model computes exact connector counts, composite identity, and deterministic priority order", () => {
  const sourceConnectors = [
    { evseId: 2, connectorId: 1, status: "AVAILABLE", statusUpdatedAt: "2026-10-08T09:00:00Z" },
    { evseId: 1, connectorId: 1, status: "OCCUPIED", statusUpdatedAt: "2026-10-08T09:01:00Z" },
    { evseId: 1, connectorId: 2, status: "RESERVED", statusUpdatedAt: "2026-10-08T09:02:00Z" },
    { evseId: 2, connectorId: 2, status: "UNAVAILABLE", statusUpdatedAt: "2026-10-08T09:03:00Z" },
    { evseId: 3, connectorId: 1, status: "FAULTED", statusUpdatedAt: "2026-10-08T09:04:00Z" },
  ];
  const copy = sourceConnectors.map(c => ({ ...c }));

  const model = buildStationDetailModel({
    state: "live",
    station: { id: "CP-1", name: "Colombo Central", status: "ONLINE" },
    connectors: { state: "live", items: sourceConnectors },
    transactions: {
      state: "live",
      items: [
        {
          stationId: "CP-1",
          transactionId: "TX-1",
          evseId: 2,
          connectorId: 1,
          status: "ACTIVE",
          startedAt: "2026-10-08T08:00:00Z",
          endedAt: null,
          lastSequenceNumber: 3,
        },
        {
          stationId: "CP-1",
          transactionId: "TX-0",
          evseId: 1,
          connectorId: 1,
          status: "ENDED",
          startedAt: "2026-10-08T06:00:00Z",
          endedAt: "2026-10-08T07:15:00Z",
          lastSequenceNumber: 9,
        },
      ],
    },
  });

  // Source array remains unmutated
  assert.deepEqual(sourceConnectors, copy);
  assert.deepEqual(model.connectorCounts, {
    total: 5,
    available: 1,
    occupied: 1,
    reserved: 1,
    unavailable: 1,
    faulted: 1,
    attention: 2,
  });

  // Priority ordering: FAULTED -> UNAVAILABLE -> OCCUPIED -> RESERVED -> AVAILABLE
  assert.deepEqual(
    model.allConnectors.map(c => c.compositeKey),
    ["3:1", "2:2", "1:1", "1:2", "2:1"],
  );
  assert.equal(formatConnectorCompositeId(2, 1), "EVSE 2 · Connector 1");

  // EVSE 1 / Connector 1 is OCCUPIED with an ENDED session; must NOT fabricate active session
  const evse1Conn1 = model.allConnectors.find(c => c.compositeKey === "1:1");
  assert.equal(evse1Conn1?.activeSession, null);

  // EVSE 2 / Connector 1 has composite ACTIVE session TX-1
  const evse2Conn1 = model.allConnectors.find(c => c.compositeKey === "2:1");
  assert.equal(evse2Conn1?.activeSession?.transactionId, "TX-1");
  assert.equal(evse2Conn1?.activeSession?.href, "/stations/CP-1/sessions/TX-1");

  assert.equal(model.activeSessionCount, 1);
  assert.equal(model.attention.kind, "equipment-issues");
  assert.equal(model.allSessions[1]?.durationLabel, "1h 15m");
});

test("partial failures keep unknown counts as null and distinguish offline caveats and invalid durations", () => {
  const unavailableBoth = buildStationDetailModel({
    state: "live",
    station: { id: "CP-2", name: "Kandy Depot", status: "OFFLINE" },
    connectors: { state: "unavailable", items: [], message: "Equipment unavailable." },
    transactions: { state: "unavailable", items: [], message: "Sessions unavailable." },
  });

  assert.equal(unavailableBoth.isOffline, true);
  assert.equal(unavailableBoth.connectorCounts, null);
  assert.equal(unavailableBoth.activeSessionCount, null);
  assert.equal(unavailableBoth.totalSessionCount, null);
  assert.equal(unavailableBoth.attention.kind, "offline");
  assert.match(unavailableBoth.attention.detail, /last reported/i);

  const emptyOffline = buildStationDetailModel({
    state: "live",
    station: { id: "CP-2", name: "Kandy Depot", status: "OFFLINE" },
    connectors: { state: "live", items: [] },
    transactions: { state: "live", items: [] },
  });
  assert.equal(emptyOffline.connectorCounts?.total, 0);
  assert.equal(emptyOffline.activeSessionCount, 0);

  assert.equal(formatSessionDuration("2026-10-08T08:00:00Z", null), null);
  assert.equal(formatSessionDuration("2026-10-08T08:00:00Z", "2026-10-08T07:00:00Z"), null);
  assert.equal(formatSessionDuration("bad-date", "2026-10-08T08:00:00Z"), null);
  assert.equal(formatSessionDuration("2026-10-08T08:00:00Z", "2026-10-08T08:00:30Z"), "< 1m");
});
