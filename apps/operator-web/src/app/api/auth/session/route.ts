import { NextResponse } from "next/server";
import { getSession, PRIVATE_HEADERS } from "@/lib/auth";

export async function GET() {
  const session = await getSession();
  return NextResponse.json({
    authenticated: session.isAuthenticated,
    user: session.user,
  }, { headers: PRIVATE_HEADERS });
}
