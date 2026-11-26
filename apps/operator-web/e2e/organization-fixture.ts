import type { IncomingMessage, ServerResponse } from "node:http";

export function respondToOrganizationAccess(request: IncomingMessage, response: ServerResponse) {
  const url = new URL(request.url ?? "/", "http://127.0.0.1");
  if (url.pathname !== "/api/operator/organization-access") return false;

  const organizationId = url.searchParams.get("organizationId");
  if (organizationId !== "org_fixture_a" || !request.headers.authorization?.startsWith("Bearer ")) {
    response.writeHead(403).end();
  } else {
    response.setHeader("Content-Type", "application/json");
    response.end(JSON.stringify({ organizationId, role: "ORG_OWNER" }));
  }
  return true;
}
