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

const { buildStationDetailModel } = loadModule("lib/station-detail-model.ts");
const { StationDetailHeader } = loadModule("components/stations/station-detail-header.tsx");
const { StationConnectorsSection } = loadModule("components/stations/station-connectors-section.tsx");
const { StationOverviewSection } = loadModule("components/stations/station-overview-section.tsx");
const { StationSessionsSection } = loadModule("components/stations/station-sessions-section.tsx");
const { StationConnectionSection } = loadModule("components/stations/station-connection-section.tsx");
const { StationDetailLoading } = loadModule("components/stations/station-detail-loading.tsx");

test("StationDetailHeader renders back return link, protocol badge, active section, and offline guidance", () => {
  const model = buildStationDetailModel(
    {
      state: "live",
      station: { id: "CP%1", name: "Kandy Depot", status: "OFFLINE" },
      connectors: { state: "live", items: [] },
      transactions: { state: "live", items: [] },
    },
    { section: "connectors", returnPath: "/stations?status=OFFLINE" },
  );

  const html = renderToStaticMarkup(React.createElement(StationDetailHeader, { model }));
  assert.match(html, /href="\/stations\?status=OFFLINE"[^>]*>← Back to charging stations/);
  assert.match(html, /<h1[^>]*>Kandy Depot<\/h1>/);
  assert.match(html, />CP%1</);
  assert.match(html, />OCPP 2\.0\.1</);
  assert.match(html, /Station is currently reported offline/);
  assert.match(html, /aria-current="page"[^>]*href="\/stations\/CP%251\?section=connectors&amp;returnTo=%2Fstations%3Fstatus%3DOFFLINE"/);
});

test("StationConnectorsSection renders composite EVSE cards, offline last-reported note, empty, and error states", () => {
  const modelWithMultiEvse = buildStationDetailModel({
    state: "live",
    station: { id: "CP-2", name: "Kandy Depot", status: "OFFLINE" },
    connectors: {
      state: "live",
      items: [
        { evseId: 1, connectorId: 1, status: "AVAILABLE", statusUpdatedAt: "2026-10-08T09:00:00Z" },
        { evseId: 2, connectorId: 1, status: "FAULTED", statusUpdatedAt: "2026-10-08T09:01:00Z" },
      ],
    },
    transactions: { state: "live", items: [] },
  });

  const connectorsHtml = renderToStaticMarkup(
    React.createElement(StationConnectorsSection, { model: modelWithMultiEvse }),
  );
  assert.match(connectorsHtml, /EVSE 1 · Connector 1/);
  assert.match(connectorsHtml, /EVSE 2 · Connector 1/);
  assert.match(connectorsHtml, /Last reported status — station currently offline/);
  assert.match(connectorsHtml, /generic visual representations/);

  const unavailableModel = buildStationDetailModel({
    state: "live",
    station: { id: "CP-1", name: "Colombo Central", status: "ONLINE" },
    connectors: { state: "unavailable", items: [], message: "Equipment read failed." },
    transactions: { state: "live", items: [] },
  });
  const unavailableHtml = renderToStaticMarkup(
    React.createElement(StationConnectorsSection, { model: unavailableModel }),
  );
  assert.match(unavailableHtml, /Unable to load connector equipment/);
  assert.match(unavailableHtml, /Equipment read failed\./);
  assert.doesNotMatch(unavailableHtml, /No connectors reported/);

  const loadingHtml = renderToStaticMarkup(React.createElement(StationDetailLoading));
  assert.match(loadingHtml, /role="status"/);
  assert.match(loadingHtml, /aria-busy="true"/);
});

test("StationOverviewSection preserves independent sections on partial failures and uses Unknown for failed counts", () => {
  const partialTxFailure = buildStationDetailModel({
    state: "live",
    station: { id: "CP-1", name: "Colombo Central", status: "ONLINE" },
    connectors: {
      state: "live",
      items: [
        { evseId: 1, connectorId: 1, status: "AVAILABLE", statusUpdatedAt: "2026-10-08T09:00:00Z" },
      ],
    },
    transactions: { state: "unavailable", items: [], message: "Session query timed out." },
  });

  const overviewHtml = renderToStaticMarkup(
    React.createElement(StationOverviewSection, { model: partialTxFailure }),
  );
  assert.match(overviewHtml, /EVSE 1 · Connector 1/);
  assert.match(overviewHtml, />Unknown<\/p>/);
  assert.match(overviewHtml, /Unable to load charging sessions/);
  assert.match(overviewHtml, /Session query timed out\./);
  assert.doesNotMatch(overviewHtml, /No charging sessions yet/);
});

test("StationSessionsSection and StationConnectionSection enforce encoded links, valid duration, and secret boundaries", () => {
  const fullModel = buildStationDetailModel({
    state: "live",
    station: { id: "CP%1", name: "Colombo Central", status: "ONLINE" },
    connectors: { state: "live", items: [] },
    transactions: {
      state: "live",
      items: [
        {
          stationId: "CP%1",
          transactionId: "TX%1",
          evseId: 2,
          connectorId: 1,
          status: "ENDED",
          startedAt: "2026-10-08T08:00:00Z",
          endedAt: "2026-10-08T09:30:00Z",
          lastSequenceNumber: 4,
        },
      ],
    },
  });

  const sessionsHtml = renderToStaticMarkup(
    React.createElement(StationSessionsSection, { model: fullModel }),
  );
  assert.match(sessionsHtml, /href="\/stations\/CP%251\/transactions\/TX%251"/);
  assert.match(sessionsHtml, /EVSE 2 · Connector 1/);
  assert.match(sessionsHtml, /Duration 1h 30m/);
  assert.doesNotMatch(sessionsHtml, /Complete/);

  const connectionHtml = renderToStaticMarkup(
    React.createElement(StationConnectionSection, { model: fullModel }),
  );
  assert.match(connectionHtml, />CP%1</);
  assert.match(connectionHtml, /OCPP 2\.0\.1/);
  assert.match(connectionHtml, />\/ocpp\/CP%1</);
  assert.match(connectionHtml, /Copy station ID/);
  assert.match(connectionHtml, /Copy OCPP path/);
  assert.match(connectionHtml, /No public WebSocket gateway URL is configured/);
  assert.doesNotMatch(connectionHtml, /graphql/i);
});
