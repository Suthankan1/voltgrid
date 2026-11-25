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
import {
  buildDirectoryStationHref,
  type StationDirectoryModel,
} from "@/lib/stations-directory-model";
import { StationRecordsList } from "./station-records-list";

export interface StationsDirectoryViewProps {
  model: StationDirectoryModel;
  registrationEnabled: boolean;
  errorFallback?: React.ReactNode;
}

/**
 * Full-snapshot station directory featuring URL-backed search/connectivity
 * filters, matching count scope, and distinct empty/no-match/error states.
 */
export function StationsDirectoryView({
  model,
  registrationEnabled,
  errorFallback,
}: StationsDirectoryViewProps) {
  const isLive = model.availability === "live";
  const total = model.totalStations ?? 0;

  const scopeLabel = !isLive
    ? "Unavailable"
    : model.hasActiveFilters
      ? `Showing ${model.matchingCount} of ${model.matchingCount} matching (${total} total)`
      : `Showing ${model.matchingCount} of ${total} ${total === 1 ? "station" : "stations"}`;

  return (
    <Card
      as="section"
      aria-labelledby="stations-directory-list-title"
      padding="none"
      className="overflow-hidden"
    >
      <div className="border-b border-[color:var(--vg-border)] p-5 sm:p-6">
        <CardHeader>
          <div>
            <CardTitle id="stations-directory-list-title">
              Station directory
            </CardTitle>
            <CardDescription>
              Offline stations appear first. Open any station to inspect connectors, sessions, and connection details.
            </CardDescription>
          </div>
          <p className="font-sans text-[0.8125rem] font-medium text-[color:var(--vg-text-secondary)]">
            {scopeLabel}
          </p>
        </CardHeader>

        {isLive && total > 0 ? (
          <form
            key={`${model.filters.query}:${model.filters.status}`}
            action="/stations"
            method="get"
            className="mt-5 grid gap-3 sm:grid-cols-[minmax(0,1fr)_12rem_auto] sm:items-end"
          >
            <FormField label="Search stations" htmlFor="stations-search">
              <Input
                id="stations-search"
                name="q"
                type="search"
                maxLength={255}
                defaultValue={model.filters.query}
                placeholder="Station name or identifier"
              />
            </FormField>

            <FormField label="Connectivity" htmlFor="stations-status">
              <Select
                id="stations-status"
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
                Apply filters
              </Button>
              {model.hasActiveFilters && model.directoryState === "results" ? (
                <Link
                  href="/stations"
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
      ) : model.directoryState === "results" ? (
        <StationRecordsList
          stations={model.stations}
          caption="Registered charging stations matching the active directory filters"
          getStationHref={station =>
            buildDirectoryStationHref(station.id, model.filters)
          }
        />
      ) : model.directoryState === "no-matches" ? (
        <div className="p-5 sm:p-6">
          <EmptyState
            kind="no-matches"
            headingAs="h3"
            title="No stations match the selected filters."
            description="Try another station name or identifier, or clear active filters to view the full directory."
            action={
              <Link
                href="/stations"
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
