import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { test } from "node:test";
import vm from "node:vm";

const require = createRequire(import.meta.url);
const ts = require("typescript");
const React = require("react");
const { renderToStaticMarkup } = require("react-dom/server");

function loadTsxModule(relPath) {
  const source = readFileSync(new URL(relPath, import.meta.url), "utf8");
  const { outputText } = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
      jsx: ts.JsxEmit.ReactJSX,
      esModuleInterop: true,
    },
  });
  const mod = { exports: {} };
  const fn = vm.runInThisContext(`(function(exports, require, module) {\n${outputText}\n})`);
  fn(mod.exports, require, mod);
  return mod.exports;
}

const {
  StatusIndicator,
  StationStatusIndicator,
  ConnectorStatusIndicator,
  SessionLifecycleIndicator,
  SessionCompletenessIndicator,
  OperationsStatusIndicator,
  getStationConnectivityDisplay,
  getConnectorStatusDisplay,
  getSessionLifecycleDisplay,
  getSessionCompletenessDisplay,
  getOperationsStatusDisplay,
} = loadTsxModule("../src/components/ui/status-indicator.tsx");

test("station connectivity maps ONLINE and OFFLINE without conflating offline with fault", () => {
  assert.deepEqual(
    { tone: getStationConnectivityDisplay("ONLINE").tone, label: getStationConnectivityDisplay("ONLINE").label },
    { tone: "success", label: "Online" },
  );
  assert.deepEqual(
    { tone: getStationConnectivityDisplay("OFFLINE").tone, label: getStationConnectivityDisplay("OFFLINE").label },
    { tone: "neutral", label: "Offline" },
  );

  const offlineHtml = renderToStaticMarkup(React.createElement(StationStatusIndicator, { status: "OFFLINE" }));
  assert.match(offlineHtml, /--vg-neutral/);
  assert.match(offlineHtml, />Offline<\/span>/);
  assert.match(offlineHtml, /<svg aria-hidden="true"/);
});

test("connector status maps all 5 values and keeps OCCUPIED distinct from charging", () => {
  const expected = [
    ["AVAILABLE", "success", "Available"],
    ["OCCUPIED", "info", "Occupied"],
    ["RESERVED", "warning", "Reserved"],
    ["UNAVAILABLE", "neutral", "Unavailable"],
    ["FAULTED", "danger", "Faulted"],
  ];
  for (const [value, tone, label] of expected) {
    const display = getConnectorStatusDisplay(value);
    assert.equal(display.tone, tone);
    assert.equal(display.label, label);
    const html = renderToStaticMarkup(React.createElement(ConnectorStatusIndicator, { status: value }));
    assert.match(html, new RegExp(`>${label}</span>`));
    assert.match(html, new RegExp(`--vg-${tone}`));
  }
});

test("session lifecycle and completeness remain independent domains", () => {
  assert.equal(getSessionLifecycleDisplay("ACTIVE").tone, "info");
  assert.equal(getSessionLifecycleDisplay("ACTIVE").label, "Active");
  assert.equal(getSessionLifecycleDisplay("ENDED").tone, "neutral");
  assert.equal(getSessionLifecycleDisplay("ENDED").label, "Ended");

  const completeness = [
    ["IN_PROGRESS", "info", "In progress"],
    ["COMPLETE", "success", "Complete"],
    ["INCOMPLETE", "warning", "Missing data"],
    ["UNKNOWN", "neutral", "Unknown"],
  ];
  for (const [value, tone, label] of completeness) {
    const display = getSessionCompletenessDisplay(value);
    assert.equal(display.tone, tone);
    assert.equal(display.label, label);
    const html = renderToStaticMarkup(React.createElement(SessionCompletenessIndicator, { status: value }));
    assert.match(html, new RegExp(`>${label}</span>`));
  }

  const endedHtml = renderToStaticMarkup(React.createElement(SessionLifecycleIndicator, { status: "ENDED" }));
  assert.doesNotMatch(endedHtml, /Complete/);
});

test("operations projection status maps all 3 values cleanly", () => {
  const ops = [
    ["ONLINE", "success", "Online"],
    ["OFFLINE", "neutral", "Offline"],
    ["UNAVAILABLE", "neutral", "Unavailable"],
  ];
  for (const [value, tone, label] of ops) {
    const display = getOperationsStatusDisplay(value);
    assert.equal(display.tone, tone);
    assert.equal(display.label, label);
    const html = renderToStaticMarkup(React.createElement(OperationsStatusIndicator, { status: value }));
    assert.match(html, new RegExp(`>${label}</span>`));
  }
});

test("unknown or unexpected enum values never map to a successful status", () => {
  const resolvers = [
    getStationConnectivityDisplay,
    getConnectorStatusDisplay,
    getSessionLifecycleDisplay,
    getSessionCompletenessDisplay,
    getOperationsStatusDisplay,
  ];
  for (const resolve of resolvers) {
    for (const unexpected of ["INVALID", "", null, undefined, 42, "toString"]) {
      const result = resolve(unexpected);
      assert.equal(result.tone, "neutral");
      assert.equal(result.label, "Unknown");
      assert.notEqual(result.tone, "success");
    }
  }

  const html = renderToStaticMarkup(React.createElement(StatusIndicator, { tone: "neutral", label: "Unknown" }));
  assert.match(html, /--vg-neutral/);
  assert.match(html, />Unknown<\/span>/);
});
