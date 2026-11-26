import type { ConnectorStatus } from "@/lib/station-api";

export interface ChargerIllustrationProps {
  /** Reported connector status used only to tint the illustrated status light. */
  status: ConnectorStatus;
  /** Decorative by default when paired with visible status and EVSE/connector text. */
  decorative?: boolean;
  /** Accessible label used when `decorative` is set to `false`. */
  title?: string;
  /** Compact card proportion (`md`) or tighter compact preview (`sm`). */
  size?: "sm" | "md";
  className?: string;
}

const STATUS_LIGHT_FILL: Record<ConnectorStatus, string> = {
  AVAILABLE: "var(--vg-success, #216b50)",
  OCCUPIED: "var(--vg-info, #684675)",
  RESERVED: "var(--vg-warning, #946000)",
  UNAVAILABLE: "var(--vg-neutral, #625e69)",
  FAULTED: "var(--vg-danger, #b83f46)",
};

const SIZE_CLASSES = {
  sm: "w-[76px] sm:w-[84px]",
  md: "w-[88px] sm:w-[96px]",
} as const;

/**
 * Original generic EV charging-equipment vector illustration inspired by modern
 * pedestal chargers. Visual details remain illustrative and never establish physical
 * charger model, AC/DC capability, power rating, or verified hardware health.
 */
