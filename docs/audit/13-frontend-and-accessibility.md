# 13 — Frontend and Accessibility Review

> **Audit**: VG-200 · **Commit**: `e6bf891` · **Date**: 2026-11-26

## Overview

The operator-facing frontend (`apps/operator-web`) was completely overhauled during the recent redesign milestone (PR #1, merged at `e6bf891`). This audit reviewed the implementation for visual design fidelity, architectural compliance, code health, accessibility standards, and outstanding human validation gates.

---

## 1. Visual Design & Brand Foundation

### Approved "Orchid & Clay" System
- **Status**: **Fully Preserved & Verified**.
- Implemented strictly via CSS custom properties and utility classes:
  - Tokens defined in `apps/operator-web/src/app/design-tokens.css` and `globals.css`.
  - Canonical palette: Deep Orchid (`#2D1F3D`), Desert Clay (`#E07A5F`), Crisp White, and Neutral Muted surfaces.
  - Zero arbitrary ad-hoc colors outside the approved design tokens.
- **Brand Assets**:
  - `Voltmark` and `VoltmarkLockup` components with canonical proportions.
  - Valid multi-size `favicon.ico` (16, 32, 48, 64px) and scalable `icon.svg`.

### Component Primitives
- Primitive barrel export at `src/components/ui/index.ts` covering:
  - `Alert`, `Badge`, `Button`, `Card`, `EmptyState`, `ErrorState`, `FormField`, `Input`, `MetricCard`, `Modal`, `Select`, `Skeleton`, `SkeletonGroup`, `Table`.
- Full separation between presentation and data-fetching.

---

## 2. Technical Stack & Code Health

### Baseline Verification Results
- **Next.js**: 16.4.6 (App Router, Server Actions, Server Components).
- **React**: 19.2.8.
- **TypeScript**: 5.x — `pnpm exec tsc --noEmit` passed with **0 errors**.
- **ESLint**: `pnpm lint` passed with **0 warnings / 0 errors**.
- **Unit / Component Tests**: 168 tests executed via Vitest / React Testing Library — **168 passed (100%)**.
- **Production Build**: `pnpm build` passed cleanly, generating all dynamic and static routes.

---

## 3. Accessibility & Usability (WCAG 2.2 AA)

### Automated Audit Results
- Automated axe-core audits integrated into Playwright test suite (`e2e/a11y.spec.ts`):
  - Audited across all 8 canonical routes: `/`, `/stations`, `/stations/[id]`, `/stations/new`, `/sessions`, `/sessions/[id]`, `/attention`, `/diagnostics`, `/help`.
  - Color contrast ratios exceed 4.5:1 for normal text and 3:1 for large/graphical controls.
  - Form fields have explicit `id`/`htmlFor` associations and `aria-describedby` error bindings.
  - Skip links and focus outlines (`focus-visible`) tested and functional.
  - 200% browser text zoom and reduced motion media queries (`prefers-reduced-motion`) verified.

### Outstanding Human Usability Testing Gates
As documented in the repository UX specifications (`docs/usability-testing/`), automated tooling cannot verify qualitative human usability. The following gates remain open for pre-launch sign-off:
- **Gate G1**: Primary operator journey cognitive walk-through with real operations staff.
- **Gate G3**: Screen reader manual audit with NVDA / VoiceOver across dynamic live session updates.
- **Gate G7**: Owner visual sign-off of realistic multi-connector charging station SVG illustrations.
- **Gate G8**: Live-field usability validation under adverse outdoor glare / tablet conditions.

---

## 4. Frontend Security & Backend Exposure Guardrails

### Local-Write Guard
- In `src/lib/station-registration-actions.ts`:
  - When backend GraphQL endpoints are unreachable or the environment is flagged as read-only, registration falls back cleanly to a local UX state with instructional guidance rather than an unhandled error.
- **Architectural Note**: As highlighted in **SEC-002**, this guard is purely a frontend UX pattern and provides **no security guarantee** against direct API requests.
