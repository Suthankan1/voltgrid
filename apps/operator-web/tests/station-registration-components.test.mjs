import assert from "node:assert/strict";
import { readFileSync, statSync } from "node:fs";
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

function loadModule(relPath) {
  const absPath = path.resolve(srcDir, relPath);
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
  const localRequire = (id) => {
    if (id.startsWith("./")) {
      const target = path.resolve(path.dirname(absPath), id);
      const file = statSync(`${target}.tsx`, { throwIfNoEntry: false })
        ? `${target}.tsx`
        : `${target}.ts`;
      return loadModule(path.relative(srcDir, file));
    }
    if (id.startsWith("@/")) {
      const target = path.resolve(srcDir, id.slice(2));
      const file = statSync(`${target}.tsx`, { throwIfNoEntry: false })
        ? `${target}.tsx`
        : `${target}.ts`;
      return loadModule(path.relative(srcDir, file));
    }
    if (id === "next/navigation") {
      return { useRouter: () => ({ refresh() {} }) };
    }
    return require(id);
  };
  const fn = vm.runInThisContext(
    `(function(exports, require, module) {\n${outputText}\n})`,
  );
  fn(mod.exports, localRequire, mod);
  cache.set(absPath, mod.exports);
  return mod.exports;
}

const { StationRegistrationWorkspace } = loadModule(
  "components/stations/station-registration-workspace.tsx",
);
const { StationRegistrationReadOnly } = loadModule(
  "components/stations/station-registration-readonly.tsx",
);
const { StationsDirectoryHeader } = loadModule(
  "components/stations/stations-directory-header.tsx",
);
const { buildStationRegistrationHref } = loadModule("lib/routes.ts");

const noopAction = async () => ({ status: "idle" });

test("buildStationRegistrationHref preserves safe directory context and rejects unsafe targets", () => {
  assert.equal(buildStationRegistrationHref("/stations"), "/stations/new");
  assert.equal(
    buildStationRegistrationHref("/stations?status=OFFLINE&q=Colombo"),
    "/stations/new?returnTo=%2Fstations%3Fstatus%3DOFFLINE%26q%3DColombo",
  );
  assert.equal(buildStationRegistrationHref("https://evil.example"), "/stations/new");

  const headerHtml = renderToStaticMarkup(
    React.createElement(StationsDirectoryHeader, {
      registrationEnabled: true,
      returnPath: "/stations?status=OFFLINE",
    }),
  );
  assert.match(headerHtml, /href="\/stations\/new\?returnTo=%2Fstations%3Fstatus%3DOFFLINE"/);
});

test("StationRegistrationWorkspace renders default inputs with labels, no maxLength clamping, and initial offline guidance", () => {
  const html = renderToStaticMarkup(
    React.createElement(StationRegistrationWorkspace, {
      backHref: "/stations",
      registerAction: noopAction,
      verifyAction: noopAction,
    }),
  );

  assert.match(html, /Station name/);
  assert.match(html, /Station identifier/);
  assert.match(html, /placeholder="Colombo Central"/);
  assert.match(html, /placeholder="CP-001"/);
  assert.match(html, /New stations start offline/);
  assert.match(html, /Register station/);
  assert.doesNotMatch(html, /maxlength=/i);
});

test("StationRegistrationWorkspace preserves submitted values and exposes aria-invalid on validation errors", () => {
  const html = renderToStaticMarkup(
    React.createElement(StationRegistrationWorkspace, {
      backHref: "/stations",
      registerAction: noopAction,
      verifyAction: noopAction,
      initialActionState: {
        status: "validation-error",
        id: "bad id",
        name: "Colombo Hub",
        submittedId: "  bad id  ",
        submittedName: "  Colombo Hub  ",
        fieldErrors: {
          id: "Use letters, numbers, dots, underscores, colons, or hyphens, starting with a letter or number.",
        },
        message:
          "Use letters, numbers, dots, underscores, colons, or hyphens, starting with a letter or number.",
      },
    }),
  );

  assert.match(html, /value=" {2}Colombo Hub {2}"/);
  assert.match(html, /value=" {2}bad id {2}"/);
  assert.match(html, /aria-invalid="true"/);
  assert.match(html, /Check station details/);
});

test("StationRegistrationWorkspace renders confirmed success, actual status, shared OCPP guidance, and inspect links", () => {
  const html = renderToStaticMarkup(
    React.createElement(StationRegistrationWorkspace, {
      backHref: "/stations?status=OFFLINE",
      registerAction: noopAction,
      verifyAction: noopAction,
      initialActionState: {
        status: "success",
        station: { id: "cp-Alpha_01", name: "Colombo Central", status: "OFFLINE" },
        ocppPath: "/ocpp/cp-Alpha_01",
        protocolLabel: "OCPP 2.0.1",
      },
    }),
  );

  assert.match(html, /Station registered/);
  assert.match(html, /Offline/);
  assert.match(html, /Colombo Central/);
  assert.match(html, /\/ocpp\/cp-Alpha_01/);
  assert.match(html, /WebSocket subprotocol <code>ocpp2\.0\.1<\/code>/);
  assert.match(html, /Inspect station details/);
  assert.match(html, /Connection details/);
  assert.match(html, /Register another station/);
  assert.match(html, /returnTo=%2Fstations%3Fstatus%3DOFFLINE/);
});

test("StationRegistrationWorkspace renders duplicate, confirmed failure, and uncertain lookup states distinctly", () => {
  const duplicateHtml = renderToStaticMarkup(
    React.createElement(StationRegistrationWorkspace, {
      backHref: "/stations",
      registerAction: noopAction,
      verifyAction: noopAction,
      initialActionState: {
        status: "duplicate",
        id: "CP-1",
        name: "Colombo Central",
        stationId: "CP-1",
        message:
          "This station identifier is already registered. Inspect the existing station or choose another identifier.",
      },
    }),
  );
  assert.match(duplicateHtml, /Station identifier already exists/);
  assert.match(duplicateHtml, /Inspect existing station CP-1/);
  assert.match(duplicateHtml, /href="\/stations\/CP-1"/);

  const uncertainHtml = renderToStaticMarkup(
    React.createElement(StationRegistrationWorkspace, {
      backHref: "/stations",
      registerAction: noopAction,
      verifyAction: noopAction,
      initialActionState: {
        status: "uncertain",
        id: "CP-99",
        name: "Kandy Hub",
        stationId: "CP-99",
        message:
          "We could not confirm whether the station was registered. Check the station identifier before retrying to avoid duplicates.",
      },
      initialVerificationState: {
        status: "found",
        station: { id: "CP-99", name: "Kandy Hub", status: "OFFLINE" },
        ocppPath: "/ocpp/CP-99",
        protocolLabel: "OCPP 2.0.1",
        message:
          "A station record with this identifier exists in Station Service. Inspect its details before attempting another registration.",
      },
    }),
  );
  assert.match(uncertainHtml, /Registration could not be confirmed/);
  assert.match(uncertainHtml, /Check station record/);
  assert.match(uncertainHtml, /Existing station record found/);
  assert.match(uncertainHtml, /Inspect station CP-99/);
});

test("StationRegistrationReadOnly hides executable form controls and links safely back", () => {
  const html = renderToStaticMarkup(
    React.createElement(StationRegistrationReadOnly, {
      backHref: "/stations?status=OFFLINE",
    }),
  );

  assert.match(html, /Read-only console/);
  assert.match(html, /Return to charging stations/);
  assert.match(html, /href="\/stations\?status=OFFLINE"/);
  assert.doesNotMatch(html, /<form\b/i);
  assert.doesNotMatch(html, /Register station/);
});
