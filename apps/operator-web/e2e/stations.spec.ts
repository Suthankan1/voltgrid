import { createServer } from "node:http";
import { spawn } from "node:child_process";
import { test, expect } from "@playwright/test";

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

test("stations directory adapts across viewports, 200% text scaling, reduced motion, and keyboard navigation", async ({ page }) => {
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
    await page.goto("/stations");
    await expect(page.locator("main h1")).toHaveText("Charging stations");
    await expect(page.locator("main#main-content")).toHaveCount(1);
    await expect(page.getByText("Retrieved", { exact: false })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);

    const addStationBox = await page.getByRole("link", { name: "Add station" }).boundingBox();
    expect(addStationBox).not.toBeNull();
    expect(addStationBox!.height).toBeGreaterThanOrEqual(44);

    const filterBtnBox = await page.getByRole("button", { name: "Apply filters" }).boundingBox();
    expect(filterBtnBox).not.toBeNull();
    expect(filterBtnBox!.height).toBeGreaterThanOrEqual(44);
  }

  // Verify 200% text scaling without horizontal overflow or sidebar collision
  for (const [width, height] of [[1440, 900], [390, 844]]) {
    await page.setViewportSize({ width, height });
    await page.goto("/stations");
    await page.evaluate(() => {
      document.documentElement.style.fontSize = "200%";
    });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    if (width >= 1280) {
      const noSidebarOverlap = await page.evaluate(() => {
        const aside = document.querySelector('aside[aria-label="Workspace sidebar"]');
        const navItems = document.querySelectorAll("aside nav ul > li");
        if (!aside) return false;
        const asideRight = aside.getBoundingClientRect().right;
        return Array.from(navItems).every(li => li.getBoundingClientRect().right <= asideRight + 1);
      });
      expect(noSidebarOverlap).toBe(true);
    }
  }

  // Static /stations/new precedence and genuine 404 preservation on unknown station
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto("/stations/new");
  await expect(page.getByRole("heading", { name: "Register a charging station" })).toBeVisible();
  expect((await page.goto("/stations/does-not-exist-station"))?.status()).toBe(404);

  // Keyboard navigation across filter controls and Enter submit on /stations
  await page.goto("/stations");
  const searchInput = page.getByLabel("Search stations");
  await searchInput.click();
  await expect(searchInput).toBeFocused();
  await page.keyboard.press("Tab");
  const activeTag = await page.evaluate(() => `${document.activeElement?.tagName}:${document.activeElement?.id}:${document.activeElement?.textContent}`);
  expect(activeTag).toContain("SELECT:stations-status");
  await page.keyboard.press("Tab");
  await expect(page.getByRole("button", { name: "Apply filters" })).toBeFocused();
  await searchInput.focus();
  await page.keyboard.type("Kandy");
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/\/stations\?q=Kandy/);
  await expect(page.getByRole("link", { name: "Kandy Depot", exact: true })).toBeVisible();

  expect(externalRequests).toEqual([]);
  const non404ConsoleErrors = consoleErrors.filter(err => !err.includes("404"));
  expect(non404ConsoleErrors).toEqual([]);
});

