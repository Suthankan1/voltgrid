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
  const id = process.env.OIDC_CLIENT_ID;
  const secret = process.env.OIDC_CLIENT_SECRET;
  const audience = process.env.OIDC_AUDIENCE ?? "voltgrid-api";
  if (!id || !secret) throw new Error("OIDC client configuration is incomplete");

  const local = issuer.protocol === "http:" &&
    ["localhost", "127.0.0.1", "[::1]"].includes(issuer.hostname) &&
    process.env.OIDC_LOCAL_HTTP === "true" &&
    new URL(appOrigin()).protocol === "http:";
  const client = await oidc.discovery(issuer, id, secret, undefined, {
    execute: local
      ? [oidc.allowInsecureRequests, oidc.enableNonRepudiationChecks]
      : [oidc.enableNonRepudiationChecks],
  });
  const metadata = client.serverMetadata();
  if (!metadata.jwks_uri) throw new Error("OIDC provider is missing JWKS");
  const jwksUrl = new URL(metadata.jwks_uri);
  if (jwksUrl.protocol !== "https:" && !(local && jwksUrl.origin === issuer.origin)) {
    throw new Error("OIDC JWKS requires HTTPS");
  }
  const keys = createRemoteJWKSet(jwksUrl);
  return {
    client,
    verify: (token: string, subject: string) => jwtVerify(token, keys, {
      issuer: metadata.issuer,
      audience,
      subject,
      algorithms: ["RS256"],
      requiredClaims: ["exp", "sub"],
    }),
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
