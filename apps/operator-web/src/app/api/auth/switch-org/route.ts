import { NextRequest, NextResponse } from "next/server";
import { organizationAccess, PRIVATE_HEADERS, resolveSession, sameOrigin, SESSION_COOKIE_NAME, sessions } from "@/lib/auth";

export async function POST(request: NextRequest) {
  if (!sameOrigin(request)) return new NextResponse(null, { status: 403, headers: PRIVATE_HEADERS });
  const id = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  const { token } = await resolveSession(id);
  const session = id && sessions.get(id);
  if (!token || !id || !session) return new NextResponse(null, { status: 401, headers: PRIVATE_HEADERS });
  const previousUser = session.user;

  const body = await request.json().catch(() => null);
  if (typeof body?.organizationId !== "string" || !body.organizationId.trim()) {
    return new NextResponse(null, { status: 400, headers: PRIVATE_HEADERS });
  }

  try {
    const access = await organizationAccess(token, body.organizationId, true);
    if (!access) return new NextResponse(null, { status: 403, headers: PRIVATE_HEADERS });
    if (sessions.get(id) !== session || session.tokenExpiresAt <= Date.now()) {
      return new NextResponse(null, { status: 401, headers: PRIVATE_HEADERS });
    }
    if (session.refreshing || session.token !== token || session.user !== previousUser) {
      return new NextResponse(null, { status: 409, headers: PRIVATE_HEADERS });
    }

    session.user = { ...session.user, activeOrganizationId: access.organizationId, roles: [access.role] };
    return NextResponse.json({ activeOrganizationId: access.organizationId }, { headers: PRIVATE_HEADERS });
  } catch {
    return new NextResponse(null, { status: 503, headers: PRIVATE_HEADERS });
  }
}
