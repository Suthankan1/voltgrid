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

const { buildAttentionModel } = loadModule("lib/attention-model.ts");
const { AttentionView } = loadModule("components/attention/attention-view.tsx");
const { AttentionLoading } = loadModule("components/attention/attention-states.tsx");

test("AttentionView renders independent counts, previews, and scoped links without synthetic total counts", () => {
  const model = buildAttentionModel(
    {
      state: "live",
      stations: [
        { id: "CP-1", name: "Colombo Central", status: "ONLINE" },
        { id: "CP-2", name: "Kandy Depot", status: "OFFLINE" },
      ],
    },
    {
      state: "live",
      transactions: [
        {
          transaction: {
            stationId: "CP-2",
            transactionId: "TX-GAP-1",
            evseId: 1,
            connectorId: 1,
            status: "ENDED",
            startedAt: "2026-10-08T08:00:00Z",
            endedAt: "2026-10-08T08:30:00Z",
            lastSequenceNumber: 4,
          },
          completeness: {
            status: "INCOMPLETE",
            firstSequenceNumber: 0,
            lastSequenceNumber: 4,
            missingSequenceNumbers: [2],
          },
        },
      ],
      page: 0,
      size: 8,
      totalElements: 1,
      totalPages: 1,
      hasNext: false,
    },
  );

  const html = renderToStaticMarkup(React.createElement(AttentionView, { model }));
  assert.match(html, /Needs attention/);
  assert.match(html, /href="\/stations\?status=OFFLINE"/);
  assert.match(html, /href="\/sessions\?integrityStatus=INCOMPLETE"/);
  assert.match(html, /href="\/stations\/CP-2\?returnTo=%2Fattention"/);
  assert.match(html, /href="\/stations\/CP-2\/sessions\/TX-GAP-1\?section=technical&amp;returnTo=%2Fattention"/);
  assert.match(html, /Seq 2/);
  assert.match(html, /Connector-specific reported faults/);
});

test("AttentionView renders honest clear state without false healthy claims and keeps partial failures independent", () => {
  const clearModel = buildAttentionModel(
    { state: "live", stations: [{ id: "CP-1", name: "Colombo Central", status: "ONLINE" }] },
    { state: "live", transactions: [], page: 0, size: 8, totalElements: 0, totalPages: 0, hasNext: false },
  );
  const clearHtml = renderToStaticMarkup(React.createElement(AttentionView, { model: clearModel }));
  assert.match(clearHtml, /No offline stations or incomplete session records found\./);
  assert.doesNotMatch(clearHtml, /All systems healthy|Everything is operational|100%/i);

  const partialModel = buildAttentionModel(
    { state: "unavailable", message: "Stations API down" },
    { state: "live", transactions: [], page: 0, size: 8, totalElements: 0, totalPages: 0, hasNext: false },
  );
  const partialHtml = renderToStaticMarkup(React.createElement(AttentionView, { model: partialModel }));
  assert.match(partialHtml, /Unknown/);
  assert.match(partialHtml, /Unable to load station connectivity/);
  assert.match(partialHtml, /No incomplete session records found/);

  const loadingHtml = renderToStaticMarkup(React.createElement(AttentionLoading));
  assert.match(loadingHtml, /aria-busy="true"/);
});
