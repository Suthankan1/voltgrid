import type { HTMLAttributes, SVGAttributes } from "react";

export const VOLTMARK_VIEWBOX = "0 0 80 80" as const;

export const VOLTMARK_SIZES = {
  xs: 16,
  sm: 24,
  md: 32,
  lg: 48,
  xl: 64,
} as const;

export const VOLTMARK_BRAND = {
  name: "VoltGrid",
  wordmark: "voltgrid.",
  tagline: "Energy in focus.",
} as const;

export type VoltmarkVariant = "primary" | "reversed" | "monochrome";
export type VoltmarkSizeToken = keyof typeof VOLTMARK_SIZES;
export type VoltmarkSize = VoltmarkSizeToken | number;
export type VoltmarkLockupSize = "sm" | "md" | "lg";

const LOCKUP_MARK_SIZES: Record<VoltmarkLockupSize, VoltmarkSizeToken> = {
  sm: "sm",
  md: "md",
  lg: "lg",
};

const WORDMARK_SIZE_CLASSES: Record<VoltmarkLockupSize, string> = {
  sm: "text-[1.125rem]",
  md: "text-[1.375rem]",
  lg: "text-[1.75rem]",
};

const WORDMARK_COLOR_CLASSES: Record<VoltmarkVariant, string> = {
  primary: "text-[color:var(--vg-brand,#43284F)]",
  reversed: "text-[color:var(--vg-canvas,#F8F6F3)]",
  monochrome: "text-current",
};

const TAGLINE_COLOR_CLASSES: Record<VoltmarkVariant, string> = {
  primary: "text-[color:var(--vg-text-secondary,#665E6C)]",
  reversed: "text-[color:var(--vg-brand-soft,#E8DDF0)]",
  monochrome: "text-current opacity-80",
};

const TAGLINE_SIZE_CLASSES: Record<VoltmarkLockupSize, string> = {
  sm: "text-[0.6875rem] leading-[1rem]",
  md: "text-[0.75rem] leading-[1.125rem]",
  lg: "text-[0.8125rem] leading-[1.25rem]",
};

const LOCKUP_GAP_CLASSES: Record<VoltmarkLockupSize, string> = {
  sm: "gap-2",
  md: "gap-2.5",
  lg: "gap-3.5",
};

export function resolveVoltmarkSize(size: VoltmarkSize = "md"): number {
  if (typeof size === "number") {
    return Number.isFinite(size) && size > 0 ? size : VOLTMARK_SIZES.md;
  }
  return VOLTMARK_SIZES[size];
}

export interface VoltmarkProps
  extends Omit<
    SVGAttributes<SVGSVGElement>,
    | "children"
    | "viewBox"
    | "width"
    | "height"
    | "role"
    | "aria-hidden"
    | "aria-label"
  > {
  /** Visual variant suited to light, dark, or single-ink surfaces. */
  variant?: VoltmarkVariant;
  /** Icon size token (16, 24, 32, 48, 64) or explicit pixel size. */
  size?: VoltmarkSize;
  /** Hide from assistive technology when paired with adjacent brand text. */
  decorative?: boolean;
  /** Accessible name used when standalone (`decorative` is false). */
  label?: string;
}

/**
 * Reusable Voltmark brand emblem for VoltGrid.
 * Uses Orchid & Clay semantic CSS tokens with hex fallbacks.
 */
