import { mkdirSync } from "node:fs";
import { createServer } from "node:http";
import { spawn } from "node:child_process";
import net from "node:net";
import path from "node:path";
import { expect, test } from "@playwright/test";
import { signIn } from "./sign-in";
import { respondToOrganizationAccess } from "./organization-fixture";

const VIEWPORTS = [
  [320, 568],
  [390, 844],
  [768, 1024],
  [1024, 768],
  [1280, 800],
  [1440, 900],
  [1920, 1080],
] as const;

const SCREENSHOT_DIR = process.env.UI108_CAPTURE_DIR ?? "";

async function getFreePort(): Promise<number> {
  return await new Promise((resolve, reject) => {
    const server = net.createServer();
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      if (!address || typeof address === "string") {
        reject(new Error("Could not allocate free port"));
        return;
      }
      const { port } = address;
      server.close((err) => (err ? reject(err) : resolve(port)));
    });
  });
}

async function waitForHttpOk(url: string): Promise<void> {
  for (let i = 0; i < 60; i += 1) {
    try {
      const res = await fetch(url);
      if (res.ok || res.status === 404) return;
    } catch {
      // retry
    }
    await new Promise((r) => setTimeout(r, 250));
  }
  throw new Error(`Timed out waiting for server at ${url}`);
}

