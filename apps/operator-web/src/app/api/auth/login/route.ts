import { NextRequest, NextResponse } from "next/server";
import {
  PRESET_PERSONAS,
  createBearerToken,
  encodeSession,
  SESSION_COOKIE_NAME,
  AuthUser,
} from "@/lib/auth";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const personaKey = body.persona as string;

    let user: AuthUser | undefined;

    if (personaKey && PRESET_PERSONAS[personaKey]) {
      user = PRESET_PERSONAS[personaKey];
    } else if (body.email) {
      // Find matching preset or create standard operator
      const found = Object.values(PRESET_PERSONAS).find(p => p.email === body.email);
      if (found) {
        user = found;
      } else {
        user = {
          userId: "usr_" + Buffer.from(body.email).toString("hex").substring(0, 12),
          email: body.email,
          name: body.email.split("@")[0],
          roles: ["STATION_OPERATOR"],
          activeOrganizationId: "org_voltgrid_default",
          availableOrganizations: [
            { id: "org_voltgrid_default", name: "VoltGrid Default Operations", role: "STATION_OPERATOR" },
          ],
        };
      }
    } else {
      user = PRESET_PERSONAS.platform_admin;
    }

    const token = createBearerToken(user);
    const cookieValue = encodeSession(user, token);

    const returnTo = body.returnTo || "/";
    const response = NextResponse.json({ success: true, user, redirectUrl: returnTo });

    response.cookies.set({
      name: SESSION_COOKIE_NAME,
      value: cookieValue,
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 86400, // 1 day
    });

    return response;
  } catch (error) {
    return NextResponse.json(
      { error: "Authentication failed", details: String(error) },
      { status: 500 }
    );
  }
}
