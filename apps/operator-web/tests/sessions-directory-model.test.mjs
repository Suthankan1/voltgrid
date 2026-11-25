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
  const localRequire = (id) => {
    if (id.startsWith("./")) {
      return loadTs(`${id.slice(2)}.ts`);
    }
    return require(id);
  };
  const fn = vm.runInThisContext(
    `(function(exports, require, module) {\n${outputText}\n})`,
  );
  fn(mod.exports, localRequire, mod);
  cache.set(absPath, mod.exports);
  return mod.exports;
}

const {
  DEFAULT_SESSION_PAGE_SIZE,
  buildSessionsDirectoryDetailHref,
  buildSessionsDirectoryHref,
  buildSessionsDirectoryModel,
  buildVerifiedStationNameMap,
  normalizeSessionsDirectoryFilters,
  resolveLegacyTransactionsRedirectTarget,
  sanitizeSessionsDirectoryReturnPath,
} = loadTs("sessions-directory-model.ts");

function makeRecord(overrides = {}) {
  return {
    transaction: {
      stationId: "CP-1",
      transactionId: "TX-1",
      evseId: 1,
      connectorId: 2,
      status: "ENDED",
      startedAt: "2026-10-08T08:00:00Z",
      endedAt: "2026-10-08T09:15:00Z",
      lastSequenceNumber: 4,
      ...(overrides.transaction ?? {}),
    },
    completeness: {
      status: "COMPLETE",
      firstSequenceNumber: 0,
      lastSequenceNumber: 4,
      missingSequenceNumbers: [],
      ...(overrides.completeness ?? {}),
    },
  };
}

test("normalizeSessionsDirectoryFilters validates page/size bounds, preserves casing, and maps legacy aliases", () => {
  const defaults = normalizeSessionsDirectoryFilters({});
  assert.deepEqual(defaults, {
    stationId: null,
    transactionId: null,
    integrityStatus: null,
    page: 0,
    size: DEFAULT_SESSION_PAGE_SIZE,
  });

  const legacy = normalizeSessionsDirectoryFilters({
    station: "  cp-Case_01  ",
    q: "  tx-MixedCase  ",
    integrity: "INCOMPLETE",
    page: "2",
    size: "50",
  });
  assert.deepEqual(legacy, {
    stationId: "cp-Case_01",
    transactionId: "tx-MixedCase",
    integrityStatus: "INCOMPLETE",
    page: 2,
    size: 50,
  });

  const canonicalOverridesLegacy = normalizeSessionsDirectoryFilters({
    stationId: "CP-CANON",
    station: "CP-OLD",
    transactionId: "TX-CANON",
    q: "TX-OLD",
    integrityStatus: "UNKNOWN",
    integrity: "COMPLETE",
    page: "-5",
    size: "999",
  });
  assert.equal(canonicalOverridesLegacy.stationId, "CP-CANON");
  assert.equal(canonicalOverridesLegacy.transactionId, "TX-CANON");
  assert.equal(canonicalOverridesLegacy.integrityStatus, "UNKNOWN");
  assert.equal(canonicalOverridesLegacy.page, 0);
  assert.equal(canonicalOverridesLegacy.size, DEFAULT_SESSION_PAGE_SIZE);

  assert.equal(
    normalizeSessionsDirectoryFilters({ integrityStatus: "INVALID", page: "1.5", size: "0" })
      .integrityStatus,
    null,
  );
  assert.equal(normalizeSessionsDirectoryFilters({ page: "1.5" }).page, 0);
  assert.equal(normalizeSessionsDirectoryFilters({ size: "0" }).size, DEFAULT_SESSION_PAGE_SIZE);
});

test("legacy redirect builder, href builder, and return-path validator prevent open redirects and keep encoding", () => {
  assert.equal(
    resolveLegacyTransactionsRedirectTarget({
      station: "CP%1",
      q: "TX/1",
      integrity: "IN_PROGRESS",
      page: "1",
      size: "10",
      evil: "https://evil.example",
    }),
    "/sessions?stationId=CP%251&transactionId=TX%2F1&integrityStatus=IN_PROGRESS&page=1&size=10",
  );

  assert.equal(buildSessionsDirectoryHref({ page: 0, size: 20 }), "/sessions");
  assert.equal(
    buildSessionsDirectoryDetailHref("CP%1", "TX%1", "/sessions?integrityStatus=INCOMPLETE&page=1"),
    "/stations/CP%251/sessions/TX%251?returnTo=%2Fsessions%3FintegrityStatus%3DINCOMPLETE%26page%3D1",
  );
  assert.equal(
    buildSessionsDirectoryDetailHref("CP-1", "TX-1", "/sessions"),
    "/stations/CP-1/sessions/TX-1",
  );

  assert.equal(
    sanitizeSessionsDirectoryReturnPath("/sessions?stationId=CP%251&page=2"),
    "/sessions?stationId=CP%251&page=2",
  );
  assert.equal(sanitizeSessionsDirectoryReturnPath("https://evil.example/sessions"), null);
  assert.equal(sanitizeSessionsDirectoryReturnPath("//evil.example/sessions"), null);
  assert.equal(sanitizeSessionsDirectoryReturnPath("/stations"), null);
  assert.equal(sanitizeSessionsDirectoryReturnPath("/sessions\\evil"), null);
});

