import { NextRequest, NextResponse } from "next/server";
import { cookieOptions, PRIVATE_HEADERS, sameOrigin, SESSION_COOKIE_NAME, sessions } from "@/lib/auth";
import { appOrigin, getProvider, oidc } from "@/lib/oidc";

export async function POST(request: NextRequest) {
  if (!sameOrigin(request)) return new NextResponse(null, { status: 403, headers: PRIVATE_HEADERS });

  const id = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  const session = id && sessions.get(id);
  if (id) sessions.delete(id);

  if (session) {
    try {
      await session.refreshing?.catch(() => undefined);
      if (session.refreshToken) {
        const { client } = await getProvider();
        if (client.serverMetadata().revocation_endpoint) {
          await oidc.tokenRevocation(client, session.refreshToken, { token_type_hint: "refresh_token" });
        }
      }
    } catch {
      // Local invalidation takes effect independently of provider availability.
    }
  }

  const response = NextResponse.redirect(new URL("/login", appOrigin()), { status: 303, headers: PRIVATE_HEADERS });
  response.cookies.set(SESSION_COOKIE_NAME, "", cookieOptions(0));
  return response;
}
