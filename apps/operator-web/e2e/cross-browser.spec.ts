import { expect, test } from "@playwright/test";

const VIEWPORT_MATRIX = [
  [320, 568],
  [390, 844],
  [430, 932],
  [768, 1024],
  [1024, 768],
  [1280, 800],
  [1440, 900],
  [1920, 1080],
] as const;

const ALL_SIX_ROUTES = [
  ["/", "Overview"],
  ["/stations", "Charging stations"],
  ["/sessions", "Charging sessions"],
  ["/attention", "Needs attention"],
  ["/diagnostics", "Diagnostics"],
  ["/help", "Help"],
] as const;

test("cross-browser responsive matrix across all 8 viewports, navigation modes, and core controls", async ({
  page,
}, testInfo) => {
  test.setTimeout(120_000);
  const consoleErrors: string[] = [];
  const pageErrors: string[] = [];

  page.on("console", (msg) => {
    if (msg.type() === "error") consoleErrors.push(msg.text());
  });
  page.on("pageerror", (err) => {
    pageErrors.push(err.message);
  });

  // Verify expanded, compact, and mobile navigation + zero horizontal overflow across all 8 viewports
  for (const [width, height] of VIEWPORT_MATRIX) {
    await page.setViewportSize({ width, height });

    for (const [route, heading] of ALL_SIX_ROUTES) {
      await page.goto(route, { waitUntil: "networkidle" });
      await expect(page.locator("main h1")).toHaveText(heading);
      await expect(page.locator("main#main-content")).toHaveCount(1);
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= window.innerWidth,
        ),
      ).toBe(true);
    }

    await page.goto("/stations/CP-1", { waitUntil: "networkidle" });
    await expect(page.locator("main h1")).toHaveText("Colombo Central");
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true);

    await page.goto("/stations/CP-1/sessions/TX-1?section=measurements", { waitUntil: "networkidle" });
    await expect(page.locator("main h1")).toContainText("TX-1");
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true);

    if (width < 768) {
      await page.goto("/", { waitUntil: "networkidle" });
      const menuBtn = page.getByRole("button", { name: /Menu/i });
      await expect(menuBtn).toBeVisible();
      await menuBtn.click();
      await expect(
        page.getByRole("dialog", { name: "Site navigation" }),
      ).toBeVisible();
      await page.keyboard.press("Escape");
      await expect(menuBtn).toBeFocused();
    } else if (width < 1280) {
      await page.goto("/", { waitUntil: "networkidle" });
      await expect(
        page.locator('aside[aria-label="Workspace sidebar"]'),
      ).toHaveAttribute("data-collapsed", "true");
    } else {
      await page.goto("/", { waitUntil: "networkidle" });
      await expect(
        page.locator('aside[aria-label="Workspace sidebar"]'),
      ).toHaveAttribute("data-collapsed", "false");
    }
  }

  // Verify native controls: registration form, native selects, Help disclosures, and 200% zoom
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto("/stations/new", { waitUntil: "networkidle" });
  const longId = `CP-${testInfo.project.name.toUpperCase()}-` + "X".repeat(60);
  await page.getByLabel("Station name", { exact: true }).fill("Long Cross Browser Station " + "Hub ".repeat(6));
  await page.getByLabel("Station identifier", { exact: true }).fill(longId);
  await page.getByRole("button", { name: "Register station", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Station registered" })).toBeVisible();
  await page.waitForLoadState("networkidle");
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);

  await page.goto("/diagnostics", { waitUntil: "networkidle" });
  await page.getByLabel("Projected status").selectOption("OFFLINE");
  await page.getByRole("button", { name: "Apply filters" }).click();
  await expect(page).toHaveURL(/\/diagnostics\?status=OFFLINE$/);
  await page.waitForLoadState("networkidle");

  await page.goto("/help", { waitUntil: "networkidle" });
  const summary = page
    .locator("summary", { hasText: "Station remains offline after registration" })
    .first();
  await summary.focus();
  await page.keyboard.press("Enter");
  await expect(
    page.getByRole("link", { name: "Inspect offline stations →" }),
  ).toBeVisible();

  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/sessions", { waitUntil: "networkidle" });
  await page.evaluate(() => {
    document.documentElement.style.fontSize = "200%";
  });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);

  expect(consoleErrors).toEqual([]);
  expect(pageErrors).toEqual([]);
});
