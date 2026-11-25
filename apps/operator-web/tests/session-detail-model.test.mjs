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
  return mod.exports;
}

const {
  MAX_CHART_POINTS,
  MAX_SEQUENCE_RAIL_SLOTS,
  buildCanonicalSessionDetailHref,
  buildLegacyTransactionToSessionRedirectHref,
  buildSessionDetailModel,
  buildSessionSequenceModel,
  normalizeSessionDetailSection,
  sanitizeSessionDetailReturnPath,
} = loadTs("session-detail-model.ts");

const baseTransaction = {
  stationId: "CP%1",
  transactionId: "TX%1",
  evseId: 1,
  connectorId: 2,
  status: "ENDED",
  startedAt: "2026-10-08T08:00:00Z",
  endedAt: "2026-10-08T08:45:00Z",
  lastSequenceNumber: 4,
};

test("normalizes URL section, preserves valid internal return paths, and strips unsafe legacy redirects", () => {
  assert.equal(normalizeSessionDetailSection(undefined), "overview");
  assert.equal(normalizeSessionDetailSection("measurements"), "measurements");
  assert.equal(normalizeSessionDetailSection(["technical", "ignored"]), "technical");
  assert.equal(normalizeSessionDetailSection("invalid-tab"), "overview");

  assert.equal(
    sanitizeSessionDetailReturnPath("/sessions?integrityStatus=INCOMPLETE&page=1", "CP%1"),
    "/sessions?integrityStatus=INCOMPLETE&page=1",
  );
  assert.equal(
    sanitizeSessionDetailReturnPath("/stations/CP%251?section=sessions", "CP%1"),
    "/stations/CP%251?section=sessions",
  );
  assert.equal(
    sanitizeSessionDetailReturnPath("/stations/OTHER?section=sessions", "CP%1"),
    null,
  );
  assert.equal(sanitizeSessionDetailReturnPath("https://evil.example", "CP%1"), null);

  assert.equal(
    buildCanonicalSessionDetailHref("CP%1", "TX%1", {
      section: "measurements",
      returnTo: "/sessions?page=1",
    }),
    "/stations/CP%251/sessions/TX%251?section=measurements&returnTo=%2Fsessions%3Fpage%3D1",
  );

  assert.equal(
    buildLegacyTransactionToSessionRedirectHref("CP%1", "TX%1", {
      section: "technical",
      returnTo: "//evil.example",
    }),
    "/stations/CP%251/sessions/TX%251?section=technical",
  );
});

test("handles unitMultiplier once without double-conversion and refuses to merge incompatible streams", () => {
  const model = buildSessionDetailModel({
    state: "live",
    transaction: baseTransaction,
    completeness: {
      state: "live",
      completeness: {
        status: "COMPLETE",
        firstSequenceNumber: 0,
        lastSequenceNumber: 4,
        missingSequenceNumbers: [],
      },
    },
    meterSamples: {
      state: "live",
      samples: [
        {
          sequenceNumber: 2,
          sampledAt: "2026-10-08T08:10:00Z",
          value: "7.4",
          measurand: "Power.Active.Import",
          context: "Sample.Periodic",
          phase: null,
          location: "Outlet",
          unit: "W",
          unitMultiplier: 3,
        },
        {
          sequenceNumber: 1,
          sampledAt: "2026-10-08T08:05:00Z",
          value: "7200",
          measurand: "Power.Active.Import",
          context: "Sample.Periodic",
          phase: null,
          location: "Outlet",
          unit: "W",
          unitMultiplier: 0,
        },
        {
          sequenceNumber: 2,
          sampledAt: "2026-10-08T08:10:00Z",
          value: "7.4",
          measurand: "Power.Active.Import",
          context: "Sample.Periodic",
          phase: "L1",
          location: "Outlet",
          unit: "W",
          unitMultiplier: 3,
        },
        {
          sequenceNumber: 3,
          sampledAt: "2026-10-08T08:20:00Z",
          value: "12.5",
          measurand: "Energy.Active.Import.Register",
          context: "Sample.Periodic",
          phase: null,
          location: "Outlet",
          unit: "Wh",
          unitMultiplier: 3,
        },
      ],
    },
  });

  // 3 distinct streams: W total power, W L1 phase power, Wh energy register
  assert.equal(model.streams.length, 3);
  const powerStream = model.streams.find(
    s => s.measurandLabel === "Power.Active.Import" && s.phaseLabel === null,
  );
  assert.ok(powerStream);
  assert.equal(powerStream.totalSamples, 2);
  assert.equal(powerStream.displayUnit, "kW");
  assert.equal(powerStream.isCumulativeRegister, false);
  // Sorted chronologically (seq 1 at 08:05 before seq 2 at 08:10) and multiplier applied once: 7200 W -> 7.2 kW, 7.4x10^3 W -> 7.4 kW
  assert.equal(powerStream.samples[0].sequenceNumber, 1);
  assert.equal(powerStream.samples[0].normalizedReadingLabel, "7.2 kW");
  assert.equal(powerStream.samples[1].normalizedReadingLabel, "7.4 kW");
  assert.equal(powerStream.samples[1].rawReadingLabel, "7.4 × 10^3 W");

  const registerStream = model.streams.find(
    s => s.measurandLabel === "Energy.Active.Import.Register",
  );
  assert.ok(registerStream);
  assert.equal(registerStream.isCumulativeRegister, true);
  assert.equal(registerStream.displayUnit, "kWh");
  assert.equal(registerStream.samples[0].normalizedReadingLabel, "12.5 kWh");
});

