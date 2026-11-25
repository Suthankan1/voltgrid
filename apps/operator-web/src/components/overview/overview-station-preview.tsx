import Link from "next/link";
import { StationRecordsList } from "@/components/stations/station-records-list";
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import type { OverviewPresentationModel } from "@/lib/overview-model";

export interface OverviewStationPreviewProps {
  model: OverviewPresentationModel;
  registrationEnabled: boolean;
  errorFallback?: React.ReactNode;
}

/**
 * Bounded offline-first charging-station preview linking operators to the
 * dedicated `/stations` directory for complete fleet search and filtering.
 */
export function OverviewStationPreview({
  model,
  registrationEnabled,
  errorFallback,
}: OverviewStationPreviewProps) {
  const isLive = model.availability === "live";
  const total = model.totalStations ?? 0;

  const scopeLabel = !isLive
    ? "Unavailable"
    : `Showing ${model.visibleStations.length} of ${total} ${total === 1 ? "station" : "stations"}`;

  return (
    <Card
      as="section"
      id="stations"
      aria-labelledby="station-preview-title"
      padding="none"
      className="scroll-mt-24 overflow-hidden"
    >
      <div className="border-b border-[color:var(--vg-border)] p-5 sm:p-6">
        <CardHeader>
          <div className="min-w-0 flex-1">
            <CardTitle id="station-preview-title">
              Charging stations
            </CardTitle>
            <CardDescription>
              Offline stations are prioritized for investigation. Open a station for details or browse the full directory.
            </CardDescription>
          </div>
          <p className="font-sans text-[0.8125rem] font-medium text-[color:var(--vg-text-secondary)]">
            {scopeLabel}
          </p>
        </CardHeader>
      </div>

      {!isLive ? (
        <div className="p-5 sm:p-6">{errorFallback}</div>
      ) : model.visibleStations.length > 0 ? (
        <>
          <StationRecordsList
            stations={model.visibleStations}
            caption="Preview of registered charging stations prioritized by offline connectivity"
          />

          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[color:var(--vg-border)] bg-[color:var(--vg-surface-subtle)] px-5 py-3.5 sm:px-6">
            <p className="font-sans text-[0.8125rem] text-[color:var(--vg-text-secondary)]">
              {scopeLabel}
            </p>
            <Link
              href="/stations"
              className="inline-flex min-h-11 items-center gap-1 rounded-[var(--vg-radius-md)] px-3 py-2 font-sans text-[0.875rem] font-semibold text-[color:var(--vg-brand)] hover:bg-[color:var(--vg-brand-soft)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--vg-focus)]"
            >
              <span>View all stations</span>
              <span aria-hidden="true">→</span>
            </Link>
          </div>
        </>
      ) : (
        <div className="p-5 sm:p-6">
          <EmptyState
            kind="empty"
            headingAs="h3"
            title="No charging stations registered"
            description={
              registrationEnabled
                ? "Station Service is reachable, but the network has no registered stations yet."
                : "Station Service is reachable, but the network has no registered stations. Registration is disabled in read-only mode."
            }
            action={
              registrationEnabled ? (
                <Link
                  href="/stations/new"
                  className="inline-flex min-h-11 items-center rounded-[var(--vg-radius-md)] bg-[color:var(--vg-brand)] px-4 py-2.5 font-sans text-[0.875rem] font-semibold text-[color:var(--vg-text-inverse)] hover:bg-[color:var(--vg-brand-hover)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--vg-focus)]"
                >
                  Add station
                </Link>
              ) : undefined
            }
          />
        </div>
      )}
    </Card>
  );
}
