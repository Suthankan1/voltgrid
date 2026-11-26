import { getAuthHeaders } from "./auth";

export interface OrganizationRecord {
  id: string;
  name: string;
  status: string;
  createdAt: string;
  updatedAt: string;
}

export interface SiteRecord {
  id: string;
  organizationId: string;
  name: string;
  status: string;
  createdAt: string;
}

export interface MemberRecord {
  id: string;
  organizationId: string;
  userId: string;
  userEmail: string;
  role: string;
  status: string;
  createdAt: string;
  updatedAt: string;
}

export interface AuditEventRecord {
  id: string;
  organizationId: string | null;
  eventType: string;
  actorId: string;
  actorType: string;
  resourceType: string;
  resourceId: string;
  action: string;
  outcome: string;
  correlationId: string | null;
  metadata: string | null;
  createdAt: string;
}

export interface AuditEventPageRecord {
  content: AuditEventRecord[];
  totalElements: number;
  totalPages: number;
  number: number;
  size: number;
}

export interface StationCredentialRecord {
  credentialId: string;
  stationId: string;
  credentialType: string;
  status: string;
  createdAt: string;
}

async function executeGraphQl<T>(query: string, variables: Record<string, unknown> = {}): Promise<T> {
  const endpoint = process.env.STATION_GRAPHQL_URL || "http://localhost:8081/graphql";
  const authHeaders = await getAuthHeaders();

  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...authHeaders,
    },
    body: JSON.stringify({ query, variables }),
    cache: "no-store",
    signal: AbortSignal.timeout(6000),
  });

  if (!response.ok) {
    throw new Error(`Station GraphQL returned HTTP ${response.status}`);
  }

  const payload = await response.json();
  if (payload.errors?.length) {
    throw new Error(payload.errors[0].message || "GraphQL error occurred");
  }

  return payload.data as T;
}

function isDynamicServerError(error: unknown): boolean {
  return typeof error === "object" && error !== null && (error as { digest?: string }).digest === "DYNAMIC_SERVER_USAGE";
}

