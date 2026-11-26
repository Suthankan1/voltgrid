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

const {
  buildSessionsDirectoryModel,
  buildVerifiedStationNameMap,
  normalizeSessionsDirectoryFilters,
} = loadModule("lib/sessions-directory-model.ts");
const { SessionsDirectoryHeader } = loadModule(
  "components/sessions/sessions-directory-header.tsx",
);
const { SessionsDirectorySummary } = loadModule(
  "components/sessions/sessions-directory-summary.tsx",
);
const { SessionsDirectoryView } = loadModule(
  "components/sessions/sessions-directory-view.tsx",
);
const {
  SessionsDirectoryErrorState,
  SessionsDirectoryLoading,
} = loadModule("components/sessions/sessions-directory-states.tsx");

const stationNames = buildVerifiedStationNameMap({
  state: "live",
  stations: [{ id: "CP-1", name: "Colombo Central", status: "ONLINE" }],
});

function buildLiveModel({
  rows,
  filtersRaw = {},
  page = 0,
  size = 20,
  totalElements = rows.length,
  totalPages = rows.length > 0 ? 1 : 0,
  hasNext = false,
  missingSnapshot = null,
} = {}) {
  const filters = normalizeSessionsDirectoryFilters(filtersRaw);
  return buildSessionsDirectoryModel(
    {
      state: "live",
      transactions: rows,
      page,
      size,
      totalElements,
      totalPages,
      hasNext,
    },
    filters,
    {
      stationNames,
      networkMissingDataSnapshot: missingSnapshot,
      retrievedAtIso: "2026-10-08T10:00:00Z",
    },
  );
}

test("SessionsDirectoryHeader and Summary render server counts, network-wide missing data, and Unknown fallback", () => {
  const headerHtml = renderToStaticMarkup(React.createElement(SessionsDirectoryHeader));
  assert.match(headerHtml, /Charging sessions/);
  assert.match(headerHtml, /href="\/stations"/);

  const model = buildLiveModel({
    rows: [
      {
        transaction: {
          stationId: "CP-1",
          transactionId: "TX-1",
          evseId: 1,
          connectorId: 1,
          status: "ACTIVE",
          startedAt: "2026-10-08T09:00:00Z",
          endedAt: null,
          lastSequenceNumber: 2,
        },
        completeness: {
          status: "IN_PROGRESS",
          firstSequenceNumber: 0,
          lastSequenceNumber: 2,
          missingSequenceNumbers: [],
        },
      },
    ],
    totalElements: 42,
    totalPages: 3,
    hasNext: true,
    missingSnapshot: {
      state: "live",
      transactions: [],
      page: 0,
      size: 1,
      totalElements: 7,
      totalPages: 7,
      hasNext: true,
    },
  });

  const summaryHtml = renderToStaticMarkup(
    React.createElement(SessionsDirectorySummary, { model }),
  );
  assert.match(summaryHtml, /Recorded sessions/);
  assert.match(summaryHtml, />42</);
  assert.match(summaryHtml, /Missing data \(network-wide\)/);
  assert.match(summaryHtml, />7</);
  assert.match(summaryHtml, /href="\/sessions\?integrityStatus=INCOMPLETE"/);
  assert.match(summaryHtml, /Page 1 of 3/);

  const partialFailureModel = buildLiveModel({
    rows: [],
    missingSnapshot: {
      state: "unavailable",
      transactions: [],
      page: 0,
      size: 1,
      totalElements: 0,
      totalPages: 0,
      hasNext: false,
      message: "Timeout",
    },
  });
  const partialHtml = renderToStaticMarkup(
    React.createElement(SessionsDirectorySummary, { model: partialFailureModel }),
  );
  assert.match(partialHtml, /Unknown/);
});

