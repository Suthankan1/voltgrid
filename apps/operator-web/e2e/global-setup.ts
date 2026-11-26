import { chromium } from "@playwright/test";
import { signIn } from "./sign-in";

export default async function globalSetup() {
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage();
    await signIn(page, "http://127.0.0.1:4310");
    await page.context().storageState({ path: "test-results/operator-auth.json" });
  } finally {
    await browser.close();
  }
}
