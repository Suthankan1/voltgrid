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
    return require(id);
  };
  const fn = vm.runInThisContext(`(function(exports, require, module) {\n${outputText}\n})`);
  fn(mod.exports, localRequire, mod);
  cache.set(absPath, mod.exports);
  return mod.exports;
}

const { HelpView } = loadModule("components/help/help-view.tsx");

test("HelpView renders accurate guidance, contextual links, native disclosures, and avoids fabricated support claims", () => {
  const html = renderToStaticMarkup(React.createElement(HelpView));

  assert.match(html, /Learn how to use VoltGrid and understand your charging network\./);
  assert.match(html, /href="\/stations\/new"/);
  assert.match(html, /href="\/attention"/);
  assert.match(html, /href="\/diagnostics"/);
  assert.match(html, /href="\/sessions"/);
  assert.match(html, /<details[^>]*><summary/);
  assert.match(html, /\/ocpp\/&lt;stationId&gt;/);
  assert.match(html, /do not represent actual hardware manufacturer/i);

  // Never invent fake support emails, phone numbers, SLAs, or public gateways
  assert.doesNotMatch(
    html,
    /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+|1-800|555-|wss:\/\/public|http:\/\/localhost/i,
  );
});
