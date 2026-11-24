import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { test } from "node:test";
import vm from "node:vm";

const require = createRequire(import.meta.url);
const ts = require("typescript");
const React = require("react");
const { renderToStaticMarkup } = require("react-dom/server");

function loadVoltmarkModule() {
  const source = readFileSync(new URL("../src/components/voltmark.tsx", import.meta.url), "utf8");
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
  Voltmark,
  VoltmarkWordmark,
  VoltmarkLockup,
  VOLTMARK_SIZES,
  VOLTMARK_VIEWBOX,
  VOLTMARK_BRAND,
  resolveVoltmarkSize,
} = loadVoltmarkModule();

const readText = (relPath) => readFileSync(new URL("../" + relPath, import.meta.url), "utf8");
const readBytes = (relPath) => readFileSync(new URL("../" + relPath, import.meta.url));

test("static Voltmark SVG assets exist and preserve approved geometry and palette", () => {
  const primary = readText("public/brand/voltmark.svg");
  const reversed = readText("public/brand/voltmark-reversed.svg");
  const monochrome = readText("public/brand/voltmark-monochrome.svg");
  const appIcon = readText("src/app/icon.svg");

  assert.equal(appIcon, primary);

  for (const [name, svg] of [
    ["voltmark.svg", primary],
    ["voltmark-reversed.svg", reversed],
    ["voltmark-monochrome.svg", monochrome],
  ]) {
    assert.match(svg, /^<svg\b[^>]*viewBox="0 0 80 80"/, `${name} viewBox`);
    assert.match(svg, /<\/svg>\s*$/, `${name} closing tag`);
    const withoutXmlns = svg.replace('xmlns="http://www.w3.org/2000/svg"', "");
    assert.doesNotMatch(withoutXmlns, /<script|<image|https?:\/\//i, `${name} must not have scripts or external refs`);
  }

  assert.match(primary, /<rect[^>]*rx="19"[^>]*fill="#43284F"/i);
  assert.match(primary, /fill="#F8F6F3"/i);
  assert.match(primary, /fill="#F3BB94"/i);

  assert.doesNotMatch(reversed, /fill="#43284F"/i);
  assert.match(reversed, /fill="#F8F6F3"/i);
  assert.match(reversed, /fill="#F3BB94"/i);

  assert.match(monochrome, /fill="currentColor"/);
  assert.match(monochrome, /fill-rule="evenodd"/);
  assert.doesNotMatch(monochrome, /#(?!$)[0-9a-f]{3,6}/i);
});

test("favicon.ico is a valid multi-size ICO covering 16, 32, 48, and 64px", () => {
  const ico = readBytes("src/app/favicon.ico");
  assert.equal(ico.readUInt16LE(0), 0);
  assert.equal(ico.readUInt16LE(2), 1);
  const count = ico.readUInt16LE(4);
  assert.equal(count, 4);

  const sizes = [];
  for (let i = 0; i < count; i++) {
    const offset = 6 + i * 16;
    const width = ico.readUInt8(offset) || 256;
    const height = ico.readUInt8(offset + 1) || 256;
    const bytesInRes = ico.readUInt32LE(offset + 8);
    const imgOffset = ico.readUInt32LE(offset + 12);
    assert.equal(width, height);
    assert.ok(bytesInRes > 0);
    assert.ok(imgOffset + bytesInRes <= ico.length);
    sizes.push(width);
  }
  assert.deepEqual(sizes, [16, 32, 48, 64]);
});

test("layout metadata preserves title and avoids conflicting manual icon overrides", () => {
  const layout = readText("src/app/layout.tsx");
  assert.match(layout, /title:\s*"VoltGrid Operator Console"/);
  assert.doesNotMatch(layout, /\bicons\s*:/);
});

test("brand documentation covers variants, sizes, tokens, and accessibility", () => {
  const docs = readText("public/brand/README.md");
  assert.match(docs, /voltgrid\./);
  assert.match(docs, /Energy in focus\./);
  assert.match(docs, /#43284F/);
  assert.match(docs, /#E8DDF0/);
  assert.match(docs, /#F3BB94/);
  assert.match(docs, /#F8F6F3/);
  assert.match(docs, /#27232D/);
  assert.match(docs, /16px.*24px.*32px.*48px.*64px/);
  assert.match(docs, /decorative/);
});

test("Voltmark React component resolves sizes and renders all variants", () => {
  assert.equal(VOLTMARK_VIEWBOX, "0 0 80 80");
  assert.deepEqual(VOLTMARK_SIZES, { xs: 16, sm: 24, md: 32, lg: 48, xl: 64 });
  assert.equal(resolveVoltmarkSize("xs"), 16);
  assert.equal(resolveVoltmarkSize("xl"), 64);
  assert.equal(resolveVoltmarkSize(40), 40);
  assert.equal(resolveVoltmarkSize(-5), 32);

  for (const [token, expected] of Object.entries(VOLTMARK_SIZES)) {
    const html = renderToStaticMarkup(React.createElement(Voltmark, { size: token }));
    assert.match(html, new RegExp(`width="${expected}"`));
    assert.match(html, new RegExp(`height="${expected}"`));
    assert.match(html, /viewBox="0 0 80 80"/);
  }

  const primaryHtml = renderToStaticMarkup(React.createElement(Voltmark, { variant: "primary" }));
  assert.match(primaryHtml, /var\(--vg-brand, #43284F\)/);
  assert.match(primaryHtml, /var\(--vg-canvas, #F8F6F3\)/);
  assert.match(primaryHtml, /var\(--vg-accent, #F3BB94\)/);

  const reversedHtml = renderToStaticMarkup(React.createElement(Voltmark, { variant: "reversed" }));
  assert.doesNotMatch(reversedHtml, /<rect/);
  assert.match(reversedHtml, /var\(--vg-canvas, #F8F6F3\)/);
  assert.match(reversedHtml, /var\(--vg-accent, #F3BB94\)/);

  const monoHtml = renderToStaticMarkup(React.createElement(Voltmark, { variant: "monochrome" }));
  assert.match(monoHtml, /fill="currentColor"/);
  assert.match(monoHtml, /fill-rule="evenodd"/);
});

test("Voltmark accessible naming handles standalone and decorative usage", () => {
  const standalone = renderToStaticMarkup(React.createElement(Voltmark));
  assert.match(standalone, /role="img"/);
  assert.match(standalone, /aria-label="VoltGrid"/);
  assert.doesNotMatch(standalone, /aria-hidden="true"/);

  const customLabel = renderToStaticMarkup(React.createElement(Voltmark, { label: "VoltGrid home" }));
  assert.match(customLabel, /role="img"/);
  assert.match(customLabel, /aria-label="VoltGrid home"/);

  const blankLabel = renderToStaticMarkup(React.createElement(Voltmark, { label: "   " }));
  assert.match(blankLabel, /aria-label="VoltGrid"/);

  const decorative = renderToStaticMarkup(React.createElement(Voltmark, { decorative: true }));
  assert.match(decorative, /aria-hidden="true"/);
  assert.doesNotMatch(decorative, /role="img"/);
  assert.doesNotMatch(decorative, /aria-label=/);
});

test("VoltmarkWordmark and VoltmarkLockup render canonical text and hide nested graphic", () => {
  assert.equal(VOLTMARK_BRAND.wordmark, "voltgrid.");
  assert.equal(VOLTMARK_BRAND.tagline, "Energy in focus.");

  const wordmark = renderToStaticMarkup(React.createElement(VoltmarkWordmark));
  assert.match(wordmark, />voltgrid\.<\/span>/);

  const lockup = renderToStaticMarkup(React.createElement(VoltmarkLockup, { showTagline: true }));
  assert.match(lockup, /aria-hidden="true"/);
  assert.doesNotMatch(lockup, /role="img"/);
  assert.match(lockup, />voltgrid\.<\/span>/);
  assert.match(lockup, />Energy in focus\.<\/span>/);
});
