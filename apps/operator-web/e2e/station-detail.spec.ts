import { createServer } from "node:http";
import { spawn } from "node:child_process";
import { test, expect } from "@playwright/test";
import { signIn } from "./sign-in";
import { respondToOrganizationAccess } from "./organization-fixture";

function getFreePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = createServer();
    server.listen(0, "127.0.0.1", () => {
      const addr = server.address();
      const port = typeof addr === "object" && addr ? addr.port : 0;
      server.close(err => (err ? reject(err) : resolve(port)));
    });
  });
}

test("station detail fits all viewports, 200% text scaling, reduced motion, keyboard section navigation, and genuine 404", async ({ page }) => {
  const consoleErrors: string[] = [];
  const externalRequests: string[] = [];
  page.on("console", msg => {
    if (msg.type() === "error") consoleErrors.push(msg.text());
  });
  page.on("request", req => {
    if (!req.url().startsWith("http://127.0.0.1:4310")) externalRequests.push(req.url());
  });

  await page.emulateMedia({ reducedMotion: "reduce" });

  for (const [width, height] of [
    [320, 568],
    [390, 844],
    [768, 1024],
    [1024, 768],
    [1280, 800],
    [1440, 900],
    [1920, 1080],
  ]) {
    await page.setViewportSize({ width, height });
    await page.goto("/stations/CP-1");
    await expect(page.locator("main h1")).toHaveText("Colombo Central");
    await expect(page.locator("main#main-content")).toHaveCount(1);
    await expect(page.getByText("Retrieved", { exact: false })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);

    const backBox = await page.getByRole("link", { name: "← Back to charging stations" }).boundingBox();
    expect(backBox).not.toBeNull();
    expect(backBox!.height).toBeGreaterThanOrEqual(44);
  }

  for (const [width, height] of [[1440, 900], [390, 844]]) {
    await page.setViewportSize({ width, height });
    await page.goto("/stations/CP-1");
    await page.evaluate(() => {
      document.documentElement.style.fontSize = "200%";
    });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    if (width >= 1280) {
      const noOverlapOrCardClip = await page.evaluate(() => {
        const aside = document.querySelector('aside[aria-label="Workspace sidebar"]');
        const navItems = document.querySelectorAll("aside nav ul > li");
        if (!aside) return false;
        const asideRight = aside.getBoundingClientRect().right;
        const sidebarOk = Array.from(navItems).every(li => li.getBoundingClientRect().right <= asideRight + 1);
        const cards = Array.from(document.querySelectorAll("main article"));
        const cardsOk = cards.every(card => card.scrollWidth <= card.clientWidth + 1);
        return sidebarOk && cardsOk;
      });
      expect(noOverlapOrCardClip).toBe(true);
    }
  }

  // Genuine HTTP 404 on valid missing identifier and malformed literal-percent ID
  expect((await page.goto("/stations/missing-station-check"))?.status()).toBe(404);
  expect((await page.goto("/stations/%25ZZ"))?.status()).toBe(404);

  // Keyboard navigation across station section links and back/forward preservation
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto("/stations/CP-1?section=unsupported");
  const sectionNav = page.getByRole("navigation", { name: "Station sections" });
  await expect(sectionNav.getByRole("link", { name: "Overview" })).toHaveAttribute("aria-current", "page");

  const connectorsTab = sectionNav.getByRole("link", { name: /Connectors/ });
  await connectorsTab.focus();
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/\/stations\/CP-1\?section=connectors/);
  await expect(sectionNav.getByRole("link", { name: /Connectors/ })).toHaveAttribute("aria-current", "page");

  await page.goBack();
  await expect(page).toHaveURL(/\/stations\/CP-1\?section=unsupported/);
  await page.goForward();
  await expect(page).toHaveURL(/\/stations\/CP-1\?section=connectors/);

  expect(externalRequests).toEqual([]);
  const non404Errors = consoleErrors.filter(err => !err.includes("404"));
  expect(non404Errors).toEqual([]);
});