export async function getOrganizations(): Promise<OrganizationRecord[]> {
  try {
    const data = await executeGraphQl<{ organizations: OrganizationRecord[] }>(`
      query GetOrganizations {
        organizations {
          id
          name
          status
          createdAt
          updatedAt
        }
      }
    `);
    return data.organizations || [];
  } catch (error) {
    if (isDynamicServerError(error)) throw error;
    console.error("Failed to load organizations:", error);
    return [
      {
        id: "org_voltgrid_default",
        name: "VoltGrid Default Operations",
        status: "ACTIVE",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    ];
  }
}

export async function getSites(organizationId: string): Promise<SiteRecord[]> {
  try {
    const data = await executeGraphQl<{ sites: SiteRecord[] }>(
      `
      query GetSites($organizationId: ID!) {
        sites(organizationId: $organizationId) {
          id
          organizationId
          name
          status
          createdAt
        }
      }
    `,
      { organizationId }
    );
    return data.sites || [];
  } catch (error) {
    if (isDynamicServerError(error)) throw error;
    console.error("Failed to load sites:", error);
    return [];
  }
}

export async function getOrganizationMembers(organizationId: string): Promise<MemberRecord[]> {
  try {
    const data = await executeGraphQl<{ organizationMembers: MemberRecord[] }>(
      `
      query GetMembers($organizationId: ID!) {
        organizationMembers(organizationId: $organizationId) {
          id
          organizationId
          userId
          userEmail
          role
          status
          createdAt
          updatedAt
        }
      }
    `,
      { organizationId }
    );
    return data.organizationMembers || [];
  } catch (error) {
    if (isDynamicServerError(error)) throw error;
    console.error("Failed to load members:", error);
    return [];
  }
}

export async function getAdministrativeAuditEvents(
  organizationId: string,
  page = 0,
  size = 25
): Promise<AuditEventPageRecord> {
  try {
    const data = await executeGraphQl<{ administrativeAuditEvents: AuditEventPageRecord }>(
      `
      query GetAuditEvents($organizationId: ID!, $page: Int, $size: Int) {
        administrativeAuditEvents(organizationId: $organizationId, page: $page, size: $size) {
          content {
            id
            organizationId
            eventType
            actorId
            actorType
            resourceType
            resourceId
            action
            outcome
            correlationId
            metadata
            createdAt
          }
          totalElements
          totalPages
          number
          size
        }
      }
    `,
      { organizationId, page, size }
    );
    return data.administrativeAuditEvents || { content: [], totalElements: 0, totalPages: 0, number: 0, size };
  } catch (error) {
    if (isDynamicServerError(error)) throw error;
    console.error("Failed to load audit events:", error);
    return { content: [], totalElements: 0, totalPages: 0, number: 0, size };
  }
}

export async function createOrganizationAction(id: string, name: string): Promise<OrganizationRecord> {
  const data = await executeGraphQl<{ createOrganization: OrganizationRecord }>(
    `
    mutation CreateOrganization($input: CreateOrganizationInput!) {
      createOrganization(input: $input) {
        id
        name
        status
        createdAt
        updatedAt
      }
    }
  `,
    { input: { id, name } }
  );
  return data.createOrganization;
}

export async function createSiteAction(id: string, organizationId: string, name: string): Promise<SiteRecord> {
  const data = await executeGraphQl<{ createSite: SiteRecord }>(
    `
    mutation CreateSite($input: CreateSiteInput!) {
      createSite(input: $input) {
        id
        organizationId
        name
        status
        createdAt
      }
    }
  `,
    { input: { id, organizationId, name } }
  );
  return data.createSite;
}

export async function inviteMemberAction(
  organizationId: string,
  userId: string,
  userEmail: string,
  role: string
): Promise<MemberRecord> {
  const data = await executeGraphQl<{ inviteMember: MemberRecord }>(
    `
    mutation InviteMember($input: InviteMemberInput!) {
      inviteMember(input: $input) {
        id
        organizationId
        userId
        userEmail
        role
        status
        createdAt
        updatedAt
      }
    }
  `,
    { input: { organizationId, userId, userEmail, role } }
  );
  return data.inviteMember;
}

export async function updateMemberRoleAction(
  organizationId: string,
  userId: string,
  role: string
): Promise<MemberRecord> {
  const data = await executeGraphQl<{ updateMemberRole: MemberRecord }>(
    `
    mutation UpdateMemberRole($organizationId: ID!, $userId: String!, $role: String!) {
      updateMemberRole(organizationId: $organizationId, userId: $userId, role: $role) {
        id
        organizationId
        userId
        userEmail
        role
        status
        createdAt
        updatedAt
      }
    }
  `,
    { organizationId, userId, role }
  );
  return data.updateMemberRole;
}

export async function revokeMemberAction(organizationId: string, userId: string): Promise<boolean> {
  const data = await executeGraphQl<{ revokeMember: boolean }>(
    `
    mutation RevokeMember($organizationId: ID!, $userId: String!) {
      revokeMember(organizationId: $organizationId, userId: $userId)
    }
  `,
    { organizationId, userId }
  );
  return data.revokeMember;
}

export async function provisionStationCredentialAction(
  stationId: string,
  password: string
): Promise<StationCredentialRecord> {
  const data = await executeGraphQl<{ provisionStationCredential: StationCredentialRecord }>(
    `
    mutation ProvisionCredential($input: ProvisionCredentialInput!) {
      provisionStationCredential(input: $input) {
        credentialId
        stationId
        credentialType
        status
        createdAt
      }
    }
  `,
    { input: { stationId, password } }
  );
  return data.provisionStationCredential;
}

export async function rotateStationCredentialAction(
  stationId: string,
  newPassword: string
): Promise<StationCredentialRecord> {
  const data = await executeGraphQl<{ rotateStationCredential: StationCredentialRecord }>(
    `
    mutation RotateCredential($input: RotateCredentialInput!) {
      rotateStationCredential(input: $input) {
        credentialId
        stationId
        credentialType
        status
        createdAt
      }
    }
  `,
    { input: { stationId, newPassword } }
  );
  return data.rotateStationCredential;
}

export async function revokeStationCredentialAction(stationId: string): Promise<boolean> {
  const data = await executeGraphQl<{ revokeStationCredential: boolean }>(
    `
    mutation RevokeCredential($stationId: ID!) {
      revokeStationCredential(stationId: $stationId)
    }
  `,
    { stationId }
  );
  return data.revokeStationCredential;
}
