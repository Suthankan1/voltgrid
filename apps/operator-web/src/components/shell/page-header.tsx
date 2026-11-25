import type { ReactNode } from "react";

export interface PageHeaderProps {
  /** Optional short section eyebrow above the primary heading. */
  eyebrow?: string;
  /** Primary page heading rendered as `<h1>`. */
  title: string;
  /** Concise supporting description explaining page scope. */
  description?: string;
  /** Optional primary action slot aligned cleanly on desktop and mobile. */
  actions?: ReactNode;
  className?: string;
}

/**
 * Reusable page header aligned with Orchid & Clay typography tokens.
 */
export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
  className,
}: PageHeaderProps) {
  const classes = [
    "mb-6 flex flex-wrap items-start justify-between gap-4 border-b border-[color:var(--vg-border)] pb-5",
    className,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div className={classes}>
      <div className="min-w-0 max-w-2xl">
        {eyebrow ? (
          <p className="font-sans text-[0.75rem] font-medium uppercase tracking-[0.06em] leading-[1.125rem] text-[color:var(--vg-text-secondary)]">
            {eyebrow}
          </p>
        ) : null}
        <h1 className="mt-1 font-sans text-[1.75rem] font-[650] leading-[2.25rem] tracking-[-0.02em] text-[color:var(--vg-text-primary)]">
          {title}
        </h1>
        {description ? (
          <p className="mt-2 font-sans text-[0.875rem] leading-[1.375rem] text-[color:var(--vg-text-secondary)]">
            {description}
          </p>
        ) : null}
      </div>
      {actions ? (
        <div className="flex shrink-0 flex-wrap items-center gap-3">{actions}</div>
      ) : null}
    </div>
  );
}
