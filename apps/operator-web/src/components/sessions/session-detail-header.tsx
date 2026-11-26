import Link from "next/link";
import {
  SessionCompletenessIndicator,
  SessionLifecycleIndicator,
  StatusIndicator,
} from "@/components/ui/status-indicator";
import {
  buildCanonicalSessionDetailHref,
  type SessionDetailPresentationModel,
  type SessionDetailSection,
} from "@/lib/session-detail-model";

export interface SessionDetailHeaderProps {
  model: SessionDetailPresentationModel;
}

const SECTION_LINKS: Array<{
  id: SessionDetailSection;
  label: string;
}> = [
  { id: "overview", label: "Overview" },
  { id: "measurements", label: "Measurements" },
  { id: "technical", label: "Technical details" },
];

/**
 * Header and URL-backed section navigation for a charging session, keeping
 * lifecycle status and telemetry completeness visually separated and return links safe.
 */
export function SessionDetailHeader({ model }: SessionDetailHeaderProps) {
  const { transaction, sequenceModel } = model;
  const completenessUnavailable =
    model.completenessAvailability === "unavailable" ||
    model.completenessStatus === null;

  return (
    <header className="space-y-5">
      <div className="flex flex-wrap items-center gap-3">
        <Link
          href={model.backLinkHref}
          className="inline-flex min-h-11 items-center gap-1.5 rounded-[var(--vg-radius-md)] px-2 py-1.5 font-sans text-[0.875rem] font-semibold text-[color:var(--vg-brand)] underline-offset-4 hover:bg-[color:var(--vg-brand-soft)] hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--vg-focus)]"
        >
          ← {model.backLinkLabel}
        </Link>

        {model.backLinkHref !== model.stationHref ? (
          <Link
            href={model.stationHref}
            className="inline-flex min-h-11 items-center rounded-[var(--vg-radius-md)] px-2.5 py-1.5 font-sans text-[0.875rem] font-medium text-[color:var(--vg-text-secondary)] underline-offset-4 hover:bg-[color:var(--vg-surface-subtle)] hover:text-[color:var(--vg-text-primary)] hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--vg-focus)]"
          >
            View station {transaction.stationId}
          </Link>
        ) : null}
      </div>

      <div className="flex flex-wrap items-start justify-between gap-4 border-b border-[color:var(--vg-border)] pb-5">
        <div className="min-w-0 flex-1 space-y-3">
          <div className="flex flex-wrap items-center gap-2.5">
            <SessionLifecycleIndicator status={model.lifecycleStatus} size="md" />
            {completenessUnavailable ? (
              <StatusIndicator
                tone="neutral"
                label="Completeness unavailable"
                size="md"
              />
            ) : (
              <SessionCompletenessIndicator
                status={model.completenessStatus!}
                size="md"
              />
            )}
          </div>

          <h1 className="break-all font-sans text-[1.625rem] font-semibold leading-[2.125rem] tracking-[-0.02em] text-[color:var(--vg-text-primary)] sm:text-[1.75rem] sm:leading-[2.25rem]">
            Session{" "}
            <span className="font-mono font-semibold">
              {transaction.transactionId}
            </span>
          </h1>

          <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 font-sans text-[0.875rem] text-[color:var(--vg-text-secondary)]">
            <span>
              Station:{" "}
              <Link
                href={model.stationHref}
                className="break-all font-mono text-[0.8125rem] font-semibold text-[color:var(--vg-brand)] underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--vg-focus)]"
              >
                {transaction.stationId}
              </Link>
            </span>
            <span>Endpoint: {model.compositeEndpoint}</span>
          </div>
        </div>
      </div>

      <nav
        aria-label="Session sections"
        className="border-b border-[color:var(--vg-border)]"
      >
        <ul className="flex flex-wrap gap-1.5 pb-2">
          {SECTION_LINKS.map(section => {
            const isActive = model.activeSection === section.id;
            const href = buildCanonicalSessionDetailHref(
              transaction.stationId,
              transaction.transactionId,
              {
                section: section.id,
                returnTo: model.sessionsReturnHref,
              },
            );

            let badge: string | number | null = null;
            if (
              section.id === "measurements" &&
              model.measurementsAvailability === "live"
            ) {
              badge = model.totalSampleCount;
            } else if (
              section.id === "technical" &&
              sequenceModel.availability === "live" &&
              sequenceModel.missingCount > 0
            ) {
              badge = `${sequenceModel.missingCount} missing`;
            }

            return (
              <li key={section.id}>
                <Link
                  href={href}
                  aria-current={isActive ? "page" : undefined}
                  className={`inline-flex min-h-11 items-center gap-2 rounded-[var(--vg-radius-md)] px-3.5 py-2 font-sans text-[0.875rem] leading-[1.25rem] transition-colors duration-[var(--vg-transition-fast)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--vg-focus)] ${
                    isActive
                      ? "border border-[color:var(--vg-brand)]/25 bg-[color:var(--vg-brand-soft)] font-semibold text-[color:var(--vg-brand)]"
                      : "text-[color:var(--vg-text-secondary)] hover:bg-[color:var(--vg-surface-subtle)] hover:text-[color:var(--vg-text-primary)]"
                  }`}
                >
                  <span>{section.label}</span>
                  {badge !== null ? (
                    <span
                      className={`rounded-full px-2 py-0.5 text-[0.75rem] tabular-nums ${
                        isActive
                          ? "bg-[color:var(--vg-surface)] text-[color:var(--vg-brand)]"
                          : "bg-[color:var(--vg-neutral-soft)] text-[color:var(--vg-neutral)]"
                      }`}
                    >
                      {badge}
                    </span>
                  ) : null}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </header>
  );
}
