import { afterEach, test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import vm from "node:vm";

const require = createRequire(import.meta.url);
const ts = require("typescript");

const libDir = path.resolve(new URL("../src/lib", import.meta.url).pathname);
const cache = new Map();

function loadTs(relPath) {
  const absPath = path.resolve(libDir, relPath);
  if (cache.has(absPath)) return cache.get(absPath);
  const source = readFileSync(absPath, "utf8");
  const { outputText } = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
      esModuleInterop: true,
    },
  });
  const mod = { exports: {} };
  cache.set(absPath, mod.exports);
  const localRequire = (id) => {
    if (id.startsWith("./")) {
      return loadTs(`${id.slice(2)}.ts`);
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
  executeRegisterStationAction,
  executeVerifyStationRegistrationAction,
} = loadTs("station-registration-actions.ts");

const originalWrites = process.env.OPERATOR_LOCAL_WRITES;
const originalEndpoint = process.env.STATION_GRAPHQL_URL;

afterEach(() => {
  for (const [key, value] of [
    ["OPERATOR_LOCAL_WRITES", originalWrites],
    ["STATION_GRAPHQL_URL", originalEndpoint],
  ]) {
    if (value === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  }
});

function enableLocalWrites() {
  process.env.OPERATOR_LOCAL_WRITES = "true";
  process.env.STATION_GRAPHQL_URL = "http://127.0.0.1:8080/graphql";
}

function makeFormData(entries) {
  const fd = new FormData();
  for (const [key, value] of Object.entries(entries)) {
    fd.set(key, value);
  }
  return fd;
}

test("executeRegisterStationAction rejects non-loopback hosts and forwarded hosts before mutating", async () => {
  enableLocalWrites();
  let mutated = false;

  for (const [hostHeader, forwardedHostHeader] of [
    ["operator.example.com", null],
    ["localhost:3000", "public.example.com"],
    [null, null],
  ]) {
    const outcome = await executeRegisterStationAction(
      makeFormData({ id: "CP-1", name: "Colombo" }),
      {
        hostHeader,
        forwardedHostHeader,
        submitRegistration: async () => {
          mutated = true;
          throw new Error("Should not call mutation");
        },
      },
    );
    assert.equal(outcome.status, "disabled");
    assert.match(outcome.message, /local console/i);
  }

  assert.equal(mutated, false);
});

test("executeRegisterStationAction accepts IPv6 loopback host and revalidates home and stations on success only", async () => {
  enableLocalWrites();
  const revalidated = [];

  const success = await executeRegisterStationAction(
    makeFormData({ id: " cp-01 ", name: " Colombo Central " }),
    {
      hostHeader: "[::1]:4312",
      revalidate: (p) => revalidated.push(p),
      submitRegistration: async (id, name) => ({
        status: "success",
        station: { id: String(id).trim(), name: String(name).trim(), status: "OFFLINE" },
        ocppPath: "/ocpp/cp-01",
        protocolLabel: "OCPP 2.0.1",
      }),
    },
  );
  assert.equal(success.status, "success");
  assert.deepEqual(revalidated, ["/", "/stations"]);

  const revalidatedOnDuplicate = [];
  const duplicate = await executeRegisterStationAction(
    makeFormData({ id: "cp-01", name: "Colombo" }),
    {
      hostHeader: "localhost:3000",
      revalidate: (p) => revalidatedOnDuplicate.push(p),
      submitRegistration: async () => ({
        status: "duplicate",
        id: "cp-01",
        name: "Colombo",
        stationId: "cp-01",
        message: "Duplicate",
      }),
    },
  );
  assert.equal(duplicate.status, "duplicate");
  assert.deepEqual(revalidatedOnDuplicate, []);
});

test("executeVerifyStationRegistrationAction performs read-only lookup for found, not-found, unavailable, and read-only gates", async () => {
  enableLocalWrites();

  const found = await executeVerifyStationRegistrationAction(
    makeFormData({ stationId: "  CP-99  " }),
    {
      hostHeader: "127.0.0.1:4312",
      lookupStation: async (stationId) => ({
        state: "live",
        station: { id: stationId, name: "Colombo 99", status: "OFFLINE" },
        connectors: { state: "live", items: [] },
        transactions: { state: "live", items: [] },
      }),
    },
  );
  assert.equal(found.status, "found");
  assert.equal(found.station.id, "CP-99");
  assert.equal(found.ocppPath, "/ocpp/CP-99");

  const notFound = await executeVerifyStationRegistrationAction(
    makeFormData({ stationId: "CP-100" }),
    {
      hostHeader: "localhost:3000",
      lookupStation: async () => ({
        state: "not-found",
        station: null,
        connectors: { state: "not-found", items: [] },
        transactions: { state: "not-found", items: [] },
      }),
    },
  );
  assert.equal(notFound.status, "not-found");
  assert.equal(notFound.stationId, "CP-100");

  const unavailable = await executeVerifyStationRegistrationAction(
    makeFormData({ stationId: "CP-100" }),
    {
      hostHeader: "localhost:3000",
      lookupStation: async () => ({
        state: "unavailable",
        station: null,
        connectors: { state: "unavailable", items: [], message: "Service unreachable." },
        transactions: { state: "unavailable", items: [], message: "Service unreachable." },
        message: "Service unreachable.",
      }),
    },
  );
  assert.equal(unavailable.status, "unavailable");
  assert.equal(unavailable.message, "Service unreachable.");

  delete process.env.OPERATOR_LOCAL_WRITES;
  let queriedWhenDisabled = false;
  const disabled = await executeVerifyStationRegistrationAction(
    makeFormData({ stationId: "CP-100" }),
    {
      hostHeader: "localhost:3000",
      lookupStation: async () => {
        queriedWhenDisabled = true;
        throw new Error("Should not lookup when disabled");
      },
    },
  );
  assert.equal(disabled.status, "disabled");
  assert.equal(queriedWhenDisabled, false);
});
