import * as oidc from "openid-client";
import { createRemoteJWKSet, jwtVerify } from "jose";

import { readOidcConfig, readOperatorOrigin } from "./oidc-config.mjs";

export function appOrigin(): string {
  return readOperatorOrigin().origin;
}

async function discover() {
  const { issuer, id, secret, audience, local } = readOidcConfig();
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
