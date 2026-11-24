# Design system (UX-001.6–7)

Approved: Orchid & Clay, Voltmark, light-first. Alternatives Terracotta & Linen and Graphite & Citron were considered and not selected. Tagline: Energy in focus. Brand should be distinctive; interactions familiar.

## Color tokens
| Token | Value | Use |
|---|---|---|
| brand | #43284F | Primary action, wordmark |
| brand-hover | #593965 | Hover |
| brand-pressed | #321B3C | Pressed |
| brand-muted | #795A88 | Links/focus |
| brand-soft | #E8DDF0 | Selected state |
| accent | #F3BB94 | Restrained clay accent |
| canvas | #F8F6F3 | Workspace |
| surface | #FFFFFF | Cards/sidebar |
| surface-subtle | #F5F0F7 | Table headers |
| border | #E4DFE6 | Decorative separation |
| text-primary | #27232D | Body/headings |
| text-secondary | #665E6C | Supporting text |
| text-inverse | #FFFFFF | On dark brand |
| success / soft | #216B50 / #E8F2EB | Online, available, complete |
| warning / soft | #946000 / #FAF0DD | Missing data, reserved |
| danger / soft | #B83F46 / #F9E7E7 | Fault, error |
| info / soft | #684675 / #E8DDF0 | Active, occupied, in progress |
| neutral / soft | #625E69 / #EAE7EC | Offline, ended, unavailable, unknown |
| focus | #795A88 | Visible focus outline |

Orchid ramp 50–950: #F7F3F9, #F1EAF4, #E8DDF0, #D4C2DF, #B99CC9, #9674A8, #795A88, #684675, #43284F, #321B3C, #24122C. Clay 100/300/500/700: #F9EDE6, #F3BB94, #B87850, #82573C. Use semantic CSS custom properties (--vg-*), not repeated literals. Decorative borders are not sufficient as essential control boundaries; choose stronger accessible border where needed. Verify actual foreground/background combinations, including hover/focus. Offline is neutral; attention summary may use warning. Do not conflate equipment UNAVAILABLE with request unavailable.

## Typography
Manrope (primary), IBM Plex Mono (technical identifiers/raw values only). Locally host licensed fonts, record licenses, avoid network build dependency. Fallback system sans/monospace. Sizes/line-height/weight: page 28/36/650; section 20/28/650; card 16/24/600; body 14/22/400; action 14/20/600; support 13/20/400; caption 12/18/500; metric 32/40/700; technical 13/20/400. Use relative units and tabular numerals as appropriate; permit 200% resizing. No oversized editorial titles.

## Geometry and layout
Spacing: 4,8,12,16,24,32,48,64px. Icon gap 8; fields gap 16; cards padding 20–24; sections 24–32; desktop page 24–32; mobile 16. Radius small 6, controls 8, cards 12, dialogs 16. Sidebar 240/72; topbar 64. Cards use subtle borders, elevation only for overlays. Default rows 52–60px; optional compact 40–44px, not initial requirement. Breakpoints: 320–479 single column; 480–767 adaptive; 768–1279 compact navigation; 1280+ expanded; 1536+ controlled content widths.

## Brand assets
Voltmark: stylized V with clay energy facet in aubergine rounded square; lower-case voltgrid. wordmark. Reference geometry in 80×80 viewBox: rounded rect radius 19; cream V path M19 20 H31 L41 49 L52 20 H64 L41 64 Z; clay facet M50 20 H66 L51 41 H39 Z. Refine geometry for production; reversed variant on dark, monochrome and favicon sizes 16/32/48/64. Test legibility. No trademark clearance claimed. Lucide icons 16/20/24px, consistent stroke. Custom charger SVGs supplement text, not imply real equipment model.

## Interaction primitives
Primary filled aubergine, secondary outline, tertiary contextual link, destructive reserved for future supported operations. Default/hover/pressed/focus/loading/disabled states. Buttons execute, links navigate. Clear labels, accessible names, disabled reason where relevant. Forms have persistent labels, error association, pending feedback. Tabs and drawers keyboard-operable; focus visible and restored. Search toolbar, URL filters, explicit scope, reset pagination. Status text + icon; no color-only semantics. Use semantic tables, captions, aligned numbers, responsive stacked records or controlled scrolling. Charts include units, timestamp context and raw alternatives.

Motion: 120ms hover; 150ms selection; 180ms menus/accordion; 180–220ms dialog; 200–250ms drawer; reduced-motion disables nonessential transitions. No decorative counters/parallax. Reusable components: AppShell, Sidebar, MobileNav, TopBar, PageHeader, Voltmark, Button, IconButton, Input, Select, Tabs, Breadcrumbs, MetricCard, StatusIndicator, DataTable, FilterToolbar, Pagination, StationCard, ConnectorCard, SessionSummary, MeterChart, SequenceInspector, Alert, EmptyState, ErrorState, Skeleton, RefreshIndicator, Toast, Dialog, Drawer, Tooltip. Build only components needed for actual slices.

## Status mapping
Station ONLINE/OFFLINE; connector AVAILABLE/OCCUPIED/RESERVED/UNAVAILABLE/FAULTED; session ACTIVE/ENDED; integrity IN_PROGRESS/COMPLETE/INCOMPLETE/UNKNOWN. Use colors above by meaning and retain lifecycle vs integrity separation. Operations ONLINE/OFFLINE/UNAVAILABLE are distinct projected states. Unknown enum/payload must follow existing validation rules, never success.
