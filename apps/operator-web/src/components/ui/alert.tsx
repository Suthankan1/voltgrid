import type { HTMLAttributes, ReactNode } from "react";

export type AlertVariant = "info" | "success" | "warning" | "error";
export type AlertAnnounce = "none" | "polite" | "assertive";

const ALERT_STYLES: Record<
  AlertVariant,
  { container: string; icon: string; title: string }
> = {
  info: {
    container:
      "bg-[color:var(--vg-info-soft)] border-[color:var(--vg-info)]/25 text-[color:var(--vg-text-primary)]",
    icon: "text-[color:var(--vg-info)]",
    title: "text-[color:var(--vg-info)]",
  },
  success: {
    container:
      "bg-[color:var(--vg-success-soft)] border-[color:var(--vg-success)]/25 text-[color:var(--vg-text-primary)]",
    icon: "text-[color:var(--vg-success)]",
    title: "text-[color:var(--vg-success)]",
  },
  warning: {
    container:
      "bg-[color:var(--vg-warning-soft)] border-[color:var(--vg-warning)]/30 text-[color:var(--vg-text-primary)]",
    icon: "text-[color:var(--vg-warning)]",
    title: "text-[color:var(--vg-warning)]",
  },
  error: {
    container:
      "bg-[color:var(--vg-danger-soft)] border-[color:var(--vg-danger)]/30 text-[color:var(--vg-text-primary)]",
    icon: "text-[color:var(--vg-danger)]",
    title: "text-[color:var(--vg-danger)]",
  },
};

function AlertIcon({ variant }: { variant: AlertVariant }) {
  switch (variant) {
    case "success":
      return (
        <svg aria-hidden="true" viewBox="0 0 20 20" width="20" height="20" fill="none" className="shrink-0">
          <circle cx="10" cy="10" r="7.5" stroke="currentColor" strokeWidth="1.6" />
          <path d="m6.75 10.25 2.2 2.2 4.3-4.6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      );
    case "warning":
      return (
        <svg aria-hidden="true" viewBox="0 0 20 20" width="20" height="20" fill="none" className="shrink-0">
          <path d="M10 3 18 16.5H2L10 3Z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
          <path d="M10 8v4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
          <circle cx="10" cy="14.2" r="0.85" fill="currentColor" />
        </svg>
      );
    case "error":
      return (
        <svg aria-hidden="true" viewBox="0 0 20 20" width="20" height="20" fill="none" className="shrink-0">
          <circle cx="10" cy="10" r="7.5" stroke="currentColor" strokeWidth="1.6" />
          <path d="M7.5 7.5 12.5 12.5M12.5 7.5 7.5 12.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
        </svg>
      );
    case "info":
    default:
      return (
        <svg aria-hidden="true" viewBox="0 0 20 20" width="20" height="20" fill="none" className="shrink-0">
          <circle cx="10" cy="10" r="7.5" stroke="currentColor" strokeWidth="1.6" />
          <path d="M10 9v4.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
          <circle cx="10" cy="6.4" r="0.85" fill="currentColor" />
        </svg>
      );
  }
}

export interface AlertProps extends Omit<HTMLAttributes<HTMLDivElement>, "title"> {
  /** Semantic severity and visual tone. */
  variant?: AlertVariant;
  /** Optional heading summarizing the notice. */
  title?: string;
  /** Live-region behavior; static informational notices default to `"none"`. */
  announce?: AlertAnnounce;
  /** Optional contextual actions rendered below the message. */
  actions?: ReactNode;
}

/**
 * Persistent alert banner with non-color icon pairing and controlled live-region semantics.
 */
export function Alert({
  variant = "info",
  title,
  announce,
  actions,
  className,
  children,
  ...props
}: AlertProps) {
  const effectiveAnnounce: AlertAnnounce =
    announce ?? (variant === "error" ? "assertive" : "none");

  const liveProps =
    effectiveAnnounce === "assertive"
      ? ({ role: "alert" } as const)
      : effectiveAnnounce === "polite"
        ? ({ role: "status" } as const)
        : ({} as const);

  const styles = ALERT_STYLES[variant];
  const classes = [
    "flex items-start gap-3 rounded-[var(--vg-radius-lg)] border p-4 font-sans text-[0.875rem] leading-[1.375rem]",
    styles.container,
    className,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div className={classes} {...liveProps} {...props}>
      <span className={`mt-0.5 shrink-0 ${styles.icon}`}>
        <AlertIcon variant={variant} />
      </span>
      <div className="min-w-0 flex-1 break-words">
        {title ? (
          <p className={`font-semibold leading-[1.375rem] ${styles.title}`}>
            {title}
          </p>
        ) : null}
        <div className={title ? "mt-1" : undefined}>{children}</div>
        {actions ? (
          <div className="mt-3 flex flex-wrap items-center gap-2">{actions}</div>
        ) : null}
      </div>
    </div>
  );
}