test("stations directory covers search, filtering, context return, overview links, empty, read-only, and failure recovery", async ({ page }) => {
  type FixtureMode =
    | "eight-stations"
    | "all-online"
    | "all-offline"
    | "empty"
    | "unavailable-503"
    | "unavailable-gql"
    | "unavailable-malformed";

  let mode: FixtureMode = "eight-stations";

  const eightStations = [
    { id: "CP-1", name: "Colombo Central", status: "ONLINE" },
    { id: "CP-2", name: "Kandy Depot", status: "OFFLINE" },
    { id: "CP-3", name: "Galle Harbor", status: "ONLINE" },
    { id: "CP-4", name: "Negombo Hub", status: "ONLINE" },
    { id: "CP-5", name: "Jaffna North", status: "ONLINE" },
    { id: "CP-6", name: "Matara South", status: "ONLINE" },
    { id: "CP-7", name: "Kurunegala Plaza", status: "ONLINE" },
    {
      id: "LONG%ID-1",
      name: "Anuradhapura Regional Transit Charging Station With Very Long Name",
      status: "OFFLINE",
    },
  ];

  const apiServer = createServer((req, res) => {
    if (req.url === "/health") {
      res.end("ok");
      return;
    }

    let body = "";
    req.on("data", chunk => {
      body += chunk;
    });
    req.on("end", () => {
      if (mode === "unavailable-503") {
        res.writeHead(503);
        res.end();
        return;
      }

      res.setHeader("Content-Type", "application/json");
      if (mode === "unavailable-gql") {
        res.end(JSON.stringify({ errors: [{ message: "Internal SQL error detail" }] }));
        return;
      }
      if (mode === "unavailable-malformed") {
        res.end(JSON.stringify({ data: { stations: [{ id: 123, name: null, status: "UNKNOWN" }] } }));
        return;
      }

      if (body.includes("station(id:")) {
        const longStation = eightStations.find(s => s.id === "LONG%ID-1")!;
        res.end(
          JSON.stringify({
            data: {
              station: longStation,
              stationConnectors: [],
              stationTransactions: [],
            },
          }),
        );
        return;
      }

      const stations =
        mode === "empty"
          ? []
          : mode === "all-online"
            ? eightStations.slice(0, 2).map(s => ({ ...s, status: "ONLINE" }))
            : mode === "all-offline"
              ? eightStations.slice(0, 2).map(s => ({ ...s, status: "OFFLINE" }))
              : eightStations;

      res.end(JSON.stringify({ data: { stations } }));
    });
  });

  const apiPort = await getFreePort();
  const appPort = await getFreePort();
  await new Promise<void>(resolve => apiServer.listen(apiPort, "127.0.0.1", resolve));

  const nextProc = spawn(
    "node",
    ["node_modules/next/dist/bin/next", "start", "--hostname", "127.0.0.1", "--port", String(appPort)],
    {
      cwd: process.cwd(),
      env: {
        ...process.env,
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
        if ((await fetch(`${origin}/`)).ok) break;
      } catch {
        // wait
      }
      await new Promise(r => setTimeout(r, 250));
    }

    // 1. Overview links to directory + legacy overview redirects
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto(`${origin}/`);
    await expect(page.getByText("Showing 6 of 8 stations").first()).toBeVisible();
    await page.getByRole("link", { name: "Inspect offline stations" }).first().click();
    await expect(page).toHaveURL(`${origin}/stations?status=OFFLINE`);
    await expect(page.getByText("Showing 2 of 2 matching (8 total)")).toBeVisible();
    await expect(page.getByText("Read-only console")).toBeVisible();
    await expect(page.getByRole("link", { name: "Add station" })).toHaveCount(0);

    // 2. Refresh & Back/Forward preserve filtered directory state; station detail preserves filtered return
    await page.getByRole("button", { name: "Refresh data" }).click();
    await expect(page).toHaveURL(`${origin}/stations?status=OFFLINE`);
    await page.getByRole("link", { name: /Anuradhapura Regional Transit/ }).click();
    await expect(page).toHaveURL(/\/stations\/LONG%25ID-1\?returnTo=%2Fstations%3Fstatus%3DOFFLINE/);
    const backLink = page.getByRole("link", { name: "← Back to charging stations" });
    await expect(backLink).toHaveAttribute("href", "/stations?status=OFFLINE");
    await backLink.click();
    await expect(page).toHaveURL(`${origin}/stations?status=OFFLINE`);

    // Untrusted external returnTo is ignored cleanly
    await page.goto(`${origin}/stations/LONG%25ID-1?returnTo=//evil.example/phish`);
    await expect(page.getByRole("link", { name: "← Back to charging stations" })).toHaveAttribute("href", "/stations");

    // 3. Search by identifier case-insensitively while full totals remain invariant
    await page.goto(`${origin}/stations`);
    await page.getByLabel("Search stations").fill("long%id");
    await page.getByRole("button", { name: "Apply filters" }).click();
    await expect(page.getByText("Showing 1 of 1 matching (8 total)")).toBeVisible();
    await expect(page.getByRole("link", { name: /Anuradhapura Regional Transit/ })).toHaveAttribute(
      "href",
      "/stations/LONG%25ID-1?returnTo=%2Fstations%3Fq%3Dlong%2525id",
    );

    await page.goBack();
    await expect(page).toHaveURL(`${origin}/stations`);
    await page.goForward();
    await expect(page).toHaveURL(/\/stations\?q=long%25id(&status=)?$/);

    // 4. All-online and all-offline states
    mode = "all-online";
    await page.goto(`${origin}/stations`);
    const summary = page.getByLabel("Registered station summary");
    await expect(summary).toContainText("2");
    await expect(summary).toContainText("0");

    mode = "all-offline";
    await page.reload();
    await expect(summary).toContainText("Offline");
    await expect(page.getByRole("link", { name: "Investigate station CP-2" })).toBeVisible();

    // 5. Empty fleet state (read-only)
    mode = "empty";
    await page.goto(`${origin}/stations`);
    await expect(page.getByText("No charging stations registered")).toBeVisible();
    await expect(page.getByText("No retrieval timestamp recorded")).toHaveCount(0);

    // 6. Unavailable modes (503, GraphQL, malformed) + Try again recovery
    for (const failMode of ["unavailable-503", "unavailable-gql", "unavailable-malformed"] as const) {
      mode = failMode;
      await page.goto(`${origin}/stations`);
      await expect(page.getByRole("alert").filter({ hasText: "Unable to load charging stations" })).toBeVisible();
      await expect(summary.getByText("Unknown")).toHaveCount(3);
      await expect(page.getByText("Internal SQL error detail")).toHaveCount(0);
    }

    mode = "eight-stations";
    await page.getByRole("button", { name: "Try again" }).click();
    await expect(page.getByText("Showing 8 of 8 stations")).toBeVisible();
  } finally {
    nextProc.kill();
    apiServer.close();
  }
});
