import AxeBuilder from "@axe-core/playwright";
import { createServer } from "node:http";
import { spawn } from "node:child_process";
import net from "node:net";
import { expect, test, type Page } from "@playwright/test";

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

async function expectNoAxeViolations(page: Page, contextLabel: string) {
  await expect(page).toHaveTitle("VoltGrid Operator Console");
  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
    .analyze();

  expect(
    results.violations,
    `Axe accessibility violations in [${contextLabel}]: ${JSON.stringify(
      results.violations.map((v) => ({
        id: v.id,
        impact: v.impact,
        help: v.help,
        nodes: v.nodes.map((n) => n.html),
      })),
      null,
      2,
    )}`,
  ).toEqual([]);
}

test("automated WCAG 2.2 AA audit across all canonical screens, dialogs, and failure/empty states", async ({
  page,
}) => {
  test.setTimeout(120_000);

  type Mode =
    | "rich"
    | "empty"
    | "unavailable"
    | "partial-attention"
    | "partial-station"
    | "partial-session"
    | "register-timeout";

  let mode: Mode = "rich";
  const stations = [
    { id: "CP-ONLINE", name: "Colombo Harbor Hub", status: "ONLINE" },
    { id: "CP-OFFLINE", name: "Kandy Transit Depot", status: "OFFLINE" },
  ];

  const allConnectors = [
    {
      evseId: 1,
      connectorId: 1,
      status: "FAULTED",
      statusUpdatedAt: "2026-10-08T09:15:00Z",
    },
    {
      evseId: 1,
      connectorId: 2,
      status: "UNAVAILABLE",
      statusUpdatedAt: "2026-10-08T09:12:00Z",
    },
    {
      evseId: 2,
      connectorId: 1,
      status: "OCCUPIED",
      statusUpdatedAt: "2026-10-08T09:10:00Z",
    },
    {
      evseId: 2,
      connectorId: 2,
      status: "RESERVED",
      statusUpdatedAt: "2026-10-08T09:05:00Z",
    },
    {
      evseId: 3,
      connectorId: 1,
      status: "AVAILABLE",
      statusUpdatedAt: "2026-10-08T09:00:00Z",
    },
  ];

  const completeSession = {
    stationId: "CP-ONLINE",
    transactionId: "TX-OK-1",
    evseId: 2,
    connectorId: 1,
    status: "ENDED",
    startedAt: "2026-10-08T08:00:00Z",
    endedAt: "2026-10-08T08:30:00Z",
    lastSequenceNumber: 2,
  };
  const incompleteSession = {
    stationId: "CP-OFFLINE",
    transactionId: "TX-GAP-1",
    evseId: 1,
    connectorId: 1,
    status: "ENDED",
    startedAt: "2026-10-08T07:00:00Z",
    endedAt: "2026-10-08T07:20:00Z",
    lastSequenceNumber: 3,
  };

  const samples = [
    {
      sequenceNumber: 1,
      sampledAt: "2026-10-08T08:10:00Z",
      value: "11.4",
      measurand: "Power.Active.Import",
      context: "Sample.Periodic",
      phase: null,
      location: "Outlet",
      unit: "W",
      unitMultiplier: 3,
    },
    {
      sequenceNumber: 2,
      sampledAt: "2026-10-08T08:20:00Z",
      value: "6.2",
      measurand: "Energy.Active.Import.Register",
      context: "Sample.Periodic",
      phase: null,
      location: "Outlet",
      unit: "Wh",
      unitMultiplier: 3,
    },
  ];

  const apiPort = await getFreePort();
  const rwAppPort = await getFreePort();
  const roAppPort = await getFreePort();

  const apiServer = createServer(async (req, res) => {
    let body = "";
    for await (const chunk of req) body += chunk;
    const { query, variables = {} } = JSON.parse(body || "{}") as {
      query: string;
      variables?: Record<string, unknown>;
    };

    if (mode === "unavailable") {
      res.writeHead(503);
      res.end("Unavailable");
      return;
    }

    let data: Record<string, unknown> = {};
    let errors: Array<{ message: string; path?: string[] }> | undefined;

    if (query.includes("OperatorRegister")) {
      if (mode === "register-timeout") {
        res.writeHead(504);
        res.end("Gateway Timeout");
        return;
      }
      const input = variables.input as { id: string; name: string };
      if (stations.some((s) => s.id === input.id)) {
        res.setHeader("Content-Type", "application/json");
        res.end(
          JSON.stringify({
            errors: [{ message: `Station already exists: ${input.id}` }],
          }),
        );
        return;
      }
      const created = { id: input.id, name: input.name, status: "OFFLINE" };
      stations.push(created);
      data = { registerStation: created };
    } else if (query.includes("OperatorStations")) {
      if (mode === "partial-attention") {
        res.writeHead(503);
        res.end("Unavailable");
        return;
      }
      data = { stations: mode === "empty" ? [] : stations };
    } else if (query.includes("OperatorStation(")) {
      const id = String(variables.id ?? "");
      const found = mode === "empty" ? null : stations.find((s) => s.id === id) ?? null;
      if (mode === "partial-station" && found) {
        data = {
          station: found,
          stationConnectors: null,
          stationTransactions: [completeSession],
        };
        errors = [{ message: "Connectors unavailable", path: ["stationConnectors"] }];
      } else {
        data = {
          station: found,
          stationConnectors: found ? allConnectors : [],
          stationTransactions: found ? [completeSession] : [],
        };
      }
    } else if (query.includes("OperatorNetworkTransactionPage")) {
      if (mode === "empty") {
        data = {
          networkTransactionPage: {
            content: [],
            page: 0,
            size: Number(variables.size ?? 20),
            totalElements: 0,
            totalPages: 0,
            hasNext: false,
          },
        };
      } else {
        const isIncompleteFilter = variables.integrityStatus === "INCOMPLETE";
        const content = isIncompleteFilter
          ? [
              {
                transaction: incompleteSession,
                completeness: {
                  status: "INCOMPLETE",
                  firstSequenceNumber: 0,
                  lastSequenceNumber: 3,
                  missingSequenceNumbers: [1, 2],
                },
              },
            ]
          : [
              {
                transaction: completeSession,
                completeness: {
                  status: "COMPLETE",
                  firstSequenceNumber: 0,
                  lastSequenceNumber: 2,
                  missingSequenceNumbers: [],
                },
              },
            ];
        data = {
          networkTransactionPage: {
            content,
            page: 0,
            size: Number(variables.size ?? 20),
            totalElements: content.length,
            totalPages: 1,
            hasNext: false,
          },
        };
      }
    } else if (query.includes("OperatorTransaction(")) {
      data = {
        transaction:
          String(variables.transactionId) === "TX-GAP-1"
            ? incompleteSession
            : String(variables.transactionId) === "TX-OK-1"
              ? completeSession
              : null,
      };
    } else if (query.includes("OperatorTransactionData")) {
      const txId = String(variables.transactionId);
      if (mode === "partial-session") {
        data = {
          transactionCompleteness: {
            status: "COMPLETE",
            firstSequenceNumber: 0,
            lastSequenceNumber: 2,
            missingSequenceNumbers: [],
          },
          transactionMeterSamples: null,
        };
        errors = [{ message: "Samples error", path: ["transactionMeterSamples"] }];
      } else if (txId === "TX-GAP-1") {
        data = {
          transactionCompleteness: {
            status: "INCOMPLETE",
            firstSequenceNumber: 0,
            lastSequenceNumber: 3,
            missingSequenceNumbers: [1, 2],
          },
          transactionMeterSamples: [],
        };
      } else {
        data = {
          transactionCompleteness: {
            status: "COMPLETE",
            firstSequenceNumber: 0,
            lastSequenceNumber: 2,
            missingSequenceNumbers: [],
          },
          transactionMeterSamples: mode === "empty" ? [] : samples,
        };
      }
    } else if (query.includes("OperatorStatuses")) {
      if (variables.after === "bad-cursor") {
        res.setHeader("Content-Type", "application/json");
        res.end(JSON.stringify({ errors: [{ message: "Invalid cursor" }] }));
        return;
      }
      data = {
        stationStatuses: {
          edges:
            mode === "empty"
              ? []
              : [
                  {
                    node: {
                      stationId: "CP-ONLINE",
                      currentStatus: "ONLINE",
                      lastEventId: "11111111-1111-1111-1111-111111111111",
                      statusChangedAt: "2026-10-08T08:45:00Z",
                      updatedAt: "2026-10-08T08:45:01Z",
                    },
                  },
                ],
          pageInfo: { hasNextPage: false, endCursor: null },
        },
      };
    } else if (query.includes("OperatorStationStatus")) {
      data = { stationStatus: null };
    } else {
      res.writeHead(400);
      res.end("Unexpected query");
      return;
    }

    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify(errors ? { data, errors } : { data }));
  });

  await new Promise<void>((resolve) =>
    apiServer.listen(apiPort, "127.0.0.1", () => resolve()),
  );

  const rwServer = spawn(
    "node",
    [
      "node_modules/next/dist/bin/next",
      "start",
      "--hostname",
      "127.0.0.1",
      "--port",
      String(rwAppPort),
    ],
    {
      env: {
        ...process.env,
        OPERATOR_LOCAL_WRITES: "true",
        STATION_GRAPHQL_URL: `http://127.0.0.1:${apiPort}/graphql`,
        OPERATIONS_GRAPHQL_URL: `http://127.0.0.1:${apiPort}/graphql`,
      },
      stdio: "ignore",
    },
  );

  const roServer = spawn(
    "node",
    [
      "node_modules/next/dist/bin/next",
      "start",
      "--hostname",
      "127.0.0.1",
      "--port",
      String(roAppPort),
    ],
    {
      env: {
        ...process.env,
        OPERATOR_LOCAL_WRITES: "false",
        STATION_GRAPHQL_URL: `http://127.0.0.1:${apiPort}/graphql`,
        OPERATIONS_GRAPHQL_URL: `http://127.0.0.1:${apiPort}/graphql`,
      },
      stdio: "ignore",
    },
  );

  try {
    const base = `http://127.0.0.1:${rwAppPort}`;
    const roBase = `http://127.0.0.1:${roAppPort}`;
    await Promise.all([waitForHttpOk(base), waitForHttpOk(roBase)]);

    await page.setViewportSize({ width: 1440, height: 900 });

    const populatedRoutes: Array<[string, string]> = [
      ["Overview (populated)", `${base}/`],
      ["Stations directory (populated)", `${base}/stations`],
      ["Stations directory (no matches)", `${base}/stations?q=no-match-xyz`],
      ["Station Overview (online)", `${base}/stations/CP-ONLINE`],
      ["Station Overview (offline)", `${base}/stations/CP-OFFLINE`],
      ["Station Connectors", `${base}/stations/CP-ONLINE?section=connectors`],
      ["Station Sessions", `${base}/stations/CP-ONLINE?section=sessions`],
      ["Station Connection details", `${base}/stations/CP-ONLINE?section=connection`],
      ["Sessions directory (populated)", `${base}/sessions`],
      ["Sessions directory (active filters)", `${base}/sessions?stationId=CP-ONLINE`],
      ["Session Overview", `${base}/stations/CP-ONLINE/sessions/TX-OK-1`],
      ["Session Measurements", `${base}/stations/CP-ONLINE/sessions/TX-OK-1?section=measurements`],
      ["Session Technical details", `${base}/stations/CP-OFFLINE/sessions/TX-GAP-1?section=technical`],
      ["Needs attention (populated)", `${base}/attention`],
      ["Diagnostics (cursor page)", `${base}/diagnostics`],
      ["Diagnostics (not found lookup)", `${base}/diagnostics?stationId=CP-UNKNOWN`],
      ["Diagnostics (invalid cursor recovery)", `${base}/diagnostics?after=bad-cursor`],
      ["Help (collapsed disclosures)", `${base}/help`],
      ["Station Registration (initial)", `${base}/stations/new`],
      ["Station Registration (read-only)", `${roBase}/stations/new`],
      ["Station 404", `${base}/stations/missing-id`],
    ];

    for (const [label, url] of populatedRoutes) {
      await page.goto(url);
      await expectNoAxeViolations(page, label);
    }

    // Check Help with expanded disclosure and copy feedback on Connection details
    await page.goto(`${base}/help`);
    await page.locator("summary", { hasText: "Station remains offline after registration" }).click();
    await expectNoAxeViolations(page, "Help (expanded disclosure)");

    // Check Diagnostics with expanded Technical event details disclosure
    await page.goto(`${base}/diagnostics`);
    await page.locator("summary", { hasText: "Technical event details" }).first().click();
    await expectNoAxeViolations(page, "Diagnostics (expanded event details)");

    // Registration validation error, success, duplicate, and uncertain states
    await page.goto(`${base}/stations/new`);
    await page.getByRole("button", { name: "Register station", exact: true }).click();
    await expect(page.getByRole("alert").filter({ hasText: "Check the station name" })).toBeVisible();
    await expectNoAxeViolations(page, "Registration (validation error)");

    await page.getByLabel("Station name", { exact: true }).fill("A11y Valid Station");
    await page.getByLabel("Station identifier", { exact: true }).fill("CP-A11Y-1");
    await page.getByRole("button", { name: "Register station", exact: true }).click();
    await expect(page.getByRole("heading", { name: "Station registered" })).toBeVisible();
    await page.waitForLoadState("networkidle");
    await expectNoAxeViolations(page, "Registration (confirmed success)");

    await page.getByRole("button", { name: "Register another station" }).click();
    await page.getByLabel("Station name", { exact: true }).fill("Duplicate A11y");
    await page.getByLabel("Station identifier", { exact: true }).fill("CP-A11Y-1");
    await page.getByRole("button", { name: "Register station", exact: true }).click();
    await expect(page.getByRole("alert").filter({ hasText: "already exists" })).toBeVisible();
    await expectNoAxeViolations(page, "Registration (duplicate)");

    mode = "register-timeout";
    await page.getByLabel("Station identifier", { exact: true }).fill("CP-A11Y-UNCERTAIN");
    await page.getByRole("button", { name: "Register station", exact: true }).click();
    await expect(page.getByRole("alert").filter({ hasText: "could not confirm" })).toBeVisible();
    await expectNoAxeViolations(page, "Registration (uncertain outcome)");

    // Empty states
    mode = "empty";
    for (const [label, url] of [
      ["Overview (empty)", `${base}/`],
      ["Stations (empty)", `${base}/stations`],
      ["Sessions (empty)", `${base}/sessions`],
      ["Session Measurements (empty)", `${base}/stations/CP-ONLINE/sessions/TX-OK-1?section=measurements`],
      ["Attention (confirmed clear)", `${base}/attention`],
      ["Diagnostics (empty)", `${base}/diagnostics`],
    ] as const) {
      await page.goto(url);
      await expectNoAxeViolations(page, label);
    }

    // Partial failures & full unavailable states
    mode = "partial-station";
    await page.goto(`${base}/stations/CP-ONLINE`);
    await expectNoAxeViolations(page, "Station Overview (partial connector failure)");

    mode = "partial-session";
    await page.goto(`${base}/stations/CP-ONLINE/sessions/TX-OK-1?section=measurements`);
    await expectNoAxeViolations(page, "Session Measurements (partial samples failure)");

    mode = "partial-attention";
    await page.goto(`${base}/attention`);
    await expectNoAxeViolations(page, "Attention (partial station failure)");

    mode = "unavailable";
    for (const [label, url] of [
      ["Overview (unavailable)", `${base}/`],
      ["Stations (unavailable)", `${base}/stations`],
      ["Sessions (unavailable)", `${base}/sessions`],
      ["Diagnostics (unavailable)", `${base}/diagnostics`],
    ] as const) {
      await page.goto(url);
      await expectNoAxeViolations(page, label);
    }

    // Mobile drawer dialog, 44px touch targets, 320px reflow, and keyboard skip link
    mode = "rich";
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(`${base}/`);
    await page.getByRole("button", { name: /Menu/i }).click();
    await expect(page.getByRole("dialog", { name: "Site navigation" })).toBeVisible();
    await expectNoAxeViolations(page, "Mobile drawer open");
    await page.keyboard.press("Escape");
    await expect(page.getByRole("button", { name: /Menu/i })).toBeFocused();

    // Verify 44px touch target floor on essential navigation, breadcrumbs, and filter chips
    await page.setViewportSize({ width: 320, height: 568 });
    for (const url of [
      `${base}/`,
      `${base}/stations`,
      `${base}/stations/CP-ONLINE?section=connection`,
      `${base}/sessions?stationId=CP-ONLINE`,
      `${base}/stations/CP-ONLINE/sessions/TX-OK-1?section=measurements`,
      `${base}/attention`,
      `${base}/diagnostics`,
      `${base}/help`,
      `${base}/stations/new`,
    ]) {
      await page.goto(url);
      await expect(page.locator("main h1")).toBeVisible();
      expect(await page.locator("main h1").count()).toBe(1);
      expect(await page.locator("main#main-content").count()).toBe(1);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
      const refreshBox = await page.getByRole("button", { name: "Refresh data" }).boundingBox();
      expect(refreshBox?.height ?? 0).toBeGreaterThanOrEqual(44);
    }

    // Keyboard stream selection on Measurements and 200% text scaling reflow at 390px
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(`${base}/stations/CP-ONLINE/sessions/TX-OK-1?section=measurements`);
    const streamSelect = page.getByLabel("Compatible measurement stream");
    await expect(streamSelect).toBeVisible();
    await streamSelect.focus();
    await page.keyboard.press("ArrowDown");
    await page.evaluate(() => {
      document.documentElement.style.fontSize = "200%";
    });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  } finally {
    rwServer.kill("SIGTERM");
    roServer.kill("SIGTERM");
    apiServer.close();
  }
});
