import { expect, test } from "@playwright/test";
import { signIn } from "./sign-in";

test.use({ storageState: { cookies: [], origins: [] } });

test("current membership controls an active browser session", async ({ page, baseURL }) => {
  const origin = baseURL!;
  await signIn(page, origin);

  async function setMembership(state: string) {
    const response = await page.request.post("http://127.0.0.1:4311/__membership", {
      params: { state },
    });
    expect(response.status()).toBe(204);
  }
  async function session() {
    const response = await page.request.get("/api/auth/session", { timeout: 5_000 });
    expect(response.ok()).toBe(true);
    return response.json();
  }

  try {
    expect(await session()).toMatchObject({ authenticated: true, user: { roles: ["ORG_OWNER"] } });

    await setMembership("SUPPORT");
    expect(await session()).toMatchObject({ authenticated: true, user: { roles: ["SUPPORT"] } });

    await setMembership("UNAVAILABLE");
    expect(await session()).toEqual({ authenticated: false, user: null });
    await setMembership("SUPPORT");
    expect(await session()).toMatchObject({ authenticated: true, user: { roles: ["SUPPORT"] } });

    await setMembership("REVOKED");
    expect(await session()).toEqual({ authenticated: false, user: null });
    const pageResponse = await page.request.get("/stations", { maxRedirects: 0, timeout: 5_000 });
    expect(pageResponse.status()).toBe(307);
    expect(pageResponse.headers().location).toBe("/login");

    await setMembership("ORG_OWNER");
    expect(await session()).toEqual({ authenticated: false, user: null });
  } finally {
    await setMembership("ORG_OWNER");
  }
});
