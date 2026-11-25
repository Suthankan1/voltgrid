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
  STATION_ID_MAX_LENGTH,
  STATION_ID_PATTERN,
  STATION_NAME_MAX_LENGTH,
  isLoopbackHostHeader,
  localRegistrationEnabled,
  registerStation,
  submitStationRegistration,
  validateStationRegistrationInput,
} = loadTs("station-registration.ts");

const originalFetch = globalThis.fetch;
const originalWrites = process.env.OPERATOR_LOCAL_WRITES;
const originalEndpoint = process.env.STATION_GRAPHQL_URL;

afterEach(() => {
  globalThis.fetch = originalFetch;
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

function enableLocalWrites(url = "http://127.0.0.1:8080/graphql") {
  process.env.OPERATOR_LOCAL_WRITES = "true";
  process.env.STATION_GRAPHQL_URL = url;
}

test("writes require explicit opt-in and a local HTTP backend", async () => {
  globalThis.fetch = () => {
    throw new Error("Must not fetch");
  };

  delete process.env.OPERATOR_LOCAL_WRITES;
  assert.equal(localRegistrationEnabled(), false);
  const disabledOutcome = await submitStationRegistration("CP-1", "Station");
  assert.equal(disabledOutcome.status, "disabled");
  assert.match((await registerStation("CP-1", "Station")).message ?? "", /disabled/);

  process.env.OPERATOR_LOCAL_WRITES = "true";
  process.env.STATION_GRAPHQL_URL = "https://production.example/graphql";
  assert.equal(localRegistrationEnabled(), false);
  assert.equal((await submitStationRegistration("CP-1", "Station")).status, "disabled");

  process.env.STATION_GRAPHQL_URL = "http://localhost:8080/graphql";
  assert.equal(localRegistrationEnabled(), true);
  process.env.STATION_GRAPHQL_URL = "http://[::1]:8080/graphql";
  assert.equal(localRegistrationEnabled(), true);
});

test("isLoopbackHostHeader validates host headers safely including IPv6", () => {
  assert.equal(isLoopbackHostHeader("localhost:3000"), true);
  assert.equal(isLoopbackHostHeader("127.0.0.1:4312"), true);
  assert.equal(isLoopbackHostHeader("[::1]:3000"), true);
  assert.equal(isLoopbackHostHeader("localhost"), true);
  assert.equal(isLoopbackHostHeader("example.com"), false);
  assert.equal(isLoopbackHostHeader("127.0.0.1.evil.com:3000"), false);
  assert.equal(isLoopbackHostHeader(null), false);
});

for (const [id, name] of [
  ["", "Station"],
  ["   ", "Station"],
  ["../unsafe", "Station"],
  ["-leading-hyphen", "Station"],
  [".leading-dot", "Station"],
  ["space inside", "Station"],
  ["x".repeat(STATION_ID_MAX_LENGTH + 1), "Station"],
  ["CP-1", ""],
  ["CP-1", "   "],
  ["CP-1", "x".repeat(STATION_NAME_MAX_LENGTH + 1)],
]) {
  test(`invalid registration ${id.slice(0, 14)} / ${name.slice(0, 14)} does not mutate`, async () => {
    enableLocalWrites();
    globalThis.fetch = () => {
      throw new Error("Must not fetch");
    };

    const outcome = await submitStationRegistration(id, name);
    assert.equal(outcome.status, "validation-error");
    assert.ok(outcome.message);
    assert.ok((await registerStation(id, name)).message);
  });
}

test("validateStationRegistrationInput accepts max lengths, preserves casing, and reports simultaneous field errors", () => {
  const maxValid = validateStationRegistrationInput(
    `A${"b._:-1".repeat(45)}`.slice(0, STATION_ID_MAX_LENGTH),
    "N".repeat(STATION_NAME_MAX_LENGTH),
  );
  assert.equal(maxValid.valid, true);
  assert.equal(maxValid.id.length, STATION_ID_MAX_LENGTH);
  assert.equal(maxValid.name.length, STATION_NAME_MAX_LENGTH);

  const mixedCase = validateStationRegistrationInput("  cp-Alpha_01:ev.2  ", "  Colombo Central  ");
  assert.equal(mixedCase.valid, true);
  assert.equal(mixedCase.id, "cp-Alpha_01:ev.2");
  assert.equal(mixedCase.name, "Colombo Central");
  assert.match(mixedCase.id, STATION_ID_PATTERN);

  const bothInvalid = validateStationRegistrationInput("   ", "   ");
  assert.equal(bothInvalid.valid, false);
  assert.ok(bothInvalid.fieldErrors.name);
  assert.ok(bothInvalid.fieldErrors.id);
});

test("registration validates, trims, sends single no-store GraphQL mutation, and returns confirmed success", async () => {
  enableLocalWrites();
  let callCount = 0;

  globalThis.fetch = async (_url, options) => {
    callCount += 1;
    const body = JSON.parse(String(options?.body));
    assert.deepEqual(body.variables, { input: { id: "CP-1", name: "Station" } });
    assert.equal(options?.cache, "no-store");
    assert.ok(options?.signal);
    return Response.json({
      data: {
        registerStation: { id: "CP-1", name: "Station", status: "OFFLINE" },
      },
    });
  };

  const outcome = await submitStationRegistration(" CP-1 ", " Station ");
  assert.equal(callCount, 1);
  assert.deepEqual(outcome, {
    status: "success",
    station: { id: "CP-1", name: "Station", status: "OFFLINE" },
    ocppPath: "/ocpp/CP-1",
    protocolLabel: "OCPP 2.0.1",
  });

  assert.deepEqual(await registerStation(" CP-1 ", " Station "), {
    stationId: "CP-1",
  });
});

test("duplicate identifier and confirmed backend rejections classify distinctly without leaking secrets", async () => {
  enableLocalWrites();

  globalThis.fetch = async () =>
    Response.json({
      errors: [{ message: "Station already exists: CP-1" }],
    });
  const duplicateOutcome = await submitStationRegistration("CP-1", "Station");
  assert.equal(duplicateOutcome.status, "duplicate");
  assert.equal(duplicateOutcome.stationId, "CP-1");
  assert.match(duplicateOutcome.message, /already registered/);

  globalThis.fetch = async () =>
    Response.json({
      errors: [{ message: "secret connection string postgres://user:pass@db" }],
    });
  const failureOutcome = await submitStationRegistration("CP-1", "Station");
  assert.equal(failureOutcome.status, "failure");
  assert.doesNotMatch(failureOutcome.message, /secret|postgres/);
});

test("HTTP error, network error, and malformed payload produce uncertain outcome without auto-retry", async () => {
  enableLocalWrites();

  let fetchCalls = 0;
  globalThis.fetch = async () => {
    fetchCalls += 1;
    throw new Error("connection lost");
  };
  const netOutcome = await submitStationRegistration("CP-1", "Station");
  assert.equal(fetchCalls, 1);
  assert.equal(netOutcome.status, "uncertain");
  assert.match(netOutcome.message, /before retrying/);

  globalThis.fetch = async () => new Response("Bad Gateway", { status: 502 });
  const httpOutcome = await submitStationRegistration("CP-1", "Station");
  assert.equal(httpOutcome.status, "uncertain");

  globalThis.fetch = async () =>
    Response.json({ data: { registerStation: { id: "OTHER-ID", name: "Station", status: "OFFLINE" } } });
  const mismatchedOutcome = await submitStationRegistration("CP-1", "Station");
  assert.equal(mismatchedOutcome.status, "uncertain");
});
