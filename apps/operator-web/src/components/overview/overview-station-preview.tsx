import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { StationStatusIndicator } from "@/components/ui/status-indicator";
import {
  buildOverviewHref,
  type OverviewPresentationModel,
} from "@/lib/overview-model";
import { buildStationHref } from "@/lib/routes";

export interface OverviewStationPreviewProps {
  model: OverviewPresentationModel;
  registrationEnabled: boolean;
  errorFallback?: React.ReactNode;
}

/**
 * Charging-station preview with offline-first deterministic sorting,
 * URL-backed search/filter controls, and full-fleet expansion until UI-104.
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
    : model.hasActiveFilters
      ? `Showing ${model.visibleStations.length} of ${model.filteredCount} matching (${total} total)`
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
          <div>
            <CardTitle id="station-preview-title">
              Charging stations
            </CardTitle>
            <CardDescription>
              Offline stations are prioritized for investigation. Open a station to inspect its connectors and sessions.
            </CardDescription>
          </div>
          <p className="font-sans text-[0.8125rem] font-medium text-[color:var(--vg-text-secondary)]">
            {scopeLabel}
          </p>
        </CardHeader>

        {isLive && total > 0 ? (
          <form
            key={`${model.filters.query}:${model.filters.status}`}
            action="/#stations"
            method="get"
            className="mt-5 grid gap-3 sm:grid-cols-[minmax(0,1fr)_12rem_auto] sm:items-end"
          >
            <FormField label="Search stations" htmlFor="overview-search">
              <Input
                id="overview-search"
                name="q"
                type="search"
                maxLength={255}
                defaultValue={model.filters.query}
                placeholder="Station name or identifier"
              />
            </FormField>

            <FormField label="Connectivity" htmlFor="overview-status">
              <Select
                id="overview-status"
                name="status"
                defaultValue={model.filters.status}
                options={[
                  { value: "", label: "All stations" },
                  { value: "ONLINE", label: "Online" },
                  { value: "OFFLINE", label: "Offline" },
                ]}
              />
            </FormField>

            <div className="flex flex-wrap items-center gap-2">
              <Button type="submit" variant="secondary">
                Search fleet
              </Button>
              {model.hasActiveFilters && model.visibleStations.length > 0 ? (
                <Link
                  href="/#stations"
                  className="inline-flex min-h-11 items-center rounded-[var(--vg-radius-md)] px-3 py-2 font-sans text-[0.875rem] font-semibold text-[color:var(--vg-brand)] underline-offset-4 hover:bg-[color:var(--vg-brand-soft)] hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--vg-focus)]"
                >
                  Clear filters
                </Link>
              ) : null}
            </div>
          </form>
        ) : null}
      </div>

      {!isLive ? (
        <div className="p-5 sm:p-6">{errorFallback}</div>
      ) : model.visibleStations.length > 0 ? (
        <>
          <div className="hidden overflow-x-auto md:block">
            <table className="w-full border-collapse text-left">
              <caption className="sr-only">
                Registered charging stations prioritized by offline connectivity
              </caption>
              <thead>
                <tr className="border-b border-[color:var(--vg-border)] bg-[color:var(--vg-surface-subtle)] font-sans text-[0.75rem] font-semibold uppercase tracking-[0.04em] text-[color:var(--vg-text-secondary)]">
                  <th scope="col" className="px-6 py-3">Station</th>
                  <th scope="col" className="px-6 py-3">Identifier</th>
                  <th scope="col" className="px-6 py-3">Connectivity</th>
                  <th scope="col" className="px-6 py-3 text-right">Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[color:var(--vg-border)]">
                {model.visibleStations.map(station => {
                  const href = buildStationHref(station.id);
                  return (
                    <tr
                      key={station.id}
                      className="transition-colors duration-[var(--vg-transition-fast)] hover:bg-[color:var(--vg-surface-subtle)]/60"
                    >
                      <td className="max-w-[20rem] px-6 py-4 align-middle">
                        <Link
                          href={href}
                          className="inline-flex min-h-11 items-center break-words rounded-[var(--vg-radius-sm)] font-sans text-[0.875rem] font-semibold leading-[1.375rem] text-[color:var(--vg-text-primary)] hover:text-[color:var(--vg-brand)] hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--vg-focus)]"
                        >
                          {station.name}
                        </Link>
                      </td>
                      <td className="max-w-[16rem] px-6 py-4 align-middle font-mono text-[0.8125rem] leading-[1.25rem] break-all text-[color:var(--vg-text-secondary)]">
                        {station.id}
                      </td>
                      <td className="px-6 py-4 align-middle">
                        <StationStatusIndicator status={station.status} size="sm" />
                      </td>
                      <td className="px-6 py-4 text-right align-middle">
                        <Link
                          href={href}
                          aria-label={
                            station.status === "OFFLINE"
                              ? `Investigate station ${station.id}`
                              : `Open station ${station.id}`
                          }
                          className="inline-flex min-h-11 items-center gap-1 rounded-[var(--vg-radius-md)] px-3 py-2 font-sans text-[0.875rem] font-semibold text-[color:var(--vg-brand)] hover:bg-[color:var(--vg-brand-soft)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--vg-focus)]"
                        >
                          <span>{station.status === "OFFLINE" ? "Investigate" : "Open"}</span>
                          <span aria-hidden="true">→</span>
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <ul className="divide-y divide-[color:var(--vg-border)] md:hidden">
            {model.visibleStations.map(station => {
              const href = buildStationHref(station.id);
              return (
                <li key={station.id} className="space-y-3 p-4">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <Link
                        href={href}
                        className="inline-flex min-h-11 items-center break-words rounded-[var(--vg-radius-sm)] font-sans text-[0.9375rem] font-semibold leading-[1.375rem] text-[color:var(--vg-text-primary)] hover:text-[color:var(--vg-brand)] hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--vg-focus)]"
                      >
                        {station.name}
                      </Link>
                      <p className="mt-0.5 break-all font-mono text-[0.8125rem] leading-[1.25rem] text-[color:var(--vg-text-secondary)]">
                        {station.id}
                      </p>
                    </div>
                    <StationStatusIndicator status={station.status} size="sm" />
                  </div>
                  <div>
                    <Link
                      href={href}
                      aria-label={
                        station.status === "OFFLINE"
                          ? `Investigate station ${station.id}`
                          : `Open station ${station.id}`
                      }
                      className="inline-flex min-h-11 items-center gap-1 rounded-[var(--vg-radius-md)] border border-[color:var(--vg-border-control)] bg-[color:var(--vg-surface)] px-3.5 py-2 font-sans text-[0.875rem] font-semibold text-[color:var(--vg-text-primary)] hover:bg-[color:var(--vg-surface-subtle)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--vg-focus)]"
                    >
                      <span>{station.status === "OFFLINE" ? "Investigate" : "Open station"}</span>
                      <span aria-hidden="true">→</span>
                    </Link>
                  </div>
                </li>
              );
            })}
          </ul>

          {model.isTruncated ||
          (model.filters.showAll &&
            !model.hasActiveFilters &&
            model.filteredCount > model.previewLimit) ? (
            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[color:var(--vg-border)] bg-[color:var(--vg-surface-subtle)] px-5 py-3.5 sm:px-6">
              <p className="font-sans text-[0.8125rem] text-[color:var(--vg-text-secondary)]">
                {scopeLabel}
              </p>
              {model.isTruncated ? (
                <Link
                  href={buildOverviewHref({ ...model.filters, showAll: true }, "stations")}
                  className="inline-flex min-h-11 items-center rounded-[var(--vg-radius-md)] px-3 py-2 font-sans text-[0.875rem] font-semibold text-[color:var(--vg-brand)] hover:bg-[color:var(--vg-brand-soft)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--vg-focus)]"
                >
                  Show all {model.filteredCount} stations
                </Link>
              ) : (
                <Link
                  href={buildOverviewHref({ ...model.filters, showAll: false }, "stations")}
                  className="inline-flex min-h-11 items-center rounded-[var(--vg-radius-md)] px-3 py-2 font-sans text-[0.875rem] font-semibold text-[color:var(--vg-brand)] hover:bg-[color:var(--vg-brand-soft)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--vg-focus)]"
                >
                  Show top {model.previewLimit}
                </Link>
              )}
            </div>
          ) : null}
        </>
      ) : model.hasActiveFilters ? (
        <div className="p-5 sm:p-6">
          <EmptyState
            kind="no-matches"
            headingAs="h3"
            title="No stations match the selected filters."
            description="Try a different station name or identifier, or clear active filters to return to the full overview list."
            action={
              <Link
                href="/#stations"
                className="inline-flex min-h-11 items-center rounded-[var(--vg-radius-md)] border border-[color:var(--vg-border-control)] bg-[color:var(--vg-surface)] px-4 py-2.5 font-sans text-[0.875rem] font-semibold text-[color:var(--vg-text-primary)] hover:bg-[color:var(--vg-surface-subtle)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--vg-focus)]"
              >
                Clear filters
              </Link>
            }
          />
        </div>
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