export function ChargerIllustration({
  status,
  decorative = true,
  title,
  size = "md",
  className,
}: ChargerIllustrationProps) {
  const lightColor =
    STATUS_LIGHT_FILL[status] ?? "var(--vg-neutral, #625e69)";
  const accessibleName = title ?? `Charging equipment illustration (${status.toLowerCase()})`;
  const classes = [SIZE_CLASSES[size], "h-auto shrink-0 select-none", className]
    .filter(Boolean)
    .join(" ");

  return (
    <svg
      viewBox="0 0 112 132"
      fill="none"
      className={classes}
      focusable="false"
      {...(decorative
        ? { "aria-hidden": true }
        : { role: "img", "aria-label": accessibleName })}
    >
      {!decorative ? <title>{accessibleName}</title> : null}

      {/* Floor surface line & plinth pad */}
      <rect x="14" y="121" width="76" height="5" rx="2.5" fill="var(--vg-border, #e4dfe6)" />

      {/* Heavy cable loop connecting lower side gland to docked plug handle */}
      <path
        d="M75 82 C92 82 99 98 95 109 C91 120 74 118 79 102 C82 93 90 83 89 63"
        stroke="#27232d"
        strokeWidth="4.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M75 82 C92 82 99 98 95 109 C91 120 74 118 79 102 C82 93 90 83 89 63"
        stroke="#574f63"
        strokeWidth="1.2"
        strokeLinecap="round"
        strokeDasharray="18 12"
      />

      {/* Side dimensional body bevel & lower vents */}
      <path
        d="M66 17 L75 21 C77.2 22 78.5 24 78.5 26.5 L78.5 117 L66 117 Z"
        fill="#ddd7e0"
        stroke="#665e6c"
        strokeWidth="1.25"
        strokeLinejoin="round"
      />
      <path
        d="M70 95 H75.5 M70 99.5 H75.5 M70 104 H75.5 M70 108.5 H75.5"
        stroke="#795a88"
        strokeWidth="1.2"
        strokeLinecap="round"
      />

      {/* Side cable exit gland collar */}
      <rect
        x="73.5"
        y="78.5"
        width="5"
        height="7"
        rx="1.5"
        fill="#4d4754"
        stroke="#27232d"
        strokeWidth="1"
      />

      {/* Side holster housing */}
      <path
        d="M76 38 H86.5 C88 38 89 39.2 89 40.7 V53.5 C89 55 88 56 86.5 56 H76 Z"
        fill="#e8ddf0"
        stroke="#665e6c"
        strokeWidth="1.25"
        strokeLinejoin="round"
      />
      <rect x="78.5" y="40.5" width="7.5" height="9" rx="1.5" fill="#27232d" />

      {/* Ergonomic EV charging handle & coupler docked in holster */}
      <path
        d="M80 42.5 L89.5 42.5 C92.5 42.5 94.5 44.5 94.5 47.5 L92 61.5 C91.6 63.5 90 64.5 88 64.5 L86.5 64.5 L87.5 51 L80 49.5 Z"
        fill="#27232d"
        stroke="#27232d"
        strokeWidth="1"
        strokeLinejoin="round"
      />
      {/* Restraining handle grip & Clay collar detail */}
      <rect x="86.2" y="59.5" width="5.2" height="3.2" rx="1" fill="var(--vg-accent, #f3bb94)" />
      <path
        d="M84 44.8 H89.2"
        stroke="#e8ddf0"
        strokeWidth="1.2"
        strokeLinecap="round"
      />

      {/* Stepped pedestal anchor plate */}
      <rect
        x="19"
        y="116"
        width="62"
        height="6"
        rx="2"
        fill="#393342"
        stroke="#27232d"
        strokeWidth="1.25"
      />
      <circle cx="24" cy="119" r="0.9" fill="#9674a8" />
      <circle cx="76" cy="119" r="0.9" fill="#9674a8" />

      {/* Main charger cabinet housing */}
      <rect
        x="21"
        y="16"
        width="46"
        height="100"
        rx="7.5"
        fill="#f7f4f0"
        stroke="#665e6c"
        strokeWidth="1.35"
      />
      {/* Subtle architectural housing highlight & lower service door seam */}
      <path
        d="M25 20 H63"
        stroke="#ffffff"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      <rect
        x="25.5"
        y="69"
        width="37"
        height="42"
        rx="3.5"
        fill="#ffffff"
        stroke="#e4dfe6"
        strokeWidth="1.2"
      />
      <line x1="57" y1="86" x2="57" y2="93" stroke="#9674a8" strokeWidth="1.4" strokeLinecap="round" />

      {/* Dark Graphite Plum upper control fascia */}
      <rect
        x="25.5"
        y="22.5"
        width="37"
        height="42"
        rx="4.5"
        fill="#27232d"
      />

      {/* Recessed semantic status light bar */}
      <rect x="29.5" y="26.5" width="29" height="5.5" rx="2.75" fill="#1b1820" />
      <rect x="30.5" y="27.5" width="27" height="3.5" rx="1.75" fill={lightColor} />
      <path
        d="M33 28.6 H55"
        stroke="#ffffff"
        strokeOpacity="0.35"
        strokeWidth="0.9"
        strokeLinecap="round"
      />

      {/* Abstract small OLED display (no numeric kW, voltage, or SoC claims) */}
      <rect
        x="29.5"
        y="35.5"
        width="29"
        height="16.5"
        rx="2.5"
        fill="#362f40"
        stroke="#51485e"
        strokeWidth="1"
      />
      {/* Abstract UI chrome lines inside screen */}
      <rect x="32.5" y="38.8" width="12" height="2" rx="1" fill="#e8ddf0" fillOpacity="0.85" />
      <rect x="32.5" y="42.8" width="18" height="1.8" rx="0.9" fill="#b99cc9" fillOpacity="0.55" />
      <rect x="32.5" y="46.4" width="9" height="1.8" rx="0.9" fill="var(--vg-accent, #f3bb94)" fillOpacity="0.8" />
      <circle cx="53.5" cy="43.5" r="2.6" stroke="#e8ddf0" strokeOpacity="0.65" strokeWidth="1.1" />

      {/* Restrained RFID reader zone & brand accent bar */}
      <path
        d="M41.5 57.5 C43.2 55.8 45.8 55.8 47.5 57.5 M43 59.5 C43.9 58.6 45.1 58.6 46 59.5"
        stroke="#b99cc9"
        strokeWidth="1.15"
        strokeLinecap="round"
      />
      <rect x="38" y="62.2" width="12" height="1.5" rx="0.75" fill="var(--vg-accent, #f3bb94)" fillOpacity="0.85" />
    </svg>
  );
}
