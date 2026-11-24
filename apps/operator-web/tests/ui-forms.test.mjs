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

const { FormField } = loadTsxModule("../src/components/ui/form-field.tsx");
const { Input } = loadTsxModule("../src/components/ui/input.tsx");
const { Select } = loadTsxModule("../src/components/ui/select.tsx");

test("FormField associates visible label, description, and validation error with Input", () => {
  const html = renderToStaticMarkup(
    React.createElement(
      FormField,
      {
        label: "Station identifier",
        htmlFor: "station-id",
        description: "Letters, numbers, dots, underscores, colons and hyphens.",
        error: "Use 1–255 valid identifier characters.",
        required: true,
      },
      fieldProps =>
        React.createElement(Input, {
          ...fieldProps,
          name: "id",
          mono: true,
          maxLength: 255,
          autoComplete: "off",
        }),
    ),
  );

  assert.match(html, /<label for="station-id"/);
  assert.match(html, />Station identifier<\/span>/);
  assert.match(html, /<input[^>]*id="station-id"/);
  assert.match(html, /aria-describedby="station-id-description station-id-error"/);
  assert.match(html, /aria-invalid="true"/);
  assert.match(html, /required=""/);
  assert.match(html, /maxLength="255"/);
  assert.match(html, /autoComplete="off"/);
  assert.match(html, /font-mono/);
  assert.match(html, /id="station-id-description"/);
  assert.match(html, /id="station-id-error"/);
});

test("Input supports disabled, readOnly, and normal text without aria-invalid when valid", () => {
  const validHtml = renderToStaticMarkup(
    React.createElement(Input, { id: "station-name", name: "name", defaultValue: "Colombo Central" }),
  );
  assert.doesNotMatch(validHtml, /aria-invalid/);
  assert.match(validHtml, /font-sans/);
  assert.match(validHtml, /min-h-11/);

  const readOnlyHtml = renderToStaticMarkup(
    React.createElement(Input, { id: "ro", readOnly: true, value: "CP-1" }),
  );
  assert.match(readOnlyHtml, /readOnly=""/i);

  const disabledHtml = renderToStaticMarkup(
    React.createElement(Input, { id: "dis", disabled: true }),
  );
  assert.match(disabledHtml, /disabled=""/);
});

test("Select uses native select element with options or children and associates errors", () => {
  const withOptions = renderToStaticMarkup(
    React.createElement(
      FormField,
      {
        label: "Connectivity filter",
        htmlFor: "connectivity-select",
        error: "Select a valid status.",
      },
      fieldProps =>
        React.createElement(Select, {
          ...fieldProps,
          name: "status",
          defaultValue: "OFFLINE",
          options: [
            { value: "", label: "All stations" },
            { value: "ONLINE", label: "Online" },
            { value: "OFFLINE", label: "Offline" },
          ],
        }),
    ),
  );

  assert.match(withOptions, /<label for="connectivity-select"/);
  assert.match(withOptions, /<select[^>]*id="connectivity-select"/);
  assert.match(withOptions, /aria-invalid="true"/);
  assert.match(withOptions, /aria-describedby="connectivity-select-error"/);
  assert.match(withOptions, /<option value="OFFLINE" selected="">Offline<\/option>/);

  const withChildren = renderToStaticMarkup(
    React.createElement(
      Select,
      { id: "integrity", disabled: true },
      React.createElement("option", { value: "" }, "All"),
      React.createElement("option", { value: "INCOMPLETE" }, "Missing data"),
    ),
  );
  assert.match(withChildren, /disabled=""/);
  assert.match(withChildren, /<option value="INCOMPLETE">Missing data<\/option>/);
});
