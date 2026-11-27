# VG-202 Identity and Access Management Final Acceptance Dossier

**READY FOR VG-203.** All VG-202 acceptance criteria and remediation slices (R.2 through R.6) have been verified with exhaustive negative test suites, reviewed, and merged into `main`. This dossier compiles the complete verification evidence.

- [Historical migration and recovery procedure](02-historical-migration-verification.md)
- [Authentication boundaries, Keycloak token-purpose policy and Java JWKS verification](03-authentication-and-session-verification.md)
- [Station and Operations signed JWT HTTP validation](03a-jwt-http-acceptance.md)
- [BFF OIDC provider, token policy and callback evidence](03b-bff-oidc-provider-acceptance.md)
- [OIDC startup configuration](03c-oidc-startup-configuration.md)
- [Operator mutation boundary](03d-operator-mutation-boundary.md)
- [Browser cookie and cache lifecycle](03e-browser-cookie-and-cache.md)
- [GraphQL authorization inventory](04-graphql-authorization-inventory.md)
- [Station membership HTTP matrix](04a-station-membership-http-matrix.md)
- [Browser membership lifecycle](04b-browser-membership-lifecycle.md)
- [Operations membership HTTP matrix](04c-operations-membership-http-matrix.md)
- [Integrated cross-service membership lifecycle](04d-integrated-membership-lifecycle.md)
- [Device credentials, versioned PBKDF2, concurrency limits and running gRPC matrix](05-device-credentials-and-grpc-lifecycle.md)
- [Approved ownership mapping and administrative audit lifecycle](06-ownership-mapping-and-audit-lifecycle.md)
- [Local test and review evidence](08-test-and-review-evidence.md)
- [Consolidated findings disposition](09-findings-disposition.md)
