# VG-202R remediation status

PR #66 was merged at `e4b621d97d57d416bc33df0ff96534882d964b24` from head `667904a1e86b35db5dd4b93496b1ef32e454d871`. The remediation branch is based on that merge. Issues #4, #12–16 and #64 were open when checked. VG-202 remains open and VG-203 readiness is withheld.

| Finding | Changes on the remediation branch | Verification and remaining work |
| --- | --- | --- |
| IAM-001 | Station and Operations use issuer, audience, expiration and subject validation plus asymmetric JWKS verification. The BFF verifies the access token independently. | Real Keycloak login and Station API authorization exercised. Rotation, provider outage, and a full signed-token test matrix remain open. |
| IAM-002–004 | The operator layout requires a session. Keycloak authorization code flow uses PKCE, state and nonce. Opaque session IDs reference bounded server-side storage with expiration, revocation and serialized refresh. | Missing session, successful sign-in and logout exercised in a browser. Sessions live in one process, and the provider may retain its SSO session after application logout. |
| IAM-005 | Operations checks active membership and station-read permission with Station Service on each authenticated request and passes the authorized organization into projection queries. | The live stack projected the test station through Kafka and displayed its state in the owning organization. Cross-tenant Operations coverage for every projection endpoint remains open. |
| IAM-006–007 | Station and transaction queries use organization-scoped reads. Meter readings and sequence integrity each require their own permission. Organization switches resolve membership, organization status and the destination role on Station Service. Successful switches generate an audit event. | A real login and switch from owner to support succeeded, with results scoped to each selected organization. Full coverage of transaction fields, pagination boundaries, and membership lifecycle remains pending. |
| IAM-008 | New Flyway migrations remove unsafe ownership defaults and seeded credentials, quarantine legacy assignments, and retain identifiers. Station V18 also enforces tenant-consistent site ownership and quarantines legacy default assignments with no site. The historical migration checksums are preserved. | Fresh Station schema migration passed. An isolated pre-V15 station and transaction were retained after quarantine, and the new database constraint rejected a cross-organization site assignment. A 255-character station identifier and its credential association were accepted after migration. Upgrades with legacy IDs that overflow V15's original credential ID column still need a pre-V15 remediation procedure and test. Historical ownership needs an approved mapping before quarantined assets become visible. |
| IAM-009 | Basic authentication binds the requested station to a stored credential. Active sessions recheck credential validity and are fenced on committed rotation or revocation. | The live charging run verified Basic authentication, boot, heartbeat, and that rotating or revoking a credential closes its socket and rejects it on reconnect. Concurrent revocation/registration and multi-replica fencing need dedicated integration evidence. Production WSS, credential entropy policy, and device-level throttling remain open. |
| IAM-010–011 | The local Compose stack requires generated service identity and HMAC keys. Authorization rejects unsafe startup defaults, and integration tests attach a generated service key. Production profiles validate gRPC TLS settings. | Local authenticated gRPC integration uses test transport. TLS interoperability, per-service privilege restrictions, and operational rotation remain open. |
| Administrative audit | Successful administrative changes join the mutation transaction. Metadata accepts a fixed set of structured fields. Station V17 adds a database trigger that blocks modification and deletion. | The live browser displayed rotation and revocation events. Production database role separation, denied-action coverage, and retention remain open. |

The previous dossier overstated completion. Its claims about OIDC, JWT signature verification, encrypted sessions, tenant isolation, device authentication, internal service credentials and audit immutability should not be used for release sign-off. The prior implementation had persona-based identity and Base64 browser sessions. The remediation uses an OIDC provider and opaque handles.

The local browser fixture and scope are documented in the [OIDC test guide](../../../../integration-tests/oidc/README.md). The authenticated browser and simulated charging flow passed locally. Representative legacy upgrade testing, the remaining acceptance cases below, comprehensive security scans and independent acceptance review remain open.

## Verification record

