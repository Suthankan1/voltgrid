import { test, expect, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";
import path from "node:path";
import vm from "node:vm";
import ts from "typescript";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import type * as ButtonModule from "../src/components/ui/button";
import type * as CardModule from "../src/components/ui/card";

function loadUiModule<T>(relPath: string): T {
  const absPath = path.resolve(process.cwd(), relPath);
  const source = readFileSync(absPath, "utf8");
  const { outputText } = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
      jsx: ts.JsxEmit.ReactJSX,
      esModuleInterop: true,
    },
  });
  const mod = { exports: {} as T };
  const fn = vm.runInThisContext(`(function(exports, require, module) {\n${outputText}\n})`);
  fn(mod.exports, require, mod);
  return mod.exports;
}

const { Button, IconButton } = loadUiModule<typeof ButtonModule>("src/components/ui/button.tsx");
const { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } =
  loadUiModule<typeof CardModule>("src/components/ui/card.tsx");

async function mountIsolatedHarness(page: Page, bodyMarkup: string) {
  await page.goto("/");
  const stylesheetHrefs = await page.locator('head link[rel="stylesheet"]').evaluateAll(links =>
    links.map(link => link.getAttribute("href")).filter((href): href is string => Boolean(href))
  );
  const styles = stylesheetHrefs
    .map(href => `<link rel="stylesheet" href="${href}">`)
    .join("\n");

  await page.route("http://127.0.0.1:4310/__ui-harness", async route => {
    await route.fulfill({
      status: 200,
      contentType: "text/html; charset=utf-8",
      body: `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>VoltGrid UI Harness</title>
  ${styles}
</head>
<body style="background: var(--vg-canvas); color: var(--vg-text-primary); font-family: var(--vg-font-sans); padding: 24px;">
  <main id="harness-root" style="max-width: 960px; margin: 0 auto;">
    ${bodyMarkup}
  </main>
</body>
</html>`,
    });
  });

  await page.goto("http://127.0.0.1:4310/__ui-harness", { waitUntil: "networkidle" });
  await page.evaluate(() => document.fonts.ready);
}

test("action and surface primitives render cleanly with keyboard focus and 44px touch targets", async ({ page }) => {
  const consoleErrors: string[] = [];
  page.on("console", msg => {
    if (msg.type() === "error") consoleErrors.push(msg.text());
  });

  const refreshIcon = React.createElement(
    "svg",
    { viewBox: "0 0 20 20", width: 20, height: 20, fill: "none" },
    React.createElement("path", { d: "M4 10a6 6 0 1 1 1.76 4.24", stroke: "currentColor", strokeWidth: 1.75, strokeLinecap: "round" }),
  );

  const markup = renderToStaticMarkup(
    React.createElement(
      Card,
      { as: "section", "aria-labelledby": "actions-title" },
      React.createElement(
        CardHeader,
        null,
        React.createElement(
          "div",
          null,
          React.createElement(CardTitle, { id: "actions-title" }, "Station actions"),
          React.createElement(CardDescription, null, "Verify Orchid & Clay controls across desktop and mobile."),
        ),
        React.createElement(IconButton, { label: "Refresh stations", icon: refreshIcon }),
      ),
      React.createElement(
        CardContent,
        { className: "flex flex-wrap gap-3" },
        React.createElement(Button, { variant: "primary" }, "Register station"),
        React.createElement(Button, { variant: "secondary" }, "Filter fleet"),
        React.createElement(Button, { variant: "tertiary" }, "Clear filters"),
        React.createElement(Button, { pending: true, pendingLabel: "Registering…" }, "Register station"),
      ),
      React.createElement(CardFooter, null, "44px minimum touch target on default controls"),
    ),
  );

  await mountIsolatedHarness(page, markup);

  for (const viewport of [{ width: 1440, height: 900 }, { width: 390, height: 844 }]) {
    await page.setViewportSize(viewport);
    const hasOverflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
    expect(hasOverflow).toBe(false);
  }

  const iconBtn = page.getByRole("button", { name: "Refresh stations" });
  const iconBox = await iconBtn.boundingBox();
  expect(iconBox).not.toBeNull();
  expect(iconBox!.width).toBeGreaterThanOrEqual(44);
  expect(iconBox!.height).toBeGreaterThanOrEqual(44);

  const primaryBtn = page.getByRole("button", { name: "Register station" });
  const primaryBox = await primaryBtn.boundingBox();
  expect(primaryBox).not.toBeNull();
  expect(primaryBox!.height).toBeGreaterThanOrEqual(44);

  await page.keyboard.press("Tab");
  await expect(iconBtn).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(primaryBtn).toBeFocused();

  const outlineStyle = await primaryBtn.evaluate(el => getComputedStyle(el).outlineStyle);
  expect(outlineStyle).not.toBe("none");

  const pendingBtn = page.getByRole("button", { name: "Registering…" });
  await expect(pendingBtn).toBeDisabled();
  await expect(pendingBtn).toHaveAttribute("aria-busy", "true");

  expect(consoleErrors).toEqual([]);
});