export function Voltmark({
  variant = "primary",
  size = "md",
  decorative = false,
  label = VOLTMARK_BRAND.name,
  className,
  ...props
}: VoltmarkProps) {
  const pixelSize = resolveVoltmarkSize(size);
  const accessibleLabel = label.trim() || VOLTMARK_BRAND.name;
  const a11yProps = decorative
    ? ({ "aria-hidden": true } as const)
    : ({ role: "img", "aria-label": accessibleLabel } as const);

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox={VOLTMARK_VIEWBOX}
      width={pixelSize}
      height={pixelSize}
      fill="none"
      focusable="false"
      className={className ? `shrink-0 ${className}` : "shrink-0"}
      {...a11yProps}
      {...props}
    >
      {variant === "monochrome" ? (
        <path
          fill="currentColor"
          fillRule="evenodd"
          clipRule="evenodd"
          d="M19 0 H61 A19 19 0 0 1 80 19 V61 A19 19 0 0 1 61 80 H19 A19 19 0 0 1 0 61 V19 A19 19 0 0 1 19 0 Z M19 20 H31 L41 49 L42.7 44.5 H51.2 L41 64 Z M51 20 H66 L51 41 H41.5 Z"
        />
      ) : (
        <>
          {variant === "primary" ? (
            <rect
              width="80"
              height="80"
              rx="19"
              fill="var(--vg-brand, #43284F)"
            />
          ) : null}
          <path
            d="M19 20 H31 L41 49 L52 20 H64 L41 64 Z"
            fill="var(--vg-canvas, #F8F6F3)"
          />
          <path
            d="M50 20 H66 L51 41 H39 Z"
            fill="var(--vg-accent, #F3BB94)"
          />
        </>
      )}
    </svg>
  );
}

export interface VoltmarkWordmarkProps
  extends Omit<HTMLAttributes<HTMLSpanElement>, "children"> {
  /** Color variant matching the surface contrast. */
  variant?: VoltmarkVariant;
  /** Typographic scale for navigation, headers, or display lockups. */
  size?: VoltmarkLockupSize;
  /** Hide from assistive technology when decorative. */
  decorative?: boolean;
}

/**
 * Lowercase `voltgrid.` wordmark rendered in Manrope.
 */
export function VoltmarkWordmark({
  variant = "primary",
  size = "md",
  decorative = false,
  className,
  ...props
}: VoltmarkWordmarkProps) {
  const classes = [
    "font-sans font-bold leading-none tracking-[-0.025em] select-none",
    WORDMARK_SIZE_CLASSES[size],
    WORDMARK_COLOR_CLASSES[variant],
    className,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <span
      aria-hidden={decorative ? true : undefined}
      className={classes}
      {...props}
    >
      {VOLTMARK_BRAND.wordmark}
    </span>
  );
}

export interface VoltmarkLockupProps
  extends Omit<HTMLAttributes<HTMLSpanElement>, "children"> {
  /** Visual variant for light, dark, or monochrome contexts. */
  variant?: VoltmarkVariant;
  /** Lockup scale mapping to 24px, 32px, or 48px mark sizes. */
  size?: VoltmarkLockupSize;
  /** Display the secondary tagline beneath the wordmark. */
  showTagline?: boolean;
  /** Optional custom tagline override; defaults to `Energy in focus.`. */
  tagline?: string;
  /** Hide the entire lockup from assistive technology when paired with external labeling. */
  decorative?: boolean;
}

/**
 * Combined Voltmark emblem and `voltgrid.` wordmark lockup.
 * Marks the graphic emblem decorative so screen readers announce the text once.
 */
export function VoltmarkLockup({
  variant = "primary",
  size = "md",
  showTagline = false,
  tagline = VOLTMARK_BRAND.tagline,
  decorative = false,
  className,
  ...props
}: VoltmarkLockupProps) {
  const classes = [
    "inline-flex items-center",
    LOCKUP_GAP_CLASSES[size],
    className,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <span
      aria-hidden={decorative ? true : undefined}
      className={classes}
      {...props}
    >
      <Voltmark
        variant={variant}
        size={LOCKUP_MARK_SIZES[size]}
        decorative
      />
      <span className="flex flex-col">
        <VoltmarkWordmark variant={variant} size={size} />
        {showTagline ? (
          <span
            className={`mt-1 font-sans font-medium ${TAGLINE_SIZE_CLASSES[size]} ${TAGLINE_COLOR_CLASSES[variant]}`}
          >
            {tagline}
          </span>
        ) : null}
      </span>
    </span>
  );
}
