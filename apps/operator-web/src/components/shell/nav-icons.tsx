import type { NavDestinationId } from "@/lib/routes";

interface IconProps {
  className?: string;
}

export function NavDestinationIcon({
  id,
  className,
}: {
  id: NavDestinationId;
  className?: string;
}) {
  const classes = ["shrink-0", className].filter(Boolean).join(" ");

  switch (id) {
    case "overview":
      return (
        <svg aria-hidden="true" viewBox="0 0 20 20" width="20" height="20" fill="none" className={classes}>
          <rect x="3" y="3" width="6" height="6" rx="1.5" stroke="currentColor" strokeWidth="1.6" />
          <rect x="11" y="3" width="6" height="6" rx="1.5" stroke="currentColor" strokeWidth="1.6" />
          <rect x="3" y="11" width="6" height="6" rx="1.5" stroke="currentColor" strokeWidth="1.6" />
          <rect x="11" y="11" width="6" height="6" rx="1.5" stroke="currentColor" strokeWidth="1.6" />
        </svg>
      );
    case "stations":
      return (
        <svg aria-hidden="true" viewBox="0 0 20 20" width="20" height="20" fill="none" className={classes}>
          <rect x="4" y="3" width="9" height="14" rx="1.5" stroke="currentColor" strokeWidth="1.6" />
          <path d="M6.5 6.5h4M13 8.5h2a1.5 1.5 0 0 1 1.5 1.5v4a1.5 1.5 0 0 1-3 0v-2" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M2.5 17h12" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
        </svg>
      );
    case "sessions":
      return (
        <svg aria-hidden="true" viewBox="0 0 20 20" width="20" height="20" fill="none" className={classes}>
          <path d="M11.2 2.5 5 11h4.5l-.7 6.5L15 9h-4.5l.7-6.5Z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
        </svg>
      );
    case "attention":
      return (
        <svg aria-hidden="true" viewBox="0 0 20 20" width="20" height="20" fill="none" className={classes}>
          <path d="M10 3.25 17.25 16H2.75L10 3.25Z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
          <path d="M10 8v3.75" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
          <circle cx="10" cy="14" r="0.85" fill="currentColor" />
        </svg>
      );
    case "diagnostics":
      return (
        <svg aria-hidden="true" viewBox="0 0 20 20" width="20" height="20" fill="none" className={classes}>
          <path d="M2.5 10h3l2-4.5 3.5 9 2-4.5h4.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      );
    case "help":
      return (
        <svg aria-hidden="true" viewBox="0 0 20 20" width="20" height="20" fill="none" className={classes}>
          <circle cx="10" cy="10" r="7.25" stroke="currentColor" strokeWidth="1.6" />
          <path d="M7.75 7.75a2.25 2.25 0 0 1 4.1 1.25c0 1.3-1.85 1.75-1.85 3" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
          <circle cx="10" cy="14.25" r="0.85" fill="currentColor" />
        </svg>
      );
    case "admin":
      return (
        <svg aria-hidden="true" viewBox="0 0 20 20" width="20" height="20" fill="none" className={classes}>
          <path d="M10 2.5 4 5v5c0 4.5 3 7.5 6 8.5 3-1 6-4 6-8.5V5l-6-2.5Z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
          <path d="m8 10 1.5 1.5 3-3" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      );
  }
}

export function CollapseIcon({
  collapsed,
  className,
}: IconProps & { collapsed: boolean }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 20 20"
      width="20"
      height="20"
      fill="none"
      className={["shrink-0 transition-transform duration-[var(--vg-transition-fast)]", collapsed ? "rotate-180" : "", className]
        .filter(Boolean)
        .join(" ")}
    >
      <path
        d="M12.5 5 7.5 10l5 5"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function MenuIcon({ className }: IconProps) {
  return (
    <svg aria-hidden="true" viewBox="0 0 20 20" width="20" height="20" fill="none" className={["shrink-0", className].filter(Boolean).join(" ")}>
      <path d="M3.5 5.5h13M3.5 10h13M3.5 14.5h13" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

export function CloseIcon({ className }: IconProps) {
  return (
    <svg aria-hidden="true" viewBox="0 0 20 20" width="20" height="20" fill="none" className={["shrink-0", className].filter(Boolean).join(" ")}>
      <path d="m5.5 5.5 9 9m0-9-9 9" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}
