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
