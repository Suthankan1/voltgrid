import * as oidc from "openid-client";
import { createRemoteJWKSet, jwtVerify } from "jose";

export function appOrigin(): string {
  const url = new URL(process.env.OPERATOR_WEB_ORIGIN ?? "");
  const localhost = ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname);
  if (url.protocol !== "https:" && !(url.protocol === "http:" && localhost && process.env.OIDC_LOCAL_HTTP === "true")) {
    throw new Error("Operator origin requires HTTPS");
  }
  return url.origin;
}

async function discover() {
  const issuer = new URL(process.env.OIDC_ISSUER ?? "");
  if (issuer.pathname.includes("/.well-known/")) throw new Error("OIDC issuer must be an issuer identifier");
  const id = process.env.OIDC_CLIENT_ID;
  const secret = process.env.OIDC_CLIENT_SECRET;
  const audience = process.env.OIDC_AUDIENCE ?? "voltgrid-api";
  if (!id || !secret) throw new Error("OIDC client configuration is incomplete");

  const local = issuer.protocol === "http:" &&
    ["localhost", "127.0.0.1", "[::1]"].includes(issuer.hostname) &&
    process.env.OIDC_LOCAL_HTTP === "true" &&
    new URL(appOrigin()).protocol === "http:";
  const client = await oidc.discovery(issuer, id, secret, undefined, {
    timeout: 5,
    execute: local
      ? [oidc.allowInsecureRequests, oidc.enableNonRepudiationChecks]
      : [oidc.enableNonRepudiationChecks],
  });
  const metadata = client.serverMetadata();
  if (new URL(metadata.issuer).href !== issuer.href) throw new Error("OIDC issuer mismatch");
  const jwksUrl = providerEndpoint(metadata.jwks_uri);
  providerEndpoint(metadata.authorization_endpoint);
  providerEndpoint(metadata.token_endpoint);
  const keys = createRemoteJWKSet(jwksUrl);

  function providerEndpoint(value: string | undefined) {
    if (!value) throw new Error("OIDC provider endpoint is missing");
    const url = new URL(value);
    if (url.protocol !== "https:" && !(local && url.protocol === "http:" && url.origin === issuer.origin)) {
      throw new Error("OIDC provider endpoint requires HTTPS");
    }
    return url;
  }

  return {
    client,
    async verify(token: string, subject: string) {
      const verified = await jwtVerify(token, keys, {
        issuer: metadata.issuer,
        audience,
        subject,
        algorithms: ["RS256"],
        requiredClaims: ["exp", "sub"],
      });
      if (typeof verified.payload.sub !== "string" || !verified.payload.sub.trim()) {
        throw new Error("Missing OIDC subject");
      }
      if (verified.payload.typ !== "Bearer") throw new Error("Invalid Keycloak access token purpose");
      return verified;
    },
  };
}

let provider: ReturnType<typeof discover> | undefined;
export function getProvider() {
  provider ??= discover().catch((error: unknown) => {
    provider = undefined;
    throw error;
  });
  return provider;
}

export { oidc };
