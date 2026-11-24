import type { HTMLAttributes, ReactNode } from "react";
import { Card } from "./card";

export type EmptyStateKind = "empty" | "no-matches";

export interface EmptyStateProps extends HTMLAttributes<HTMLDivElement> {
  /** Short, direct title describing the empty or filtered state. */
  title: string;
  /** Clear explanation distinguishing zero records from API unavailability. */
  description: string;
  /** Semantic category (`empty` fleet/list vs `no-matches` active filter). */
  kind?: EmptyStateKind;
  /** Heading element level matching the surrounding page hierarchy. */
  headingAs?: "h2" | "h3" | "h4";
  /** Optional contextual action (such as registering a station or clearing filters). */
  action?: ReactNode;
  /** Optional decorative icon wrapped in `aria-hidden="true"`. */
  icon?: ReactNode;
}

/**
 * Calm empty-state surface for valid zero-record or filtered-out states (never for API errors).
 */
export function EmptyState({
  title,
  description,
  kind = "empty",
  headingAs = "h2",
  action,
  icon,
  className,
  ...props
}: EmptyStateProps) {
  const Heading = headingAs;

  return (
    <Card
      variant="subtle"
      padding="lg"
      data-empty-kind={kind}
      className={className}
      {...props}
    >
      <div className="flex flex-col items-start gap-3">
        {icon ? (
          <span
            aria-hidden="true"
            className="inline-flex h-10 w-10 items-center justify-center rounded-[var(--vg-radius-md)] border border-[color:var(--vg-border)] bg-[color:var(--vg-surface)] text-[color:var(--vg-brand)]"
          >
            {icon}
          </span>
        ) : null}
        <div>
          <Heading className="font-sans text-[1rem] font-semibold leading-[1.5rem] text-[color:var(--vg-text-primary)]">
            {title}
          </Heading>
          <p className="mt-1.5 max-w-prose font-sans text-[0.875rem] leading-[1.375rem] text-[color:var(--vg-text-secondary)]">
            {description}
          </p>
        </div>
        {action ? <div className="mt-1 flex flex-wrap gap-2">{action}</div> : null}
      </div>
    </Card>
  );
}
