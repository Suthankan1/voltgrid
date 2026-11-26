# Voltmark Brand Assets

Production visual identity assets for VoltGrid (`voltgrid.` — *Energy in focus.*), aligned with the Orchid & Clay design system (`docs/redesign/design-system.md`).

## Approved colors

- **Primary aubergine** (`--vg-brand`): `#43284F`
- **Soft orchid** (`--vg-brand-soft`): `#E8DDF0`
- **Warm clay** (`--vg-accent`): `#F3BB94`
- **Porcelain** (`--vg-canvas`): `#F8F6F3`
- **Graphite plum** (`--vg-text-primary`): `#27232D`

## Static SVG assets

All marks use an `80 × 80` `viewBox` with no external dependencies, embedded scripts, or network requests.

| Asset | Purpose | Background guidance |
|---|---|---|
| `public/brand/voltmark.svg` | Primary emblem (aubergine rounded square `rx="19"`, porcelain `V`, warm clay energy facet) | Light surfaces (`#F8F6F3`, `#FFFFFF`, `#F5F0F7`) |
| `public/brand/voltmark-reversed.svg` | Reversed emblem (porcelain `V` and warm clay energy facet, transparent container) | Dark surfaces (`#43284F`, `#321B3C`, `#27232D`) |
| `public/brand/voltmark-monochrome.svg` | Single-ink knockout emblem using `currentColor` and `fill-rule="evenodd"` with separated facet gap | Single-color print, constrained badges, or inherited text color contexts |

## Favicons and Next.js metadata

- `src/app/icon.svg`: Vector app icon for modern browsers (`<link rel="icon" type="image/svg+xml" sizes="any">`).
- `src/app/favicon.ico`: Multi-resolution ICO generated from `voltmark.svg` containing `16×16`, `32×32`, `48×48`, and `64×64` PNG frames.
- `src/app/layout.tsx` relies on Next.js App Router file-based icon conventions without duplicate manual `icons` metadata entries.

## React components (`src/components/voltmark.tsx`)

- `<Voltmark variant="primary | reversed | monochrome" size="xs | sm | md | lg | xl | number" />`
  - Standard sizes map to `xs: 16px`, `sm: 24px`, `md: 32px`, `lg: 48px`, `xl: 64px`.
  - **Standalone usage**: default `decorative={false}` applies `role="img"` and `aria-label="VoltGrid"` (customizable via `label`).
  - **Decorative usage**: pass `decorative` to apply `aria-hidden="true"` when adjacent text or link labels already identify VoltGrid.
- `<VoltmarkWordmark variant size decorative />`
  - Renders lowercase `voltgrid.` in `Manrope` (`--vg-font-sans`), weight `700`, tight tracking.
- `<VoltmarkLockup variant size showTagline tagline decorative />`
  - Combines `<Voltmark decorative />` with `<VoltmarkWordmark />` and optional `Energy in focus.` tagline so assistive technology announces the brand name once.

## Legibility and clear space

- Tested for recognizability at `16px`, `24px`, `32px`, `48px`, and `64px`.
- Do not render `<Voltmark>` below `16px`.
- Maintain clear space around the emblem equal to at least 25% of the mark width (`8px` around a `32px` mark).
- Do not stretch, rotate, recolor outside approved tokens, or add drop shadows or gradients.

No trademark clearance is claimed by these assets.
