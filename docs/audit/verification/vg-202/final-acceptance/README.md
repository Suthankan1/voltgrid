# VG-202R.2 partial acceptance evidence

**NOT READY FOR VG-203.** The PostgreSQL Station upgrade now has an offline procedure and a historical-data regression suite. Operations projection and receipt preservation have a separate migration test. This dossier records that scope. Full VG-202 application acceptance remains open.

- [Historical migration and recovery procedure](02-historical-migration-verification.md)
- [Current GraphQL authorization inventory](04-graphql-authorization-inventory.md)
- [Local test and review evidence](08-test-and-review-evidence.md)
- [Findings disposition](09-findings-disposition.md)
- The PostgreSQL audit trigger has a regression case for update, delete and truncate. Database role separation, denied-action coverage and transactional audit behavior still require dedicated evidence.
- Station preserves the final active owner during revocation and role downgrade. The supporting PostgreSQL test verifies concurrent removal attempts serialize at commit. Browser and Operations revocation propagation remain open.
- Operations projection replay, explicit historical ownership mapping, and two-organization GraphQL coverage remain open.
- Genuine OIDC signing-key rotation and outage behavior, application session lifecycle, active membership revocation and propagation time, device authentication throttling and commit-boundary concurrency, internal gRPC identity, HMAC lifecycle and secure startup still require acceptance evidence.
- Full secure-mode CI, Java dependency and configuration scans, the expanded authenticated end-to-end lifecycle and independent acceptance remain open. A separate agent reviewed the migration change. Independent review of the full application remains open.

Production transport and distributed operation remain separate VG-203 and VG-204 gates. Production activation requires independent release acceptance and owner approval.

## VG-202R.3 partial evidence

- [Authentication boundaries, Keycloak token-purpose policy and Java JWKS verification](03-authentication-and-session-verification.md)

## VG-202R.3B backend acceptance

- [Station and Operations signed JWT HTTP validation](03a-jwt-http-acceptance.md)
## VG-202R.3C BFF acceptance

- [BFF OIDC provider, token policy and callback evidence](03b-bff-oidc-provider-acceptance.md)
