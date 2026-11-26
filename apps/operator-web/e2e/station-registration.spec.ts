import { createServer } from "node:http";
import { spawn } from "node:child_process";
import net from "node:net";
import { expect, test } from "@playwright/test";
import { signIn } from "./sign-in";
import { respondToOrganizationAccess } from "./organization-fixture";

const VIEWPORTS = [
  [1440, 900],
  [1280, 800],
  [1024, 768],
  [768, 1024],
  [390, 844],
  [375, 812],
  [320, 568],
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

test("registration adapts cleanly across all 7 viewports, 200% zoom, reduced motion, validation, and filtered return paths", async ({
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
    await page.goto("/stations/new");

    await expect(page.locator("main#main-content")).toHaveCount(1);
    await expect(
      page.getByRole("heading", { name: "Add charging station" }),
    ).toBeVisible();
    await expect(page.getByLabel("Station name", { exact: true })).toBeVisible();
    await expect(
      page.getByLabel("Station identifier", { exact: true }),
    ).toBeVisible();

    const noOverflow = await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    );
    expect(noOverflow).toBe(true);

    const backBox = await page
      .getByRole("link", { name: "← Back to charging stations" })
      .boundingBox();
    expect(backBox).not.toBeNull();
    expect(backBox!.height).toBeGreaterThanOrEqual(44);

    const submitBox = await page
      .getByRole("button", { name: "Register station", exact: true })
      .boundingBox();
    expect(submitBox).not.toBeNull();
    expect(submitBox!.height).toBeGreaterThanOrEqual(44);
  }

  for (const [width, height] of [
    [1440, 900],
    [390, 844],
  ] as const) {
    await page.setViewportSize({ width, height });
    await page.goto("/stations/new");
    await page.evaluate(() => {
      document.documentElement.style.fontSize = "200%";
    });

    const zoomMetrics = await page.evaluate(() => {
      const noHorizontalOverflow =
        document.documentElement.scrollWidth <= window.innerWidth;
      const sections = Array.from(document.querySelectorAll("main section"));
      const sectionsOk = sections.every(
        (el) => el.scrollWidth <= el.clientWidth + 1,
      );
      return { noHorizontalOverflow, sectionsOk };
    });
    expect(zoomMetrics.noHorizontalOverflow).toBe(true);
    expect(zoomMetrics.sectionsOk).toBe(true);
  }

  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.setViewportSize({ width: 1280, height: 800 });

  // Return context preservation from filtered directory and open-redirect hardening
  await page.goto("/stations?status=OFFLINE&q=Kandy");
  await page.getByRole("link", { name: "Add station" }).click();
  await expect(page).toHaveURL(
    /\/stations\/new\?returnTo=%2Fstations%3Fq%3DKandy%26status%3DOFFLINE/,
  );
  await expect(
    page.getByRole("link", { name: "← Back to charging stations" }),
  ).toHaveAttribute("href", "/stations?q=Kandy&status=OFFLINE");

  await page.goto("/stations/new?returnTo=https://evil.example");
  await expect(
    page.getByRole("link", { name: "← Back to charging stations" }),
  ).toHaveAttribute("href", "/stations");

  // Client-side accessible validation: empty form -> focus first invalid field
  const nameInput = page.getByLabel("Station name", { exact: true });
  const idInput = page.getByLabel("Station identifier", { exact: true });
  const submitButton = page.getByRole("button", {
    name: "Register station",
    exact: true,
  });

  await submitButton.click();
  await expect(nameInput).toBeFocused();
  await expect(nameInput).toHaveAttribute("aria-invalid", "true");
  await expect(idInput).toHaveAttribute("aria-invalid", "true");
  await expect(
    page.getByText("Enter a station name (1–255 characters)."),
  ).toBeVisible();
  await expect(
    page.getByText("Enter a station identifier (1–255 characters)."),
  ).toBeVisible();

  // Whitespace-only input & invalid identifier retain operator input and focus identifier
  await nameInput.fill("   Valid Station Name   ");
  await idInput.fill("../bad-id");
  await submitButton.click();
  await expect(idInput).toBeFocused();
  await expect(nameInput).toHaveValue("   Valid Station Name   ");
  await expect(idInput).toHaveValue("../bad-id");
  await expect(
    page
      .locator("#station-registration-id-error")
      .getByText(/Use letters, numbers, dots, underscores, colons, or hyphens/),
  ).toBeVisible();

  // >255 chars are not silently truncated and surface length validation errors
  const overLimitName = "N".repeat(256);
  const overLimitId = `A${"b".repeat(255)}`;
  await nameInput.fill(overLimitName);
  await idInput.fill(overLimitId);
  await expect(nameInput).toHaveValue(overLimitName);
  await expect(idInput).toHaveValue(overLimitId);
  await submitButton.click();
  await expect(
    page.getByText("Station name must be 255 characters or fewer."),
  ).toBeVisible();
  await expect(
    page.getByText("Station identifier must be 255 characters or fewer."),
  ).toBeVisible();

  // Keyboard navigation across form fields and back link
  await nameInput.fill("Colombo Keyboard Test");
  await idInput.fill("cp-kb-01");
  await idInput.focus();
  await page.keyboard.press("Tab");
  await expect(submitButton).toBeFocused();

  expect(consoleErrors).toEqual([]);
  expect(pageErrors).toEqual([]);
});