test("supports single-point, constant, negative, duplicate timestamp, unplottable raw samples, and gap breaks", () => {
  const model = buildSessionDetailModel({
    state: "live",
    transaction: { ...baseTransaction, lastSequenceNumber: 10 },
    completeness: {
      state: "live",
      completeness: {
        status: "INCOMPLETE",
        firstSequenceNumber: 0,
        lastSequenceNumber: 10,
        missingSequenceNumbers: [3, 4],
      },
    },
    meterSamples: {
      state: "live",
      samples: [
        // Single-point constant signed export stream
        {
          sequenceNumber: 1,
          sampledAt: "2026-10-08T08:01:00Z",
          value: "-1500",
          measurand: "Power.Active.Export",
          context: "Sample.Periodic",
          phase: null,
          location: "Outlet",
          unit: "W",
          unitMultiplier: 0,
        },
        // Mixed-sign reactive power crossing zero
        {
          sequenceNumber: 1,
          sampledAt: "2026-10-08T08:01:00Z",
          value: "-500",
          measurand: "Power.Reactive.Import",
          context: "Sample.Periodic",
          phase: null,
          location: "Outlet",
          unit: "var",
          unitMultiplier: 0,
        },
        {
          sequenceNumber: 2,
          sampledAt: "2026-10-08T08:02:00Z",
          value: "800",
          measurand: "Power.Reactive.Import",
          context: "Sample.Periodic",
          phase: null,
          location: "Outlet",
          unit: "var",
          unitMultiplier: 0,
        },
        // Constant + duplicate timestamp + gap across missing sequences 3 & 4 + invalid raw value
        {
          sequenceNumber: 1,
          sampledAt: "2026-10-08T08:01:00Z",
          value: "400",
          measurand: "Voltage",
          context: "Sample.Periodic",
          phase: null,
          location: "Outlet",
          unit: "V",
          unitMultiplier: 0,
        },
        {
          sequenceNumber: 2,
          sampledAt: "2026-10-08T08:01:00Z",
          value: "400",
          measurand: "Voltage",
          context: "Sample.Periodic",
          phase: null,
          location: "Outlet",
          unit: "V",
          unitMultiplier: 0,
        },
        {
          sequenceNumber: 5,
          sampledAt: "2026-10-08T08:05:00Z",
          value: "not-a-number",
          measurand: "Voltage",
          context: "Sample.Periodic",
          phase: null,
          location: "Outlet",
          unit: "V",
          unitMultiplier: 0,
        },
        {
          sequenceNumber: 6,
          sampledAt: "2026-10-08T08:06:00Z",
          value: "400",
          measurand: "Voltage",
          context: "Sample.Periodic",
          phase: null,
          location: "Outlet",
          unit: "V",
          unitMultiplier: 0,
        },
      ],
    },
  });

  const exportStream = model.streams.find(s => s.measurandLabel === "Power.Active.Export");
  assert.ok(exportStream);
  assert.equal(exportStream.hasNegativeValues, true);
  assert.equal(exportStream.isConstantSeries, true);
  assert.equal(exportStream.zeroLineY, null);
  assert.equal(exportStream.plotSegments.length, 1);
  assert.equal(exportStream.plotSegments[0].length, 1);
  assert.ok(Number.isFinite(exportStream.plotSegments[0][0].x));
  assert.ok(Number.isFinite(exportStream.plotSegments[0][0].y));

  const reactiveStream = model.streams.find(s => s.measurandLabel === "Power.Reactive.Import");
  assert.ok(reactiveStream);
  assert.equal(reactiveStream.hasNegativeValues, true);
  assert.ok(reactiveStream.zeroLineY !== null);

  const voltageStream = model.streams.find(s => s.measurandLabel === "Voltage");
  assert.ok(voltageStream);
  assert.equal(voltageStream.totalSamples, 4);
  assert.equal(voltageStream.plottableSamples, 3);
  assert.equal(voltageStream.unplottableSamples, 1);
  assert.equal(voltageStream.hasDuplicateTimestamps, true);
  assert.equal(voltageStream.isConstantSeries, true);
  assert.equal(voltageStream.gapBreakCount, 1);
  assert.equal(voltageStream.plotSegments.length, 2);
  assert.equal(voltageStream.plotSegments[0].length, 2);
  assert.equal(voltageStream.plotSegments[1].length, 1);

  const badRow = model.allSamplesChronological.find(s => s.rawValue === "not-a-number");
  assert.ok(badRow);
  assert.equal(badRow.plottable, false);
  assert.equal(badRow.invalidReason, "non-numeric");
});

