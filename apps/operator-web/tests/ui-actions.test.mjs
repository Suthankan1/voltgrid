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

const { Button, IconButton } = loadTsxModule("../src/components/ui/button.tsx");
const { Card, Surface, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } =
  loadTsxModule("../src/components/ui/card.tsx");

test("Button defaults to type=button, renders primary/secondary/tertiary variants and native attributes", () => {
  const primary = renderToStaticMarkup(
    React.createElement(Button, { name: "save", value: "ok", "data-testid": "btn" }, "Save changes"),
  );
  assert.match(primary, /^<button /);
  assert.match(primary, /type="button"/);
  assert.match(primary, /name="save"/);
  assert.match(primary, /value="ok"/);
  assert.match(primary, /data-testid="btn"/);
  assert.match(primary, /bg-\[color:var\(--vg-brand\)\]/);
  assert.match(primary, />Save changes<\/span>/);

  const secondary = renderToStaticMarkup(
    React.createElement(Button, { variant: "secondary", type: "submit" }, "Filter"),
  );
  assert.match(secondary, /type="submit"/);
  assert.match(secondary, /border-\[color:var\(--vg-border-control\)\]/);

  const tertiary = renderToStaticMarkup(
    React.createElement(Button, { variant: "tertiary", size: "lg" }, "Cancel"),
  );
  assert.match(tertiary, /bg-transparent/);
  assert.match(tertiary, /min-h-12/);
});

test("Button disables and prevents duplicate activation while pending or disabled", () => {
  const pendingHtml = renderToStaticMarkup(
    React.createElement(Button, { pending: true, pendingLabel: "Registering…" }, "Register station"),
  );
  assert.match(pendingHtml, /disabled=""/);
  assert.match(pendingHtml, /aria-busy="true"/);
  assert.match(pendingHtml, /motion-reduce:animate-none/);
  assert.match(pendingHtml, /Registering…/);

  let clicks = 0;
  let prevented = false;
  const fakeEvent = { preventDefault() { prevented = true; } };

  const activeEl = Button({ onClick: () => { clicks += 1; }, children: "Run" });
  activeEl.props.onClick(fakeEvent);
  assert.equal(clicks, 1);
  assert.equal(prevented, false);

  const pendingEl = Button({ pending: true, onClick: () => { clicks += 1; }, children: "Run" });
  pendingEl.props.onClick(fakeEvent);
  assert.equal(clicks, 1);
  assert.equal(prevented, true);

  prevented = false;
  const disabledEl = Button({ disabled: true, onClick: () => { clicks += 1; }, children: "Run" });
  disabledEl.props.onClick(fakeEvent);
  assert.equal(clicks, 1);
  assert.equal(prevented, true);
});

test("IconButton enforces accessible name, hides decorative icon, and defaults to 44x44 target", () => {
  const icon = React.createElement("svg", { viewBox: "0 0 16 16" }, React.createElement("path", { d: "M2 8h12" }));
  const html = renderToStaticMarkup(
    React.createElement(IconButton, { label: "Close navigation drawer", icon }),
  );
  assert.match(html, /type="button"/);
  assert.match(html, /aria-label="Close navigation drawer"/);
  assert.match(html, /min-h-11 min-w-11/);
  assert.match(html, /<span aria-hidden="true"[^>]*><svg/);

  let clicks = 0;
  const pendingIconEl = IconButton({
    label: "Refresh",
    icon,
    pending: true,
    onClick: () => { clicks += 1; },
  });
  let prevented = false;
  pendingIconEl.props.onClick({ preventDefault() { prevented = true; } });
  assert.equal(clicks, 0);
  assert.equal(prevented, true);
});

test("Card and Surface use semantic tokens, subtle borders, no shadows, and non-clickable containers", () => {
  assert.equal(Surface, Card);
  const html = renderToStaticMarkup(
    React.createElement(
      Card,
      { as: "section", "aria-labelledby": "card-heading" },
      React.createElement(
        CardHeader,
        null,
        React.createElement(
          "div",
          null,
          React.createElement(CardTitle, { id: "card-heading" }, "Station connectivity"),
          React.createElement(CardDescription, null, "Reported status from Station Service."),
        ),
      ),
      React.createElement(CardContent, null, "24 stations online"),
      React.createElement(CardFooter, null, "Updated just now"),
    ),
  );
  assert.match(html, /^<section /);
  assert.match(html, /shadow-none/);
  assert.match(html, /border-\[color:var\(--vg-border\)\]/);
  assert.match(html, /<h2\b[^>]*id="card-heading"/);
  assert.doesNotMatch(html, /onclick=/i);
});