- The live Playwright check against Keycloak and Station Service verified anonymous denial, OIDC sign-in, an opaque HttpOnly session, a role change from owner to support on switching organizations, distinct station lists, denial of a direct cross-tenant station lookup, and application logout.
- All 172 operator web unit tests passed. TypeScript, ESLint, the production build and the automated Chromium accessibility audit passed. The 35 passing cases from the Chromium regression run and the successful rerun of its isolated two-origin journey covered all 36 cases. The final npm registry audit reported zero advisories in production and development dependencies after patching minimatch.
- Station Maven verification passed with explicit legacy HTTP and OCPP settings for its pre-existing integration fixtures. The Operations Maven gate passed with the explicit legacy HTTP test setting. Authorization Maven verification and all four black-box authorization-flow tests passed with generated test keys and authenticated gRPC requests.
- Station's historic PBKDF2 format still uses 65,536 iterations with a unique salt. This is below OWASP's PBKDF2-HMAC-SHA256 work factor for human passwords. The local fixture uses generated high-entropy secrets. Production use requires assessing credential generation, benchmarking a versioned work-factor increase, and limiting concurrent authentication work. [OWASP password storage guidance](https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html)

## Live acceptance coverage

- Browser access required an active session. Keycloak issued the token, Station Service verified it, and a switch resolved the destination organization's role from PostgreSQL.
- An owner registered a station and provisioned an OCPP credential. An anonymous connection was rejected. The simulator completed authenticated boot, heartbeat and connector reporting. An isolated RFID token was accepted through authenticated gRPC.
- The simulator started and ended sessions and submitted meter samples. The operator saw the session and its samples. The outbox relayed connectivity events through Kafka, and the Operations projection reflected the owner's station state online and after disconnect.
- A second organization could not open the station. The owner rotated and revoked credentials, both actions closed connected device sessions, and the browser displayed the audit events. Browser logout invalidated the application session.
- Registering in a specified site, cross-tenant denial for every transaction and projection field, and revoking a membership while its browser session is active remain open as live acceptance cases. The latter has focused unit coverage.

## Local gate totals

| Command | Result |
| --- | --- |
| Station `./mvnw -q verify` | 193 tests passed. A targeted rerun also passed the added quarantined-device case. |
| Operations `./mvnw -q verify` | 33 tests passed |
| Authorization `./mvnw -q verify` | 30 tests passed |
| Authorization flow `mvn -q verify` | 4 tests passed |
| Operator `pnpm test` | 172 tests passed |
| Operator `pnpm lint`, `pnpm exec tsc --noEmit`, `pnpm build` | Passed |
| Operator Chromium UI and accessibility | 35 passed in the broad run, followed by successful targeted reruns of the repaired two-origin and accessibility fixtures |
| Operator `pnpm test:e2e:live` | 1 passed against the isolated Keycloak, Station, Authorization, Kafka, Operations and PostgreSQL stack |
| Operator `pnpm audit` | 0 advisories reported after the minimatch update |
| Operator WebKit matrix | 18 tests passed |

Local verification used Java 25, Maven 3.9.16, Node 24, pnpm 12.4.2, PostgreSQL 18.6, Keycloak 26.8.2, and Kafka 4.2.1. Firefox failed to launch its temporary browser profile on the local macOS host.

For databases still below V15, inventory station identifiers longer than 59 characters before attempting that migration. V15 prefixes the original station ID when seeding its old credential ID, so this historical step can fail before the forward fixes apply. Keep the migration history intact and use a separately validated upgrade procedure for affected databases.

The VG-202R.2 historical upgrade procedure and regression scope are recorded in the [final acceptance dossier](final-acceptance/README.md).

## VG-202R.3 authentication slice

Station and Operations enforce the configured Keycloak bearer access-token
type. Both Java decoder suites verified rotation, warm-cache outage behavior,
expiry and recovery. HTTP matrices and browser authentication acceptance remain
open. [Authentication verification](final-acceptance/03-authentication-and-session-verification.md)

## VG-202R.3B backend JWT HTTP acceptance

Station and Operations exercise the production RS256 decoder and
authentication filter through HTTP, including signed token purpose, rejected
requests stopping before GraphQL, and request-context cleanup. Browser and
provider failure acceptance remains open.
[Backend JWT HTTP acceptance](final-acceptance/03a-jwt-http-acceptance.md)

## VG-202R.3C BFF and provider acceptance

The BFF aligns its signed access-token purpose check with Station and
Operations. Controlled JWT, JWKS, discovery, provider failure and callback
tests verify IAM-001 and IAM-003 within this slice. Initial session creation
adds evidence for IAM-002 and IAM-004. The complete browser session lifecycle
remains open under VG-202R.3D. [BFF OIDC provider acceptance](final-acceptance/03b-bff-oidc-provider-acceptance.md)
