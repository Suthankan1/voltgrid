import { createServer } from "node:http";
import { spawn } from "node:child_process";
import net from "node:net";
import { expect, test } from "@playwright/test";

const VIEWPORTS = [
  [320, 568],
  [390, 844],
  [768, 1024],
  [1024, 768],
  [1280, 800],
  [1440, 900],
  [1920, 1080],
] as const;

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

test("sessions directory adapts across all 7 viewports, 200% zoom, reduced motion, and keyboard navigation", async ({
  page,
}) => {
  const consoleErrors: string[] = [];
  const pageErrors: string[] = [];
  page.on("console", (msg) => {
    if (msg.type() === "error") consoleErrors.push(msg.text());
  });
  page.on("pageerror", (err) => pageErrors.push(err.message));

  for (const [width, height] of VIEWPORTS) {
    await page.setViewportSize({ width, height });
    await page.goto("/sessions");

    await expect(page.locator("main#main-content")).toHaveCount(1);
    await expect(
      page.getByRole("heading", { name: "Charging sessions", exact: true }),
    ).toBeVisible();

    const noHorizontalOverflow = await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    );
    expect(noHorizontalOverflow).toBe(true);

    const sectionsOk = await page.evaluate(() =>
      Array.from(document.querySelectorAll("main section")).every(
        (el) => el.scrollWidth <= el.clientWidth + 1,
      ),
    );
    expect(sectionsOk).toBe(true);
  }

  for (const [width, height] of [
    [1440, 900],
    [390, 844],
  ] as const) {
    await page.setViewportSize({ width, height });
    await page.goto("/sessions");
    await expect(
      page.getByRole("heading", { name: "Charging sessions", exact: true }),
    ).toBeVisible();
    await page.evaluate(() => {
      document.documentElement.style.fontSize = "200%";
    });

    const zoomMetrics = await page.evaluate(() => ({
      noHorizontalOverflow:
        document.documentElement.scrollWidth <= window.innerWidth,
      sectionsOk: Array.from(document.querySelectorAll("main section")).every(
        (el) => el.scrollWidth <= el.clientWidth + 1,
      ),
    }));
    expect(zoomMetrics.noHorizontalOverflow).toBe(true);
    expect(zoomMetrics.sectionsOk).toBe(true);
  }

  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto("/sessions");
  await expect(
    page.getByRole("heading", { name: "Charging sessions", exact: true }),
  ).toBeVisible();

  // Keyboard focus & Enter filter submit on toolbar
  const stationInput = page.getByLabel("Station identifier", { exact: true });
  await stationInput.click();
  await expect(stationInput).toBeFocused();
  await stationInput.fill("CP-1");
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/\/sessions\?stationId=CP-1/);

  expect(consoleErrors).toEqual([]);
  expect(pageErrors).toEqual([]);
});