test("downsamples huge sample streams safely without losing peaks or all raw table rows", () => {
  const samples = Array.from({ length: 300 }, (_, i) => ({
    sequenceNumber: i,
    sampledAt: new Date(Date.UTC(2026, 9, 8, 8, Math.floor(i / 60), i % 60)).toISOString(),
    value: i === 150 ? "22000" : "7000",
    measurand: "Power.Active.Import",
    context: "Sample.Periodic",
    phase: null,
    location: "Outlet",
    unit: "W",
    unitMultiplier: 0,
  }));

  const model = buildSessionDetailModel({
    state: "live",
    transaction: { ...baseTransaction, lastSequenceNumber: 299 },
    completeness: { state: "unavailable", message: "Completeness unavailable" },
    meterSamples: { state: "live", samples },
  });

  assert.equal(model.completenessAvailability, "unavailable");
  assert.equal(model.measurementsAvailability, "live");
  assert.equal(model.allSamplesChronological.length, 300);
  const stream = model.streams[0];
  assert.ok(stream);
  assert.equal(stream.isDownsampled, true);
  assert.ok(stream.renderedPointCount <= MAX_CHART_POINTS);
  assert.ok(stream.plotSegments[0].some(pt => pt.normalizedValue === 22000));
});

test("bounds sequence rail for huge ranges and surfaces null or inconsistent bounds cleanly", () => {
  const large = buildSessionSequenceModel(
    { ...baseTransaction, lastSequenceNumber: 100000 },
    {
      state: "live",
      completeness: {
        status: "INCOMPLETE",
        firstSequenceNumber: 0,
        lastSequenceNumber: 100000,
        missingSequenceNumbers: [500, 501, 502],
      },
    },
  );
  assert.equal(large.availability, "live");
  assert.equal(large.expectedSpanCount, 100001);
  assert.equal(large.railTruncated, true);
  assert.ok(large.railItems.length <= MAX_SEQUENCE_RAIL_SLOTS + 2);
  assert.ok(large.railItems.some(item => item.kind === "ellipsis"));

  const unknownNullStart = buildSessionSequenceModel(baseTransaction, {
    state: "live",
    completeness: {
      status: "UNKNOWN",
      firstSequenceNumber: null,
      lastSequenceNumber: 4,
      missingSequenceNumbers: [],
    },
  });
  assert.equal(unknownNullStart.availability, "live");
  assert.equal(unknownNullStart.hasUnboundedStart, true);
  assert.equal(unknownNullStart.expectedSpanCount, null);
  assert.equal(unknownNullStart.railItems.length, 0);

  const inconsistent = buildSessionSequenceModel(
    { ...baseTransaction, lastSequenceNumber: 8 },
    {
      state: "live",
      completeness: {
        status: "COMPLETE",
        firstSequenceNumber: 5,
        lastSequenceNumber: 2,
        missingSequenceNumbers: [9],
      },
    },
  );
  assert.equal(inconsistent.availability, "live");
  assert.equal(inconsistent.hasRangeInconsistency, true);
  assert.ok(inconsistent.inconsistencyReasons.length >= 2);
});
