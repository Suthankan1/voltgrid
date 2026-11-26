import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { test } from "node:test";

const uiDir = path.resolve(new URL("../src/components/ui", import.meta.url).pathname);

test("UI primitives consume --vg-* semantic tokens without hardcoded brand or status hex colors", () => {
  const files = readdirSync(uiDir).filter(file => file.endsWith(".tsx"));
  assert.ok(files.length >= 10);

  for (const file of files) {
    const content = readFileSync(path.join(uiDir, file), "utf8");
    assert.match(content, /var\(--vg-/, `${file} should consume --vg-* tokens`);
    assert.doesNotMatch(
      content,
      /#(?:43284f|593965|321b3c|795a88|e8ddf0|f3bb94|f8f6f3|27232d|2457ff)/i,
      `${file} should not hardcode palette hex literals`,
    );
  }
});

test("UI barrel exports all documented primitives", () => {
  const indexContent = readFileSync(path.join(uiDir, "index.ts"), "utf8");
  for (const symbol of [
    "Button",
    "IconButton",
    "Card",
    "Surface",
    "FormField",
    "Input",
    "Select",
    "StatusIndicator",
    "StationStatusIndicator",
    "ConnectorStatusIndicator",
    "SessionLifecycleIndicator",
    "SessionCompletenessIndicator",
    "OperationsStatusIndicator",
    "Alert",
    "EmptyState",
    "ErrorState",
    "Skeleton",
    "SkeletonGroup",
    "MetricCard",
  ]) {
    assert.match(indexContent, new RegExp(`\\b${symbol}\\b`), `index.ts missing ${symbol}`);
  }
});

test("UI documentation covers every primitive, status domain, and accessibility rule", () => {
  const docs = readFileSync(path.join(uiDir, "README.md"), "utf8");
  for (const term of [
    "Button",
    "IconButton",
    "Card",
    "FormField",
    "Input",
    "Select",
    "StatusIndicator",
    "Alert",
    "EmptyState",
    "ErrorState",
    "SkeletonGroup",
    "MetricCard",
    "44 × 44",
    "prefers-reduced-motion",
    "Missing data",
    "OCCUPIED",
    "INCOMPLETE",
  ]) {
    assert.ok(docs.includes(term), `README.md missing ${term}`);
  }
});
