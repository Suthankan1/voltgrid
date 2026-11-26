import { NextRequest, NextResponse } from "next/server";
import {
  getSession,
  createBearerToken,
  encodeSession,
  SESSION_COOKIE_NAME,
} from "@/lib/auth";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const newOrgId = body.organizationId as string;

    if (!newOrgId) {
      return NextResponse.json({ error: "Missing organizationId" }, { status: 400 });
    }

    const session = await getSession();
    if (!session.isAuthenticated || !session.user) {
      return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
    }

    const updatedUser = {
      ...session.user,
      activeOrganizationId: newOrgId,
    };

    const token = createBearerToken(updatedUser);
    const cookieValue = encodeSession(updatedUser, token);

    const response = NextResponse.json({ success: true, activeOrganizationId: newOrgId });

    response.cookies.set({
      name: SESSION_COOKIE_NAME,
      value: cookieValue,
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 86400,
    });

    return response;
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to switch organization", details: String(error) },
      { status: 500 }
    );
  }
}
