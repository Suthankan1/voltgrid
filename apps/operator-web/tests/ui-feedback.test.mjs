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

const uiDir = path.resolve(new URL("../src/components/ui", import.meta.url).pathname);
const cache = new Map();

function loadUiFile(absPath) {
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
      return loadUiFile(path.resolve(path.dirname(absPath), `${id}.tsx`));
    }
    return require(id);
  };
  const fn = vm.runInThisContext(`(function(exports, require, module) {\n${outputText}\n})`);
  fn(mod.exports, localRequire, mod);
  cache.set(absPath, mod.exports);
  return mod.exports;
}

const { Alert } = loadUiFile(path.join(uiDir, "alert.tsx"));
const { EmptyState } = loadUiFile(path.join(uiDir, "empty-state.tsx"));
const { ErrorState } = loadUiFile(path.join(uiDir, "error-state.tsx"));
const { Skeleton, SkeletonGroup } = loadUiFile(path.join(uiDir, "skeleton.tsx"));
const { MetricCard } = loadUiFile(path.join(uiDir, "metric-card.tsx"));

test("Alert renders info/success/warning/error variants with controlled live announcements", () => {
  const staticInfo = renderToStaticMarkup(
    React.createElement(Alert, { variant: "info", title: "Projection note" }, "Asynchronous status may lag Station Service."),
  );
  assert.doesNotMatch(staticInfo, /role="alert"/);
  assert.doesNotMatch(staticInfo, /role="status"/);
  assert.match(staticInfo, /--vg-info-soft/);
  assert.match(staticInfo, /<svg aria-hidden="true"/);

  const politeSuccess = renderToStaticMarkup(
    React.createElement(Alert, { variant: "success", announce: "polite", title: "Station registered" }, "Ready for OCPP connection."),
  );
  assert.match(politeSuccess, /role="status"/);
  assert.match(politeSuccess, /--vg-success-soft/);

  const criticalWarning = renderToStaticMarkup(
    React.createElement(Alert, { variant: "warning", announce: "assertive", title: "Missing records" }, "One or more sequence events are missing."),
  );
  assert.match(criticalWarning, /role="alert"/);
  assert.match(criticalWarning, /--vg-warning-soft/);

  const errorAlert = renderToStaticMarkup(
    React.createElement(Alert, { variant: "error" }, "Station API could not be reached."),
  );
  assert.match(errorAlert, /role="alert"/);
  assert.match(errorAlert, /--vg-danger-soft/);
});

test("EmptyState distinguishes empty and no-matches states with optional contextual action", () => {
  const emptyHtml = renderToStaticMarkup(
    React.createElement(EmptyState, {
      title: "No charging stations registered",
      description: "Register a local station to begin monitoring connectivity.",
      kind: "empty",
      action: React.createElement("a", { href: "/stations/new" }, "Add station"),
    }),
  );
  assert.match(emptyHtml, /data-empty-kind="empty"/);
  assert.match(emptyHtml, /No charging stations registered/);
  assert.match(emptyHtml, /href="\/stations\/new"/);

  const noMatchHtml = renderToStaticMarkup(
    React.createElement(EmptyState, {
      title: "No matching stations",
      description: "Adjust your search or clear active filters.",
      kind: "no-matches",
    }),
  );
  assert.match(noMatchHtml, /data-empty-kind="no-matches"/);
});

test("ErrorState exposes safe message and optional retry button without raw exceptions", () => {
  let retried = 0;
  const html = renderToStaticMarkup(
    React.createElement(ErrorState, {
      title: "Unable to load stations",
      message: "Station API could not be reached.",
      guidance: "Check that Station Service is running and try again.",
      onRetry: () => { retried += 1; },
    }),
  );
  assert.match(html, /role="alert"/);
  assert.match(html, /Unable to load stations/);
  assert.match(html, /Station API could not be reached\./);
  assert.match(html, />Try again<\/span>/);

  const retryingHtml = renderToStaticMarkup(
    React.createElement(ErrorState, {
      message: "Station data unavailable.",
      onRetry: () => { retried += 1; },
      retrying: true,
    }),
  );
  assert.match(retryingHtml, /disabled=""/);
  assert.match(retryingHtml, /aria-busy="true"/);
  assert.match(retryingHtml, /Retrying…/);
  assert.equal(retried, 0);
});

test("Skeleton hides decorative bars and SkeletonGroup exposes aria-busy status region", () => {
  const html = renderToStaticMarkup(
    React.createElement(
      SkeletonGroup,
      { label: "Loading station overview" },
      React.createElement(Skeleton, { variant: "heading" }),
      React.createElement(Skeleton, { variant: "text" }),
      React.createElement(Skeleton, { variant: "block" }),
    ),
  );
  assert.match(html, /role="status"/);
  assert.match(html, /aria-busy="true"/);
  assert.match(html, /aria-label="Loading station overview"/);
  assert.match(html, /class="sr-only">Loading station overview<\/span>/);
  assert.match(html, /aria-hidden="true"/);
  assert.match(html, /motion-reduce:animate-none/);
});

test("MetricCard distinguishes zero from unknown/unavailable values and supports semantic links", () => {
  const zeroHtml = renderToStaticMarkup(
    React.createElement(MetricCard, {
      label: "Offline stations",
      value: 0,
      description: "Full snapshot of registered stations",
      href: "/stations?status=OFFLINE",
      linkLabel: "View offline stations",
    }),
  );
  assert.match(zeroHtml, />0<\/p>/);
  assert.doesNotMatch(zeroHtml, /Unknown/);
  assert.match(zeroHtml, /href="\/stations\?status=OFFLINE"/);
  assert.match(zeroHtml, />View offline stations<\/span>/);

  for (const unknownVal of [null, undefined, Number.NaN, ""]) {
    const unknownHtml = renderToStaticMarkup(
      React.createElement(MetricCard, {
        label: "Connectivity",
        value: unknownVal,
        unknownLabel: "N/A",
      }),
    );
    assert.match(unknownHtml, />N\/A<\/p>/);
    assert.doesNotMatch(unknownHtml, />0<\/p>/);
  }

  const defaultUnknown = renderToStaticMarkup(
    React.createElement(MetricCard, { label: "Online stations", value: undefined }),
  );
  assert.match(defaultUnknown, />Unknown<\/p>/);
});
