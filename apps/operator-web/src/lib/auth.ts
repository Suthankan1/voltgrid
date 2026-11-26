export type UserRole =
  | "PLATFORM_ADMIN"
  | "ORG_OWNER"
  | "STATION_OPERATOR"
  | "BILLING_ANALYST"
  | "READ_ONLY";

export interface OrganizationMembershipInfo {
  id: string;
  name: string;
  role: UserRole;
}

export interface AuthUser {
  userId: string;
  email: string;
  name: string;
  roles: string[];
  activeOrganizationId: string;
  availableOrganizations: OrganizationMembershipInfo[];
}

export interface AuthSession {
  user: AuthUser;
  token: string;
  isAuthenticated: boolean;
}

export const SESSION_COOKIE_NAME = "voltgrid_session";

export const PRESET_PERSONAS: Record<string, AuthUser> = {
  platform_admin: {
    userId: "usr_platform_admin_001",
    email: "admin@voltgrid.lk",
    name: "Kasun Silva (Platform Admin)",
    roles: ["PLATFORM_ADMIN", "ORG_OWNER"],
    activeOrganizationId: "org_voltgrid_default",
    availableOrganizations: [
      { id: "org_voltgrid_default", name: "VoltGrid Default Operations", role: "PLATFORM_ADMIN" },
      { id: "org_ceb_pilot", name: "CEB National Grid Pilot", role: "PLATFORM_ADMIN" },
    ],
  },
  org_owner: {
    userId: "usr_org_owner_001",
    email: "owner@voltgrid.lk",
    name: "Dilshan Perera (Org Owner)",
    roles: ["ORG_OWNER"],
    activeOrganizationId: "org_voltgrid_default",
    availableOrganizations: [
      { id: "org_voltgrid_default", name: "VoltGrid Default Operations", role: "ORG_OWNER" },
    ],
  },
  station_operator: {
    userId: "usr_operator_001",
    email: "operator@voltgrid.lk",
    name: "Nimal Fernando (Station Operator)",
    roles: ["STATION_OPERATOR"],
    activeOrganizationId: "org_voltgrid_default",
    availableOrganizations: [
      { id: "org_voltgrid_default", name: "VoltGrid Default Operations", role: "STATION_OPERATOR" },
    ],
  },
  billing_analyst: {
    userId: "usr_billing_001",
    email: "billing@voltgrid.lk",
    name: "Anoma Jayasinghe (Billing Analyst)",
    roles: ["BILLING_ANALYST"],
    activeOrganizationId: "org_voltgrid_default",
    availableOrganizations: [
      { id: "org_voltgrid_default", name: "VoltGrid Default Operations", role: "BILLING_ANALYST" },
    ],
  },
  read_only: {
    userId: "usr_auditor_001",
    email: "auditor@voltgrid.lk",
    name: "Rohan De Silva (Compliance Auditor)",
    roles: ["READ_ONLY"],
    activeOrganizationId: "org_voltgrid_default",
    availableOrganizations: [
      { id: "org_voltgrid_default", name: "VoltGrid Default Operations", role: "READ_ONLY" },
    ],
  },
};

/**
 * Creates a signed/encoded JWT test token matching the backend JwtTokenValidator claims.
 */
export function createBearerToken(user: AuthUser): string {
  const header = Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString("base64url");
  const now = Math.floor(Date.now() / 1000);
  const payload = Buffer.from(
    JSON.stringify({
      sub: user.userId,
      email: user.email,
      name: user.name,
      roles: user.roles,
      tenantId: user.activeOrganizationId,
      iat: now,
      exp: now + 86400, // 24 hours
    })
  ).toString("base64url");

  return `${header}.${payload}.signature_${user.userId.substring(0, 8)}`;
}

/**
 * Encodes session into cookie value
 */
export function encodeSession(user: AuthUser, token: string): string {
  const sessionData = { user, token };
  return Buffer.from(JSON.stringify(sessionData)).toString("base64url");
}

/**
 * Decodes session from cookie value
 */
export function decodeSession(cookieValue: string): { user: AuthUser; token: string } | null {
  try {
    const raw = Buffer.from(cookieValue, "base64url").toString("utf-8");
    const parsed = JSON.parse(raw);
    if (parsed && parsed.user && parsed.user.userId && parsed.token) {
      return parsed;
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Dynamically resolves next/headers cookie store when in Next.js server runtime.
 */
async function getCookieStore() {
  try {
    const nextHeaders = await import("next/headers");
    if (typeof nextHeaders.cookies === "function") {
      return await nextHeaders.cookies();
    }
  } catch {
    // Standalone node environment or static generation
  }
  return null;
}

/**
 * Retrieves current session.
 */
export async function getSession(): Promise<AuthSession> {
  try {
    const cookieStore = await getCookieStore();
    if (cookieStore) {
      const cookie = cookieStore.get(SESSION_COOKIE_NAME);
      if (cookie?.value) {
        const decoded = decodeSession(cookie.value);
        if (decoded) {
          return {
            user: decoded.user,
            token: decoded.token,
            isAuthenticated: true,
          };
        }
      }
    }
  } catch {
    // Ignore cookie resolution failures
  }

  // Fallback dev persona
  const defaultUser = PRESET_PERSONAS.platform_admin;
  return {
    user: defaultUser,
    token: createBearerToken(defaultUser),
    isAuthenticated: true,
  };
}

/**
 * Returns auth headers to attach to upstream backend GraphQL and REST calls.
 */
export async function getAuthHeaders(): Promise<Record<string, string>> {
  try {
    const session = await getSession();
    const headers: Record<string, string> = {};

    if (session.token) {
      headers["Authorization"] = `Bearer ${session.token}`;
    }

    if (session.user?.activeOrganizationId) {
      headers["X-Tenant-Id"] = session.user.activeOrganizationId;
    }

    return headers;
  } catch {
    return {
      "X-Tenant-Id": "org_voltgrid_default",
    };
  }
}
