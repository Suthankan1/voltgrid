import { NextRequest, NextResponse } from "next/server";
import { cookieOptions, LOGIN_COOKIE_NAME, LOGIN_MAX_AGE, logins, PRIVATE_HEADERS } from "@/lib/auth";
import { appOrigin, getProvider, oidc } from "@/lib/oidc";

export async function GET(request: NextRequest) {
  try {
    const { client } = await getProvider();
    const verifier = oidc.randomPKCECodeVerifier();
    const state = oidc.randomState();
    const nonce = oidc.randomNonce();
    const url = oidc.buildAuthorizationUrl(client, {
      redirect_uri: new URL("/api/auth/callback", appOrigin()).href,
      scope: "openid profile email",
      code_challenge: await oidc.calculatePKCECodeChallenge(verifier),
      code_challenge_method: "S256",
      state,
      nonce,
    });
    const previous = request.cookies.get(LOGIN_COOKIE_NAME)?.value;
    if (previous) logins.delete(previous);
    const id = logins.create({ verifier, state, nonce, expiresAt: Date.now() + LOGIN_MAX_AGE * 1000 });
    const response = NextResponse.redirect(url, { headers: PRIVATE_HEADERS });
    response.cookies.set(LOGIN_COOKIE_NAME, id, cookieOptions(LOGIN_MAX_AGE));
    return response;
  } catch {
    return NextResponse.json({ error: "Sign-in is unavailable" }, { status: 503, headers: PRIVATE_HEADERS });
  }
}
