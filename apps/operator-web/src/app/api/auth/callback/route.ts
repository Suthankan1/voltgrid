import { NextRequest, NextResponse } from "next/server";
import {
  cookieOptions, LOGIN_COOKIE_NAME, logins, PRIVATE_HEADERS,
  SESSION_COOKIE_NAME, SESSION_MAX_AGE, sessions, verifiedSession,
} from "@/lib/auth";
import { appOrigin, getProvider, oidc } from "@/lib/oidc";

export async function GET(request: NextRequest) {
  const id = request.cookies.get(LOGIN_COOKIE_NAME)?.value;
  const login = id && logins.get(id);
  if (id) logins.delete(id);

  try {
    if (!login) throw new Error("Login has expired");
    const { client } = await getProvider();
    const callback = new URL("/api/auth/callback", appOrigin());
    callback.search = request.nextUrl.search;
    const tokens = await oidc.authorizationCodeGrant(client, callback, {
      pkceCodeVerifier: login.verifier,
      expectedState: login.state,
      expectedNonce: login.nonce,
      idTokenExpected: true,
    });
    const identity = tokens.claims();
    if (!identity?.sub) throw new Error("Missing OIDC subject");
    const session = await verifiedSession(
      identity.sub, tokens.access_token, tokens.refresh_token,
      Date.now() + SESSION_MAX_AGE * 1000,
    );
    const prior = request.cookies.get(SESSION_COOKIE_NAME)?.value;
    if (prior) sessions.delete(prior);
    const sessionId = sessions.create(session);
    const response = NextResponse.redirect(new URL("/", appOrigin()), { headers: PRIVATE_HEADERS });
    response.cookies.set(LOGIN_COOKIE_NAME, "", cookieOptions(0));
    response.cookies.set(SESSION_COOKIE_NAME, sessionId, cookieOptions(SESSION_MAX_AGE));
    return response;
  } catch {
    return NextResponse.json({ error: "Sign-in failed" }, { status: 401, headers: PRIVATE_HEADERS });
  }
}
