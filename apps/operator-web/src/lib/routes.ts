import { decodePathIdentifier } from "./path-identifier";

export type NavGroupId = "workspace" | "support";

export type NavDestinationId =
  | "overview"
  | "stations"
  | "sessions"
  | "attention"
  | "diagnostics"
  | "help";

export interface NavItem {
  id: NavDestinationId;
  group: NavGroupId;
  label: string;
  /** Canonical target route from docs/redesign/information-architecture.md. */
  canonicalHref: string;
  /** Implemented active route during the incremental redesign transition. */
  href: string | null;
  /** Milestone responsible for completing deferred routes. */
  deferredTo?: string;
  /** Concise note for deferred destinations. */
  statusNote?: string;
}

export const NAV_ITEMS: readonly NavItem[] = [
  {
    id: "overview",
    group: "workspace",
    label: "Overview",
    canonicalHref: "/",
    href: "/",
  },
  {
    id: "stations",
    group: "workspace",
    label: "Charging stations",
    canonicalHref: "/stations",
    href: null,
    deferredTo: "UI-104",
    statusNote: "Standalone station directory deferred to UI-104; station list is currently on Overview.",
  },
  {
    id: "sessions",
    group: "workspace",
    label: "Charging sessions",
    canonicalHref: "/sessions",
    href: "/transactions",
    deferredTo: "UI-107",
    statusNote: "Routes to existing /transactions view until /sessions is implemented in UI-107.",
  },
  {
    id: "attention",
    group: "workspace",
    label: "Needs attention",
    canonicalHref: "/attention",
    href: null,
    deferredTo: "UI-109",
    statusNote: "Attention workspace deferred to UI-109.",
  },
  {
    id: "diagnostics",
    group: "support",
    label: "Diagnostics",
    canonicalHref: "/diagnostics",
    href: "/operations",
    deferredTo: "UI-109",
    statusNote: "Routes to existing /operations projection view until /diagnostics is implemented in UI-109.",
  },
  {
    id: "help",
    group: "support",
    label: "Help",
    canonicalHref: "/help",
    href: null,
    deferredTo: "UI-109",
    statusNote: "Static operator guidance deferred to UI-109.",
  },
] as const;

export const NAV_GROUPS: ReadonlyArray<{
  id: NavGroupId;
  label: string;
  items: readonly NavItem[];
}> = [
  {
    id: "workspace",
    label: "Workspace",
    items: NAV_ITEMS.filter(item => item.group === "workspace"),
  },
  {
    id: "support",
    label: "Support",
    items: NAV_ITEMS.filter(item => item.group === "support"),
  },
];

export interface BreadcrumbItem {
  label: string;
  href?: string;
  mono?: boolean;
  current?: boolean;
}

export interface RouteMeta {
  activeNav: NavDestinationId | null;
  contextNav: NavDestinationId | null;
  breadcrumbs: BreadcrumbItem[];
}

export function buildStationHref(stationId: string): string {
  return `/stations/${encodeURIComponent(stationId)}`;
}

export function buildSessionHref(stationId: string, sessionId: string): string {
  return `/stations/${encodeURIComponent(stationId)}/transactions/${encodeURIComponent(sessionId)}`;
}

export function isNavItemActive(
  item: NavItem,
  routeMeta: RouteMeta,
): boolean {
  return item.href !== null && routeMeta.activeNav === item.id;
}

export function isNavItemContextActive(
  item: NavItem,
  routeMeta: RouteMeta,
): boolean {
  return item.href === null && routeMeta.contextNav === item.id;
}

/**
 * Resolves active navigation state and safe breadcrumbs from the current pathname.
 * Decodes dynamic path identifiers once via `decodePathIdentifier` without fabricating names.
 */
export function resolveRouteMeta(pathname: string): RouteMeta {
  const cleanPath = pathname.split("?")[0]?.split("#")[0] ?? "/";

  if (cleanPath === "/") {
    return {
      activeNav: "overview",
      contextNav: null,
      breadcrumbs: [{ label: "Overview", current: true }],
    };
  }

  if (cleanPath === "/transactions" || cleanPath === "/sessions") {
    return {
      activeNav: "sessions",
      contextNav: null,
      breadcrumbs: [
        { label: "Overview", href: "/" },
        { label: "Charging sessions", current: true },
      ],
    };
  }

  if (cleanPath === "/operations" || cleanPath === "/diagnostics") {
    return {
      activeNav: "diagnostics",
      contextNav: null,
      breadcrumbs: [
        { label: "Overview", href: "/" },
        { label: "Diagnostics", current: true },
      ],
    };
  }

  if (cleanPath === "/stations/new") {
    return {
      activeNav: null,
      contextNav: "stations",
      breadcrumbs: [
        { label: "Overview", href: "/" },
        { label: "Stations" },
        { label: "Add station", current: true },
      ],
    };
  }

  const segments = cleanPath.split("/").filter(Boolean);

  if (segments[0] === "stations" && segments.length >= 2) {
    const decodedStationId = decodePathIdentifier(segments[1]);
    const stationLabel = decodedStationId ?? "Invalid station";

    if (
      segments.length === 4 &&
      (segments[2] === "transactions" || segments[2] === "sessions")
    ) {
      const decodedSessionId = decodePathIdentifier(segments[3]);
      const sessionLabel = decodedSessionId ?? "Invalid session";

      return {
        activeNav: "sessions",
        contextNav: null,
        breadcrumbs: [
          { label: "Overview", href: "/" },
          { label: "Charging sessions", href: "/transactions" },
          ...(decodedStationId
            ? [{ label: stationLabel, href: buildStationHref(decodedStationId), mono: true }]
            : [{ label: stationLabel, mono: true }]),
          { label: sessionLabel, mono: true, current: true },
        ],
      };
    }

    if (segments.length === 2) {
      return {
        activeNav: null,
        contextNav: "stations",
        breadcrumbs: [
          { label: "Overview", href: "/" },
          { label: "Stations" },
          { label: stationLabel, mono: true, current: true },
        ],
      };
    }
  }

  return {
    activeNav: null,
    contextNav: null,
    breadcrumbs: [
      { label: "Overview", href: "/" },
      { label: "Page", current: true },
    ],
  };
}
