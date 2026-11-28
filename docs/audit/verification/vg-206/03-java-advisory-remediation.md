# VG-206 Java advisory remediation

Base `88584e07f636666152d88b76e3098e60ca570b9a`. Tracks [#8](https://github.com/Suthankan1/voltgrid/issues/8).

The three service POMs move to Spring Boot 4.1.3, which manages Jackson 3.1.8. They select Tomcat 11.0.29 and Guava 33.8.0-android. The Station and Operations POMs also select LZ4 1.11.4 and Snappy 1.1.10.12.

| Baseline advisory IDs | Severity | Baseline → selected | Affected service scopes and defensive reachability review |
| --- | --- | --- | --- |
| CVE-2026-65182, CVE-2026-65637, CVE-2026-65905, CVE-2026-68525 | Critical | Tomcat core 11.0.24 → 11.0.29 | All three. Embedded HTTP is on the runtime request boundary. Advisory-specific connector and deployment conditions require separate validation. |
| CVE-2026-89407, CVE-2026-89425 | High | Jackson core 3.1.5 → 3.1.8 | All three. External input reaches JSON parsers, including Station OCPP and HTTP. Parser mode and default limits affect advisory-specific reachability. |
| CVE-2026-68497, CVE-2026-91776, CVE-2026-91777 | High | Jackson databind 3.1.5 → 3.1.8 | All three. Runtime JSON binding is present. Application use of the specific deserialization modes remains unverified. |
| CVE-2026-102554 | High | Guava 33.6.0-android → 33.8.0-android | Authorization and Station. The library is present. Exposure of the affected deserialization path remains unverified. |
| CVE-2026-106451 | High | LZ4 1.10.1 → 1.11.4 | Operations and Station. Kafka transport can carry compressed records. Actual exposure depends on broker ingress and negotiated record compression. |
| CVE-2026-108106, CVE-2026-93451 | High | Snappy 1.1.10.7 → 1.1.10.12 | Operations and Station. The same broker and compression boundaries apply. |

Each row is dispositioned as a version upgrade verified by local rescan. No exception was applied. The scoped scans used Trivy 0.76.2 image digest `sha256:8f6bb947dbc528902e11f2f5be52f7b519f6a39d5d148f41166f2040499768fb`, advisory DB schema 2 from 2026-11-27 13:04 UTC, CycloneDX Maven Plugin 2.9.1, and `trivy sbom --skip-db-update --pkg-types library --list-all-pkgs --format json`. The old counts are from the same database on the PR #94 head recorded in #8.

| SBOM scope | Prior Critical / High | Patched packages | Patched Critical / High / Medium / Low | Maven verification |
| --- | --- | ---: | --- | --- |
| Authorization | 4 / 6 | 133 | 0 / 0 / 0 / 0 | 49 passed |
| Operations | 4 / 8 | 147 | 0 / 0 / 1 / 0 | 84 passed |
| Station | 4 / 9 | 166 | 0 / 0 / 1 / 0 | 307 passed |

The Operations and Station scans still matched Medium CVE-2026-118259 for OpenTelemetry API 1.62.0. The database reports a fix in 1.67.0. Align the API with the corresponding SDK and revalidate telemetry before changing its managed version. Each Maven run used `mvn -B -ntp -f <service-pom> verify org.cyclonedx:cyclonedx-maven-plugin:2.9.1:makeAggregateBom` with zero failures, errors or skips.

Residual release work includes fresh runtime image scans and remediation, AWS-0030 (ECR scan policy), AWS-0053/AWS-0054 (public ingress and HTTP path), AWS-0104 (service egress), hosted enforcement evidence, provenance and fork-isolation verification, and independent review. No infrastructure was provisioned or modified. The POM change requires no migration.

Sources: [Apache Tomcat 11 security advisories](https://tomcat.apache.org/security-11.html), [Jackson 3.1.7 fixes](https://github.com/FasterXML/jackson/wiki/Jackson-Release-3.1.7), [Spring Boot 4.1.3 dependency BOM](https://repo.maven.apache.org/maven2/org/springframework/boot/spring-boot-dependencies/4.1.3/spring-boot-dependencies-4.1.3.pom).

The GitHub backend SBOM job now uses a read-only checkout and the same pinned Trivy image to enforce the High/Critical Java library policy. It downloads its advisory database once, scans each BOM with networking disabled, fails if any policy check fails, and retains SBOM and scan artifacts. A local controlled check with the prior Authorization SBOM exited 42. The patched Authorization SBOM exited 0 with the same image and database. Hosted workflow and fork behavior require final-head CI evidence.
