import { createServer } from "node:http";
import { spawn } from "node:child_process";
import { test, expect } from "@playwright/test";

test("overview fits all responsive viewports, 200% text scaling, reduced motion, and accessible semantics", async ({ page }) => {
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
    await page.goto("/");
    await expect(page.locator("main h1")).toHaveText("Overview");
    await expect(page.locator("main#main-content")).toHaveCount(1);
    await expect(page.getByRole("img", { name: /current station connectivity: \d+ of \d+ stations? online/ })).toBeVisible();
    await expect(page.getByText("Retrieved", { exact: false })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);

    const addStationBox = await page.getByRole("link", { name: "Add station" }).boundingBox();
    expect(addStationBox).not.toBeNull();
    expect(addStationBox!.height).toBeGreaterThanOrEqual(44);
  }

  // 200% text scaling across desktop and mobile
  for (const [width, height] of [[1440, 900], [390, 844]]) {
    await page.setViewportSize({ width, height });
    await page.goto("/");
    await page.evaluate(() => {
      document.documentElement.style.fontSize = "200%";
    });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    if (width >= 1280) {
      const noSidebarOverlap = await page.evaluate(() => {
        const aside = document.querySelector('aside[aria-label="Workspace sidebar"]');
        const navItems = document.querySelectorAll('aside nav ul > li');
        if (!aside) return false;
        const asideRight = aside.getBoundingClientRect().right;
        return Array.from(navItems).every(li => li.getBoundingClientRect().right <= asideRight + 1);
      });
      expect(noSidebarOverlap).toBe(true);
    }
  }

  expect(externalRequests).toEqual([]);
  expect(consoleErrors).toEqual([]);
});

test("overview handles empty network, read-only registration, unavailable API retry recovery, and >6 station expansion", async ({ page }) => {
  type FixtureMode = "empty" | "unavailable-503" | "unavailable-gql" | "unavailable-malformed" | "eight-stations";
  let mode: FixtureMode = "empty";

  const eightStations = [
    { id: "CP-1", name: "Colombo Central", status: "ONLINE" },
    { id: "CP-2", name: "Kandy Depot", status: "OFFLINE" },
    { id: "CP-3", name: "Galle Harbor", status: "ONLINE" },
    { id: "CP-4", name: "Negombo Hub", status: "ONLINE" },
    { id: "CP-5", name: "Jaffna North", status: "ONLINE" },
    { id: "CP-6", name: "Matara South", status: "ONLINE" },
    { id: "CP-7", name: "Kurunegala Plaza", status: "ONLINE" },
    { id: "LONG%ID-1", name: "Anuradhapura Regional Transit Charging Station With Very Long Name", status: "OFFLINE" },
  ];

  const apiServer = createServer(async (req, res) => {
    if (req.url === "/health") {
      res.end("ok");
      return;
    }
    req.resume();

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

    res.end(
      JSON.stringify({
        data: {
          stations: mode === "empty" ? [] : eightStations,
        },
      }),
    );
  });

  await new Promise<void>(resolve => apiServer.listen(4322, "127.0.0.1", resolve));

  const nextProc = spawn(
    "node",
    ["node_modules/next/dist/bin/next", "start", "--hostname", "127.0.0.1", "--port", "4323"],
    {
      cwd: process.cwd(),
      env: {
        ...process.env,
        OPERATOR_LOCAL_WRITES: "false",
        STATION_GRAPHQL_URL: "http://127.0.0.1:4322/graphql",
        OPERATIONS_GRAPHQL_URL: "http://127.0.0.1:4322/graphql",
      },
      stdio: "ignore",
    },
  );

  try {
    for (let i = 0; i < 40; i++) {
      try {
        if ((await fetch("http://127.0.0.1:4323/")).ok) break;
      } catch {
        // wait
      }
      await new Promise(r => setTimeout(r, 250));
    }

    // 1. Valid empty network + read-only mode
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto("http://127.0.0.1:4323/");
    await expect(page.getByText("Read-only console")).toBeVisible();
    await expect(page.getByRole("link", { name: "Add station" })).toHaveCount(0);
    await expect(page.getByText("N/A", { exact: true })).toBeVisible();
    await expect(page.getByText("No charging stations registered")).toBeVisible();

    // 2. Unavailable modes (503, GraphQL error, malformed payload) -> Unknown + ErrorState, then retry recovery
    for (const failMode of ["unavailable-503", "unavailable-gql", "unavailable-malformed"] as const) {
      mode = failMode;
      await page.goto("http://127.0.0.1:4323/");
      await expect(page.getByRole("alert").filter({ hasText: "Unable to load network overview" })).toBeVisible();
      await expect(page.getByText("Unknown", { exact: true })).toHaveCount(4);
      await expect(page.getByText("Status unknown", { exact: true })).toBeVisible();
      await expect(page.getByText("Internal SQL error detail")).toHaveCount(0);
    }

    mode = "eight-stations";
    await page.getByRole("button", { name: "Try again" }).click();
    await expect(page.getByText("Showing 6 of 8 stations").first()).toBeVisible();
    await expect(page.getByText("2 offline", { exact: true })).toBeVisible();
    await expect(page.getByRole("link", { name: /Anuradhapura Regional Transit/ })).toHaveAttribute("href", "/stations/LONG%25ID-1");

    await page.getByRole("link", { name: "Show all 8 stations" }).click();
    await expect(page.getByText("Showing 8 of 8 stations").first()).toBeVisible();
    await expect(page.getByRole("link", { name: "Negombo Hub", exact: true })).toBeVisible();

    await page.setViewportSize({ width: 390, height: 844 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  } finally {
    nextProc.kill();
    apiServer.close();
  }
});
