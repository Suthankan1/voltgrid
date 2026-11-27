import assert from "node:assert/strict";
import { once } from "node:events";
import { createServer } from "node:http";
import { createRequire, registerHooks } from "node:module";
import { test } from "node:test";
import { exportJWK, generateKeyPair, SignJWT } from "jose";

const audience = "voltgrid-api";
const subject = "fixture-operator";

async function signingKey(kid) {
  const { privateKey, publicKey } = await generateKeyPair("RS256");
  return {
    privateKey,
    jwk: { ...await exportJWK(publicKey), kid, alg: "RS256", use: "sig" },
  };
}

test("BFF OIDC provider acceptance", { timeout: 30_000 }, async t => {
  const [initial, replacement] = await Promise.all([signingKey("initial"), signingKey("replacement")]);
  let keys = [initial.jwk];
  let jwksDown = false;
  let jwksRequests = 0;
  let alternateKeyRequests = 0;
  let discoveryStatus = 200;
  let discoveryBody;
  let exchange;
  const revocations = [];
  let organizationStatus = 200;
  let switchOrganization;
  let organizationRequests = 0;
  let expectedAccessToken;
  const server = createServer((request, response) => {
    response.setHeader("Content-Type", "application/json");
    if (request.url === "/realm/.well-known/openid-configuration") {
      response.writeHead(discoveryStatus).end(discoveryBody ?? JSON.stringify(metadata));
    } else if (request.url === "/jwks") {
      jwksRequests++;
      response.writeHead(jwksDown ? 503 : 200).end(JSON.stringify({ keys }));
    } else if (request.url === "/alternate-jwks") {
      alternateKeyRequests++;
      response.end(JSON.stringify({ keys: [replacement.jwk] }));
    } else if (request.url === "/token" && exchange) {
      void exchange(request, response);
    } else if (request.url === "/revoke") {
      let body = "";
      request.on("data", chunk => { body += chunk; });
      request.on("end", () => {
        revocations.push(new URLSearchParams(body).get("token"));
        response.end();
      });
    } else if (request.url?.startsWith("/api/operator/organization-access?")) {
      organizationRequests++;
      if (request.method === "POST" && switchOrganization) {
        void switchOrganization(request, response);
        return;
      }
      if (request.url !== "/api/operator/organization-access?organizationId=fixture-org" ||
          request.headers.authorization !== "Bearer " + expectedAccessToken) {
        response.writeHead(400).end("{}");
        return;
      }
      response.writeHead(organizationStatus).end(JSON.stringify({
        organizationId: "fixture-org", role: "SUPPORT",
      }));
    } else {
      response.writeHead(404).end("{}");
    }
  });
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  t.after(() => new Promise((resolve, reject) => {
    server.close(error => error ? reject(error) : resolve());
    server.closeAllConnections();
  }));
  const origin = `http://127.0.0.1:${server.address().port}`;
  const issuer = origin + "/realm";
  const metadata = {
    issuer,
    jwks_uri: origin + "/jwks",
    authorization_endpoint: origin + "/authorize",
    token_endpoint: origin + "/token",
    revocation_endpoint: origin + "/revoke",
  };
  Object.assign(process.env, {
    OIDC_ISSUER: issuer,
    OIDC_LOCAL_HTTP: "true",
    OPERATOR_WEB_ORIGIN: origin,
    OIDC_CLIENT_ID: "fixture-client",
    OIDC_CLIENT_SECRET: "fixture-secret",
    OIDC_AUDIENCE: audience,
    STATION_GRAPHQL_URL: origin + "/graphql",
  });
  let context = 0;
  const freshProvider = async () => (await import(`../src/lib/oidc.ts?fixture=${++context}`)).getProvider;
  const now = Math.floor(Date.now() / 1000);
  const validClaims = {
    iss: issuer,
    aud: audience,
    sub: subject,
    exp: now + 900,
    typ: "Bearer",
  };
  const mint = (claims = {}, key = initial, kid = key.jwk.kid, header = {}) =>
    new SignJWT({ ...validClaims, ...claims })
      .setProtectedHeader({ alg: "RS256", kid, typ: "JWT", ...header }).sign(key.privateKey);

  const { verify } = await (await freshProvider())();
  await t.test("BFF-JWT-01 / JWKS-01 accepts the initial bearer token", async () => {
    assert.equal((await verify(await mint(), subject)).payload.sub, subject);
  });
  for (const [id, label, claims, expected] of [
    ["07", "issuer", { iss: "https://different.example.test" }, { claim: "iss" }],
    ["08", "audience", { aud: "fixture-client" }, { claim: "aud" }],
    ["09", "absent audience", { aud: undefined }, { claim: "aud" }],
    ["10", "expired", { exp: now - 1 }, { code: "ERR_JWT_EXPIRED" }],
    ["11", "absent expiry", { exp: undefined }, { claim: "exp" }],
    ["12", "future activation", { nbf: now + 120 }, { claim: "nbf" }],
    ["13", "absent subject", { sub: undefined }, { claim: "sub" }],
    ["14", "blank subject", { sub: " " }, /Missing OIDC subject/],
    ["15", "different subject", { sub: "different" }, { claim: "sub" }],
    ["19", "ID token purpose", { typ: "ID" }, /Invalid Keycloak access token purpose/],
    ["20", "refresh token purpose", { typ: "Refresh" }, /Invalid Keycloak access token purpose/],
    ["21", "absent purpose", { typ: undefined }, /Invalid Keycloak access token purpose/],
  ]) {
    await t.test(`BFF-JWT-${id} rejects ${label}`, async () => {
      await assert.rejects(verify(await mint(claims), id === "14" ? " " : subject), expected);
    });
  }
  await t.test("BFF-JWT-02 rejects malformed input", async () => {
    await assert.rejects(verify("invalid", subject), { code: "ERR_JWS_INVALID" });
  });
  await t.test("BFF-JWT-03 rejects an invalid signature for the trusted key ID", async () => {
    await assert.rejects(verify(await mint({}, replacement, initial.jwk.kid), subject), {
      code: "ERR_JWS_SIGNATURE_VERIFICATION_FAILED",
    });
  });
  await t.test("BFF-JWT-04 rejects a changed payload", async () => {
    const [header, , signature] = (await mint()).split(".");
    const payload = Buffer.from(JSON.stringify({ ...validClaims, name: "changed" })).toString("base64url");
    await assert.rejects(verify([header, payload, signature].join("."), subject), {
      code: "ERR_JWS_SIGNATURE_VERIFICATION_FAILED",
    });
  });
  await t.test("BFF-JWT-05 rejects unsigned input", async () => {
    const header = Buffer.from(JSON.stringify({ alg: "none" })).toString("base64url");
    const payload = (await mint()).split(".")[1];
    await assert.rejects(verify(`${header}.${payload}.`, subject), { code: "ERR_JOSE_ALG_NOT_ALLOWED" });
  });
  await t.test("BFF-JWT-06 rejects an unpublished signing key", async () => {
    await assert.rejects(verify(await mint({}, replacement), subject), { code: "ERR_JWKS_NO_MATCHING_KEY" });
  });
  for (const [id, alg, key] of [
    ["16", "HS256", await crypto.subtle.generateKey({ name: "HMAC", hash: "SHA-256" }, false, ["sign"])],
    ["17", "RS512", (await generateKeyPair("RS512")).privateKey],
  ]) {
    await t.test(`BFF-JWT-${id} rejects ${alg}`, async () => {
      const token = await new SignJWT(validClaims).setProtectedHeader({ alg, kid: initial.jwk.kid }).sign(key);
      await assert.rejects(verify(token, subject), { code: "ERR_JOSE_ALG_NOT_ALLOWED" });
    });
  }
  await t.test("BFF-JWT-18 rejects an unknown key identifier", async () => {
    await assert.rejects(verify(await mint({}, initial, "unknown"), subject), { code: "ERR_JWKS_NO_MATCHING_KEY" });
  });
  await t.test("BFF-JWT-22 uses the discovered key source despite a token key URL", async () => {
    const header = { jku: origin + "/alternate-jwks" };
    await verify(await mint({}, initial, initial.jwk.kid, header), subject);
    await assert.rejects(verify(await mint({}, replacement, replacement.jwk.kid, header), subject), {
      code: "ERR_JWKS_NO_MATCHING_KEY",
    });
    assert.equal(alternateKeyRequests, 0);
  });

  await t.test("JWKS-02 through JWKS-08 follow cache, rotation and outage policy", async t => {
    t.mock.timers.enable({ apis: ["Date"], now: Date.now() });
    const pending = await mint({}, replacement);
    const active = await mint();
    const firstFetch = jwksRequests;
    t.mock.timers.tick(30_001);
    await assert.rejects(verify(pending, subject), { code: "ERR_JWKS_NO_MATCHING_KEY" });
    assert.equal(jwksRequests, firstFetch + 1);
    keys = [replacement.jwk];
    await assert.rejects(verify(pending, subject), { code: "ERR_JWKS_NO_MATCHING_KEY" });
    assert.equal(jwksRequests, firstFetch + 1);
    await verify(active, subject);
    t.mock.timers.tick(30_001);
    await verify(pending, subject);
    await assert.rejects(verify(active, subject), { code: "ERR_JWKS_NO_MATCHING_KEY" });
    jwksDown = true;
    await verify(pending, subject);
    await assert.rejects(verify(await mint({ exp: now + 40 }, replacement), subject), { code: "ERR_JWT_EXPIRED" });
    t.mock.timers.tick(30_001);
    await assert.rejects(verify(active, subject), /Expected 200 OK/);
    t.mock.timers.tick(600_001);
    await assert.rejects(verify(pending, subject), /Expected 200 OK/);
    jwksDown = false;
    await verify(pending, subject);
  });

  await t.test("PROVIDER-02 / 10 retries discovery after provider recovery", async () => {
    const getProvider = await freshProvider();
    discoveryStatus = 503;
    await assert.rejects(getProvider());
    discoveryStatus = 200;
    assert.equal((await getProvider()).client.serverMetadata().issuer, issuer);
  });
  for (const [label, body, expected] of [
    ["PROVIDER-03 malformed discovery", "{", undefined],
    ["PROVIDER-04 mismatched issuer", JSON.stringify({ ...metadata, issuer: origin + "/different" }), /issuer/],
    ...["jwks_uri", "authorization_endpoint", "token_endpoint"].map(field => [
      `missing ${field}`, JSON.stringify({ ...metadata, [field]: undefined }), /endpoint is missing/,
    ]),
    ["insecure remote JWKS", JSON.stringify({ ...metadata, jwks_uri: "http://different.example.test/jwks" }), /requires HTTPS/],
  ]) {
    await t.test(label, async () => {
      discoveryBody = body;
      try {
        const getProvider = await freshProvider();
        await assert.rejects(getProvider(), expected);
      } finally {
        discoveryBody = undefined;
      }
    });
  }
  await t.test("rejects an HTTP issuer with local mode disabled", async () => {
    process.env.OIDC_LOCAL_HTTP = "false";
    try {
      await assert.rejects((await freshProvider())(), /HTTPS/);
    } finally {
      process.env.OIDC_LOCAL_HTTP = "true";
    }
  });
  await t.test("PROVIDER-05 rejects initial verification when JWKS is down", async () => {
    const provider = await (await freshProvider())();
    jwksDown = true;
    try {
      await assert.rejects(provider.verify(await mint({}, replacement), subject), /Expected 200 OK/);
    } finally {
      jwksDown = false;
    }
  });

  await t.test("production login and callback route handlers", async t => {
    keys = [replacement.jwk];
    const require = createRequire(import.meta.url);
    const nextServerPath = require.resolve("next/server");
    const { NextRequest } = require("next/server");
    const lib = new URL("../src/lib/", import.meta.url);
    const hooks = registerHooks({
      resolve(specifier, context, nextResolve) {
        if (specifier === "next/server") return nextResolve(nextServerPath, context);
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
    const { GET: login } = await import("../src/app/api/auth/login/route.ts");
    const { GET: callback } = await import("../src/app/api/auth/callback/route.ts");
    const { POST: logout } = await import("../src/app/api/auth/logout/route.ts");
    const { POST: switchRoute } = await import("../src/app/api/auth/switch-org/route.ts");
    const { logins, resolveSession, sessions } = await import("../src/lib/auth.ts");
    const createSession = t.mock.method(sessions, "create");
    const { oidc } = await import("../src/lib/oidc.ts");
    const key = replacement;
    let codeCounter = 0;
    let tokenRequests = 0;
    let exchangeOutcome;
    let refreshExchange;
    const codes = new Map();
    exchange = async (request, response) => {
      tokenRequests++;
      try {
        let body = "";
        for await (const chunk of request) body += chunk;
        const form = new URLSearchParams(body);
        if (form.get("grant_type") === "refresh_token" && refreshExchange) {
          await refreshExchange(form.get("refresh_token"), response);
          return;
        }
        const entry = codes.get(form.get("code"));
        const challenge = form.get("code_verifier");
        if (!entry || !challenge || await oidc.calculatePKCECodeChallenge(challenge) !== entry.challenge ||
            form.get("redirect_uri") !== origin + "/api/auth/callback") {
          exchangeOutcome = !entry ? "unknown-code" : "verifier";
          response.writeHead(400).end(JSON.stringify({ error: "invalid_grant" }));
          return;
        }
        codes.delete(form.get("code"));
        if (entry.mode === "timeout") {
          exchangeOutcome = entry.mode;
          return;
        }
        if (entry.mode === "malformed") {
          exchangeOutcome = entry.mode;
          response.end("{");
          return;
        }
        if (entry.mode === "provider-error") {
          exchangeOutcome = entry.mode;
          response.writeHead(503).end("{}");
          return;
        }
        const idToken = await new SignJWT({
          iss: issuer, aud: "fixture-client", sub: subject, iat: now, exp: now + 900,
          nonce: entry.mode === "nonce" ? "unexpected-nonce" : entry.nonce,
        }).setProtectedHeader({ alg: "RS256", kid: key.jwk.kid })
          .sign(entry.mode === "id-signature" ? initial.privateKey : key.privateKey);
        const claims = {
          org_id: "fixture-org",
          sub: entry.mode === "subject" ? "other-subject" : subject,
        };
        expectedAccessToken = entry.mode === "invalid-access" ? "invalid-access" : await mint(claims, key);
        exchangeOutcome = entry.mode ?? "success";
        response.end(JSON.stringify({
          token_type: "Bearer",
          access_token: expectedAccessToken,
          id_token: entry.mode === "no-id" ? undefined : idToken,
        }));
      } catch {
        exchangeOutcome = "fixture-error";
        response.writeHead(500).end("{}");
      }
    };

    async function begin(mode, previous) {
      const response = await login(new NextRequest(origin + "/api/auth/login", {
        headers: previous ? { cookie: "voltgrid_oidc=" + previous } : {},
      }));
      assert.equal(response.status, 307);
      const url = new URL(response.headers.get("location"));
      const id = response.cookies.get("voltgrid_oidc").value;
      const state = url.searchParams.get("state");
      const nonce = url.searchParams.get("nonce");
      const challenge = url.searchParams.get("code_challenge");
      const code = "fixture-code-" + ++codeCounter;
      codes.set(code, { nonce, challenge, mode });
      return { id, code, state, nonce, challenge, url };
    }

    async function complete(login, params = { state: login.state, code: login.code }, priorSession) {
      const cookies = [];
      if (login.id) cookies.push("voltgrid_oidc=" + login.id);
      if (priorSession) cookies.push("voltgrid_session=" + priorSession);
      const request = new NextRequest(origin + "/api/auth/callback?" + new URLSearchParams(params), {
        headers: { cookie: cookies.join("; ") },
      });
      const before = createSession.mock.callCount();
      const response = await callback(request);
      assert.equal(createSession.mock.callCount(), before + (response.status === 307 ? 1 : 0));
      return response;
    }

    async function denied(response, hadCookie = true) {
      assert.equal(response.status, 401);
      assert.deepEqual(await response.json(), { error: "Sign-in failed" });
      assert.equal(response.headers.get("location"), null);
      assert.equal(response.headers.get("cache-control"), "private, no-store");
      assert.equal(response.cookies.has("voltgrid_session"), false);
      if (hadCookie) assert.equal(response.cookies.get("voltgrid_oidc").value, "");
    }

    await t.test("PROVIDER-01 / OIDC-01 creates a verified initial session", async () => {
      const prior = await begin();
      const txn = await begin(undefined, prior.id);
      assert.equal(logins.get(prior.id), undefined);
      assert.match(txn.id, /^[\w-]{43}$/);
      assert.equal(txn.url.origin, origin);
      assert.equal(txn.url.searchParams.get("response_type"), "code");
      assert.equal(txn.url.searchParams.get("redirect_uri"), origin + "/api/auth/callback");
      assert.equal(txn.url.searchParams.get("code_challenge_method"), "S256");
      assert.notEqual(txn.state, prior.state);
      assert.notEqual(txn.nonce, prior.nonce);
      assert.notEqual(txn.challenge, prior.challenge);
      const record = logins.get(txn.id);
      assert.equal(record.state, txn.state);
      assert.equal(record.nonce, txn.nonce);
      assert.ok(record.expiresAt > Date.now() + 290_000 && record.expiresAt <= Date.now() + 300_000);
      assert.equal(await oidc.calculatePKCECodeChallenge(record.verifier), txn.challenge);
      assert.equal(txn.url.href.includes(record.verifier), false);
      const before = organizationRequests;
      const response = await complete(txn);
      assert.equal(response.status, 307);
      assert.equal(response.headers.get("location"), origin + "/");
      const id = response.cookies.get("voltgrid_session").value;
      assert.match(id, /^[\w-]{43}$/);
      assert.equal(sessions.get(id).user.userId, subject);
      assert.deepEqual(sessions.get(id).user.roles, ["SUPPORT"]);
      assert.equal(organizationRequests, before + 1);
      assert.equal(logins.get(txn.id), undefined);
      await denied(await complete(txn));
      sessions.delete(id);
    });

    for (const [label, mode] of [
      ["OIDC-09 invalid code", "unknown-code"],
      ["OIDC-12 incorrect verifier", "verifier"],
      ["OIDC-13 incorrect nonce", "nonce"],
      ["OIDC-14 missing ID token", "no-id"],
      ["OIDC-15 ID token signature rejection", "id-signature"],
      ["OIDC-16 subject binding rejection", "subject"],
      ["OIDC-18 / PROVIDER-06 token endpoint error", "provider-error"],
      ["OIDC-19 / PROVIDER-09 invalid access token", "invalid-access"],
      ["PROVIDER-07 malformed token response", "malformed"],
      ["PROVIDER-08 bounded token request", "timeout"],
    ]) {
      await t.test(label, async () => {
        const txn = await begin(mode);
        if (mode === "unknown-code") codes.delete(txn.code);
        if (mode === "verifier") logins.get(txn.id).verifier = oidc.randomPKCECodeVerifier();
        const before = tokenRequests;
        const accessBefore = organizationRequests;
        const started = performance.now();
        await denied(await complete(txn));
        if (mode === "timeout") {
          const elapsed = performance.now() - started;
          assert.ok(elapsed >= 4_500 && elapsed < 12_000, `token request took ${elapsed}ms`);
        }
        assert.equal(tokenRequests, before + 1);
        assert.equal(exchangeOutcome, mode);
        assert.equal(organizationRequests, accessBefore);
        assert.equal(logins.get(txn.id), undefined);
        await denied(await complete(txn));
        assert.equal(tokenRequests, before + 1);
      });
    }

    for (const [label, status] of [["OIDC-21 membership denied", 403], ["OIDC-22 Station unavailable", 503]]) {
      await t.test(label, async () => {
        const txn = await begin();
        const before = organizationRequests;
        organizationStatus = status;
        try {
          await denied(await complete(txn));
          await denied(await complete(txn));
          assert.equal(organizationRequests, before + 1);
        } finally {
          organizationStatus = 200;
        }
      });
    }

    for (const [label, transform] of [
      ["OIDC-02 missing login cookie", txn => [{ ...txn, id: undefined }]],
      ["OIDC-03 unknown login", txn => [{ ...txn, id: "unknown" }]],
      ["OIDC-04 expired login", txn => { logins.get(txn.id).expiresAt = Date.now() - 1; return [txn]; }],
      ["OIDC-05 missing state", txn => [txn, { code: txn.code }]],
      ["OIDC-06 incorrect state", txn => [txn, { state: "invalid", code: txn.code }]],
      ["OIDC-08 missing code", txn => [txn, { state: txn.state }]],
      ["OIDC-11 incomplete transaction", txn => { logins.get(txn.id).verifier = ""; return [txn]; }],
      ["OIDC-17 authorization denied", txn => [txn, { state: txn.state, error: "access_denied" }]],
      ["OIDC-20 duplicate state", txn => [txn, [["state", txn.state], ["state", txn.state], ["code", txn.code]]]],
    ]) {
      await t.test(label, async () => {
        const txn = await begin();
        const [input, parameters] = transform(txn);
        const before = tokenRequests;
        await denied(await complete(input, parameters), Boolean(input.id));
        assert.equal(tokenRequests, before);
        assert.equal(logins.get(input.id) ?? undefined, undefined);
        logins.delete(txn.id);
      });
    }

    await t.test("OIDC-07 / 10 / 23 / 24 binds origin and consumes transaction and code once", async () => {
      const txn = await begin();
      const url = new URL("https://outside.example.test/api/auth/callback");
      url.search = new URLSearchParams({ state: txn.state, code: txn.code, returnTo: "//outside.example.test" });
      const request = () => new NextRequest(url, { headers: {
        cookie: "voltgrid_oidc=" + txn.id,
        host: "outside.example.test",
        "x-forwarded-host": "outside.example.test",
      } });
      const before = tokenRequests;
      const sessionsBefore = createSession.mock.callCount();
      const results = await Promise.all([callback(request()), callback(request())]);
      assert.deepEqual(results.map(response => response.status).sort(), [307, 401]);
      const success = results.find(response => response.status === 307);
      assert.equal(success.headers.get("location"), origin + "/");
      assert.equal(tokenRequests, before + 1);
      assert.equal(createSession.mock.callCount(), sessionsBefore + 1);
      await denied(results.find(response => response.status === 401));
      await denied(await complete(txn));
      assert.equal(tokenRequests, before + 1);
      const next = await begin();
      await denied(await complete({ ...next, code: txn.code }));
      assert.equal(tokenRequests, before + 2);
      sessions.delete(success.cookies.get("voltgrid_session").value);
    });

    async function signIn(priorSession) {
      const result = await complete(await begin(), undefined, priorSession);
      assert.equal(result.status, 307);
      return result.cookies.get("voltgrid_session").value;
    }

    function signOut(id) {
      return logout(new NextRequest(origin + "/api/auth/logout", {
        method: "POST",
        headers: { origin, cookie: "voltgrid_session=" + id },
      }));
    }

    await t.test("R.3D callback replaces the old handle and logout leaves an independent session intact", async () => {
      const prior = await signIn();
      const independent = await signIn();
      const current = await signIn(prior);
      assert.notEqual(current, prior);
      for (const id of [undefined, "unknown", "#" + current, prior]) {
        assert.equal((await resolveSession(id)).isAuthenticated, false);
      }
      assert.equal((await resolveSession(current)).isAuthenticated, true);
      const response = await signOut(current);
      assert.equal(response.status, 303);
      assert.equal(response.cookies.get("voltgrid_session").maxAge, 0);
      assert.equal((await resolveSession(current)).isAuthenticated, false);
      assert.equal((await resolveSession(independent)).isAuthenticated, true);
      sessions.get(independent).expiresAt = Date.now() - 1;
      assert.equal((await resolveSession(independent)).isAuthenticated, false);
    });

    for (const outcome of ["rotate", "logout", "expire", "reject"]) {
      await t.test("R.3D concurrent refresh: " + outcome, async () => {
        const id = await signIn();
        const session = sessions.get(id);
        session.tokenExpiresAt = Date.now() - 1;
        session.refreshToken = "fixture-refresh-initial";
        const started = Promise.withResolvers();
        const release = Promise.withResolvers();
        const before = tokenRequests;
        const revokedBefore = revocations.length;
        const oldToken = session.token;
        const expiry = session.expiresAt;
        refreshExchange = async (token, response) => {
          started.resolve(token);
          await release.promise;
          expectedAccessToken = await mint({ org_id: "fixture-org", name: "Refreshed operator" }, key);
          response.writeHead(outcome === "reject" ? 503 : 200).end(JSON.stringify({
            token_type: "Bearer", access_token: expectedAccessToken, refresh_token: "fixture-refresh-rotated",
          }));
        };
        try {
          const first = resolveSession(id);
          const second = resolveSession(id);
          assert.equal(await started.promise, "fixture-refresh-initial");
          const logoutResult = outcome === "logout" ? signOut(id) : undefined;
          if (outcome === "expire") session.expiresAt = Date.now() - 1;
          if (outcome === "logout" || outcome === "expire") {
            assert.equal((await resolveSession(id)).isAuthenticated, false);
          }
          release.resolve();
          const results = await Promise.all([first, second]);
          assert.equal(tokenRequests, before + 1);
          if (outcome === "rotate") {
            assert.ok(results.every(result => result.isAuthenticated && result.token === expectedAccessToken));
            assert.equal(session.expiresAt, expiry);
            assert.equal(session.refreshToken, "fixture-refresh-rotated");
          } else {
            assert.ok(results.every(result => !result.isAuthenticated && result.token === null));
            assert.equal(session.token, oldToken);
            assert.equal(sessions.get(id), undefined);
          }
          if (logoutResult) {
            assert.equal((await logoutResult).status, 303);
            assert.deepEqual(revocations.slice(revokedBefore), ["fixture-refresh-rotated"]);
          }
        } finally {
          release.resolve();
          refreshExchange = undefined;
          sessions.delete(id);
        }
      });
    }

    await t.test("R.3D a delayed organization response cannot overwrite a refreshed session", async () => {
      const id = await signIn();
      const session = sessions.get(id);
      const started = Promise.withResolvers();
      const release = Promise.withResolvers();
      switchOrganization = async (_request, response) => {
        started.resolve();
        await release.promise;
        response.end(JSON.stringify({ organizationId: "other-org", role: "OWNER" }));
      };
      refreshExchange = async (_token, response) => {
        expectedAccessToken = await mint({ org_id: "fixture-org", name: "Refreshed operator" }, key);
        response.end(JSON.stringify({ token_type: "Bearer", access_token: expectedAccessToken }));
      };
      try {
        const switching = switchRoute(new NextRequest(origin + "/api/auth/switch-org", {
          method: "POST",
          headers: { origin, cookie: "voltgrid_session=" + id },
          body: JSON.stringify({ organizationId: "other-org" }),
        }));
        await started.promise;
        session.tokenExpiresAt = Date.now() - 1;
        session.refreshToken = "fixture-refresh-initial";
        assert.equal((await resolveSession(id)).token, expectedAccessToken);
        release.resolve();
        assert.equal((await switching).status, 409);
        assert.equal(session.user.activeOrganizationId, "fixture-org");
        assert.deepEqual(session.user.roles, ["SUPPORT"]);
      } finally {
        release.resolve();
        switchOrganization = undefined;
        refreshExchange = undefined;
        sessions.delete(id);
      }
    });
  });
});
