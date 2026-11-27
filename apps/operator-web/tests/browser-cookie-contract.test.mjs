import assert from "node:assert/strict";
import { createRequire, registerHooks } from "node:module";
import { test } from "node:test";

test("HTTPS operator cookies are host-only and logout expires the cookie on the configured origin", async t => {
  const previousOrigin = process.env.OPERATOR_WEB_ORIGIN;
  process.env.OPERATOR_WEB_ORIGIN = "https://console.example.test";
  t.after(() => {
    if (previousOrigin === undefined) delete process.env.OPERATOR_WEB_ORIGIN;
    else process.env.OPERATOR_WEB_ORIGIN = previousOrigin;
  });

  const require = createRequire(import.meta.url);
  const nextServer = require.resolve("next/server");
  const { NextRequest } = require("next/server");
  const lib = new URL("../src/lib/", import.meta.url);
  const hooks = registerHooks({
    resolve(specifier, context, nextResolve) {
      if (specifier === "next/server") return nextResolve(nextServer, context);
      if (specifier.startsWith("@/lib/")) {
        return nextResolve(new URL(specifier.slice(6) + ".ts", lib).href, context);
      }
      if (context.parentURL?.startsWith(lib.href) && /^\.\/[^.]+$/.test(specifier)) {
        return nextResolve(specifier + ".ts", context);
      }
      return nextResolve(specifier, context);
    },
  });
  t.after(() => hooks.deregister());

  const { cookieOptions, LOGIN_MAX_AGE, SESSION_MAX_AGE } = await import("../src/lib/auth.ts");
  for (const maxAge of [LOGIN_MAX_AGE, SESSION_MAX_AGE]) {
    assert.deepEqual(cookieOptions(maxAge), {
      httpOnly: true, secure: true, sameSite: "lax", path: "/", maxAge,
    });
  }

  const { POST: logout } = await import("../src/app/api/auth/logout/route.ts");
  const response = await logout(new NextRequest("https://console.example.test/api/auth/logout", {
    method: "POST",
    headers: { origin: "https://console.example.test" },
  }));
  assert.equal(response.status, 303);
  assert.equal(response.headers.get("location"), "https://console.example.test/login");
  assert.equal(response.headers.get("cache-control"), "private, no-store");
  const cookie = response.headers.get("set-cookie");
  for (const attribute of ["HttpOnly", "Secure", "SameSite=lax", "Path=/", "Max-Age=0"]) {
    assert.ok(cookie.includes(attribute));
  }
  assert.doesNotMatch(cookie, /;\s*domain=/i);
});
