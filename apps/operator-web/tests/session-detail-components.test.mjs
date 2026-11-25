import assert from "node:assert/strict";
import { readFileSync, statSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { test } from "node:test";
import vm from "node:vm";

const require = createRequire(import.meta.url);
const ts = require("typescript");
const React = require("react");
const { renderToStaticMarkup } = require("react-dom/server");

const srcDir = path.resolve(new URL("../src", import.meta.url).pathname);
const cache = new Map();

function loadModule(relPath) {
  const absPath = path.resolve(srcDir, relPath);
  if (cache.has(absPath)) return cache.get(absPath);
  const source = readFileSync(absPath, "utf8");
  const { outputText } = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
      jsx: ts.JsxEmit.ReactJSX,
      esModuleInterop: true,
    },
  });
  const mod = { exports: {} };
  cache.set(absPath, mod.exports);
  const localRequire = id => {
    if (id.startsWith("./")) {
      const target = path.resolve(path.dirname(absPath), id);
      const file = statSync(`${target}.tsx`, { throwIfNoEntry: false }) ? `${target}.tsx` : `${target}.ts`;
      return loadModule(path.relative(srcDir, file));
    }
    if (id.startsWith("@/")) {
      const target = path.resolve(srcDir, id.slice(2));
      const file = statSync(`${target}.tsx`, { throwIfNoEntry: false }) ? `${target}.tsx` : `${target}.ts`;
      return loadModule(path.relative(srcDir, file));
    }
    if (id === "next/navigation") {
      return { useRouter: () => ({ refresh() {} }) };
    }
    return require(id);
  };
  const fn = vm.runInThisContext(`(function(exports, require, module) {\n${outputText}\n})`);
  fn(mod.exports, localRequire, mod);
  cache.set(absPath, mod.exports);
  return mod.exports;
}

const { buildSessionDetailModel } = loadModule("lib/session-detail-model.ts");
const { SessionDetailView } = loadModule("components/sessions/session-detail-view.tsx");
const { SessionDetailLoading } = loadModule("components/sessions/session-detail-states.tsx");

const sampleLiveSnapshot = {
  state: "live",
  transaction: {
    stationId: "CP%1",
    transactionId: "TX%1",
    evseId: 1,
    connectorId: 2,
    status: "ENDED",
    startedAt: "2026-10-08T08:00:00Z",
    endedAt: "2026-10-08T08:30:00Z",
    lastSequenceNumber: 3,
  },
  completeness: {
    state: "live",
    completeness: {
      status: "INCOMPLETE",
      firstSequenceNumber: 0,
      lastSequenceNumber: 3,
      missingSequenceNumbers: [1],
    },
  },
  meterSamples: {
    state: "live",
    samples: [
      {
        sequenceNumber: 0,
        sampledAt: "2026-10-08T08:05:00Z",
        value: "7.4",
        measurand: "Power.Active.Import",
        context: "Sample.Periodic",
        phase: null,
        location: "Outlet",
        unit: "W",
        unitMultiplier: 3,
      },
      {
        sequenceNumber: 2,
        sampledAt: "2026-10-08T08:15:00Z",
        value: "bad",
        measurand: "Power.Active.Import",
        context: "Sample.Periodic",
        phase: null,
        location: "Outlet",
        unit: "W",
        unitMultiplier: 3,
      },
      {
        sequenceNumber: 3,
        sampledAt: "2026-10-08T08:20:00Z",
        value: "7.8",
        measurand: "Power.Active.Import",
        context: "Sample.Periodic",
        phase: null,
        location: "Outlet",
        unit: "W",
        unitMultiplier: 3,
      },
    ],
  },
};

test("SessionDetailView renders overview with separated indicators and preserved directory returnTo", () => {
  const model = buildSessionDetailModel(sampleLiveSnapshot, {
    section: "overview",
    returnTo: "/sessions?integrityStatus=INCOMPLETE",
  });
  const html = renderToStaticMarkup(React.createElement(SessionDetailView, { model }));

  assert.match(html, /Back to Charging sessions/);
  assert.match(html, /href="\/sessions\?integrityStatus=INCOMPLETE"/);
  assert.match(html, /href="\/stations\/CP%251\/sessions\/TX%251\?section=measurements&amp;returnTo=%2Fsessions%3FintegrityStatus%3DINCOMPLETE"/);
  assert.match(html, /Ended/);
  assert.match(html, /Missing data/);
  assert.match(html, /30m/);
});

test("SessionDetailView renders measurements chart with honest messaging and preserves unplottable raw row", () => {
  const model = buildSessionDetailModel(sampleLiveSnapshot, {
    section: "measurements",
  });
  const html = renderToStaticMarkup(React.createElement(SessionDetailView, { model }));

  assert.match(html, /Only recorded measurements are displayed/);
  assert.match(html, /Telemetry gaps break the plotted line/);
  assert.match(html, /7\.4 kW/);
  assert.match(html, /bad × 10\^3 W/);
  assert.match(html, /Non-numeric raw value/);
});

test("SessionDetailView renders technical identifiers, bounded completeness rail, and partial error recovery", () => {
  const partialModel = buildSessionDetailModel(
    {
      ...sampleLiveSnapshot,
      completeness: { state: "unavailable", message: "Completeness unavailable" },
      meterSamples: { state: "unavailable", samples: [], message: "Measurements unavailable" },
    },
    { section: "technical" },
  );
  const partialHtml = renderToStaticMarkup(React.createElement(SessionDetailView, { model: partialModel }));
  assert.match(partialHtml, /Copy session ID/);
  assert.match(partialHtml, /Copy station ID/);
  assert.match(partialHtml, /Completeness unavailable/);

  const techModel = buildSessionDetailModel(sampleLiveSnapshot, {
    section: "technical",
  });
  const techHtml = renderToStaticMarkup(React.createElement(SessionDetailView, { model: techModel }));
  assert.match(techHtml, /OCPP sequence completeness audit/);
  assert.match(techHtml, /Seq 1/);

  const loadingHtml = renderToStaticMarkup(React.createElement(SessionDetailLoading));
  assert.match(loadingHtml, /aria-busy="true"/);
  assert.match(loadingHtml, /Loading charging session/);
});
