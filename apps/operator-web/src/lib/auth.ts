import { cache } from "react";
import { createAuthStore } from "./auth-store";
import { appOrigin, getProvider, oidc } from "./oidc";

export interface AuthUser {
  userId: string;
  email: string;
  name: string;
  roles: string[];
  activeOrganizationId: string;
}

export interface AuthSession {
  user: AuthUser | null;
  token: string | null;
  isAuthenticated: boolean;
}

type Login = { expiresAt: number; verifier: string; state: string; nonce: string };
type Session = {
  expiresAt: number;
  tokenExpiresAt: number;
  user: AuthUser;
  token: string;
  refreshToken?: string;
  refreshing?: Promise<void>;
};

const stores = globalThis as typeof globalThis & {
  voltgridLogins?: ReturnType<typeof createAuthStore<Login>>;
  voltgridSessions?: ReturnType<typeof createAuthStore<Session>>;
};

export const logins = stores.voltgridLogins ??= createAuthStore<Login>(1000);
export const sessions = stores.voltgridSessions ??= createAuthStore<Session>(10000);
export const SESSION_COOKIE_NAME = "voltgrid_session";
export const LOGIN_COOKIE_NAME = "voltgrid_oidc";
export const SESSION_MAX_AGE = 8 * 60 * 60;
export const LOGIN_MAX_AGE = 5 * 60;
export const PRIVATE_HEADERS = { "Cache-Control": "private, no-store" };

export function cookieOptions(maxAge: number) {
  return {
    httpOnly: true,
    secure: new URL(appOrigin()).protocol === "https:",
    sameSite: "lax" as const,
    path: "/",
    maxAge,
  };
}

export function sameOrigin(request: Request) {
  try {
    return request.headers.get("origin") === appOrigin();
  } catch {
    return false;
  }
}

export async function organizationAccess(token: string, organizationId: string, switching = false) {
  const endpoint = new URL("/api/operator/organization-access", process.env.STATION_GRAPHQL_URL);
  endpoint.searchParams.set("organizationId", organizationId);
  const response = await fetch(endpoint, {
    method: switching ? "POST" : "GET",
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
    redirect: "error",
    signal: AbortSignal.timeout(3000),
  });

  if (response.status === 403) return null;
  if (!response.ok) throw new Error("Organization access check failed");
  const access = await response.json();
  if (access.organizationId !== organizationId || typeof access.role !== "string") {
    throw new Error("Invalid organization access response");
  }
  return { organizationId, role: access.role as string };
}

export async function verifiedSession(
  subject: string,
  token: string,
  refreshToken: string | undefined,
  expiresAt: number,
  selectedOrganization?: string,
): Promise<Session> {
  const { verify } = await getProvider();
  const { payload } = await verify(token, subject);
  const organization = payload.org_id ?? payload.tenant_id;
  if (typeof organization !== "string" || !organization.trim() || !payload.exp) {
    throw new Error("OIDC identity has no organization");
  }
  const access = await organizationAccess(token, selectedOrganization ?? organization);
  if (!access) throw new Error("OIDC identity has no active membership");
  return {
    expiresAt,
    tokenExpiresAt: payload.exp * 1000,
    token,
    refreshToken,
    user: {
      userId: subject,
      email: typeof payload.email === "string" ? payload.email : "",
      name: typeof payload.name === "string" ? payload.name : subject,
      roles: [access.role],
      activeOrganizationId: access.organizationId,
    },
  };
}

async function refresh(id: string, session: Session) {
  if (!session.refreshToken) throw new Error("OIDC session requires sign-in");
  const { client } = await getProvider();
  const tokens = await oidc.refreshTokenGrant(client, session.refreshToken);
  // Logout may hold a detached record while waiting to revoke the rotated grant.
  session.refreshToken = tokens.refresh_token ?? session.refreshToken;
  if (sessions.get(id) !== session) return;
  const updated = await verifiedSession(
    session.user.userId,
    tokens.access_token,
    session.refreshToken,
    session.expiresAt,
    session.user.activeOrganizationId,
  );
  if (sessions.get(id) === session) Object.assign(session, updated);
}

export async function resolveSession(id: string | undefined): Promise<AuthSession> {
  const session = id && sessions.get(id);
  if (id && session) {
    try {
      if (session.tokenExpiresAt <= Date.now() + 15_000) {
        session.refreshing ??= refresh(id, session).finally(() => {
          session.refreshing = undefined;
        });
        await session.refreshing;
      }
      if (sessions.get(id) === session) {
        if (session.tokenExpiresAt > Date.now()) {
          return { user: session.user, token: session.token, isAuthenticated: true };
        }
        sessions.delete(id);
      }
    } catch {
      if (sessions.get(id) === session) sessions.delete(id);
    }
  }
  return { user: null, token: null, isAuthenticated: false };
}

export const getSession = cache(async (): Promise<AuthSession> => {
  const { cookies } = await import("next/headers");
  return resolveSession((await cookies()).get(SESSION_COOKIE_NAME)?.value);
});

export async function getAuthHeaders(): Promise<Record<string, string>> {
  const session = await getSession();
  if (!session.token || !session.user) return {};
  return {
    Authorization: `Bearer ${session.token}`,
    "X-Tenant-Id": session.user.activeOrganizationId,
  };
}