test("buildSessionsDirectoryModel formats server pagination ranges, preserves order and composite identities, and avoids fabricated durations", () => {
  const stationNames = buildVerifiedStationNameMap({
    state: "live",
    stations: [
      { id: "CP-1", name: "Colombo Central", status: "ONLINE" },
      { id: "CP-2", name: "   ", status: "OFFLINE" },
    ],
  });

  // Note identical transactionId "TX-SHARED" on two different stations
  const row1 = makeRecord({
    transaction: {
      stationId: "CP-1",
      transactionId: "TX-SHARED",
      status: "ACTIVE",
      endedAt: null,
      startedAt: "2026-10-08T10:00:00Z",
    },
    completeness: { status: "IN_PROGRESS", missingSequenceNumbers: [] },
  });
  const row2 = makeRecord({
    transaction: {
      stationId: "CP-2",
      transactionId: "TX-SHARED",
      status: "ENDED",
      startedAt: "2026-10-08T09:00:00Z",
      endedAt: "2026-10-08T08:00:00Z", // invalid negative range
    },
    completeness: { status: "INCOMPLETE", missingSequenceNumbers: [2, 3] },
  });

  const filters = normalizeSessionsDirectoryFilters({ page: "1", size: "2" });
  const model = buildSessionsDirectoryModel(
    {
      state: "live",
      transactions: [row1, row2],
      page: 1,
      size: 2,
      totalElements: 5,
      totalPages: 3,
      hasNext: true,
    },
    filters,
    {
      stationNames,
      networkMissingDataSnapshot: {
        state: "live",
        transactions: [],
        page: 0,
        size: 1,
        totalElements: 4,
        totalPages: 4,
        hasNext: true,
      },
      retrievedAtIso: "2026-10-08T10:05:00Z",
    },
  );

  assert.equal(model.availability, "live");
  assert.equal(model.directoryState, "results");
  assert.equal(model.totalMatchingSessions, 5);
  assert.equal(model.networkMissingDataCount, 4);
  assert.equal(model.pagination.displayPage, 2);
  assert.equal(model.pagination.displayTotalPages, 3);
  assert.equal(model.pagination.rangeStart, 3);
  assert.equal(model.pagination.rangeEnd, 4);
  assert.equal(model.pagination.previousHref, "/sessions?size=2");
  assert.equal(model.pagination.nextHref, "/sessions?page=2&size=2");
  assert.equal(model.pagination.isOutOfRange, false);

  assert.equal(model.rows.length, 2);
  assert.equal(model.rows[0].compositeKey, "CP-1:TX-SHARED");
  assert.equal(model.rows[0].stationName, "Colombo Central");
  assert.equal(model.rows[0].durationLabel, null);
  assert.equal(model.rows[0].completeness.detailLabel, "Receiving events");
  assert.match(model.rows[0].sessionHref, /^\/stations\/CP-1\/sessions\/TX-SHARED\?returnTo=/);

  assert.equal(model.rows[1].compositeKey, "CP-2:TX-SHARED");
  assert.equal(model.rows[1].stationName, null); // Blank station name omitted cleanly
  assert.equal(model.rows[1].durationLabel, null); // Negative duration rejected cleanly
  assert.equal(model.rows[1].completeness.status, "INCOMPLETE");
  assert.equal(model.rows[1].completeness.detailLabel, "Missing #2, #3");
});

test("buildSessionsDirectoryModel distinguishes empty network, no-matches, out-of-range page, unavailable API, and partial summary failure", () => {
  const emptyModel = buildSessionsDirectoryModel(
    {
      state: "live",
      transactions: [],
      page: 0,
      size: 20,
      totalElements: 0,
      totalPages: 0,
      hasNext: false,
    },
    normalizeSessionsDirectoryFilters({}),
  );
  assert.equal(emptyModel.directoryState, "empty");
  assert.equal(emptyModel.totalMatchingSessions, 0);
  assert.equal(emptyModel.pagination.displayPage, 0);
  assert.equal(emptyModel.pagination.isOutOfRange, false);

  const outOfRangeModel = buildSessionsDirectoryModel(
    {
      state: "live",
      transactions: [],
      page: 5,
      size: 20,
      totalElements: 22,
      totalPages: 2,
      hasNext: false,
    },
    normalizeSessionsDirectoryFilters({ page: "5", stationId: "CP-1" }),
  );
  assert.equal(outOfRangeModel.directoryState, "no-matches");
  assert.equal(outOfRangeModel.pagination.isOutOfRange, true);
  assert.equal(outOfRangeModel.pagination.clampedPage, 1);

  const unavailableModel = buildSessionsDirectoryModel(
    {
      state: "unavailable",
      transactions: [],
      page: 0,
      size: 20,
      totalElements: 0,
      totalPages: 0,
      hasNext: false,
      message: "Station API could not be reached.",
    },
    normalizeSessionsDirectoryFilters({}),
  );
  assert.equal(unavailableModel.directoryState, "unavailable");
  assert.equal(unavailableModel.totalMatchingSessions, null);
  assert.equal(unavailableModel.networkMissingDataCount, null);

  // Partial failure: main page live, independent missing-data summary failed -> rows stay live, missing-data is null
  const partialFailureModel = buildSessionsDirectoryModel(
    {
      state: "live",
      transactions: [
        makeRecord({
          completeness: { status: "UNKNOWN", missingSequenceNumbers: [] },
        }),
      ],
      page: 0,
      size: 20,
      totalElements: 1,
      totalPages: 1,
      hasNext: false,
    },
    normalizeSessionsDirectoryFilters({}),
    {
      networkMissingDataSnapshot: {
        state: "unavailable",
        transactions: [],
        page: 0,
        size: 1,
        totalElements: 0,
        totalPages: 0,
        hasNext: false,
        message: "Timed out",
      },
    },
  );
  assert.equal(partialFailureModel.directoryState, "results");
  assert.equal(partialFailureModel.totalMatchingSessions, 1);
  assert.equal(partialFailureModel.networkMissingDataCount, null);
  assert.equal(partialFailureModel.rows[0].completeness.detailLabel, "Insufficient receipt history");
});
