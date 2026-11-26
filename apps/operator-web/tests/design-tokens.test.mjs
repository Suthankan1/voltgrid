import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const css = readFileSync(new URL("../src/app/design-tokens.css", import.meta.url), "utf8");
const colors = new Map([...css.matchAll(/--vg-([\w-]+):\s*(#[0-9a-f]{6});/gi)].map(([, key, value]) => [key, value]));
function luminance(hex) {
  const [r, g, b] = hex.slice(1).match(/../g).map(value => parseInt(value, 16) / 255).map(value => value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
const pairs = [["text-primary","canvas"],["text-secondary","canvas"],["text-secondary","surface"],["text-inverse","brand"],["text-inverse","brand-hover"],["text-inverse","brand-pressed"],["brand","brand-soft"],["success","success-soft"],["warning","warning-soft"],["danger","danger-soft"],["info","info-soft"],["neutral","neutral-soft"],["focus","canvas",3],["border-control","surface",3],["brand","accent"]];
for (const [foreground, background, minimum = 4.5] of pairs) {
  test(`design token contrast: ${foreground} on ${background}`, () => {
    assert.ok(colors.has(foreground) && colors.has(background));
    const a = luminance(colors.get(foreground));
    const b = luminance(colors.get(background));
    const ratio = (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
    assert.ok(ratio >= minimum, `contrast ${ratio.toFixed(2)} below ${minimum}`);
  });
}
