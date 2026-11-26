import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { test } from "node:test";

const assets = [["public/fonts/manrope-variable.ttf","75274da58537d6123b14f2cd0c355ad4681fc2b3"],["public/fonts/ibm-plex-mono-regular.ttf","0c9770d5183ba60dc4350d3e011b782a320761ae"],["public/fonts/manrope-OFL.txt","e271172a9ed0cddc895aabb6509f1c7d880b492d"],["public/fonts/ibm-plex-mono-OFL.txt","c35c4c618fab33da8695177b3a6cefe0810b7b28"]];
for (const [path, sha] of assets) {
  test(`bundled typography asset: ${path}`, () => {
    const bytes = readFileSync(new URL("../" + path, import.meta.url));
    const actual = createHash("sha1").update(`blob ${bytes.length}\0`).update(bytes).digest("hex");
    assert.equal(actual, sha);
  });
}
const css = readFileSync(new URL("../src/app/typography.css", import.meta.url), "utf8");
const tokens = readFileSync(new URL("../src/app/design-tokens.css", import.meta.url), "utf8");
const globals = readFileSync(new URL("../src/app/globals.css", import.meta.url), "utf8");
test("local font declarations and global aliases", () => {
  assert.match(css, /font-family: "Manrope"/);
  assert.match(css, /font-weight: 200 800/);
  assert.match(css, /font-family: "IBM Plex Mono"/);
  assert.doesNotMatch(css, /https?:|@import/);
  assert.match(css, /url\("\/fonts\/manrope-variable\.ttf"\)/);
  assert.match(css, /url\("\/fonts\/ibm-plex-mono-regular\.ttf"\)/);
  assert.match(tokens, /--vg-font-sans: "Manrope"/);
  assert.match(tokens, /--vg-font-mono: "IBM Plex Mono"/);
  assert.match(globals, /@import "\.\/typography\.css"/);
  assert.match(globals, /--font-operator-sans: var\(--vg-font-sans\)/);
  assert.match(globals, /--font-operator-mono: var\(--vg-font-mono\)/);
});