test("canonical session detail covers viewports, zoom, reduced motion, stream isolation, gaps, edge series, partial errors, and copy actions", async ({
  page,
}) => {
  test.setTimeout(90_000);
  type Scenario =
    | "rich"
    | "partial-comp-fail"
    | "partial-samples-fail"
    | "lookup-fail"
    | "empty-samples"
    | "large-range-and-downsampled"
    | "single-negative-and-inconsistent"
    | "unbounded-null-start";

  const state: {
    scenario: Scenario;
    lookupRequests: number;
  } = {
    scenario: "rich",
    lookupRequests: 0,
  };

  const baseTx = {
    stationId: "CP%1",
    transactionId: "TX%1",
    evseId: 1,
    connectorId: 2,
    status: "ENDED",
    startedAt: "2026-10-08T08:00:00Z",
    endedAt: "2026-10-08T08:45:00Z",
    lastSequenceNumber: 6,
  };

  const apiPort = await getFreePort();
  const appPort = 4313;
  const origin = `http://127.0.0.1:${appPort}`;

  const apiServer = createServer(async (req, res) => {
    if (respondToOrganizationAccess(req, res)) return;
    let body = "";
    for await (const chunk of req) body += chunk;
    const { query, variables = {} } = JSON.parse(body || "{}") as {
      query: string;
      variables?: Record<string, string>;
    };

    res.setHeader("Content-Type", "application/json");

    if (query.includes("OperatorTransaction(")) {
      state.lookupRequests += 1;
      if (state.scenario === "lookup-fail") {
        res.end(
          JSON.stringify({
            data: { transaction: null },
            errors: [{ message: "secret internal pg password leak", path: ["transaction"] }],
          }),
        );
        return;
      }
      if (variables.transactionId === "missing") {
        res.end(JSON.stringify({ data: { transaction: null } }));
        return;
      }
      if (state.scenario === "single-negative-and-inconsistent") {
        res.end(
          JSON.stringify({
            data: {
              transaction: {
                ...baseTx,
                stationId: variables.stationId,
                transactionId: variables.transactionId,
                lastSequenceNumber: 12,
              },
            },
          }),
        );
        return;
      }
      if (state.scenario === "large-range-and-downsampled") {
        res.end(
          JSON.stringify({
            data: {
              transaction: {
                ...baseTx,
                stationId: variables.stationId,
                transactionId: variables.transactionId,
                lastSequenceNumber: 100000,
              },
            },
          }),
        );
        return;
      }
      res.end(
        JSON.stringify({
          data: {
            transaction: {
              ...baseTx,
              stationId: variables.stationId,
              transactionId: variables.transactionId,
            },
          },
        }),
      );
      return;
    }

    if (query.includes("OperatorTransactionData")) {
      if (state.scenario === "partial-comp-fail") {
        res.end(
          JSON.stringify({
            data: {
              transactionCompleteness: null,
              transactionMeterSamples: [
                {
                  sequenceNumber: 1,
                  sampledAt: "2026-10-08T08:05:00Z",
                  value: "7400",
                  measurand: "Power.Active.Import",
                  context: "Sample.Periodic",
                  phase: null,
                  location: "Outlet",
                  unit: "W",
                  unitMultiplier: 0,
                },
              ],
            },
            errors: [
              {
                message: "secret completeness SQL trace",
                path: ["transactionCompleteness"],
              },
            ],
          }),
        );
        return;
      }

      if (state.scenario === "partial-samples-fail") {
        res.end(
          JSON.stringify({
            data: {
              transactionCompleteness: {
                status: "COMPLETE",
                firstSequenceNumber: 0,
                lastSequenceNumber: 6,
                missingSequenceNumbers: [],
              },
              transactionMeterSamples: null,
            },
            errors: [
              {
                message: "secret sample table leak",
                path: ["transactionMeterSamples"],
              },
            ],
          }),
        );
        return;
      }

      if (state.scenario === "empty-samples") {
        res.end(
          JSON.stringify({
            data: {
              transactionCompleteness: {
                status: "COMPLETE",
                firstSequenceNumber: 0,
                lastSequenceNumber: 6,
                missingSequenceNumbers: [],
              },
              transactionMeterSamples: [],
            },
          }),
        );
        return;
      }

      if (state.scenario === "large-range-and-downsampled") {
        const denseSamples = Array.from({ length: 240 }, (_, i) => ({
          sequenceNumber: i + 1,
          sampledAt: new Date(
            Date.UTC(2026, 9, 8, 8, Math.floor(i / 60), i % 60),
          ).toISOString(),
          value: i === 120 ? "22000" : i === 60 ? "3200" : "7400",
          measurand: "Power.Active.Import",
          context: "Sample.Periodic",
          phase: null,
          location: "Outlet",
          unit: "W",
          unitMultiplier: 0,
        }));
        res.end(
          JSON.stringify({
            data: {
              transactionCompleteness: {
                status: "INCOMPLETE",
                firstSequenceNumber: 0,
                lastSequenceNumber: 100000,
                missingSequenceNumbers: [500, 501, 502],
              },
              transactionMeterSamples: denseSamples,
            },
          }),
        );
        return;
      }

      if (state.scenario === "single-negative-and-inconsistent") {
        res.end(
          JSON.stringify({
            data: {
              transactionCompleteness: {
                status: "INCOMPLETE",
                firstSequenceNumber: 1,
                lastSequenceNumber: 8,
                missingSequenceNumbers: [3],
              },
              transactionMeterSamples: [
                {
                  sequenceNumber: 2,
                  sampledAt: "2026-10-08T08:02:00Z",
                  value: "-1500",
                  measurand: "Power.Active.Export",
                  context: "Sample.Periodic",
                  phase: null,
                  location: "Outlet",
                  unit: "W",
                  unitMultiplier: 0,
                },
              ],
            },
          }),
        );
        return;
      }

      if (state.scenario === "unbounded-null-start") {
        res.end(
          JSON.stringify({
            data: {
              transactionCompleteness: {
                status: "UNKNOWN",
                firstSequenceNumber: null,
                lastSequenceNumber: 6,
                missingSequenceNumbers: [],
              },
              transactionMeterSamples: [],
            },
          }),
        );
        return;
      }

      // Rich realistic multi-stream dataset with gaps, unitMultiplier, duplicate timestamps, unplottable raw value, and register stream
      res.end(
        JSON.stringify({
          data: {
            transactionCompleteness: {
              status: "INCOMPLETE",
              firstSequenceNumber: 0,
              lastSequenceNumber: 6,
              missingSequenceNumbers: [3],
            },
            transactionMeterSamples: [
              {
                sequenceNumber: 1,
                sampledAt: "2026-10-08T08:05:00Z",
                value: "7200",
                measurand: "Power.Active.Import",
                context: "Sample.Periodic",
                phase: null,
                location: "Outlet",
                unit: "W",
                unitMultiplier: 0,
              },
              {
                sequenceNumber: 2,
                sampledAt: "2026-10-08T08:15:00Z",
                value: "7.4",
                measurand: "Power.Active.Import",
                context: "Sample.Periodic",
                phase: null,
                location: "Outlet",
                unit: "W",
                unitMultiplier: 3,
              },
              {
                sequenceNumber: 4,
                sampledAt: "2026-10-08T08:30:00Z",
                value: "11.0",
                measurand: "Power.Active.Import",
                context: "Sample.Periodic",
                phase: null,
                location: "Outlet",
                unit: "W",
                unitMultiplier: 3,
              },
              {
                sequenceNumber: 5,
                sampledAt: "2026-10-08T08:35:00Z",
                value: "not-a-number",
                measurand: "Power.Active.Import",
                context: "Sample.Periodic",
                phase: null,
                location: "Outlet",
                unit: "W",
                unitMultiplier: 3,
              },
              {
                sequenceNumber: 2,
                sampledAt: "2026-10-08T08:15:00Z",
                value: "3700",
                measurand: "Power.Active.Import",
                context: "Sample.Periodic",
                phase: "L1",
                location: "Outlet",
                unit: "W",
                unitMultiplier: 0,
              },
              {
                sequenceNumber: 4,
                sampledAt: "2026-10-08T08:30:00Z",
                value: "12.5",
                measurand: "Energy.Active.Import.Register",
                context: "Sample.Periodic",
                phase: null,
                location: "Outlet",
                unit: "Wh",
                unitMultiplier: 3,
              },
            ],
          },
        }),
      );
      return;
    }

    res.writeHead(400);
    res.end("Unexpected query");
  });

  await new Promise<void>((resolve) =>
    apiServer.listen(apiPort, "127.0.0.1", () => resolve()),
  );

  const nextProc = spawn(
    "node",
    [
      "node_modules/next/dist/bin/next",
      "start",
      "--hostname",
      "127.0.0.1",
      "--port",
      String(appPort),
    ],
    {
      cwd: process.cwd(),
      env: {
        ...process.env,
        OPERATOR_WEB_ORIGIN: `http://127.0.0.1:${appPort}`,
        OIDC_LOCAL_HTTP: "true",
        STATION_GRAPHQL_URL: `http://127.0.0.1:${apiPort}/graphql`,
        OPERATIONS_GRAPHQL_URL: `http://127.0.0.1:${apiPort}/graphql`,
      },
      stdio: "ignore",
    },
  );

  const consoleErrors: string[] = [];
  const pageErrors: string[] = [];
  page.on("console", (msg) => {
    if (msg.type() === "error") consoleErrors.push(msg.text());
  });
  page.on("pageerror", (err) => pageErrors.push(err.message));

  const capture = async (filename: string) => {
    if (!SCREENSHOT_DIR) return;
    mkdirSync(SCREENSHOT_DIR, { recursive: true });
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.screenshot({
      path: path.join(SCREENSHOT_DIR, filename),
      fullPage: true,
    });
  };

  try {
    await waitForHttpOk(`${origin}/stations/CP%251/sessions/TX%251`);
    await signIn(page, origin);

    // 1. All 7 viewports across Measurements and Technical without horizontal overflow
    for (const [width, height] of VIEWPORTS) {
      await page.setViewportSize({ width, height });
      await page.goto(
        `${origin}/stations/CP%251/sessions/TX%251?section=measurements`,
      );
      await expect(
        page.getByRole("heading", { name: "Session TX%1", exact: true }),
      ).toBeVisible();
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      );
      expect(overflow).toBe(true);
    }

    // 2. Capture required desktop & mobile screenshots for Overview, Measurements, Technical
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(
      `${origin}/stations/CP%251/sessions/TX%251?returnTo=%2Fsessions%3FintegrityStatus%3DINCOMPLETE`,
    );
    await expect(
      page.getByRole("heading", { name: "Session TX%1", exact: true }),
    ).toBeVisible();
    await capture("session-overview-1440.png");

    await page.setViewportSize({ width: 390, height: 844 });
    await capture("session-overview-390.png");

    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(
      `${origin}/stations/CP%251/sessions/TX%251?section=measurements&returnTo=%2Fsessions%3FintegrityStatus%3DINCOMPLETE`,
    );
    await expect(page.getByRole("img", { name: /Time-series measurement chart/i })).toBeVisible();
    await expect(page.getByText("Only recorded measurements are displayed.")).toBeVisible();
    await expect(page.getByText("Telemetry gaps break the plotted line")).toBeVisible();
    const rawTable = page.getByRole("table");
    await expect(rawTable.getByText("7.2 kW").first()).toBeVisible();
    await expect(rawTable.getByText("11 kW").first()).toBeVisible();
    await expect(rawTable.getByText("not-a-number × 10^3 W").first()).toBeVisible();
    await capture("session-measurements-1440.png");

    // Step through plotted points with keyboard button
    await page.getByRole("button", { name: "Previous point" }).click();
    await expect(page.getByText("Selected reading:")).toContainText("7.4 kW");

    // Switch to cumulative energy register stream & L1 phase stream independently
    const streamSelect = page.getByLabel("Compatible measurement stream", {
      exact: true,
    });
    const registerOption = await streamSelect
      .locator("option", { hasText: "Energy.Active.Import.Register" })
      .getAttribute("value");
    expect(registerOption).toBeTruthy();
    await streamSelect.selectOption(registerOption!);
    await expect(page.getByText("Cumulative meter register stream")).toBeVisible();
    await capture("session-register-1440.png");

    await page.setViewportSize({ width: 390, height: 844 });
    await capture("session-measurements-390.png");

    // Technical details & clipboard copy actions
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(
      `${origin}/stations/CP%251/sessions/TX%251?section=technical`,
    );
    await expect(
      page.getByRole("heading", { name: "OCPP sequence completeness audit" }),
    ).toBeVisible();
    await page.context().grantPermissions(["clipboard-read", "clipboard-write"]);
    await page.getByRole("button", { name: "Copy session ID" }).click();
    await expect(page.getByText("Copied").first()).toBeVisible();
    await capture("session-technical-1440.png");

    await page.setViewportSize({ width: 390, height: 844 });
    await capture("session-technical-390.png");

    // 3. 200% zoom & reduced motion checks without horizontal overflow
    for (const [width, height] of [
      [1440, 900],
      [390, 844],
    ] as const) {
      await page.setViewportSize({ width, height });
      await page.goto(
        `${origin}/stations/CP%251/sessions/TX%251?section=measurements`,
      );
      await page.evaluate(() => {
        document.documentElement.style.fontSize = "200%";
      });
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      );
      expect(overflow).toBe(true);
    }
    await capture("session-measurements-zoom-390.png");

    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.setViewportSize({ width: 1440, height: 900 });

    // 4. Legacy /transactions/ redirect preserves section and validated returnTo, drops unsafe params
    await page.goto(
      `${origin}/stations/CP%251/transactions/TX%251?section=technical&returnTo=%2Fsessions%3Fpage%3D2`,
    );
    await expect(page).toHaveURL(
      `${origin}/stations/CP%251/sessions/TX%251?section=technical&returnTo=%2Fsessions%3Fpage%3D2`,
    );
    await expect(
      page.getByRole("link", { name: "← Back to Charging sessions" }),
    ).toHaveAttribute("href", "/sessions?page=2");

    // 5. Large sequence span & 240-sample downsampling
    state.scenario = "large-range-and-downsampled";
    await page.goto(
      `${origin}/stations/CP%251/sessions/TX%251?section=measurements`,
    );
    await expect(
      page.getByText(/Chart displays .* representative points of 240 plottable samples/),
    ).toBeVisible();
    await page.goto(
      `${origin}/stations/CP%251/sessions/TX%251?section=technical`,
    );
    await expect(
      page.getByRole("listitem", { name: "Sequence 100000: recorded" }),
    ).toBeVisible();
    await expect(page.getByText(/bounded window shown/)).toBeVisible();
    await capture("session-large-range-technical-1440.png");

    // 6. Single negative point & inconsistent lastSequenceNumber bounds
    state.scenario = "single-negative-and-inconsistent";
    await page.goto(
      `${origin}/stations/CP%251/sessions/TX%251?section=measurements`,
    );
    await expect(page.getByText("-1.5 kW").first()).toBeVisible();
    await capture("session-negative-single-1440.png");
    await page.goto(
      `${origin}/stations/CP%251/sessions/TX%251?section=technical`,
    );
    await expect(page.getByText("Reported sequence bounds differ")).toBeVisible();

    // 7. Unknown null firstSequenceNumber
    state.scenario = "unbounded-null-start";
    await page.goto(
      `${origin}/stations/CP%251/sessions/TX%251?section=technical`,
    );
    await expect(page.getByText("Start sequence number not recorded")).toBeVisible();

    // 8. Empty measurements honest state
    state.scenario = "empty-samples";
    await page.goto(
      `${origin}/stations/CP%251/sessions/TX%251?section=measurements`,
    );
    await expect(
      page.getByRole("heading", { name: "No meter measurements were recorded" }),
    ).toBeVisible();
    await capture("session-empty-measurements-1440.png");

    // 9. Partial completeness failure leaves Overview + Measurements live & exposes retry without leaking secrets
    state.scenario = "partial-comp-fail";
    await page.goto(
      `${origin}/stations/CP%251/sessions/TX%251?section=technical`,
    );
    await expect(
      page.getByRole("heading", { name: "Unable to verify sequence completeness" }),
    ).toBeVisible();
    await expect(page.getByText(/secret completeness SQL trace/)).toHaveCount(0);
    await capture("session-partial-completeness-fail-1440.png");

    // 10. Partial measurement failure leaves Overview + Technical live & exposes retry without leaking secrets
    state.scenario = "partial-samples-fail";
    await page.goto(
      `${origin}/stations/CP%251/sessions/TX%251?section=measurements`,
    );
    await expect(
      page.getByRole("heading", { name: "Unable to load session measurements" }),
    ).toBeVisible();
    await expect(page.getByText(/secret sample table leak/)).toHaveCount(0);
    await capture("session-partial-samples-fail-1440.png");

    // 11. Transaction lookup failure renders 200 recovery ErrorState without leaking secrets and retries to live
    state.scenario = "lookup-fail";
    await page.goto(`${origin}/stations/CP%251/sessions/TX%251`);
    await expect(
      page.getByRole("heading", { name: "Unable to load charging session" }),
    ).toBeVisible();
    await expect(page.getByText(/secret internal pg password leak/)).toHaveCount(0);
    await capture("session-lookup-unavailable-1440.png");

    state.scenario = "rich";
    await page.getByRole("button", { name: "Try again" }).click();
    await expect(page.getByText("Recorded samples")).toBeVisible();

    expect(consoleErrors).toEqual([]);

    // 12. Genuine 404 when transaction is explicitly null
    const notFoundResp = await page.goto(
      `${origin}/stations/CP%251/sessions/missing`,
    );
    expect(notFoundResp?.status()).toBe(404);
    await capture("session-not-found-1440.png");

    expect(pageErrors).toEqual([]);
  } finally {
    nextProc.kill("SIGTERM");
    await new Promise<void>((resolve) => apiServer.close(() => resolve()));
  }
});
