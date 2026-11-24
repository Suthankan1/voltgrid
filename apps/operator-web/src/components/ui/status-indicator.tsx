import type { HTMLAttributes } from "react";
import type { OperationalStatus } from "@/lib/operations-api";
import type {
  ConnectorStatus,
  StationStatus,
  TransactionDataStatus,
  TransactionStatus,
} from "@/lib/station-api";

export type StatusTone = "success" | "info" | "warning" | "danger" | "neutral";
export type StatusIndicatorSize = "sm" | "md";

export interface StatusDisplay {
  tone: StatusTone;
  label: string;
  /** Non-authoritative explanatory note clarifying domain meaning. */
  meaning: string;
}

const TONE_CLASSES: Record<StatusTone, string> = {
  success:
    "bg-[color:var(--vg-success-soft)] text-[color:var(--vg-success)] border-[color:var(--vg-success)]/20",
  info:
    "bg-[color:var(--vg-info-soft)] text-[color:var(--vg-info)] border-[color:var(--vg-info)]/20",
  warning:
    "bg-[color:var(--vg-warning-soft)] text-[color:var(--vg-warning)] border-[color:var(--vg-warning)]/25",
  danger:
    "bg-[color:var(--vg-danger-soft)] text-[color:var(--vg-danger)] border-[color:var(--vg-danger)]/20",
  neutral:
    "bg-[color:var(--vg-neutral-soft)] text-[color:var(--vg-neutral)] border-[color:var(--vg-neutral)]/20",
};

const SIZE_CLASSES: Record<StatusIndicatorSize, string> = {
  sm: "px-2.5 py-0.5 text-[0.75rem] leading-[1.125rem]",
  md: "px-3 py-1 text-[0.8125rem] leading-[1.25rem]",
};

function StatusGlyph({ tone }: { tone: StatusTone }) {
  switch (tone) {
    case "success":
      return (
        <svg
          aria-hidden="true"
          viewBox="0 0 12 12"
          width="12"
          height="12"
          fill="none"
          className="shrink-0"
        >
          <path
            d="M2.5 6.2 4.8 8.5 9.5 3.5"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      );
    case "info":
      return (
        <svg
          aria-hidden="true"
          viewBox="0 0 12 12"
          width="12"
          height="12"
          fill="none"
          className="shrink-0"
        >
          <circle cx="6" cy="6" r="4.25" stroke="currentColor" strokeWidth="1.35" />
          <circle cx="6" cy="6" r="1.75" fill="currentColor" />
        </svg>
      );
    case "warning":
      return (
        <svg
          aria-hidden="true"
          viewBox="0 0 12 12"
          width="12"
          height="12"
          fill="none"
          className="shrink-0"
        >
          <path
            d="M6 1.75 10.75 10H1.25L6 1.75Z"
            stroke="currentColor"
            strokeWidth="1.25"
            strokeLinejoin="round"
          />
          <path
            d="M6 4.75v2.2"
            stroke="currentColor"
            strokeWidth="1.25"
            strokeLinecap="round"
          />
          <circle cx="6" cy="8.45" r="0.6" fill="currentColor" />
        </svg>
      );
    case "danger":
      return (
        <svg
          aria-hidden="true"
          viewBox="0 0 12 12"
          width="12"
          height="12"
          fill="none"
          className="shrink-0"
        >
          <circle cx="6" cy="6" r="4.5" stroke="currentColor" strokeWidth="1.35" />
          <path
            d="M4.2 4.2 7.8 7.8M7.8 4.2 4.2 7.8"
            stroke="currentColor"
            strokeWidth="1.35"
            strokeLinecap="round"
          />
        </svg>
      );
    case "neutral":
    default:
      return (
        <svg
          aria-hidden="true"
          viewBox="0 0 12 12"
          width="12"
          height="12"
          fill="none"
          className="shrink-0"
        >
          <circle cx="6" cy="6" r="4.25" stroke="currentColor" strokeWidth="1.35" />
          <path
            d="M4 6h4"
            stroke="currentColor"
            strokeWidth="1.35"
            strokeLinecap="round"
          />
        </svg>
      );
  }
}

export interface StatusIndicatorProps
  extends Omit<HTMLAttributes<HTMLSpanElement>, "children"> {
  /** Semantic color and glyph pairing. */
  tone: StatusTone;
  /** Visible human-readable status label (never omitted). */
  label: string;
  /** Visual size variant. */
  size?: StatusIndicatorSize;
  /** Renders a distinct non-color glyph alongside the text label. */
  showIcon?: boolean;
}

/**
 * Accessible status pill combining semantic colors, distinct glyphs, and text.
 */
export function StatusIndicator({
  tone,
  label,
  size = "md",
  showIcon = true,
  className,
  ...props
}: StatusIndicatorProps) {
  const classes = [
    "inline-flex items-center gap-1.5 rounded-full border font-sans font-semibold whitespace-nowrap",
    TONE_CLASSES[tone],
    SIZE_CLASSES[size],
    className,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <span className={classes} {...props}>
      {showIcon ? <StatusGlyph tone={tone} /> : null}
      <span>{label}</span>
    </span>
  );
}

const UNKNOWN_STATUS_DISPLAY: StatusDisplay = {
  tone: "neutral",
  label: "Unknown",
  meaning: "Reported state could not be mapped to a recognized status.",
};

