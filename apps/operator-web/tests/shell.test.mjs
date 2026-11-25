import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
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

function loadTsx(relPath, pathname = "/") {
  const absPath = path.resolve(srcDir, relPath);
  const key = `${absPath}:${pathname}`;
  if (cache.has(key)) return cache.get(key);
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
  cache.set(key, mod.exports);
  const localRequire = id => {
    if (id.startsWith("./")) {
      const target = path.resolve(path.dirname(absPath), id);
      const file = statSync(`${target}.tsx`, { throwIfNoEntry: false }) ? `${target}.tsx` : `${target}.ts`;
      return loadTsx(path.relative(srcDir, file), pathname);
    }
    if (id.startsWith("@/")) {
      const target = path.resolve(srcDir, id.slice(2));
      const file = statSync(`${target}.tsx`, { throwIfNoEntry: false }) ? `${target}.tsx` : `${target}.ts`;
      return loadTsx(path.relative(srcDir, file), pathname);
    }
    if (id === "next/navigation") {
      return {
        usePathname: () => pathname,
        useRouter: () => ({ refresh() {}, push() {} }),
      };
    }
    return require(id);
  };
  const fn = vm.runInThisContext(`(function(exports, require, module) {\n${outputText}\n})`);
  fn(mod.exports, localRequire, mod);
  cache.set(key, mod.exports);
  return mod.exports;
}

const { MainContent } = loadTsx("components/shell/main-content.tsx");
const { PageHeader } = loadTsx("components/shell/page-header.tsx");

test("AppShell renders skip link, sidebar, top bar, and single main landmark", () => {
  const { AppShell } = loadTsx("components/shell/app-shell.tsx", "/");
  const html = renderToStaticMarkup(
    React.createElement(AppShell, null, React.createElement("h1", null, "Overview")),
  );
  assert.match(html, /class="skip-link" href="#main-content"/);
  assert.equal((html.match(/<main\b/g) ?? []).length, 1);
  assert.match(html, /<main id="main-content" tabindex="-1"/i);
  assert.match(html, /<aside aria-label="Workspace sidebar"/);
  assert.match(html, /<header /);
  assert.match(html, />Overview<\/h1>/);
});

test("Sidebar renders approved Workspace and Support groups and avoids broken links for deferred routes", () => {
  const { Sidebar } = loadTsx("components/shell/sidebar.tsx", "/");
  const html = renderToStaticMarkup(React.createElement(Sidebar));

  assert.match(html, /aria-label="VoltGrid overview"/);
  assert.match(html, />voltgrid\.</);
  assert.match(html, />Workspace<\/p>/);
  assert.match(html, />Support<\/p>/);
  assert.match(html, /aria-current="page"[^>]*href="\/"/);
  assert.match(html, /href="\/transactions"[^>]*>.*Charging sessions/);
  assert.match(html, /href="\/operations"[^>]*>.*Diagnostics/);

  assert.doesNotMatch(html, /href="\/stations"/);
  assert.doesNotMatch(html, /href="\/attention"/);
  assert.doesNotMatch(html, /href="\/help"/);
  assert.match(html, /aria-disabled="true"[^>]*>.*Charging stations/);
  assert.match(html, /aria-disabled="true"[^>]*>.*Needs attention/);
  assert.match(html, /aria-disabled="true"[^>]*>.*Help/);
});

test("Sidebar highlights Charging sessions on nested session routes and context on station routes", () => {
  const { Sidebar: SessionSidebar } = loadTsx("components/shell/sidebar.tsx", "/stations/CP-1/transactions/TX-1");
  const sessionHtml = renderToStaticMarkup(React.createElement(SessionSidebar));
  assert.match(sessionHtml, /aria-current="page"[^>]*href="\/transactions"/);
  assert.doesNotMatch(sessionHtml, /aria-current="page"[^>]*href="\/"/);

  const { Sidebar: StationSidebar } = loadTsx("components/shell/sidebar.tsx", "/stations/CP-1");
  const stationHtml = renderToStaticMarkup(React.createElement(StationSidebar));
  assert.match(stationHtml, /data-context-active="true"[^>]*>.*Charging stations/);
  assert.doesNotMatch(stationHtml, /aria-current="page"/);
});

test("MobileNav renders menu trigger and hides dialog until opened", () => {
  const { MobileNav } = loadTsx("components/shell/mobile-nav.tsx", "/");
  const closedHtml = renderToStaticMarkup(React.createElement(MobileNav));
  assert.match(closedHtml, /aria-expanded="false"/);
  assert.match(closedHtml, />Open navigation <\/span>Menu/);
  assert.doesNotMatch(closedHtml, /role="dialog"/);
});

test("MainContent and PageHeader render semantic heading and porcelain tokens", () => {
  const mainHtml = renderToStaticMarkup(
    React.createElement(
      MainContent,
      null,
      React.createElement(PageHeader, {
        eyebrow: "Network",
        title: "Charging stations",
        description: "Monitor reported station connectivity.",
      }),
    ),
  );
  assert.match(mainHtml, /<main id="main-content"/);
  assert.match(mainHtml, /<h1[^>]*>Charging stations<\/h1>/);
  assert.match(mainHtml, /Monitor reported station connectivity\./);
});

test("route pages do not render duplicate nested main landmarks", () => {
  function walk(dir) {
    const entries = [];
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) entries.push(...walk(full));
      else if (entry.name.endsWith(".tsx")) entries.push(full);
    }
    return entries;
  }

  const appFiles = walk(path.join(srcDir, "app"));
  for (const file of appFiles) {
    const content = readFileSync(file, "utf8");
    assert.doesNotMatch(content, /<main\b/, `${path.relative(srcDir, file)} should not define nested <main>`);
  }
});
