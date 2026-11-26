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

const SCREENSHOT_DIR = process.env.UI109_CAPTURE_DIR ?? "";

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

test("Needs attention, Diagnostics, Help, and all six navigation destinations satisfy responsive, functional, and security gates", async ({
  page,
}) => {
  test.setTimeout(120_000);

  type AttentionScenario =
    | "populated"
    | "clear"
    | "stations-fail"
    | "sessions-fail"
    | "both-fail";
  type DiagnosticsScenario = "live" | "empty" | "api-fail" | "malformed";

  const state: {
    attention: AttentionScenario;
    diagnostics: DiagnosticsScenario;
    stationQueries: number;
    sessionPageQueries: number;
    diagnosticsQueries: number;
  } = {
    attention: "populated",
    diagnostics: "live",
    stationQueries: 0,
    sessionPageQueries: 0,
    diagnosticsQueries: 0,
  };

  const stations = [
    { id: "CP-1", name: "Colombo Central", status: "ONLINE" },
    { id: "CP%2", name: "Kandy Regional Depot", status: "OFFLINE" },
    { id: "CP-3", name: "Anuradhapura Transit Hub", status: "OFFLINE" },
  ];

  const incompleteSession = {
    transaction: {
      stationId: "CP%2",
      transactionId: "TX%GAP-1",
      evseId: 1,
      connectorId: 2,
      status: "ENDED",
      startedAt: "2026-10-08T08:00:00Z",
      endedAt: "2026-10-08T08:30:00Z",
      lastSequenceNumber: 5,
    },
    completeness: {
      status: "INCOMPLETE",
      firstSequenceNumber: 0,
      lastSequenceNumber: 5,
      missingSequenceNumbers: [2, 3],
    },
  };

  const diagnosticsPage1 = [
    {
      stationId: "CP-1",
      currentStatus: "ONLINE",
      lastEventId: "evt-online-101",
      statusChangedAt: "2026-10-08T08:00:00Z",
      updatedAt: "2026-10-08T08:00:02Z",
    },
    {
      stationId: "CP%2",
      currentStatus: "OFFLINE",
      lastEventId: "evt-offline-202",
      statusChangedAt: "2026-10-08T08:15:00Z",
      updatedAt: "2026-10-08T08:15:03Z",
    },
    {
      stationId: "CP-3",
      currentStatus: "UNAVAILABLE",
      lastEventId: "evt-unavail-303",
      statusChangedAt: "2026-10-08T08:30:00Z",
      updatedAt: "2026-10-08T08:30:01Z",
    },
  ];

  const diagnosticsPage2 = [
    {
      stationId: "CP-4",
      currentStatus: "OFFLINE",
      lastEventId: "evt-offline-404",
      statusChangedAt: "2026-10-08T09:00:00Z",
      updatedAt: "2026-10-08T09:00:02Z",
    },
  ];

  const apiPort = await getFreePort();
  const appPort = 4313;
  const origin = `http://127.0.0.1:${appPort}`;

  const apiServer = createServer(async (req, res) => {
    if (respondToOrganizationAccess(req, res)) return;
    let body = "";
    for await (const chunk of req) body += chunk;
    const { query, variables = {} } = JSON.parse(body || "{}") as {
      query: string;
      variables?: Record<string, unknown>;
    };

    res.setHeader("Content-Type", "application/json");

    if (query.includes("OperatorStations")) {
      state.stationQueries += 1;
      if (
        state.attention === "stations-fail" ||
        state.attention === "both-fail"
      ) {
        res.end(
          JSON.stringify({
            errors: [{ message: "secret station snapshot sql error" }],
          }),
        );
        return;
      }
      res.end(
        JSON.stringify({
          data: {
            stations:
              state.attention === "clear"
                ? [{ id: "CP-1", name: "Colombo Central", status: "ONLINE" }]
                : stations,
          },
        }),
      );
      return;
    }

    if (query.includes("OperatorNetworkTransactionPage")) {
      state.sessionPageQueries += 1;
      if (
        state.attention === "sessions-fail" ||
        state.attention === "both-fail"
      ) {
        res.end(
          JSON.stringify({
            errors: [{ message: "secret incomplete session page sql error" }],
          }),
        );
        return;
      }
      res.end(
        JSON.stringify({
          data: {
            networkTransactionPage:
              state.attention === "clear"
                ? {
                    content: [],
                    page: 0,
                    size: 8,
                    totalElements: 0,
                    totalPages: 0,
                    hasNext: false,
                  }
                : {
                    content: [incompleteSession],
                    page: 0,
                    size: 8,
                    totalElements: 1,
                    totalPages: 1,
                    hasNext: false,
                  },
          },
        }),
      );
      return;
    }

    if (query.includes("OperatorStationStatus(")) {
      state.diagnosticsQueries += 1;
      if (state.diagnostics === "api-fail") {
        res.end(
          JSON.stringify({
            errors: [{ message: "secret operations db password" }],
          }),
        );
        return;
      }
      const match = diagnosticsPage1.find(
        (r) => r.stationId === variables.stationId,
      );
      res.end(JSON.stringify({ data: { stationStatus: match ?? null } }));
      return;
    }

    if (query.includes("OperatorStatuses")) {
      state.diagnosticsQueries += 1;
      if (variables.after === "invalid-cursor") {
        res.end(
          JSON.stringify({
            data: { stationStatuses: null },
            errors: [{ message: "secret internal cursor parse trace" }],
          }),
        );
        return;
      }
      if (state.diagnostics === "api-fail") {
        res.writeHead(503);
        res.end();
        return;
      }
      if (state.diagnostics === "malformed") {
        res.end(
          JSON.stringify({
            data: { stationStatuses: { edges: null, pageInfo: {} } },
          }),
        );
        return;
      }
      if (state.diagnostics === "empty") {
        res.end(
          JSON.stringify({
            data: {
              stationStatuses: {
                edges: [],
                pageInfo: { hasNextPage: false, endCursor: null },
              },
            },
          }),
        );
        return;
      }

      const statusFilter = variables.status as string | null;
      const sourceRows =
        variables.after === "cursor-2" ? diagnosticsPage2 : diagnosticsPage1;
      const filtered = statusFilter
        ? sourceRows.filter((row) => row.currentStatus === statusFilter)
        : sourceRows;

      const hasNextPage =
        variables.after !== "cursor-2" && (!statusFilter || statusFilter === "OFFLINE");

      res.end(
        JSON.stringify({
          data: {
            stationStatuses: {
              edges: filtered.map((node) => ({ node })),
              pageInfo: {
                hasNextPage,
                endCursor: hasNextPage ? "cursor-2" : null,
              },
            },
          },
        }),
      );
      return;
    }

    if (query.includes("OperatorStation(")) {
      res.end(
        JSON.stringify({
          data: {
            station: stations.find((s) => s.id === variables.id) ?? null,
            stationConnectors: [],
            stationTransactions: [],
          },
        }),
      );
      return;
    }

    if (query.includes("OperatorTransaction(")) {
      res.end(
        JSON.stringify({
          data: {
            transaction: incompleteSession.transaction,
          },
        }),
      );
      return;
    }

    if (query.includes("OperatorTransactionData")) {
      res.end(
        JSON.stringify({
          data: {
            transactionCompleteness: incompleteSession.completeness,
            transactionMeterSamples: [],
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
    await waitForHttpOk(`${origin}/help`);
    await signIn(page, origin);

    // 1. Check all 7 viewports across /attention, /diagnostics, and /help with zero horizontal overflow
    for (const [width, height] of VIEWPORTS) {
      await page.setViewportSize({ width, height });
      for (const route of ["/attention", "/diagnostics", "/help"]) {
        await page.goto(`${origin}${route}`);
        await expect(page.locator("main#main-content")).toHaveCount(1);
        await expect(page.locator("main h1")).toBeVisible();
        const noOverflow = await page.evaluate(
          () => document.documentElement.scrollWidth <= window.innerWidth,
        );
        expect(noOverflow).toBe(true);
      }
    }

    // 2. Populated Needs attention + sidebar six activated links check + zero N+1 request check
    await page.setViewportSize({ width: 1440, height: 900 });
    state.stationQueries = 0;
    state.sessionPageQueries = 0;
    await page.goto(`${origin}/attention`);
    await expect(
      page.getByRole("heading", { name: "Needs attention", exact: true }),
    ).toBeVisible();
    // Strictly 1 stations call + 1 incomplete networkTransactionPage call
    expect(state.stationQueries).toBe(1);
    expect(state.sessionPageQueries).toBe(1);

    const nav = page.getByRole("navigation", { name: "Primary navigation" });
    for (const label of [
      "Overview",
      "Charging stations",
      "Charging sessions",
      "Needs attention",
      "Diagnostics",
      "Help",
    ]) {
      await expect(nav.getByRole("link", { name: label, exact: true })).toBeVisible();
    }
    await expect(nav.getByText("Soon", { exact: true })).toHaveCount(0);
    await expect(
      nav.getByRole("link", { name: "Needs attention", exact: true }),
    ).toHaveAttribute("aria-current", "page");

    await expect(page.getByText("Kandy Regional Depot").first()).toBeVisible();
    await expect(page.getByText("TX%GAP-1").first()).toBeVisible();
    await expect(page.getByText("Seq 2").first()).toBeVisible();
    await capture("01-attention-populated-1440.png");
    await capture("16-sidebar-all-six-1440.png");

    // Round-trip from Needs attention to Station details & back preserving safe returnTo=/attention
    await page.getByRole("link", { name: "Inspect offline station Kandy Regional Depot" }).click();
    await expect(page).toHaveURL(`${origin}/stations/CP%252?returnTo=%2Fattention`);
    await expect(page.getByRole("link", { name: "← Back to Needs attention" })).toBeVisible();
    await page.getByRole("link", { name: "← Back to Needs attention" }).click();
    await expect(page).toHaveURL(`${origin}/attention`);

    // Round-trip from Needs attention to Session Technical details & back preserving safe returnTo=/attention
    await page
      .getByRole("link", {
        name: "Sequence details for session TX%GAP-1 at CP%2",
      })
      .click();
    await expect(page).toHaveURL(
      `${origin}/stations/CP%252/sessions/TX%25GAP-1?section=technical&returnTo=%2Fattention`,
    );
    await expect(page.getByRole("link", { name: "← Back to Needs attention" })).toBeVisible();
    await page.getByRole("link", { name: "← Back to Needs attention" }).click();
    await expect(page).toHaveURL(`${origin}/attention`);

    await page.setViewportSize({ width: 390, height: 844 });
    await capture("02-attention-populated-390.png");

    // 3. Needs attention empty state (no false healthy claim) + partial failures
    await page.setViewportSize({ width: 1440, height: 900 });
    state.attention = "clear";
    await page.goto(`${origin}/attention`);
    await expect(
      page.getByRole("heading", {
        name: "No offline stations or incomplete session records found.",
      }),
    ).toBeVisible();
    await capture("03-attention-clear-1440.png");

    state.attention = "stations-fail";
    await page.goto(`${origin}/attention`);
    await expect(
      page.getByRole("heading", { name: "Unable to load station connectivity" }),
    ).toBeVisible();
    await expect(page.getByText(/secret station snapshot sql error/)).toHaveCount(0);
    await expect(page.getByText("TX%GAP-1").first()).toBeVisible();
    await capture("04-attention-station-partial-fail-1440.png");

    state.attention = "sessions-fail";
    await page.goto(`${origin}/attention`);
    await expect(
      page.getByRole("heading", { name: "Unable to load incomplete sessions" }),
    ).toBeVisible();
    await expect(page.getByText("Kandy Regional Depot").first()).toBeVisible();
    await capture("05-attention-session-partial-fail-1440.png");

    // 4. Diagnostics scenarios: populated, mobile, filtered, cursor pagination, lookup, missing lookup, invalid cursor, API fail, legacy redirect
    await page.goto(`${origin}/diagnostics`);
    await expect(
      page.getByRole("heading", { name: "Diagnostics", exact: true }),
    ).toBeVisible();
    await expect(
      page.getByText("The Operations Service maintains an asynchronous station-status projection."),
    ).toBeVisible();
    await expect(page.getByText("3 stations on this page")).toBeVisible();
    await page.getByText("Technical event details").first().click();
    await expect(page.getByText("evt-online-101").first()).toBeVisible();
    await page.context().grantPermissions(["clipboard-read", "clipboard-write"]);
    await page.getByRole("button", { name: "Copy station ID CP-1" }).click();
    await expect(page.getByText("Copied").first()).toBeVisible();
    await capture("06-diagnostics-populated-1440.png");

    await page.setViewportSize({ width: 390, height: 844 });
    await capture("07-diagnostics-populated-390.png");

    // Filtered status & reset cursor
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.getByLabel("Projected status", { exact: true }).selectOption("UNAVAILABLE");
    await page.getByRole("button", { name: "Apply filters" }).click();
    await expect(page).toHaveURL(`${origin}/diagnostics?status=UNAVAILABLE`);
    await expect(page.getByRole("table").getByText("Unavailable", { exact: true })).toBeVisible();
    await capture("08-diagnostics-filtered-1440.png");

    // Cursor pagination (page 1 -> Next page -> page 2 -> First page)
    await page.goto(`${origin}/diagnostics`);
    await page.getByRole("link", { name: "Next page" }).click();
    await expect(page).toHaveURL(`${origin}/diagnostics?after=cursor-2`);
    await expect(page.getByText("CP-4").first()).toBeVisible();
    await expect(page.getByText("No next page", { exact: true })).toBeVisible();
    await capture("10-diagnostics-cursor-page2-1440.png");

    // Exact station lookup (found + missing projection distinct from unregistered)
    await page.getByLabel("Exact station lookup", { exact: true }).fill("CP%2");
    await page.getByRole("button", { name: "Apply filters" }).click();
    await expect(page).toHaveURL(`${origin}/diagnostics?stationId=CP%252`);
    await expect(page.getByText("1 exact lookup record")).toBeVisible();
    await capture("09-diagnostics-lookup-found-1440.png");

    await page.getByLabel("Exact station lookup", { exact: true }).fill("CP-NO-PROJECTION");
    await page.getByRole("button", { name: "Apply filters" }).click();
    await expect(
      page.getByRole("heading", { name: "No projection record found for this station" }),
    ).toBeVisible();
    await capture("11-diagnostics-lookup-missing-1440.png");

    // Invalid cursor recovery + API unavailable state
    await page.goto(`${origin}/diagnostics?after=invalid-cursor`);
    await expect(
      page.getByRole("heading", { name: "Diagnostics cursor could not be loaded" }),
    ).toBeVisible();
    await expect(page.getByText(/secret internal cursor parse trace/)).toHaveCount(0);
    await expect(page.getByRole("link", { name: "Return to first page" })).toHaveAttribute(
      "href",
      "/diagnostics",
    );

    state.diagnostics = "api-fail";
    await page.goto(`${origin}/diagnostics`);
    await expect(
      page.getByRole("heading", { name: "Unable to load operational diagnostics" }),
    ).toBeVisible();
    await capture("12-diagnostics-unavailable-1440.png");

    // Legacy /operations redirect preserves status + cursor and strips unsafe params
    state.diagnostics = "live";
    await page.goto(
      `${origin}/operations?status=OFFLINE&after=cursor-2&evil=https://evil.example`,
    );
    await expect(page).toHaveURL(`${origin}/diagnostics?status=OFFLINE&after=cursor-2`);

    // 5. Static Help page: zero backend requests, interactive keyboard disclosures, mobile & desktop
    state.diagnosticsQueries = 0;
    state.stationQueries = 0;
    state.sessionPageQueries = 0;
    await page.goto(`${origin}/help`);
    await expect(page.getByRole("heading", { name: "Help", exact: true })).toBeVisible();
    expect(state.diagnosticsQueries).toBe(0);
    expect(state.stationQueries).toBe(0);
    expect(state.sessionPageQueries).toBe(0);
    await capture("13-help-1440.png");

    // Expand native <details> guidance via keyboard Enter
    const firstSummary = page
      .locator("#troubleshooting summary", {
        hasText: "Station remains offline after registration",
      })
      .first();
    await firstSummary.focus();
    await page.keyboard.press("Enter");
    await expect(page.getByRole("link", { name: "Inspect offline stations →" })).toBeVisible();
    await capture("15-help-expanded-1440.png");

    await page.setViewportSize({ width: 390, height: 844 });
    await capture("14-help-390.png");

    // 6. 200% zoom & reduced motion check across /attention, /diagnostics, /help
    await page.emulateMedia({ reducedMotion: "reduce" });
    state.attention = "populated";
    for (const [route, file] of [
      ["/attention", "17-attention-zoom-200.png"],
      ["/diagnostics", "18-diagnostics-zoom-200.png"],
      ["/help", "19-help-zoom-200.png"],
    ] as const) {
      await page.setViewportSize({ width: 390, height: 844 });
      await page.goto(`${origin}${route}`);
      await page.evaluate(() => {
        document.documentElement.style.fontSize = "200%";
      });
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      );
      expect(overflow).toBe(true);
      await capture(file);
    }

    // 7. Browser Back/Forward across Support destinations
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto(`${origin}/attention`);
    await page.getByRole("link", { name: "Diagnostics", exact: true }).click();
    await expect(page).toHaveURL(`${origin}/diagnostics`);
    await page.getByRole("link", { name: "Help", exact: true }).click();
    await expect(page).toHaveURL(`${origin}/help`);
    await page.goBack();
    await expect(page).toHaveURL(`${origin}/diagnostics`);
    await page.goForward();
    await expect(page).toHaveURL(`${origin}/help`);

    expect(consoleErrors).toEqual([]);
    expect(pageErrors).toEqual([]);
  } finally {
    nextProc.kill("SIGTERM");
    await new Promise<void>((resolve) => apiServer.close(() => resolve()));
  }
});