function resolveFromMap<K extends string>(
  map: Record<K, StatusDisplay>,
  value: unknown,
): StatusDisplay {
  if (typeof value === "string" && Object.hasOwn(map, value)) {
    return map[value as K];
  }
  return UNKNOWN_STATUS_DISPLAY;
}

/** Station connectivity domain (reported connectivity, not uptime or fault health). */
export const STATION_CONNECTIVITY_DISPLAY: Record<StationStatus, StatusDisplay> = {
  ONLINE: {
    tone: "success",
    label: "Online",
    meaning: "Station is currently reported as connected to Station Service.",
  },
  OFFLINE: {
    tone: "neutral",
    label: "Offline",
    meaning: "Station is currently reported as disconnected; not proof of hardware fault.",
  },
};

/** Connector status domain (reported connector state; OCCUPIED does not prove active charging). */
export const CONNECTOR_STATUS_DISPLAY: Record<ConnectorStatus, StatusDisplay> = {
  AVAILABLE: {
    tone: "success",
    label: "Available",
    meaning: "Connector is reported ready for a charging session.",
  },
  OCCUPIED: {
    tone: "info",
    label: "Occupied",
    meaning: "Connector is reported occupied; does not establish active energy transfer.",
  },
  RESERVED: {
    tone: "warning",
    label: "Reserved",
    meaning: "Connector is reported reserved.",
  },
  UNAVAILABLE: {
    tone: "neutral",
    label: "Unavailable",
    meaning: "Connector is reported unavailable for charging.",
  },
  FAULTED: {
    tone: "danger",
    label: "Faulted",
    meaning: "Connector reported an equipment fault.",
  },
};

/** Session lifecycle domain (independent from session data completeness). */
export const SESSION_LIFECYCLE_DISPLAY: Record<TransactionStatus, StatusDisplay> = {
  ACTIVE: {
    tone: "info",
    label: "Active",
    meaning: "Charging session has not yet reported an end event.",
  },
  ENDED: {
    tone: "neutral",
    label: "Ended",
    meaning: "Charging session has ended; data completeness is tracked separately.",
  },
};

/** Session data completeness domain (independent from session lifecycle). */
export const SESSION_COMPLETENESS_DISPLAY: Record<TransactionDataStatus, StatusDisplay> = {
  IN_PROGRESS: {
    tone: "info",
    label: "In progress",
    meaning: "Session event sequence is still in progress.",
  },
  COMPLETE: {
    tone: "success",
    label: "Complete",
    meaning: "No missing sequence numbers were observed for this session.",
  },
  INCOMPLETE: {
    tone: "warning",
    label: "Missing data",
    meaning: "One or more expected sequence records are missing.",
  },
  UNKNOWN: {
    tone: "neutral",
    label: "Unknown",
    meaning: "Data completeness could not be determined.",
  },
};

/** Operations Service asynchronous projection domain (distinct from Station Service connectivity). */
export const OPERATIONS_STATUS_DISPLAY: Record<OperationalStatus, StatusDisplay> = {
  ONLINE: {
    tone: "success",
    label: "Online",
    meaning: "Projected as online by the asynchronous Operations Service.",
  },
  OFFLINE: {
    tone: "neutral",
    label: "Offline",
    meaning: "Projected as offline by the asynchronous Operations Service.",
  },
  UNAVAILABLE: {
    tone: "neutral",
    label: "Unavailable",
    meaning: "Projected as unavailable by the asynchronous Operations Service.",
  },
};

export function getStationConnectivityDisplay(status: unknown): StatusDisplay {
  return resolveFromMap(STATION_CONNECTIVITY_DISPLAY, status);
}

export function getConnectorStatusDisplay(status: unknown): StatusDisplay {
  return resolveFromMap(CONNECTOR_STATUS_DISPLAY, status);
}

export function getSessionLifecycleDisplay(status: unknown): StatusDisplay {
  return resolveFromMap(SESSION_LIFECYCLE_DISPLAY, status);
}

export function getSessionCompletenessDisplay(status: unknown): StatusDisplay {
  return resolveFromMap(SESSION_COMPLETENESS_DISPLAY, status);
}

export function getOperationsStatusDisplay(status: unknown): StatusDisplay {
  return resolveFromMap(OPERATIONS_STATUS_DISPLAY, status);
}

interface DomainStatusProps
  extends Omit<StatusIndicatorProps, "tone" | "label"> {
  status: unknown;
}

export function StationStatusIndicator({ status, ...props }: DomainStatusProps) {
  const display = getStationConnectivityDisplay(status);
  return <StatusIndicator tone={display.tone} label={display.label} {...props} />;
}

export function ConnectorStatusIndicator({ status, ...props }: DomainStatusProps) {
  const display = getConnectorStatusDisplay(status);
  return <StatusIndicator tone={display.tone} label={display.label} {...props} />;
}

export function SessionLifecycleIndicator({ status, ...props }: DomainStatusProps) {
  const display = getSessionLifecycleDisplay(status);
  return <StatusIndicator tone={display.tone} label={display.label} {...props} />;
}

export function SessionCompletenessIndicator({ status, ...props }: DomainStatusProps) {
  const display = getSessionCompletenessDisplay(status);
  return <StatusIndicator tone={display.tone} label={display.label} {...props} />;
}

export function OperationsStatusIndicator({ status, ...props }: DomainStatusProps) {
  const display = getOperationsStatusDisplay(status);
  return <StatusIndicator tone={display.tone} label={display.label} {...props} />;
}
