import { mkdirSync } from "node:fs";
import { createServer } from "node:http";
import { spawn } from "node:child_process";
import net from "node:net";
import path from "node:path";
import { expect, test } from "@playwright/test";
import { signIn } from "./sign-in";
import { respondToOrganizationAccess } from "./organization-fixture";

const CHARGER_CAPTURE_DIR = process.env.UI110_CHARGER_CAPTURE_DIR ?? "";

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

test("integrated UI-110 journeys, legacy routes, failure recovery, and mandatory charger visuals", async ({
  page,
}) => {
  test.setTimeout(120_000);

  let failStationCalls = false;
  const stations = [
    { id: "CP-ONLINE", name: "Colombo Harbor Hub", status: "ONLINE" },
    { id: "CP-OFFLINE", name: "Kandy Transit Depot", status: "OFFLINE" },
    { id: "CP-RESERVE", name: "Galle Waterfront", status: "ONLINE" },
  ];

  const allFiveConnectors = [
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

  const sessions = [
    {
      transaction: {
        stationId: "CP-ONLINE",
        transactionId: "TX-OK-1",
        evseId: 2,
        connectorId: 1,
        status: "ENDED",
        startedAt: "2026-10-08T08:00:00Z",
        endedAt: "2026-10-08T08:30:00Z",
        lastSequenceNumber: 2,
      },
      completeness: {
        status: "COMPLETE",
        firstSequenceNumber: 0,
        lastSequenceNumber: 2,
        missingSequenceNumbers: [],
      },
      samples: [
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
          sequenceNumber: 1,
          sampledAt: "2026-10-08T08:10:00Z",
          value: "6.2",
          measurand: "Energy.Active.Import.Register",
          context: "Sample.Periodic",
          phase: null,
          location: "Outlet",
          unit: "Wh",
          unitMultiplier: 3,
        },
      ],
    },
    {
      transaction: {
        stationId: "CP-OFFLINE",
        transactionId: "TX-GAP-1",
        evseId: 1,
        connectorId: 1,
        status: "ENDED",
        startedAt: "2026-10-08T07:00:00Z",
        endedAt: "2026-10-08T07:20:00Z",
        lastSequenceNumber: 3,
      },
      completeness: {
        status: "INCOMPLETE",
        firstSequenceNumber: 0,
        lastSequenceNumber: 3,
        missingSequenceNumbers: [1, 2],
      },
      samples: [],
    },
  ];

  const opsRecords = [
    {
      stationId: "CP-OFFLINE",
      currentStatus: "OFFLINE",
      lastEventId: "11111111-1111-1111-1111-111111111111",
      statusChangedAt: "2026-10-08T08:40:00Z",
      updatedAt: "2026-10-08T08:40:02Z",
    },
    {
      stationId: "CP-ONLINE",
      currentStatus: "ONLINE",
      lastEventId: "22222222-2222-2222-2222-222222222222",
      statusChangedAt: "2026-10-08T08:45:00Z",
      updatedAt: "2026-10-08T08:45:01Z",
    },
  ];

  const apiPort = await getFreePort();
  const rwAppPort = 4313;
  const roAppPort = 4314;

  const apiServer = createServer(async (req, res) => {
    if (respondToOrganizationAccess(req, res)) return;
    let body = "";
    for await (const chunk of req) body += chunk;
    const { query, variables = {} } = JSON.parse(body || "{}") as {
      query: string;
      variables?: Record<string, unknown>;
    };

    if (failStationCalls && !query.includes("OperatorStatuses") && !query.includes("OperatorStationStatus")) {
      res.writeHead(503);
      res.end("Service Unavailable");
      return;
    }

    let data: Record<string, unknown>;
    if (query.includes("OperatorRegister")) {
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
      data = { stations };
    } else if (query.includes("OperatorStation(")) {
      const id = String(variables.id ?? "");
      const found = stations.find((s) => s.id === id) ?? null;
      data = {
        station: found,
        stationConnectors:
          id === "CP-ONLINE"
            ? allFiveConnectors
            : id === "CP-OFFLINE"
              ? [allFiveConnectors[0], allFiveConnectors[4]]
              : [],
        stationTransactions: sessions
          .filter((s) => s.transaction.stationId === id)
          .map((s) => s.transaction),
      };
    } else if (query.includes("OperatorNetworkTransactionPage")) {
      const stationFilter = variables.stationId
        ? String(variables.stationId)
        : null;
      const txFilter = variables.transactionId
        ? String(variables.transactionId)
        : null;
      const statusFilter = variables.integrityStatus
        ? String(variables.integrityStatus)
        : null;
      const filtered = sessions.filter((entry) => {
        if (stationFilter && entry.transaction.stationId !== stationFilter) {
          return false;
        }
        if (txFilter && entry.transaction.transactionId !== txFilter) {
          return false;
        }
        if (statusFilter && entry.completeness.status !== statusFilter) {
          return false;
        }
        return true;
      });
      data = {
        networkTransactionPage: {
          content: filtered.map((e) => ({
            transaction: e.transaction,
            completeness: e.completeness,
          })),
          page: Number(variables.page ?? 0),
          size: Number(variables.size ?? 20),
          totalElements: filtered.length,
          totalPages: filtered.length > 0 ? 1 : 0,
          hasNext: false,
        },
      };
    } else if (query.includes("OperatorTransaction(")) {
      const stId = String(variables.stationId ?? "");
      const txId = String(variables.transactionId ?? "");
      const match = sessions.find(
        (s) =>
          s.transaction.stationId === stId &&
          s.transaction.transactionId === txId,
      );
      data = { transaction: match ? match.transaction : null };
    } else if (query.includes("OperatorTransactionData")) {
      const stId = String(variables.stationId ?? "");
      const txId = String(variables.transactionId ?? "");
      const match = sessions.find(
        (s) =>
          s.transaction.stationId === stId &&
          s.transaction.transactionId === txId,
      );
      data = {
        transactionCompleteness: match ? match.completeness : null,
        transactionMeterSamples: match ? match.samples : [],
      };
    } else if (query.includes("OperatorStatuses")) {
      const statusFilter = variables.status ? String(variables.status) : null;
      const after = variables.after ? String(variables.after) : null;
      const matching = statusFilter
        ? opsRecords.filter((r) => r.currentStatus === statusFilter)
        : opsRecords;
      const pageRecords = after ? matching.slice(1) : matching.slice(0, 1);
      data = {
        stationStatuses: {
          edges: pageRecords.map((node) => ({ node })),
          pageInfo: {
            hasNextPage: !after && matching.length > 1,
            endCursor: !after && matching.length > 1 ? "cursor-page-2" : null,
          },
        },
      };
    } else if (query.includes("OperatorStationStatus")) {
      const stId = String(variables.stationId ?? "");
      data = {
        stationStatus: opsRecords.find((r) => r.stationId === stId) ?? null,
      };
    } else {
      res.writeHead(400);
      res.end("Unexpected query");
      return;
    }

    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify({ data }));
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
        OPERATOR_WEB_ORIGIN: `http://127.0.0.1:${rwAppPort}`,
        OIDC_LOCAL_HTTP: "true",
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
        OPERATOR_WEB_ORIGIN: `http://127.0.0.1:${roAppPort}`,
        OIDC_LOCAL_HTTP: "true",
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
    await signIn(page, base);

    if (CHARGER_CAPTURE_DIR) {
      mkdirSync(CHARGER_CAPTURE_DIR, { recursive: true });
    }

    // 1. Overview to offline station directory
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(base);
    await expect(page.getByRole("heading", { name: "Overview", exact: true })).toBeVisible();
    await page.getByRole("link", { name: "Inspect offline stations" }).first().click();
    await expect(page).toHaveURL(/\/stations\?status=OFFLINE$/);

    // 2. Directory search & filtering -> station details (+ back link filter retention #11)
    await page.getByLabel("Search stations").fill("Kandy");
    await page.getByRole("button", { name: "Apply filters" }).click();
    await expect(page).toHaveURL(/\/stations\?q=Kandy&status=OFFLINE$/);
    await page.getByRole("link", { name: "Kandy Transit Depot", exact: true }).click();
    await expect(page).toHaveURL(/\/stations\/CP-OFFLINE\?returnTo=%2Fstations%3Fq%3DKandy%26status%3DOFFLINE$/);
    await expect(page.getByText("Station is currently reported offline").first()).toBeVisible();

    if (CHARGER_CAPTURE_DIR) {
      await page.screenshot({
        path: path.join(CHARGER_CAPTURE_DIR, "charger-05-offline-last-reported-1440.png"),
        fullPage: true,
      });
    }

    // Return via preserved filter back link
    await page.getByRole("link", { name: "← Back to charging stations" }).click();
    await expect(page).toHaveURL(/\/stations\?q=Kandy&status=OFFLINE$/);
    await expect(page.getByLabel("Search stations")).toHaveValue("Kandy");

    // 3. Station details -> Connectors inspection + charger review screenshots
    await page.goto(`${base}/stations/CP-ONLINE`);
    await expect(page.getByRole("heading", { name: "Colombo Harbor Hub" })).toBeVisible();
    if (CHARGER_CAPTURE_DIR) {
      await page.screenshot({
        path: path.join(CHARGER_CAPTURE_DIR, "charger-01-station-overview-1440.png"),
        fullPage: true,
      });
      await page.setViewportSize({ width: 390, height: 844 });
      await page.screenshot({
        path: path.join(CHARGER_CAPTURE_DIR, "charger-02-station-overview-mobile-390.png"),
        fullPage: true,
      });
      await page.setViewportSize({ width: 1440, height: 900 });
    }

    await page.getByRole("navigation", { name: "Station sections" }).getByRole("link", { name: /Connectors/ }).click();
    await expect(page).toHaveURL(/\/stations\/CP-ONLINE\?section=connectors$/);
    await expect(page.getByText("EVSE 1 · Connector 1")).toBeVisible();
    await expect(page.getByText("Faulted", { exact: true }).first()).toBeVisible();
    await expect(page.getByText("Unavailable", { exact: true }).first()).toBeVisible();
    await expect(page.getByText("Occupied", { exact: true }).first()).toBeVisible();
    await expect(page.getByText("Reserved", { exact: true }).first()).toBeVisible();
    await expect(page.getByText("Available", { exact: true }).first()).toBeVisible();

    if (CHARGER_CAPTURE_DIR) {
      await page.screenshot({
        path: path.join(CHARGER_CAPTURE_DIR, "charger-04-all-five-statuses-1440.png"),
        fullPage: true,
      });
      const firstCard = page.locator("main article").first();
      await firstCard.screenshot({
        path: path.join(CHARGER_CAPTURE_DIR, "charger-03-closeup-card.png"),
      });
    }

    // 4. Station details -> station-specific sessions
    await page.getByRole("navigation", { name: "Station sections" }).getByRole("link", { name: /Sessions/ }).click();
    await expect(page).toHaveURL(/\/stations\/CP-ONLINE\?section=sessions$/);
    await expect(page.getByRole("link", { name: "Inspect in Charging sessions →" })).toHaveAttribute(
      "href",
      "/sessions?stationId=CP-ONLINE",
    );

    // 5. Registration -> confirmed station details & connection guidance
    await page.goto(`${base}/stations/new`);
    await page.getByLabel("Station name", { exact: true }).fill("Jaffna Solar Terminal");
    await page.getByLabel("Station identifier", { exact: true }).fill("CP-JAFFNA-1");
    await page.getByRole("button", { name: "Register station", exact: true }).click();
    await expect(page.getByRole("heading", { name: "Station registered" })).toBeVisible();
    await expect(page.getByText("/ocpp/CP-JAFFNA-1")).toBeVisible();
    await page.getByRole("link", { name: "Connection details" }).click();
    await expect(page).toHaveURL(/\/stations\/CP-JAFFNA-1\?section=connection$/);
    await expect(page.getByText("/ocpp/CP-JAFFNA-1")).toBeVisible();

    // 6. Global sessions -> canonical session detail + back filter preservation (#11)
    await page.goto(`${base}/sessions?integrityStatus=COMPLETE`);
    await page.getByRole("link", { name: "TX-OK-1", exact: true }).click();
    await expect(page).toHaveURL(/\/stations\/CP-ONLINE\/sessions\/TX-OK-1\?returnTo=%2Fsessions%3FintegrityStatus%3DCOMPLETE$/);

    // 7. Session Measurements -> Technical details
    await page.getByRole("navigation", { name: "Session sections" }).getByRole("link", { name: /Measurements/ }).click();
    await expect(page).toHaveURL(/\/stations\/CP-ONLINE\/sessions\/TX-OK-1\?section=measurements&returnTo=%2Fsessions%3FintegrityStatus%3DCOMPLETE$/);
    await expect(page.getByRole("img", { name: /Time-series measurement chart/i })).toBeVisible();
    await page.getByRole("navigation", { name: "Session sections" }).getByRole("link", { name: /Technical details/ }).click();
    await expect(page).toHaveURL(/\/stations\/CP-ONLINE\/sessions\/TX-OK-1\?section=technical&returnTo=%2Fsessions%3FintegrityStatus%3DCOMPLETE$/);
    await expect(page.getByRole("heading", { name: "OCPP sequence completeness audit" })).toBeVisible();
    await page.getByRole("link", { name: "← Back to Charging sessions" }).click();
    await expect(page).toHaveURL(/\/sessions\?integrityStatus=COMPLETE$/);

    // 8. Needs attention -> offline station & incomplete session inspection
    await page.goto(`${base}/attention`);
    await page.getByRole("link", { name: "Inspect offline station Kandy Transit Depot" }).click();
    await expect(page).toHaveURL(/\/stations\/CP-OFFLINE\?returnTo=%2Fattention$/);
    await page.getByRole("link", { name: "← Back to Needs attention" }).click();
    await expect(page).toHaveURL(/\/attention$/);
    await page.getByRole("link", { name: "Sequence details for session TX-GAP-1 at CP-OFFLINE" }).click();
    await expect(page).toHaveURL(/\/stations\/CP-OFFLINE\/sessions\/TX-GAP-1\?section=technical&returnTo=%2Fattention$/);
    await expect(page.getByText("Missing sequence numbers reported")).toBeVisible();

    // 9. Diagnostics -> cursor pagination -> exact station lookup
    await page.goto(`${base}/diagnostics`);
    await expect(page.getByText("CP-OFFLINE", { exact: true }).first()).toBeVisible();
    await page.getByRole("link", { name: "Next page" }).click();
    await expect(page).toHaveURL(/\/diagnostics\?after=cursor-page-2$/);
    await expect(page.getByText("CP-ONLINE", { exact: true }).first()).toBeVisible();
    await page.getByLabel("Exact station lookup").fill("CP-OFFLINE");
    await page.getByRole("button", { name: "Apply filters" }).click();
    await expect(page).toHaveURL(/\/diagnostics\?stationId=CP-OFFLINE$/);
    await expect(page.getByText("1 exact lookup record")).toBeVisible();

    // 10. Help -> disclosure & contextual destination
    await page.goto(`${base}/help`);
    await page.locator("summary", { hasText: "Station remains offline after registration" }).click();
    await page.getByRole("link", { name: "Inspect offline stations →" }).click();
    await expect(page).toHaveURL(/\/stations\?status=OFFLINE$/);

    // 12. Manual refresh preserving route context
    await page.getByRole("button", { name: "Refresh data" }).click();
    await expect(page).toHaveURL(/\/stations\?status=OFFLINE$/);

    // 13. API failure -> recovery via retry
    failStationCalls = true;
    await page.goto(`${base}/stations?status=OFFLINE`);
    await expect(page.getByRole("alert").filter({ hasText: "Station API returned HTTP 503." })).toBeVisible();
    failStationCalls = false;
    await page.getByRole("button", { name: "Try again" }).click();
    await expect(page.getByRole("link", { name: "Kandy Transit Depot" })).toBeVisible();

    // 14. Read-only registration enforcement
    await signIn(page, roBase);
    await page.goto(`${roBase}/stations/new`);
    await expect(page.getByRole("heading", { name: "Read-only console" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Register station" })).toHaveCount(0);

    // Legacy compatibility routes
    await signIn(page, base);
    await page.goto(`${base}/?q=Kandy&status=OFFLINE`);
    await expect(page).toHaveURL(/\/stations\?q=Kandy&status=OFFLINE$/);
    await page.goto(`${base}/transactions?station=CP-OFFLINE&integrity=INCOMPLETE`);
    await expect(page).toHaveURL(/\/sessions\?stationId=CP-OFFLINE&integrityStatus=INCOMPLETE$/);
    await page.goto(`${base}/operations?status=OFFLINE`);
    await expect(page).toHaveURL(/\/diagnostics\?status=OFFLINE$/);
    await page.goto(`${base}/stations/CP-OFFLINE/transactions/TX-GAP-1?section=technical`);
    await expect(page).toHaveURL(/\/stations\/CP-OFFLINE\/sessions\/TX-GAP-1\?section=technical$/);
  } finally {
    rwServer.kill("SIGTERM");
    roServer.kill("SIGTERM");
    apiServer.close();
  }
});