test("sessions directory covers pagination, exact filters, composite IDs, legacy redirects, partial summary failure, and unavailable recovery", async ({
  page,
}) => {
  type Scenario = "live" | "empty" | "api-fail" | "summary-fail" | "malformed";
  const state: {
    scenario: Scenario;
    lastPageVariables: {
      page?: number;
      size?: number;
      stationId?: string | null;
      transactionId?: string | null;
      integrityStatus?: string | null;
    } | null;
    transactionDetailLookups: number;
  } = {
    scenario: "live",
    lastPageVariables: null,
    transactionDetailLookups: 0,
  };

  const allRecords = [
    {
      transaction: {
        stationId: "CP-1",
        transactionId: "TX-ACTIVE-LONG-SESSION-2026-ALPHA-0001",
        evseId: 1,
        connectorId: 1,
        status: "ACTIVE" as const,
        startedAt: "2026-10-08T12:00:00Z",
        endedAt: null,
        lastSequenceNumber: 7,
      },
      completeness: {
        status: "IN_PROGRESS" as const,
        firstSequenceNumber: 0,
        lastSequenceNumber: 7,
        missingSequenceNumbers: [],
      },
    },
    {
      transaction: {
        stationId: "CP-2",
        transactionId: "TX-INCOMPLETE-1",
        evseId: 2,
        connectorId: 1,
        status: "ENDED" as const,
        startedAt: "2026-10-08T11:00:00Z",
        endedAt: "2026-10-08T11:45:00Z",
        lastSequenceNumber: 6,
      },
      completeness: {
        status: "INCOMPLETE" as const,
        firstSequenceNumber: 0,
        lastSequenceNumber: 6,
        missingSequenceNumbers: [2, 4],
      },
    },
    {
      transaction: {
        stationId: "CP-1",
        transactionId: "TX-SHARED",
        evseId: 1,
        connectorId: 2,
        status: "ENDED" as const,
        startedAt: "2026-10-08T10:00:00Z",
        endedAt: "2026-10-08T10:30:00Z",
        lastSequenceNumber: 3,
      },
      completeness: {
        status: "COMPLETE" as const,
        firstSequenceNumber: 0,
        lastSequenceNumber: 3,
        missingSequenceNumbers: [],
      },
    },
    {
      transaction: {
        stationId: "CP-UNLISTED",
        transactionId: "TX-SHARED",
        evseId: 1,
        connectorId: 1,
        status: "ENDED" as const,
        startedAt: "2026-10-08T09:00:00Z",
        endedAt: "2026-10-08T09:15:00Z",
        lastSequenceNumber: 2,
      },
      completeness: {
        status: "UNKNOWN" as const,
        firstSequenceNumber: null,
        lastSequenceNumber: 2,
        missingSequenceNumbers: [],
      },
    },
    {
      transaction: {
        stationId: "cp-MixedCase",
        transactionId: "tx-CasePreserved-9",
        evseId: 3,
        connectorId: 1,
        status: "ENDED" as const,
        startedAt: "2026-10-08T08:00:00Z",
        endedAt: "2026-10-08T08:20:00Z",
        lastSequenceNumber: 4,
      },
      completeness: {
        status: "COMPLETE" as const,
        firstSequenceNumber: 0,
        lastSequenceNumber: 4,
        missingSequenceNumbers: [],
      },
    },
  ];

  const apiServer = createServer((req, res) => {
    const chunks: Buffer[] = [];
    req.on("data", (chunk: Buffer) => chunks.push(chunk));
    req.on("end", () => {
      const payload = JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}") as {
        query?: string;
        variables?: {
          page?: number;
          size?: number;
          stationId?: string | null;
          transactionId?: string | null;
          integrityStatus?: string | null;
          id?: string;
        };
      };
      const query = payload.query ?? "";
      const vars = payload.variables ?? {};
      res.setHeader("Content-Type", "application/json");

      if (query.includes("OperatorNetworkTransactionPage")) {
        const isMissingSummaryProbe =
          vars.size === 1 &&
          vars.page === 0 &&
          vars.integrityStatus === "INCOMPLETE" &&
          !vars.stationId &&
          !vars.transactionId;

        if (isMissingSummaryProbe && state.scenario === "summary-fail") {
          res.statusCode = 503;
          res.end("Summary unavailable");
          return;
        }

        if (!isMissingSummaryProbe) {
          state.lastPageVariables = vars;
        }

        if (state.scenario === "api-fail") {
          res.statusCode = 502;
          res.end("Upstream internal exception secret://hidden");
          return;
        }

        if (state.scenario === "malformed") {
          res.end(
            JSON.stringify({
              data: {
                networkTransactionPage: {
                  page: 0,
                  size: 20,
                  totalElements: "broken",
                },
              },
            }),
          );
          return;
        }

        if (state.scenario === "empty") {
          res.end(
            JSON.stringify({
              data: {
                networkTransactionPage: {
                  content: [],
                  page: vars.page ?? 0,
                  size: vars.size ?? 20,
                  totalElements: 0,
                  totalPages: 0,
                  hasNext: false,
                },
              },
            }),
          );
          return;
        }

        const filtered = allRecords.filter((rec) => {
          if (vars.stationId && rec.transaction.stationId !== vars.stationId) {
            return false;
          }
          if (
            vars.transactionId &&
            !rec.transaction.transactionId
              .toLowerCase()
              .includes(vars.transactionId.toLowerCase())
          ) {
            return false;
          }
          if (
            vars.integrityStatus &&
            rec.completeness.status !== vars.integrityStatus
          ) {
            return false;
          }
          return true;
        });

        const pageIdx = vars.page ?? 0;
        const sizeVal = vars.size ?? 20;
        const totalElements = filtered.length;
        const totalPages = Math.ceil(totalElements / sizeVal);
        const slice = filtered.slice(
          pageIdx * sizeVal,
          (pageIdx + 1) * sizeVal,
        );
        const hasNext = pageIdx + 1 < totalPages;

        res.end(
          JSON.stringify({
            data: {
              networkTransactionPage: {
                content: slice,
                page: pageIdx,
                size: sizeVal,
                totalElements,
                totalPages,
                hasNext,
              },
            },
          }),
        );
        return;
      }

      if (query.includes("OperatorStations")) {
        res.end(
          JSON.stringify({
            data: {
              stations: [
                { id: "CP-1", name: "Colombo Central", status: "ONLINE" },
                { id: "CP-2", name: "Kandy Depot", status: "OFFLINE" },
              ],
            },
          }),
        );
        return;
      }

      if (query.includes("OperatorStation(")) {
        res.end(
          JSON.stringify({
            data: {
              station: {
                id: vars.id ?? "CP-1",
                name: "Colombo Central",
                status: "ONLINE",
              },
              stationConnectors: [],
              stationTransactions: [allRecords[0].transaction],
            },
          }),
        );
        return;
      }

      if (query.includes("OperatorTransaction(")) {
        state.transactionDetailLookups += 1;
        res.end(
          JSON.stringify({
            data: {
              transaction: allRecords[2].transaction,
            },
          }),
        );
        return;
      }

      if (query.includes("OperatorTransactionData")) {
        res.end(
          JSON.stringify({
            data: {
              transactionCompleteness: allRecords[2].completeness,
              transactionMeterSamples: [],
            },
          }),
        );
        return;
      }

      res.end(JSON.stringify({ data: {} }));
    });
  });

  const apiPort = await getFreePort();
  const appPort = await getFreePort();
  await new Promise<void>((resolve) =>
    apiServer.listen(apiPort, "127.0.0.1", resolve),
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
        if ((await fetch(`${origin}/sessions`)).ok) break;
      } catch {
        // wait
      }
      await new Promise((r) => setTimeout(r, 250));
    }

    await page.setViewportSize({ width: 1280, height: 800 });

    const paginationNav = page.getByRole("navigation", {
      name: "Charging sessions pagination",
    });

    // 1. Populated directory, separated lifecycle vs completeness, no per-row detail N+1 queries
    await page.goto(`${origin}/sessions?size=2`);
    expect(state.transactionDetailLookups).toBe(0);
    await expect(
      page.getByRole("heading", { name: "Charging sessions", exact: true }),
    ).toBeVisible();
    await expect(
      paginationNav.getByText("Showing 1–2 of 5 sessions"),
    ).toBeVisible();
    await expect(paginationNav.getByText("Page 1 of 3")).toBeVisible();
    await expect(page.getByText("Missing #2, #4").first()).toBeVisible();
    await expect(page.getByText("Receiving events").first()).toBeVisible();

    // 2. Current-page-only toggle excludes ended row without altering server totals
    await page.getByRole("button", { name: "Active on page" }).click();
    await expect(page.getByText("TX-INCOMPLETE-1")).toHaveCount(0);
    await expect(
      page.getByText("TX-ACTIVE-LONG-SESSION-2026-ALPHA-0001").first(),
    ).toBeVisible();
    await expect(paginationNav.getByText("Page 1 of 3")).toBeVisible();
    await expect(
      paginationNav.getByText("Showing 1–2 of 5 sessions"),
    ).toBeVisible();
    await page.getByRole("button", { name: "All on page" }).click();

    // 3. Server pagination across Page 2 and Final Page 3
    await page.getByRole("link", { name: "Next page →" }).click();
    await expect(page).toHaveURL(`${origin}/sessions?page=1&size=2`);
    await expect(paginationNav.getByText("Page 2 of 3")).toBeVisible();
    await expect(
      paginationNav.getByText("Showing 3–4 of 5 sessions"),
    ).toBeVisible();
    // Composite identity: identical TX-SHARED rendered cleanly for BOTH CP-1 and CP-UNLISTED
    await expect(
      page.locator('a[href^="/stations/CP-1/sessions/TX-SHARED"]').first(),
    ).toBeVisible();
    await expect(
      page
        .locator('a[href^="/stations/CP-UNLISTED/sessions/TX-SHARED"]')
        .first(),
    ).toBeVisible();

    // Refresh preserves pagination & size
    await page.getByRole("button", { name: "Refresh data" }).click();
    await expect(page).toHaveURL(`${origin}/sessions?page=1&size=2`);

    // Open session detail from Page 2 & return via preserved returnTo
    await page
      .getByRole("link", { name: "Open session TX-SHARED at CP-1" })
      .click();
    await expect(page).toHaveURL(
      `${origin}/stations/CP-1/sessions/TX-SHARED?returnTo=%2Fsessions%3Fpage%3D1%26size%3D2`,
    );
    await page.getByRole("link", { name: "← Back to Charging sessions" }).first().click();
    await expect(page).toHaveURL(`${origin}/sessions?page=1&size=2`);

    // Final page disables Next link
    await page.getByRole("link", { name: "Next page →" }).click();
    await expect(page).toHaveURL(`${origin}/sessions?page=2&size=2`);
    await expect(paginationNav.getByText("Page 3 of 3")).toBeVisible();
    await expect(
      paginationNav.getByText("Showing 5–5 of 5 sessions"),
    ).toBeVisible();
    await expect(page.getByText("Next page →")).toHaveAttribute(
      "aria-disabled",
      "true",
    );

    // 4. Out-of-range page redirects cleanly to clamped last page; malformed params normalize safely
    await page.goto(`${origin}/sessions?page=99&size=2`);
    await expect(page).toHaveURL(`${origin}/sessions?page=2&size=2`);

    await page.goto(`${origin}/sessions?page=-2&size=999&integrityStatus=BOGUS`);
    await expect(paginationNav.getByText("Page 1 of 1")).toBeVisible();

    // 5. Case-preserving exact filter + page reset from page=2
    await page.goto(`${origin}/sessions?page=1&size=2`);
    await page
      .getByLabel("Station identifier", { exact: true })
      .fill("cp-MixedCase");
    await page
      .getByLabel("Session identifier", { exact: true })
      .fill("tx-CasePreserved-9");
    await page
      .getByLabel("Data completeness", { exact: true })
      .selectOption("COMPLETE");
    await page.getByRole("button", { name: "Apply filters" }).click();
    await expect(page).toHaveURL(
      `${origin}/sessions?stationId=cp-MixedCase&transactionId=tx-CasePreserved-9&integrityStatus=COMPLETE&size=2`,
    );
    expect(state.lastPageVariables?.stationId).toBe("cp-MixedCase");
    expect(state.lastPageVariables?.transactionId).toBe("tx-CasePreserved-9");
    expect(state.lastPageVariables?.integrityStatus).toBe("COMPLETE");
    expect(state.lastPageVariables?.page).toBe(0);
    await expect(page.getByText("tx-CasePreserved-9").first()).toBeVisible();

    // 6. Legacy /transactions redirect preserves parameters & drops unknown params
    await page.goto(
      `${origin}/transactions?station=CP-2&q=TX-INCOMPLETE-1&integrity=INCOMPLETE&page=0&size=10&evil=https%3A%2F%2Fevil.example`,
    );
    await expect(page).toHaveURL(
      `${origin}/sessions?stationId=CP-2&transactionId=TX-INCOMPLETE-1&integrityStatus=INCOMPLETE&size=10`,
    );
    await expect(page.getByText("Kandy Depot").first()).toBeVisible();

    // 7. Station Detail contextual Sessions link targets /sessions?stationId=CP-1
    await page.goto(`${origin}/stations/CP-1?section=sessions`);
    await expect(
      page.getByRole("link", { name: "Inspect in Charging sessions →" }),
    ).toHaveAttribute("href", "/sessions?stationId=CP-1");

    // 8. Open-redirect protection on session detail returnTo
    await page.goto(
      `${origin}/stations/CP-1/transactions/TX-SHARED?returnTo=https://evil.example`,
    );
    await expect(page).toHaveURL(
      `${origin}/stations/CP-1/sessions/TX-SHARED`,
    );
    await expect(page.locator('a[href*="evil.example"]')).toHaveCount(0);
    await expect(
      page.getByRole("link", { name: "← Back to CP-1" }).first(),
    ).toHaveAttribute("href", "/stations/CP-1");

    // 9. No-matches filtered state vs Empty history vs Partial summary failure vs Unavailable retry
    await page.goto(`${origin}/sessions?stationId=DOES-NOT-EXIST`);
    await expect(
      page.getByRole("heading", {
        name: "No charging sessions match the selected filters",
      }),
    ).toBeVisible();
    await page.getByRole("link", { name: "Clear filters" }).first().click();
    await expect(page).toHaveURL(`${origin}/sessions`);

    state.scenario = "summary-fail";
    await page.goto(`${origin}/sessions`);
    await expect(
      page.getByText("TX-ACTIVE-LONG-SESSION-2026-ALPHA-0001").first(),
    ).toBeVisible();
    await expect(page.getByText("Unknown").first()).toBeVisible();

    state.scenario = "empty";
    await page.goto(`${origin}/sessions`);
    await expect(
      page.getByRole("heading", { name: "No charging sessions recorded" }),
    ).toBeVisible();

    state.scenario = "malformed";
    await page.goto(`${origin}/sessions`);
    await expect(
      page.getByRole("heading", { name: "Unable to load charging sessions" }),
    ).toBeVisible();

    state.scenario = "api-fail";
    await page.goto(`${origin}/sessions`);
    await expect(
      page.getByRole("heading", { name: "Unable to load charging sessions" }),
    ).toBeVisible();
    await expect(page.locator("main")).not.toContainText("secret://hidden");

    state.scenario = "live";
    await page.getByRole("button", { name: "Try again" }).click();
    await expect(
      page.getByText("TX-ACTIVE-LONG-SESSION-2026-ALPHA-0001").first(),
    ).toBeVisible();
  } finally {
    nextProc.kill("SIGTERM");
    apiServer.close();
  }
});
