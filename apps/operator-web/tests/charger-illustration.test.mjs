import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { test } from "node:test";
import vm from "node:vm";

const require = createRequire(import.meta.url);
const ts = require("typescript");
const React = require("react");
const { renderToStaticMarkup } = require("react-dom/server");

function loadChargerIllustration() {
  const absPath = path.resolve(
    new URL("../src/components/stations/charger-illustration.tsx", import.meta.url).pathname,
  );
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
  const fn = vm.runInThisContext(`(function(exports, require, module) {\n${outputText}\n})`);
  fn(mod.exports, require, mod);
  return mod.exports.ChargerIllustration;
}

const ChargerIllustration = loadChargerIllustration();

test("ChargerIllustration renders lightweight generic charger SVG for every connector status without ID collisions or fake readings", () => {
  const expectedLightColors = {
    AVAILABLE: "--vg-success",
    OCCUPIED: "--vg-info",
    RESERVED: "--vg-warning",
    UNAVAILABLE: "--vg-neutral",
    FAULTED: "--vg-danger",
  };

  for (const [status, token] of Object.entries(expectedLightColors)) {
    const html = renderToStaticMarkup(
      React.createElement(ChargerIllustration, { status }),
    );
    assert.match(html, /<svg[^>]*aria-hidden="true"/);
    assert.match(html, new RegExp(token));
    assert.doesNotMatch(html, /id="/i);
    assert.doesNotMatch(html, /<image\b|<script\b|http:|https:/i);
    assert.doesNotMatch(html, /\b(kW|kWh|V\b|A\b|%)\b/);
  }
});

test("ChargerIllustration supports named standalone mode when non-decorative", () => {
  const html = renderToStaticMarkup(
    React.createElement(ChargerIllustration, {
      status: "FAULTED",
      decorative: false,
      title: "Generic EV charger equipment",
    }),
  );
  assert.match(html, /role="img"/);
  assert.match(html, /aria-label="Generic EV charger equipment"/);
  assert.match(html, /<title>Generic EV charger equipment<\/title>/);
  assert.doesNotMatch(html, /aria-hidden="true"/);
});
