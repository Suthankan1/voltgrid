import { expect, test } from "@playwright/test";
import { signIn } from "./sign-in";

test.use({ storageState: { cookies: [], origins: [] } });

test("operator responses stay private and browser state contains an opaque handle", async ({
  browser, page, baseURL,
}) => {
  const origin = baseURL!;
  const callbackResponse = page.waitForResponse(response =>
    response.url().startsWith(origin + "/api/auth/callback?"),
  );
  await signIn(page, origin);

  const callback = await callbackResponse;
  const sessionCookie = (await callback.headerValues("set-cookie"))
    .find(value => value.startsWith("voltgrid_session=")) ?? "";
  expect(sessionCookie).toMatch(/^voltgrid_session=[\w-]{43};/);
  expect(sessionCookie).toMatch(/; Path=\//i);
  expect(sessionCookie).toMatch(/; HttpOnly/i);
  expect(sessionCookie).toMatch(/; SameSite=Lax/i);
  expect(sessionCookie).toMatch(/; Max-Age=28800/i);
  expect(sessionCookie).not.toMatch(/; Domain=/i);
  expect(await callback.headerValue("cache-control")).toBe("private, no-store");

  for (const path of ["/api/auth/session", "/stations"]) {
    const response = await page.request.get(path);
    expect(response.ok()).toBe(true);
    const cache = response.headers()["cache-control"];
    expect(cache).toContain("private");
    expect(cache).toContain("no-store");
    expect(await response.text()).not.toMatch(/eyJ[\w-]+\.[\w-]+\.[\w-]+/);
  }

  const stored = await page.evaluate(() => ({
    cookie: document.cookie,
    local: Object.values(localStorage),
    session: Object.values(sessionStorage),
  }));
  expect(stored.cookie).not.toContain("voltgrid_session");
  expect([...stored.local, ...stored.session].join(" ")).not.toMatch(/eyJ[\w-]+\.[\w-]+\.[\w-]+/);

  const anonymous = await browser.newContext({ baseURL: origin });
  try {
    const response = await anonymous.request.get("/api/auth/session");
    expect(response.headers()["cache-control"]).toBe("private, no-store");
    expect(await response.json()).toEqual({ authenticated: false, user: null });
    const stations = await anonymous.request.get("/stations", { maxRedirects: 0 });
    expect(stations.status()).toBe(307);
    expect(stations.headers().location).toBe("/login");
  } finally {
    await anonymous.close();
  }

  const deniedLogout = await page.request.post("/api/auth/logout", {
    headers: { origin: "https://outside.example.test" },
    maxRedirects: 0,
  });
  expect(deniedLogout.status()).toBe(403);
  expect(deniedLogout.headers()["cache-control"]).toBe("private, no-store");
  expect(await (await page.request.get("/api/auth/session")).json())
    .toMatchObject({ authenticated: true });
});