test("station detail covers all 5 statuses, repeated connector IDs, offline mode, partial failures, sessions, connection copy, and retry", async ({ page, context }) => {
  type FixtureScenario =
    | "online-rich"
    | "offline-station"
    | "empty-sections"
    | "partial-connector-fail"
    | "partial-session-fail"
    | "station-fail-503"
    | "station-null-with-error";

  let scenario: FixtureScenario = "online-rich";

  const longStation = {
    id: "LONG%ID-1",
    name: "Anuradhapura Regional Hub With Long Descriptive Station Title",
    status: "ONLINE",
  };

  const fiveConnectors = [
    { evseId: 1, connectorId: 1, status: "AVAILABLE", statusUpdatedAt: "2026-10-08T08:30:00Z" },
    { evseId: 2, connectorId: 1, status: "OCCUPIED", statusUpdatedAt: "2026-10-08T08:40:00Z" },
    { evseId: 2, connectorId: 2, status: "RESERVED", statusUpdatedAt: "2026-10-08T08:45:00Z" },
    { evseId: 3, connectorId: 1, status: "UNAVAILABLE", statusUpdatedAt: "2026-10-08T08:50:00Z" },
    { evseId: 3, connectorId: 2, status: "FAULTED", statusUpdatedAt: "2026-10-08T09:00:00Z" },
  ];

  const sessions = [
    {
      stationId: "LONG%ID-1",
      transactionId: "TX%ACTIVE-1",
      evseId: 1,
      connectorId: 1,
      status: "ACTIVE",
      startedAt: "2026-10-08T09:10:00Z",
      endedAt: null,
      lastSequenceNumber: 5,
    },
    {
      stationId: "LONG%ID-1",
      transactionId: "TX%ENDED-2",
      evseId: 2,
      connectorId: 1,
      status: "ENDED",
      startedAt: "2026-10-08T07:00:00Z",
      endedAt: "2026-10-08T08:15:00Z",
      lastSequenceNumber: 12,
    },
  ];

  const apiServer = createServer((req, res) => {
    if (respondToOrganizationAccess(req, res)) return;
    if (req.url === "/health") {
      res.end("ok");
      return;
    }

    req.resume();
    req.on("end", () => {
      if (scenario === "station-fail-503") {
        res.writeHead(503);
        res.end();
        return;
      }

      res.setHeader("Content-Type", "application/json");
      if (scenario === "station-null-with-error") {
        res.end(
          JSON.stringify({
            data: { station: null, stationConnectors: [], stationTransactions: [] },
            errors: [{ message: "Internal Station DB timeout" }],
          }),
        );
        return;
      }

      if (scenario === "partial-connector-fail") {
        res.end(
          JSON.stringify({
            data: { station: longStation, stationConnectors: null, stationTransactions: sessions },
            errors: [{ message: "Connector read timeout", path: ["stationConnectors"] }],
          }),
        );
        return;
      }

      if (scenario === "partial-session-fail") {
        res.end(
          JSON.stringify({
            data: { station: longStation, stationConnectors: fiveConnectors, stationTransactions: null },
            errors: [{ message: "Session read timeout", path: ["stationTransactions"] }],
          }),
        );
        return;
      }

      if (scenario === "empty-sections") {
        res.end(
          JSON.stringify({
            data: { station: longStation, stationConnectors: [], stationTransactions: [] },
          }),
        );
        return;
      }

      if (scenario === "offline-station") {
        res.end(
          JSON.stringify({
            data: {
              station: { ...longStation, status: "OFFLINE" },
              stationConnectors: fiveConnectors,
              stationTransactions: sessions,
            },
          }),
        );
        return;
      }

      res.end(
        JSON.stringify({
          data: {
            station: longStation,
            stationConnectors: fiveConnectors,
            stationTransactions: sessions,
          },
        }),
      );
    });
  });

  const apiPort = await getFreePort();
  const appPort = 4313;
  await new Promise<void>(resolve => apiServer.listen(apiPort, "127.0.0.1", resolve));

  const nextProc = spawn(
    "node",
    ["node_modules/next/dist/bin/next", "start", "--hostname", "127.0.0.1", "--port", String(appPort)],
    {
      cwd: process.cwd(),
      env: {
        ...process.env,
        OPERATOR_WEB_ORIGIN: `http://127.0.0.1:${appPort}`,
        OIDC_LOCAL_HTTP: "true",
        OPERATOR_LOCAL_WRITES: "false",
        STATION_GRAPHQL_URL: `http://127.0.0.1:${apiPort}/graphql`,
        OPERATIONS_GRAPHQL_URL: `http://127.0.0.1:${apiPort}/graphql`,
      },
      stdio: "ignore",
    },
  );

  const origin = `http://127.0.0.1:${appPort}`;

  try {
    for (let i = 0; i < 40; i++) {
      try {
        const res = await fetch(`${origin}/stations/LONG%25ID-1`);
        if (res.status < 500) break;
      } catch {
        // retry
      }
      await new Promise(r => setTimeout(r, 250));
    }

    await signIn(page, origin);
    await context.grantPermissions(["clipboard-read", "clipboard-write"], { origin });
    await page.setViewportSize({ width: 1280, height: 800 });

    // 1. Rich online Overview + decorative SVGs + composite identity + active association separation
    await page.goto(`${origin}/stations/LONG%25ID-1?returnTo=%2Fstations%3Fstatus%3DOFFLINE`);
    await expect(page.getByRole("heading", { name: /Anuradhapura Regional Hub/ })).toBeVisible();
    await expect(page.getByText("LONG%ID-1", { exact: true }).first()).toBeVisible();
    await expect(page.locator("article").filter({ hasText: "EVSE 1 · Connector 1" })).toBeVisible();
    await expect(page.locator("article").filter({ hasText: "EVSE 2 · Connector 1" })).toBeVisible();
    await expect(page.locator("article").filter({ hasText: "EVSE 3 · Connector 1" })).toBeVisible();
    for (const label of ["Faulted", "Unavailable", "Occupied", "Reserved", "Available"]) {
      await expect(page.getByText(label, { exact: true }).first()).toBeVisible();
    }
    const svgCheck = await page.evaluate(() => {
      const svgs = Array.from(document.querySelectorAll("article svg[viewBox='0 0 112 132']"));
      return svgs.length === 5 && svgs.every(svg => svg.getAttribute("aria-hidden") === "true" && !svg.querySelector("[id]"));
    });
    expect(svgCheck).toBe(true);

    // Preserve return context across section switch + refresh
    await page.getByRole("navigation", { name: "Station sections" }).getByRole("link", { name: /Sessions/ }).click();
    await expect(page).toHaveURL(`${origin}/stations/LONG%25ID-1?section=sessions&returnTo=%2Fstations%3Fstatus%3DOFFLINE`);
    await expect(page.getByText("Duration 1h 15m").first()).toBeVisible();
    await expect(page.getByRole("link", { name: "TX%ACTIVE-1" }).first()).toHaveAttribute(
      "href",
      "/stations/LONG%25ID-1/sessions/TX%25ACTIVE-1",
    );
    await page.getByRole("button", { name: "Refresh data" }).click();
    await expect(page).toHaveURL(`${origin}/stations/LONG%25ID-1?section=sessions&returnTo=%2Fstations%3Fstatus%3DOFFLINE`);

    // 2. Connection details + copy guidance + secret protection
    await page.getByRole("navigation", { name: "Station sections" }).getByRole("link", { name: "Connection details" }).click();
    await expect(page.getByText("/ocpp/LONG%ID-1", { exact: true })).toBeVisible();
    await expect(page.getByText("graphql", { exact: false })).toHaveCount(0);
    await page.getByRole("button", { name: "Copy station ID LONG%ID-1" }).click();
    await expect(page.getByText("Copied")).toBeVisible();

    // Return context preserves directory filter
    await expect(page.getByRole("link", { name: "← Back to charging stations" })).toHaveAttribute(
      "href",
      "/stations?status=OFFLINE",
    );

    // 3. Offline station last-reported connector warning
    scenario = "offline-station";
    await page.goto(`${origin}/stations/LONG%25ID-1`);
    await expect(page.getByText("Station is currently reported offline").first()).toBeVisible();
    await expect(page.getByText("Last reported status — station currently offline").first()).toBeVisible();

    // 4. Empty connectors & empty sessions
    scenario = "empty-sections";
    await page.goto(`${origin}/stations/LONG%25ID-1`);
    await expect(page.getByRole("heading", { name: "No connectors reported" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "No charging sessions yet" })).toBeVisible();

    // 5. Partial connector failure preserves header and sessions while Unknown appears for connector counts
    scenario = "partial-connector-fail";
    await page.goto(`${origin}/stations/LONG%25ID-1`);
    await expect(page.getByRole("alert").filter({ hasText: "Unable to load connector equipment" })).toBeVisible();
    await expect(page.getByRole("link", { name: "TX%ACTIVE-1" }).first()).toBeVisible();
    await expect(page.getByText("Unknown", { exact: true })).toHaveCount(3);
    await expect(page.getByText("Connector read timeout")).toHaveCount(0);

    // 6. Partial session failure preserves header and charger cards while Unknown appears for active sessions
    scenario = "partial-session-fail";
    await page.goto(`${origin}/stations/LONG%25ID-1`);
    await expect(page.getByRole("alert").filter({ hasText: "Unable to load charging sessions" })).toBeVisible();
    await expect(page.getByText("EVSE 3 · Connector 2")).toBeVisible();
    await expect(page.getByText("Unknown", { exact: true })).toHaveCount(1);

    // 7. Full station failure (503 & null+error) shows unavailable (never 404) and recovers on retry
    for (const fail of ["station-fail-503", "station-null-with-error"] as const) {
      scenario = fail;
      const response = await page.goto(`${origin}/stations/LONG%25ID-1`);
      expect(response?.status()).toBe(200);
      await expect(page.getByRole("heading", { name: "Station record unavailable" })).toBeVisible();
      await expect(page.getByText("Internal Station DB timeout")).toHaveCount(0);
    }

    scenario = "online-rich";
    await page.getByRole("button", { name: "Try again" }).click();
    await expect(page.getByRole("heading", { name: /Anuradhapura Regional Hub/ })).toBeVisible();
  } finally {
    nextProc.kill();
    apiServer.close();
  }
});
