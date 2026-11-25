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

const { buildDiagnosticsModel } = loadModule("lib/diagnostics-model.ts");
const { DiagnosticsView } = loadModule("components/diagnostics/diagnostics-view.tsx");
const { DiagnosticsLoading } = loadModule("components/diagnostics/diagnostics-states.tsx");

test("DiagnosticsView renders asynchronous caveat, scoped cursor page, event ID disclosure, and pagination", () => {
  const model = buildDiagnosticsModel(
    { status: "OFFLINE", stationId: "", after: null },
    {
      mode: "cursor-page",
      snapshot: {
        state: "live",
        stations: [
          {
            stationId: "CP%1",
            currentStatus: "OFFLINE",
            lastEventId: "evt-123",
            statusChangedAt: "2026-10-08T08:00:00Z",
            updatedAt: "2026-10-08T08:00:02Z",
          },
        ],
        hasNextPage: true,
        endCursor: "cursor-2",
      },
    },
    { retrievedAtIso: "2026-10-08T08:10:00Z" },
  );

  const html = renderToStaticMarkup(React.createElement(DiagnosticsView, { model }));
  assert.match(html, /asynchronous station-status projection/);
  assert.match(html, /1 station on this page/);
  assert.doesNotMatch(html, /\d+ total projected|projection lag:/i);
  assert.match(html, /href="\/stations\/CP%251"/);
  assert.match(html, /evt-123/);
  assert.match(html, /Copy station ID/);
  assert.match(html, /Copy event ID/);
  assert.match(html, /href="\/diagnostics\?status=OFFLINE&amp;after=cursor-2"/);
});

test("DiagnosticsView distinguishes absent lookup record, invalid cursor recovery, and unavailable API", () => {
  const missingLookup = buildDiagnosticsModel(
    { status: "", stationId: "CP-MISS", after: null },
    { mode: "station-lookup", snapshot: { state: "not-found" } },
  );
  const missingHtml = renderToStaticMarkup(React.createElement(DiagnosticsView, { model: missingLookup }));
  assert.match(missingHtml, /No projection record found for this station/);
  assert.match(missingHtml, /does not mean the station is unregistered/);

  const badCursor = buildDiagnosticsModel(
    { status: "", stationId: "", after: "broken" },
    {
      mode: "cursor-page",
      snapshot: {
        state: "unavailable",
        invalidCursor: true,
        message: "The requested diagnostics page cursor is no longer valid.",
      },
    },
  );
  const badCursorHtml = renderToStaticMarkup(React.createElement(DiagnosticsView, { model: badCursor }));
  assert.match(badCursorHtml, /Diagnostics cursor could not be loaded/);
  assert.match(badCursorHtml, /Return to first page/);

  const loadingHtml = renderToStaticMarkup(React.createElement(DiagnosticsLoading));
  assert.match(loadingHtml, /aria-busy="true"/);
});
