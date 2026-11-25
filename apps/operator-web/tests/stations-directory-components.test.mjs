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

const {
  buildStationsDirectoryModel,
  normalizeStationDirectoryFilters,
} = loadModule("lib/stations-directory-model.ts");
const { StationsDirectoryHeader } = loadModule("components/stations/stations-directory-header.tsx");
const { StationsDirectorySummary } = loadModule("components/stations/stations-directory-summary.tsx");
const { StationsDirectoryView } = loadModule("components/stations/stations-directory-view.tsx");
const { StationsDirectoryLoading } = loadModule("components/stations/stations-directory-loading.tsx");
const { StationsDirectoryErrorState } = loadModule("components/stations/stations-directory-error-state.tsx");

test("StationsDirectoryHeader shows Add station when enabled and read-only notice when disabled", () => {
  const enabledHtml = renderToStaticMarkup(
    React.createElement(StationsDirectoryHeader, { registrationEnabled: true }),
  );
  assert.match(enabledHtml, /<h1[^>]*>Charging stations<\/h1>/);
  assert.match(enabledHtml, /Manage stations connected to your network\./);
  assert.match(enabledHtml, /href="\/stations\/new"[^>]*>.*Add station/);
  assert.doesNotMatch(enabledHtml, /Read-only console/);

  const disabledHtml = renderToStaticMarkup(
    React.createElement(StationsDirectoryHeader, { registrationEnabled: false }),
  );
  assert.doesNotMatch(disabledHtml, /href="\/stations\/new"/);
  assert.match(disabledHtml, /Read-only console/);
});

test("StationsDirectorySummary and View render filtered results with encoded return context and full totals", () => {
  const stations = [
    { id: "CP%1", name: "Colombo Central", status: "ONLINE" },
    { id: "CP-2", name: "Kandy Depot", status: "OFFLINE" },
    { id: "CP-3", name: "Galle Harbor", status: "ONLINE" },
  ];
  const filteredModel = buildStationsDirectoryModel(
    { state: "live", stations },
    normalizeStationDirectoryFilters({ q: "Kandy", status: "OFFLINE" }),
  );

  const summaryHtml = renderToStaticMarkup(
    React.createElement(StationsDirectorySummary, { model: filteredModel }),
  );
  assert.match(summaryHtml, />Total registered<\/dt><dd[^>]*>3<\/dd>/);
  assert.match(summaryHtml, />Online<\/dt><dd[^>]*>2<\/dd>/);
  assert.match(summaryHtml, />Offline<\/dt><dd[^>]*>1<\/dd>/);

  const viewHtml = renderToStaticMarkup(
    React.createElement(StationsDirectoryView, {
      model: filteredModel,
      registrationEnabled: true,
    }),
  );
  assert.match(viewHtml, /Showing 1 of 1 matching \(3 total\)/);
  assert.match(viewHtml, /href="\/stations\/CP-2\?returnTo=%2Fstations%3Fq%3DKandy%26status%3DOFFLINE"/);
  assert.match(viewHtml, /Investigate station CP-2/);
  assert.match(viewHtml, /href="\/stations"[^>]*>Clear filters/);

  const unfilteredModel = buildStationsDirectoryModel(
    { state: "live", stations },
    normalizeStationDirectoryFilters({}),
  );
  const unfilteredHtml = renderToStaticMarkup(
    React.createElement(StationsDirectoryView, {
      model: unfilteredModel,
      registrationEnabled: true,
    }),
  );
  assert.match(unfilteredHtml, /Showing 3 of 3 stations/);
  assert.match(unfilteredHtml, /href="\/stations\/CP%251"/);
  assert.doesNotMatch(unfilteredHtml, /returnTo=/);
});

test("StationsDirectory states distinguish no-matches, empty fleet, unavailable summary, loading, and retry", () => {
  const noMatchModel = buildStationsDirectoryModel(
    { state: "live", stations: [{ id: "CP-1", name: "Colombo Central", status: "ONLINE" }] },
    normalizeStationDirectoryFilters({ q: "missing" }),
  );
  const noMatchHtml = renderToStaticMarkup(
    React.createElement(StationsDirectoryView, {
      model: noMatchModel,
      registrationEnabled: false,
    }),
  );
  assert.match(noMatchHtml, /No stations match the selected filters\./);
  assert.match(noMatchHtml, /href="\/stations"/);

  const emptyModel = buildStationsDirectoryModel(
    { state: "live", stations: [] },
    normalizeStationDirectoryFilters({}),
  );
  const emptyReadOnlyHtml = renderToStaticMarkup(
    React.createElement(StationsDirectoryView, {
      model: emptyModel,
      registrationEnabled: false,
    }),
  );
  assert.match(emptyReadOnlyHtml, /No charging stations registered/);
  assert.doesNotMatch(emptyReadOnlyHtml, /href="\/stations\/new"/);

  const unavailableModel = buildStationsDirectoryModel(
    { state: "unavailable", stations: [], message: "Station API could not be reached." },
    normalizeStationDirectoryFilters({}),
  );
  const unavailableSummaryHtml = renderToStaticMarkup(
    React.createElement(StationsDirectorySummary, { model: unavailableModel }),
  );
  assert.equal((unavailableSummaryHtml.match(/>Unknown<\/dd>/g) ?? []).length, 3);
  assert.doesNotMatch(unavailableSummaryHtml, />0<\/dd>/);

  const loadingHtml = renderToStaticMarkup(React.createElement(StationsDirectoryLoading));
  assert.match(loadingHtml, /role="status"/);
  assert.match(loadingHtml, /aria-busy="true"/);
  assert.match(loadingHtml, /Loading charging stations directory/);

  const errorHtml = renderToStaticMarkup(
    React.createElement(StationsDirectoryErrorState, { message: "Station API could not be reached." }),
  );
  assert.match(errorHtml, /role="alert"/);
  assert.match(errorHtml, /Unable to load charging stations/);
  assert.match(errorHtml, />Try again<\/span>/);
});
