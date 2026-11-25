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

const { buildOverviewModel, normalizeOverviewFilters } = loadModule("lib/overview-model.ts");
const { OverviewHeader } = loadModule("components/overview/overview-header.tsx");
const { OverviewMetrics } = loadModule("components/overview/overview-metrics.tsx");
const { OverviewSummaries } = loadModule("components/overview/overview-summaries.tsx");

test("OverviewHeader shows Add station when enabled and read-only notice when disabled", () => {
  const enabledHtml = renderToStaticMarkup(
    React.createElement(OverviewHeader, { registrationEnabled: true }),
  );
  assert.match(enabledHtml, /<h1[^>]*>Overview<\/h1>/);
  assert.match(enabledHtml, /Monitor your charging network\./);
  assert.match(enabledHtml, /href="\/stations\/new"[^>]*>.*Add station/);
  assert.doesNotMatch(enabledHtml, /Read-only console/);

  const disabledHtml = renderToStaticMarkup(
    React.createElement(OverviewHeader, { registrationEnabled: false }),
  );
  assert.doesNotMatch(disabledHtml, /href="\/stations\/new"/);
  assert.match(disabledHtml, /Read-only console/);
  assert.match(disabledHtml, /Station registration is disabled outside local demo mode\./);
});

test("OverviewMetrics renders live counts with safe filter links and unknown when unavailable", () => {
  const mixedModel = buildOverviewModel(
    {
      state: "live",
      stations: [
        { id: "CP-1", name: "Colombo Central", status: "ONLINE" },
        { id: "CP-2", name: "Kandy Depot", status: "OFFLINE" },
      ],
    },
    normalizeOverviewFilters({}),
  );
  const liveHtml = renderToStaticMarkup(React.createElement(OverviewMetrics, { model: mixedModel }));
  assert.match(liveHtml, />Total stations<\/p>/);
  assert.match(liveHtml, />2<\/p>/);
  assert.match(liveHtml, />1<\/p>/);
  assert.match(liveHtml, /href="\/#stations"/);
  assert.match(liveHtml, /href="\/\?status=ONLINE#stations"/);
  assert.match(liveHtml, /href="\/\?status=OFFLINE#stations"/);
  assert.doesNotMatch(liveHtml, /href="\/stations"/);

  const unavailableModel = buildOverviewModel(
    { state: "unavailable", stations: [], message: "Station API could not be reached." },
    normalizeOverviewFilters({}),
  );
  const unavailableHtml = renderToStaticMarkup(React.createElement(OverviewMetrics, { model: unavailableModel }));
  assert.equal((unavailableHtml.match(/>Unknown<\/p>/g) ?? []).length, 3);
  assert.doesNotMatch(unavailableHtml, />0<\/p>/);
});

test("OverviewSummaries renders connectivity bar, N/A on zero, Unknown on unavailable, and non-fault offline note", () => {
  const mixedModel = buildOverviewModel(
    {
      state: "live",
      stations: [
        { id: "CP-1", name: "Colombo Central", status: "ONLINE" },
        { id: "CP-2", name: "Kandy Depot", status: "OFFLINE" },
      ],
    },
    normalizeOverviewFilters({}),
  );
  const mixedHtml = renderToStaticMarkup(React.createElement(OverviewSummaries, { model: mixedModel }));
  assert.match(mixedHtml, />50%</);
  assert.match(mixedHtml, /1 of 2 registered stations are currently reported online\./);
  assert.match(mixedHtml, /not historical uptime/);
  assert.match(mixedHtml, /1 offline/);
  assert.match(mixedHtml, /Disconnection does not establish a physical equipment fault/);
  assert.match(mixedHtml, /href="\/\?status=OFFLINE#stations"/);

  const emptyModel = buildOverviewModel({ state: "live", stations: [] }, normalizeOverviewFilters({}));
  const emptyHtml = renderToStaticMarkup(React.createElement(OverviewSummaries, { model: emptyModel }));
  assert.match(emptyHtml, />N\/A</);
  assert.doesNotMatch(emptyHtml, />0%</);

  const unavailableModel = buildOverviewModel(
    { state: "unavailable", stations: [], message: "Station API unavailable." },
    normalizeOverviewFilters({}),
  );
  const unavailableHtml = renderToStaticMarkup(React.createElement(OverviewSummaries, { model: unavailableModel }));
  assert.match(unavailableHtml, />Unknown</);
  assert.match(unavailableHtml, />Status unknown</);
  assert.doesNotMatch(unavailableHtml, />0%</);
});
