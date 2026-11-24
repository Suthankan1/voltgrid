# Acceptance criteria (UX-001.9)

All targets are proposed gates, not achieved measurements.

## User validation
Initial 10 participants (4 nontechnical, 4 technical, 2 management-oriented), ideally including real infrastructure operators and prior feedback participants plus newcomers. Formative rounds before final evaluation. Equivalent data/devices/task complexity for old/new; counterbalance order or separate groups to reduce learning bias. Record unaided/assisted/failed, elapsed time, navigation errors, hesitation, critical errors, post-task ease (1–7), SUS; report denominators and missing results. No coaching during timed tasks. Consent for observations/recording; avoid private or production data.

| Task | Target |
|---|---|
| Identify offline count | 10s |
| Find known station | 15s |
| Inspect faulty connector (correct EVSE + ID) | 30s |
| Find historical session | 30s |
| Identify missing session records | 30s |
| Register station in isolated local demo | 60s (excludes physical connection) |
| Locate connection guidance | 30s |
| Access technical diagnostics | 30s |
| Recover failed read | 30s |

Also test first-time understanding, all-online vs healthy distinction, meter interpretation, back/filter retention, mobile and disabled registration. Predefine starting screen and success rubric. Targets: ≥90% core task completion and ≥90% unassisted completion (attempted applicable tasks denominator; report per task too), zero critical user errors, mean ease ≥5.5/7, mean SUS ≥80/100, no mandatory onboarding or unsupported actions. Report median and spread of successful unaided task times and percentage meeting each time target; proposed gate median at or below each target, no systematic failure hidden by averages. Small samples are formative, not population estimates. If targets fail, iterate/retest; do not claim validated release.

SUS: use standard ten-item instrument with 1–5 agreement; odd items contribution response−1, even 5−response; sum ×2.5. Score is not completion percentage.

## Accessibility
Target [WCAG 2.2 AA](https://www.w3.org/TR/WCAG22/). Normal contrast ≥4.5:1, large ≥3:1, essential nontext ≥3:1 where applicable; text resize 200%, reflow at 320 CSS px subject to standard exceptions; essential touch controls target 44×44px (product target, not universal AA requirement). Keyboard all tasks, visible unobscured focus, semantic headings/landmarks, skip link, meaningful names/roles/states, status announcements, error association, no color-only states, dialog/drawer focus management, reduced motion, accessible chart alternatives. Automated axe checks plus manual keyboard, NVDA/VoiceOver where available; no unresolved identified A/AA violations; document coverage and unavailable environments. Automated score is not certification.

## Browser/responsive
Playwright Chromium/Firefox/WebKit; manual Chrome/Edge/Safari where available. Viewports 320×568, 390×844, 430×932, 768×1024, 1024×768, 1280×800, 1440×900, 1920×1080. No clipped essential controls, unintended overflow, inaccessible navigation or overlapping text; controlled scroll for wide tables.

## Performance
Production build, documented hardware/network/fixture and repeated lab runs. Core Web Vitals targets LCP ≤2.5s, INP ≤200ms, CLS ≤0.1 at field 75th percentile by device when field data exists ([reference](https://web.dev/articles/vitals)). Lab data separate; Lighthouse performance ≥90 and accessibility 100 targets, local feedback ~100ms where practical, preserve bounded API timeouts. Use lab interaction measurements as proxies, not field INP claims. No unexplained material regression; document measurements and limitations.

## Functional / regression matrix
| Scope | Required tests |
|---|---|
| Shell | Active links, breadcrumbs, keyboard drawer/focus, responsive navigation, legacy redirects and identifier safety |
| Overview | Full snapshot counts, zero denominator, offline filter links, empty vs unavailable, refresh |
| Stations | Search + status, no matches, back/URL context, read-only registration |
| Station | Null vs failed lookup, partial sections, EVSE identity, offline last reported, tabs |
| Registration | Trim, exact regex, max lengths, duplicate, pending double-submit, uncertain verification, server gate and request host, confirmed success |
| Sessions | Exact supported filters, page scope active, reset page, server counts, composite IDs |
| Session | Valid/invalid timing, integrity independent of lifecycle, late event refresh, raw samples and compatible streams, no fabricated gaps or totals |
| Attention | Independent category failures, valid server count, scoped previews, no false healthy claim |
| Diagnostics | Status filter and cursor reset regression, two timestamps, asynchronous disagreement, safe links |
| Help/shared states | Guidance accuracy, loading/empty/no-match/stale/unavailable/not-found/partial recovery |

Preserve server-only configuration, no secrets/client backend endpoint leakage, sanitized errors, validated payloads, local-only write restrictions, safe route encoding/decoding; no new backend mutations. Test delayed and malformed responses, GraphQL errors, non-2xx and timeout. No critical/high-risk exploitable vulnerabilities unresolved.

## Testing layers and commands
From apps/operator-web with pinned pnpm and lockfile: pnpm test; pnpm lint; pnpm exec tsc --noEmit; pnpm build; pnpm test:e2e; pnpm test:e2e:live (requires documented local Compose stack). Existing package scripts verified at baseline; no runs executed for UX-002. Retain existing client/browser/live guarantees; historical test counts are not current evidence. Add component tests if needed, axe, visual screenshot baselines and Lighthouse CI in separate slices; proposed test:a11y, test:visual, test:performance do not yet exist. No fixture data in production. Keep backend regressions intact.

## Release gates (all required for completed redesign)
- G1 Visual: approved tokens/logo, consistent components, all screen specifications.
- G2 Functional: unit/component/browser/live E2E pass, legacy paths, preserved behaviors.
- G3 Accessibility: manual and automated evidence, identified A/AA defects resolved.
- G4 Responsive: documented browser and viewport matrix verified.
- G5 Performance: production build, lab targets evaluated, material regressions resolved, field evidence separately reported when available.
- G6 Data/security: correct scope, failure semantics, measurement normalization, registration restrictions, vulnerability review.
- G7 User validation: representative testing, targets met, retests and no critical/high defects.
- G8 Release: CI green, documentation and limitations updated, rollback verified, owner sign-off.

Severity P0 critical: unsafe writes, misleading operational data, security/data corruption. P1 high: core journey blocked or essential accessibility/navigation broken. P2 medium: workaround available. P3 minor visual. Zero open P0/P1; P2/P3 may defer with documented rationale only if mandatory gates still met. Release is local-console milestone; public production requires separate security/deployment work. Each feature: implement → test applicable states → responsive/a11y/data review → regression → small commit. Evidence includes commit, commands/results, screenshots, test fixture, user study report, defect list and reviewer.
