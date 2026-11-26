# Local operator OIDC fixture

Use this setup with an isolated station database. The realm has two synthetic users, an authorization-code client with S256 PKCE, and the API audience mapper. The SQL fixture gives Operator A an owner role in Organization A and a support role in Organization B. Operator B belongs to Organization B only. [Keycloak container documentation](https://www.keycloak.org/server/containers)

Generate temporary credentials in the same shell you use to start the fixture.

```sh
export VG_TEST_OIDC_CLIENT_SECRET=$(openssl rand -hex 32)
export VG_TEST_OIDC_PASSWORD=$(openssl rand -hex 24)
docker compose -f compose.oidc-test.yaml up -d
export OIDC_ISSUER=http://127.0.0.1:8180/realms/voltgrid-test
export VOLTGRID_SECURITY_JWT_ISSUER="$OIDC_ISSUER"
export VOLTGRID_SECURITY_JWT_JWK_SET_URI="$OIDC_ISSUER/protocol/openid-connect/certs"
export AUTHORIZATION_TOKEN_HMAC_KEY=$(openssl rand -hex 32)
export SERVICE_IDENTITY_STATION_SERVICE_KEY=$(openssl rand -hex 32)
```

For the local Compose stack, use a JWKS URL reachable from inside the Java service containers. On Docker Desktop use `http://host.docker.internal:8180/realms/voltgrid-test/protocol/openid-connect/certs` as `SERVICE_OIDC_JWKS_URI`. Keep the issuer set to the URL used by the browser. For JVMs running directly on the host, use the loopback JWKS URL above.

After Station Service applies Flyway, load [organizations.sql](organizations.sql) into the isolated station database. Set the following variables before starting operator web at `127.0.0.1:3000`.

```sh
export OPERATOR_WEB_ORIGIN=http://127.0.0.1:3000
export OIDC_LOCAL_HTTP=true
export OIDC_CLIENT_ID=voltgrid-operator-web
export OIDC_CLIENT_SECRET="$VG_TEST_OIDC_CLIENT_SECRET"
export STATION_GRAPHQL_URL=http://127.0.0.1:8080/graphql
export OPERATIONS_GRAPHQL_URL=http://127.0.0.1:8081/graphql
```

Open the console and sign in as `operator-a` or `operator-b` using the generated fixture password. Application logout invalidates the server-side session. The provider can retain its own single-sign-on session.

The BFF session store lives in one Node process. A restart clears sessions, and scaled deployments require a shared session store before rollout. For a real provider, configure HTTPS, a confidential client, the exact callback URL, a dedicated access-token audience, and a provider-controlled default organization claim. Keep one trusted issuer per deployment because existing memberships identify users by subject. Assign any platform administration claim through restricted provider configuration.

With the fixture running and Chromium installed through Playwright, run the live browser check from the repository root.

```sh
node integration-tests/oidc/operator-session.mjs
```

Station and Operations require an RS256-signed JWT with the configured realm
issuer, API audience, a nonblank subject, expiration, and the signed Keycloak
payload claim `typ: Bearer`. Keep the browser client ID distinct from the API
audience and map the API audience into access tokens only. This policy applies
to the Keycloak bearer configuration used by the fixture. Review these claims
before changing providers or enabling a different Keycloak token type.
[Keycloak 26.8.2 token issuance](https://github.com/keycloak/keycloak/blob/26.8.2/services/src/main/java/org/keycloak/protocol/oidc/TokenManager.java#L1431)
