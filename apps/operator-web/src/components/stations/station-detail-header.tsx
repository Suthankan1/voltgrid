import Link from "next/link";
import { Alert } from "@/components/ui/alert";
import { StationStatusIndicator } from "@/components/ui/status-indicator";
import {
  buildStationDetailSectionHref,
  type StationDetailPresentationModel,
  type StationDetailSection,
} from "@/lib/station-detail-model";

export interface StationDetailHeaderProps {
  model: StationDetailPresentationModel;
}

const SECTION_LINKS: Array<{
  id: StationDetailSection;
  label: string;
}> = [
  { id: "overview", label: "Overview" },
  { id: "connectors", label: "Connectors" },
  { id: "sessions", label: "Sessions" },
  { id: "connection", label: "Connection details" },
];

/**
 * Station header and URL-backed section navigation preserving validated filtered
 * directory return context across station sub-sections.
 */
export function StationDetailHeader({ model }: StationDetailHeaderProps) {
  const backHref = model.returnPath ?? "/stations";
  const backLabel =
    backHref === "/attention"
      ? "Back to Needs attention"
      : "Back to charging stations";

  return (
    <header className="space-y-5">
      <div>
        <Link
          href={backHref}
          className="inline-flex min-h-11 items-center gap-1.5 rounded-[var(--vg-radius-md)] px-2 py-1.5 font-sans text-[0.875rem] font-semibold text-[color:var(--vg-brand)] underline-offset-4 hover:bg-[color:var(--vg-brand-soft)] hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--vg-focus)]"
        >
          ← {backLabel}
        </Link>
      </div>

      <div className="flex flex-wrap items-start justify-between gap-4 border-b border-[color:var(--vg-border)] pb-5">
        <div className="min-w-0 flex-1 space-y-2.5">
          <div className="flex flex-wrap items-center gap-2.5">
            <StationStatusIndicator status={model.station.status} size="md" />
            <span className="inline-flex items-center rounded-full border border-[color:var(--vg-border)] bg-[color:var(--vg-surface-subtle)] px-2.5 py-0.5 font-mono text-[0.75rem] font-medium text-[color:var(--vg-text-secondary)]">
              {model.protocolLabel}
            </span>
          </div>

          <h1 className="break-words font-sans text-[1.75rem] font-semibold leading-[2.25rem] tracking-[-0.02em] text-[color:var(--vg-text-primary)]">
            {model.station.name}
          </h1>

          <p className="font-sans text-[0.875rem] text-[color:var(--vg-text-secondary)]">
            Station ID:{" "}
            <span className="break-all font-mono text-[0.8125rem] text-[color:var(--vg-text-primary)]">
              {model.station.id}
            </span>
          </p>
        </div>
      </div>

      {model.isOffline ? (
        <Alert
          variant="warning"
          announce="none"
          title="Station is currently reported offline"
        >
          {model.attention.detail}
        </Alert>
      ) : null}

      <nav aria-label="Station sections" className="border-b border-[color:var(--vg-border)]">
        <ul className="flex flex-wrap gap-1.5 pb-2">
          {SECTION_LINKS.map(section => {
            const isActive = model.activeSection === section.id;
            const href = buildStationDetailSectionHref(
              model.station.id,
              section.id,
              model.returnPath,
            );

            let countBadge: number | null = null;
            if (section.id === "connectors" && model.connectorCounts !== null) {
              countBadge = model.connectorCounts.total;
            } else if (section.id === "sessions" && model.totalSessionCount !== null) {
              countBadge = model.totalSessionCount;
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
                  {countBadge !== null ? (
                    <span
                      className={`rounded-full px-2 py-0.5 text-[0.75rem] tabular-nums ${
                        isActive
                          ? "bg-[color:var(--vg-surface)] text-[color:var(--vg-brand)]"
                          : "bg-[color:var(--vg-neutral-soft)] text-[color:var(--vg-neutral)]"
                      }`}
                    >
                      {countBadge}
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
