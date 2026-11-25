import { test, expect } from "@playwright/test";

test("desktop sidebar displays approved hierarchy, active states, and collapse toggle", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/");

  const sidebar = page.getByLabel("Workspace sidebar");
  await expect(sidebar).toBeVisible();
  const expandedBox = await sidebar.boundingBox();
  expect(expandedBox).not.toBeNull();
  expect(Math.round(expandedBox!.width)).toBe(240);

  const nav = sidebar.getByRole("navigation", { name: "Primary navigation" });
  await expect(nav.getByRole("link", { name: "Overview", exact: true })).toHaveAttribute("aria-current", "page");
  await expect(nav.getByRole("link", { name: "Charging sessions", exact: true })).toBeVisible();
  await expect(nav.getByRole("link", { name: "Diagnostics", exact: true })).toBeVisible();

  await expect(nav.getByRole("link", { name: "Charging stations" })).toHaveCount(0);
  await expect(nav.getByRole("link", { name: "Needs attention" })).toHaveCount(0);
  await expect(nav.getByRole("link", { name: "Help" })).toHaveCount(0);

  const toggleBtn = sidebar.getByRole("button", { name: "Collapse sidebar" });
  await expect(toggleBtn).toHaveAttribute("aria-expanded", "true");
  await toggleBtn.click();

  await expect(sidebar).toHaveAttribute("data-collapsed", "true");
  await expect(sidebar.getByRole("button", { name: "Expand sidebar" })).toHaveAttribute("aria-expanded", "false");
  await expect.poll(async () => Math.round((await sidebar.boundingBox())!.width)).toBe(72);

  await sidebar.getByRole("button", { name: "Expand sidebar" }).click();
  await expect(sidebar).toHaveAttribute("data-collapsed", "false");
  await expect.poll(async () => Math.round((await sidebar.boundingBox())!.width)).toBe(240);

  await page.goto("/stations/CP-1/transactions/TX-1");
  await expect(nav.getByRole("link", { name: "Charging sessions", exact: true })).toHaveAttribute("aria-current", "page");

  await page.goto("/operations");
  await expect(nav.getByRole("link", { name: "Diagnostics", exact: true })).toHaveAttribute("aria-current", "page");
});

test("tablet viewport uses compact 72px sidebar with accessible labels and no overflow", async ({ page }) => {
  for (const viewport of [{ width: 768, height: 1024 }, { width: 1024, height: 768 }]) {
    await page.setViewportSize(viewport);
    await page.goto("/");

    const sidebar = page.getByLabel("Workspace sidebar");
    await expect(sidebar).toBeVisible();
    await expect(sidebar).toHaveAttribute("data-collapsed", "true");
    const box = await sidebar.boundingBox();
    expect(Math.round(box!.width)).toBe(72);

    const nav = sidebar.getByRole("navigation", { name: "Primary navigation" });
    await expect(nav.getByRole("link", { name: "Overview" })).toHaveAttribute("aria-current", "page");
    await expect(nav.getByRole("link", { name: "Charging sessions" })).toBeVisible();
    await expect(nav.getByRole("link", { name: "Diagnostics" })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  }
});

test("mobile navigation drawer opens, traps focus, locks scroll, closes on Escape/navigation, and restores focus", async ({ page }) => {
  for (const viewport of [{ width: 320, height: 568 }, { width: 390, height: 844 }]) {
    await page.setViewportSize(viewport);
    await page.goto("/");
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);

    const menuButton = page.getByRole("button", { name: /Open navigation Menu/i });
    const menuBox = await menuButton.boundingBox();
    expect(menuBox!.height).toBeGreaterThanOrEqual(44);

    await menuButton.click();

    const dialog = page.getByRole("dialog", { name: "Site navigation" });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole("button", { name: "Close navigation menu" })).toBeFocused();
    expect(await page.evaluate(() => document.body.style.overflow)).toBe("hidden");

    // Shift+Tab from close button moves to logo link (first focusable), then wraps to Diagnostics (last focusable)
    await page.keyboard.press("Shift+Tab");
    await expect(dialog.getByRole("link", { name: "VoltGrid overview" })).toBeFocused();
    await page.keyboard.press("Shift+Tab");
    await expect(dialog.getByRole("link", { name: "Diagnostics" })).toBeFocused();

    // Tab from last focusable link wraps back to first focusable control inside dialog
    await page.keyboard.press("Tab");
    await expect(dialog.getByRole("link", { name: "VoltGrid overview" })).toBeFocused();

    // Escape closes drawer, unlocks scroll, and restores focus to Menu trigger
    await page.keyboard.press("Escape");
    await expect(dialog).toBeHidden();
    await expect(menuButton).toBeFocused();
    expect(await page.evaluate(() => document.body.style.overflow)).toBe("");

    // Clicking a destination navigates and closes drawer automatically
    await menuButton.click();
    await expect(dialog).toBeVisible();
    await dialog.getByRole("link", { name: "Charging sessions" }).click();
    await expect(page).toHaveURL(/\/transactions/);
    await expect(dialog).toBeHidden();
    expect(await page.evaluate(() => document.body.style.overflow)).toBe("");
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  }
});

test("contextual top bar displays accurate breadcrumbs and refresh preserves URL filters", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });

  await page.goto("/stations/CP%251");
  const breadcrumb = page.getByRole("navigation", { name: "Breadcrumb" });
  await expect(breadcrumb.getByRole("link", { name: "Overview" })).toHaveAttribute("href", "/");
  await expect(breadcrumb.getByText("Stations", { exact: true })).toBeVisible();
  await expect(breadcrumb.getByText("CP%1", { exact: true })).toHaveAttribute("aria-current", "page");

  await page.goto("/stations/CP%251/transactions/TX%251");
  await expect(breadcrumb.getByRole("link", { name: "Charging sessions" })).toHaveAttribute("href", "/transactions");
  await expect(breadcrumb.getByRole("link", { name: "CP%1" })).toHaveAttribute("href", "/stations/CP%251");
  await expect(breadcrumb.getByText("TX%1", { exact: true })).toHaveAttribute("aria-current", "page");

  await page.goto("/operations?status=OFFLINE");
  await expect(breadcrumb.getByText("Diagnostics", { exact: true })).toHaveAttribute("aria-current", "page");
  await page.getByRole("button", { name: "Refresh data" }).click();
  await expect(page).toHaveURL(/\/operations\?status=OFFLINE/);
  await expect(page.getByRole("cell", { name: "OFFLINE", exact: true })).toBeVisible();
});