test("registration covers pending protection, confirmed guidance, duplicate, failure, uncertain lookup, and read-only enforcement", async ({
  page,
}) => {
  type MutationMode =
    | "delayed-success"
    | "duplicate"
    | "failure-secret"
    | "http-502"
    | "malformed";
  type LookupMode = "found" | "not-found" | "unavailable";

  let mutationMode: MutationMode = "delayed-success";
  let lookupMode: LookupMode = "not-found";
  let mutationCount = 0;
  let lookupCount = 0;
  let lastMutationVariables: { id: string; name: string } | null = null;
  const createdStations = new Map<
    string,
    { id: string; name: string; status: "ONLINE" | "OFFLINE" }
  >([
    [
      "DUP-CP-1",
      { id: "DUP-CP-1", name: "Existing Depot", status: "ONLINE" },
    ],
  ]);

  const apiServer = createServer((req, res) => {
    if (respondToOrganizationAccess(req, res)) return;
    const chunks: Buffer[] = [];
    req.on("data", (chunk: Buffer) => chunks.push(chunk));
    req.on("end", async () => {
      const payload = JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}") as {
        query?: string;
        variables?: { input?: { id: string; name: string }; id?: string };
      };
      const query = payload.query ?? "";
      res.setHeader("Content-Type", "application/json");

      if (query.includes("OperatorRegister")) {
        mutationCount += 1;
        const input = payload.variables?.input;
        lastMutationVariables = input ?? null;

        if (mutationMode === "delayed-success") {
          await new Promise((resolve) => setTimeout(resolve, 650));
          const station = {
            id: input!.id,
            name: input!.name,
            status: "OFFLINE" as const,
          };
          createdStations.set(station.id, station);
          res.end(JSON.stringify({ data: { registerStation: station } }));
          return;
        }

        if (mutationMode === "duplicate") {
          res.end(
            JSON.stringify({
              errors: [{ message: `Station already exists: ${input!.id}` }],
            }),
          );
          return;
        }

        if (mutationMode === "failure-secret") {
          res.end(
            JSON.stringify({
              errors: [
                { message: "postgres://secret-user:secret-pass@internal-db/fail" },
              ],
            }),
          );
          return;
        }

        if (mutationMode === "http-502") {
          res.statusCode = 502;
          res.end("Bad Gateway");
          return;
        }

        if (mutationMode === "malformed") {
          res.end(
            JSON.stringify({
              data: {
                registerStation: {
                  id: "UNEXPECTED-ID",
                  name: "Broken",
                  status: "OFFLINE",
                },
              },
            }),
          );
          return;
        }
      }

      if (query.includes("OperatorStation(")) {
        lookupCount += 1;
        const id = payload.variables?.id ?? "";
        if (lookupMode === "unavailable") {
          res.statusCode = 503;
          res.end("Service Unavailable");
          return;
        }
        if (lookupMode === "found") {
          const found = createdStations.get(id) ?? {
            id,
            name: "Recovered Station",
            status: "OFFLINE" as const,
          };
          res.end(
            JSON.stringify({
              data: {
                station: found,
                stationConnectors: [],
                stationTransactions: [],
              },
            }),
          );
          return;
        }
        res.end(
          JSON.stringify({
            data: {
              station: null,
              stationConnectors: [],
              stationTransactions: [],
            },
          }),
        );
        return;
      }

      if (query.includes("OperatorStations")) {
        res.end(
          JSON.stringify({
            data: { stations: Array.from(createdStations.values()) },
          }),
        );
        return;
      }

      res.end(JSON.stringify({ data: {} }));
    });
  });

  const apiPort = await getFreePort();
  const writableAppPort = 4313;
  const readOnlyAppPort = 4314;
  await new Promise<void>((resolve) =>
    apiServer.listen(apiPort, "127.0.0.1", resolve),
  );

  const writableApp = spawn(
    "node",
    [
      "node_modules/next/dist/bin/next",
      "start",
      "--hostname",
      "127.0.0.1",
      "--port",
      String(writableAppPort),
    ],
    {
      cwd: process.cwd(),
      env: {
        ...process.env,
        OPERATOR_WEB_ORIGIN: `http://127.0.0.1:${writableAppPort}`,
        OIDC_LOCAL_HTTP: "true",
        OPERATOR_LOCAL_WRITES: "true",
        STATION_GRAPHQL_URL: `http://127.0.0.1:${apiPort}/graphql`,
        OPERATIONS_GRAPHQL_URL: `http://127.0.0.1:${apiPort}/graphql`,
      },
      stdio: "ignore",
    },
  );

  const readOnlyApp = spawn(
    "node",
    [
      "node_modules/next/dist/bin/next",
      "start",
      "--hostname",
      "127.0.0.1",
      "--port",
      String(readOnlyAppPort),
    ],
    {
      cwd: process.cwd(),
      env: {
        ...process.env,
        OPERATOR_WEB_ORIGIN: `http://127.0.0.1:${readOnlyAppPort}`,
        OIDC_LOCAL_HTTP: "true",
        OPERATOR_LOCAL_WRITES: "false",
        STATION_GRAPHQL_URL: `http://127.0.0.1:${apiPort}/graphql`,
        OPERATIONS_GRAPHQL_URL: `http://127.0.0.1:${apiPort}/graphql`,
      },
      stdio: "ignore",
    },
  );

  const writableOrigin = `http://127.0.0.1:${writableAppPort}`;
  const readOnlyOrigin = `http://127.0.0.1:${readOnlyAppPort}`;

  try {
    for (const origin of [writableOrigin, readOnlyOrigin]) {
      for (let i = 0; i < 40; i++) {
        try {
          if ((await fetch(`${origin}/stations/new`)).ok) break;
        } catch {
          // wait
        }
        await new Promise((r) => setTimeout(r, 250));
      }
    }

    await signIn(page, writableOrigin);
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto(`${writableOrigin}/stations/new`);

    // 1. Trimmed case-sensitive input, pending double-submit prevention, and confirmed success with shared OCPP guidance
    await page
      .getByLabel("Station name", { exact: true })
      .fill("  Colombo Harbour  ");
    await page
      .getByLabel("Station identifier", { exact: true })
      .fill("  cp-Alpha:01  ");

    const submitBtn = page.getByRole("button", {
      name: "Register station",
      exact: true,
    });
    await submitBtn.click();

    const pendingBtn = page.getByRole("button", {
      name: "Registering station...",
    });
    await expect(pendingBtn).toBeVisible();
    await expect(pendingBtn).toBeDisabled();
    // Attempt duplicate activation while disabled
    await pendingBtn.click({ force: true });

    await expect(
      page.getByRole("heading", { name: "Station registered" }),
    ).toBeVisible();
    expect(mutationCount).toBe(1);
    expect(lastMutationVariables).toEqual({
      id: "cp-Alpha:01",
      name: "Colombo Harbour",
    });

    await expect(page.getByText("Offline", { exact: true })).toBeVisible();
    await expect(page.getByText("Colombo Harbour")).toBeVisible();
    await expect(page.getByText("/ocpp/cp-Alpha:01")).toBeVisible();
    await expect(page.getByText(/ocpp2\.0\.1/)).toBeVisible();
    await expect(
      page.getByRole("button", { name: /Copy OCPP path/ }),
    ).toBeVisible();
    await expect(
      page.getByRole("link", { name: "Inspect station details" }),
    ).toHaveAttribute("href", "/stations/cp-Alpha%3A01");
    await expect(
      page.getByRole("link", { name: "Connection details" }),
    ).toHaveAttribute("href", "/stations/cp-Alpha%3A01?section=connection");

    // "Register another station" resets cleanly and focuses Station name
    await page
      .getByRole("button", { name: "Register another station" })
      .click();
    await expect(page.getByLabel("Station name", { exact: true })).toBeFocused();
    await expect(page.getByLabel("Station name", { exact: true })).toHaveValue(
      "",
    );
    await expect(
      page.getByLabel("Station identifier", { exact: true }),
    ).toHaveValue("");

    // 2. Duplicate identifier gives actionable link and keeps operator input
    mutationMode = "duplicate";
    await page.getByLabel("Station name", { exact: true }).fill("New Depot");
    await page
      .getByLabel("Station identifier", { exact: true })
      .fill("DUP-CP-1");
    await page
      .getByRole("button", { name: "Register station", exact: true })
      .click();
    await expect(
      page.getByRole("alert").filter({ hasText: "Station identifier already exists" }),
    ).toBeVisible();
    await expect(
      page.getByRole("link", { name: "Inspect existing station DUP-CP-1" }),
    ).toHaveAttribute("href", "/stations/DUP-CP-1");
    await expect(page.getByLabel("Station name", { exact: true })).toHaveValue(
      "New Depot",
    );

    // 3. Confirmed backend failure sanitizes secrets
    mutationMode = "failure-secret";
    await page.getByLabel("Station identifier", { exact: true }).fill("CP-FAIL-1");
    await page
      .getByRole("button", { name: "Register station", exact: true })
      .click();
    const failAlert = page
      .getByRole("alert")
      .filter({ hasText: "Registration failed" });
    await expect(failAlert).toBeVisible();
    await expect(failAlert).not.toContainText("secret");
    await expect(failAlert).not.toContainText("postgres");

    // 4. Uncertain outcome (HTTP 502) never auto-retries and offers read-only lookup
    mutationMode = "http-502";
    const beforeUncertainCount = mutationCount;
    await page.getByLabel("Station identifier", { exact: true }).fill("CP-UNCERTAIN");
    await page
      .getByRole("button", { name: "Register station", exact: true })
      .click();
    await expect(
      page
        .getByRole("alert")
        .filter({ hasText: "Registration could not be confirmed" }),
    ).toBeVisible();
    expect(mutationCount).toBe(beforeUncertainCount + 1);

    // Verify read-only check transitions cleanly through unavailable -> not-found -> found without mutating
    lookupMode = "unavailable";
    await page.getByRole("button", { name: "Check station record" }).click();
    await expect(
      page.getByRole("alert").filter({ hasText: "Unable to verify station record" }),
    ).toBeVisible();
    expect(mutationCount).toBe(beforeUncertainCount + 1);
    expect(lookupCount).toBe(1);

    lookupMode = "not-found";
    await page.getByRole("button", { name: "Check station record" }).click();
    await expect(
      page.getByRole("status").filter({ hasText: "No station record found" }),
    ).toBeVisible();
    expect(mutationCount).toBe(beforeUncertainCount + 1);

    lookupMode = "found";
    await page.getByRole("button", { name: "Check station record" }).click();
    await expect(
      page.getByRole("status").filter({ hasText: "Existing station record found" }),
    ).toBeVisible();
    await expect(
      page.getByRole("link", { name: "Inspect station CP-UNCERTAIN" }),
    ).toHaveAttribute("href", "/stations/CP-UNCERTAIN");
    expect(mutationCount).toBe(beforeUncertainCount + 1);

    // 5. Malformed GraphQL response also classifies as uncertain without retrying
    mutationMode = "malformed";
    await page.getByLabel("Station identifier", { exact: true }).fill("CP-MALFORMED");
    await page
      .getByRole("button", { name: "Register station", exact: true })
      .click();
    await expect(
      page
        .getByRole("alert")
        .filter({ hasText: "Registration could not be confirmed" }),
    ).toBeVisible();
    expect(mutationCount).toBe(beforeUncertainCount + 2);

    // 6. Read-only restricted mode renders no executable form and never calls GraphQL mutation
    const mutationsBeforeReadOnly = mutationCount;
    await signIn(page, readOnlyOrigin);
    await page.goto(`${readOnlyOrigin}/stations/new`);
    await expect(
      page.getByRole("heading", { name: "Read-only console" }),
    ).toBeVisible();
    await expect(page.locator("main form")).toHaveCount(0);
    await expect(page.getByLabel("Station name")).toHaveCount(0);
    await expect(page.getByLabel("Station identifier")).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Register station" })).toHaveCount(0);
    await expect(
      page.getByRole("link", { name: "Return to charging stations" }),
    ).toHaveAttribute("href", "/stations");
    expect(mutationCount).toBe(mutationsBeforeReadOnly);
  } finally {
    writableApp.kill("SIGTERM");
    readOnlyApp.kill("SIGTERM");
    apiServer.close();
  }
});