test("SessionsDirectoryView renders desktop table, mobile cards, composite IDs, separated indicators, pagination, and scoped lifecycle note", () => {
  const model = buildLiveModel({
    rows: [
      {
        transaction: {
          stationId: "CP-1",
          transactionId: "TX-SHARED",
          evseId: 1,
          connectorId: 1,
          status: "ACTIVE",
          startedAt: "2026-10-08T09:00:00Z",
          endedAt: null,
          lastSequenceNumber: 2,
        },
        completeness: {
          status: "IN_PROGRESS",
          firstSequenceNumber: 0,
          lastSequenceNumber: 2,
          missingSequenceNumbers: [],
        },
      },
      {
        transaction: {
          stationId: "CP-UNKNOWN",
          transactionId: "TX-SHARED",
          evseId: 2,
          connectorId: 1,
          status: "ENDED",
          startedAt: "2026-10-08T08:00:00Z",
          endedAt: "2026-10-08T09:30:00Z",
          lastSequenceNumber: 5,
        },
        completeness: {
          status: "INCOMPLETE",
          firstSequenceNumber: 0,
          lastSequenceNumber: 5,
          missingSequenceNumbers: [3, 4],
        },
      },
    ],
    filtersRaw: { stationId: "CP-1", page: "1", size: "10" },
    page: 1,
    size: 10,
    totalElements: 25,
    totalPages: 3,
    hasNext: true,
  });

  const html = renderToStaticMarkup(
    React.createElement(SessionsDirectoryView, {
      model,
      errorFallback: null,
    }),
  );

  // Filter toolbar + case-preserved chips
  assert.match(html, /Station identifier/);
  assert.match(html, /Session identifier/);
  assert.match(html, /Data completeness/);
  assert.match(html, /Missing data/);
  assert.match(html, /Clear filters/);
  assert.match(html, /Station: CP-1/);

  // Explicit page-local lifecycle scope disclaimer
  assert.match(html, /Current page only/);
  assert.match(html, /Server totals and page counts do not change/);

  // Composite links (both CP-1 & CP-UNKNOWN with identical TX-SHARED)
  assert.match(html, /href="\/stations\/CP-1\/sessions\/TX-SHARED\?returnTo=/);
  assert.match(html, /href="\/stations\/CP-UNKNOWN\/sessions\/TX-SHARED\?returnTo=/);
  assert.match(html, /Colombo Central/);
  assert.match(html, /Missing #3, #4/);
  assert.match(html, /Duration 1h 30m/);
  assert.match(html, /Ongoing session/);
  assert.match(html, /Copy session identifier TX-SHARED/);

  // Pagination controls
  assert.match(html, /Page 2 of 3/);
  assert.match(html, /Showing 11–12 of 25 matching sessions/);
  assert.match(html, /href="\/sessions\?stationId=CP-1&amp;size=10"/);
  assert.match(html, /href="\/sessions\?stationId=CP-1&amp;page=2&amp;size=10"/);
});

test("SessionsDirectoryView distinguishes empty network, no-matches, unavailable ErrorState, and loading skeletons", () => {
  const emptyModel = buildLiveModel({ rows: [] });
  const emptyHtml = renderToStaticMarkup(
    React.createElement(SessionsDirectoryView, {
      model: emptyModel,
      errorFallback: null,
    }),
  );
  assert.match(emptyHtml, /No charging sessions recorded/);
  assert.doesNotMatch(emptyHtml, /Clear filters/);

  const noMatchModel = buildLiveModel({
    rows: [],
    filtersRaw: { transactionId: "TX-MISSING" },
  });
  const noMatchHtml = renderToStaticMarkup(
    React.createElement(SessionsDirectoryView, {
      model: noMatchModel,
      errorFallback: null,
    }),
  );
  assert.match(noMatchHtml, /No charging sessions match the selected filters/);
  assert.match(noMatchHtml, /Clear filters/);

  const unavailableModel = buildSessionsDirectoryModel(
    {
      state: "unavailable",
      transactions: [],
      page: 0,
      size: 20,
      totalElements: 0,
      totalPages: 0,
      hasNext: false,
      message: "Station API could not be reached.",
    },
    normalizeSessionsDirectoryFilters({}),
  );
  const unavailableHtml = renderToStaticMarkup(
    React.createElement(SessionsDirectoryView, {
      model: unavailableModel,
      errorFallback: React.createElement(SessionsDirectoryErrorState, {
        message: "Station API could not be reached.",
      }),
    }),
  );
  assert.match(unavailableHtml, /Unable to load charging sessions/);
  assert.match(unavailableHtml, /Try again/);

  const loadingHtml = renderToStaticMarkup(
    React.createElement(SessionsDirectoryLoading),
  );
  assert.match(loadingHtml, /aria-busy="true"/);
  assert.match(loadingHtml, /Loading charging sessions/);
});
