import Link from "next/link";
import type { HTMLAttributes, ReactNode } from "react";
import { Card } from "./card";

export type MetricValue = number | string | null | undefined;

export interface MetricCardProps extends HTMLAttributes<HTMLDivElement> {
  /** Concise metric title describing scope accurately. */
  label: string;
  /** Metric value; `null`, `undefined`, or non-finite numbers render as unknown rather than `0`. */
  value: MetricValue;
  /** Fallback text when `value` is unknown/unavailable (defaults to `"Unknown"`). */
  unknownLabel?: string;
  /** Optional supporting explanation (for example denominator scope or retrieval note). */
  description?: string;
  /** Optional restrained decorative icon rendered with `aria-hidden="true"`. */
  icon?: ReactNode;
  /** Optional internal route for semantic navigation from the metric card. */
  href?: string;
  /** Accessible link label rendered when `href` is provided. */
  linkLabel?: string;
}

function resolveMetricDisplay(
  value: MetricValue,
  unknownLabel: string,
): { text: string; isUnknown: boolean } {
  if (value === null || value === undefined) {
    return { text: unknownLabel, isUnknown: true };
  }
  if (typeof value === "number") {
    if (!Number.isFinite(value)) {
      return { text: unknownLabel, isUnknown: true };
    }
    return { text: String(value), isUnknown: false };
  }
  const trimmed = value.trim();
  if (trimmed.length === 0) {
    return { text: unknownLabel, isUnknown: true };
  }
  return { text: value, isUnknown: false };
}

/**
 * Operational metric card distinguishing valid zero values from unknown/unavailable data.
 */
export function MetricCard({
  label,
  value,
  unknownLabel = "Unknown",
  description,
  icon,
  href,
  linkLabel = "View details",
  className,
  ...props
}: MetricCardProps) {
  const display = resolveMetricDisplay(value, unknownLabel);

  return (
    <Card
      as="section"
      padding="md"
      className={className}
      {...props}
    >
      <div className="flex items-center justify-between gap-2">
        <p className="font-sans text-[0.8125rem] font-medium leading-[1.25rem] text-[color:var(--vg-text-secondary)]">
          {label}
        </p>
        {icon ? (
          <span
            aria-hidden="true"
            className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-[var(--vg-radius-md)] bg-[color:var(--vg-surface-subtle)] text-[color:var(--vg-brand)]"
          >
            {icon}
          </span>
        ) : null}
      </div>
      <p
        className={`mt-2 font-sans text-[2rem] font-bold leading-[2.5rem] tabular-nums ${
          display.isUnknown
            ? "text-[color:var(--vg-text-secondary)]"
            : "text-[color:var(--vg-text-primary)]"
        }`}
      >
        {display.text}
      </p>
      {description ? (
        <p className="mt-1.5 font-sans text-[0.8125rem] leading-[1.25rem] text-[color:var(--vg-text-secondary)]">
          {description}
        </p>
      ) : null}
      {href ? (
        <div className="mt-4">
          <Link
            href={href}
            className="inline-flex min-h-11 items-center gap-1 rounded-[var(--vg-radius-sm)] font-sans text-[0.875rem] font-semibold leading-[1.25rem] text-[color:var(--vg-brand)] underline-offset-4 hover:text-[color:var(--vg-brand-hover)] hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--vg-focus)]"
          >
            <span>{linkLabel}</span>
            <span aria-hidden="true">→</span>
          </Link>
        </div>
      ) : null}
    </Card>
  );
}
