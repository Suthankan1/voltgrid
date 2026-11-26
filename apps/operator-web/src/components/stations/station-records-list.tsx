import Link from "next/link";
import { StationStatusIndicator } from "@/components/ui/status-indicator";
import { buildStationHref } from "@/lib/routes";
import type { Station } from "@/lib/station-api";

export interface StationRecordsListProps {
  stations: readonly Station[];
  caption: string;
  getStationHref?: (station: Station) => string;
}

/**
 * Responsive charging-station list rendering a semantic desktop table and
 * stacked mobile cards without duplicating link encoding or status semantics.
 */
export function StationRecordsList({
  stations,
  caption,
  getStationHref = station => buildStationHref(station.id),
}: StationRecordsListProps) {
  return (
    <>
      <div className="hidden overflow-x-auto md:block">
        <table className="w-full border-collapse text-left">
          <caption className="sr-only">{caption}</caption>
          <thead>
            <tr className="border-b border-[color:var(--vg-border)] bg-[color:var(--vg-surface-subtle)] font-sans text-[0.75rem] font-semibold uppercase tracking-[0.04em] text-[color:var(--vg-text-secondary)]">
              <th scope="col" className="px-4 py-3 sm:px-5">Station</th>
              <th scope="col" className="px-4 py-3 sm:px-5">Identifier</th>
              <th scope="col" className="px-4 py-3 sm:px-5">Connectivity</th>
              <th scope="col" className="px-4 py-3 text-right sm:px-5">Details</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[color:var(--vg-border)]">
            {stations.map(station => {
              const href = getStationHref(station);
              const isOffline = station.status === "OFFLINE";
              return (
                <tr
                  key={station.id}
                  className="transition-colors duration-[var(--vg-transition-fast)] hover:bg-[color:var(--vg-surface-subtle)]/60"
                >
                  <td className="max-w-[20rem] px-4 py-4 align-middle sm:px-5">
                    <Link
                      href={href}
                      className="inline-flex min-h-11 items-center break-words rounded-[var(--vg-radius-sm)] font-sans text-[0.875rem] font-semibold leading-[1.375rem] text-[color:var(--vg-text-primary)] hover:text-[color:var(--vg-brand)] hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--vg-focus)]"
                    >
                      {station.name}
                    </Link>
                  </td>
                  <td className="max-w-[16rem] px-4 py-4 align-middle font-mono text-[0.8125rem] leading-[1.25rem] break-all text-[color:var(--vg-text-secondary)] sm:px-5">
                    {station.id}
                  </td>
                  <td className="px-4 py-4 align-middle sm:px-5">
                    <StationStatusIndicator status={station.status} size="sm" />
                  </td>
                  <td className="px-4 py-4 text-right align-middle sm:px-5">
                    <Link
                      href={href}
                      aria-label={
                        isOffline
                          ? `Investigate station ${station.id}`
                          : `Open station ${station.id}`
                      }
                      className="inline-flex min-h-11 items-center gap-1 rounded-[var(--vg-radius-md)] px-3 py-2 font-sans text-[0.875rem] font-semibold text-[color:var(--vg-brand)] hover:bg-[color:var(--vg-brand-soft)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--vg-focus)]"
                    >
                      <span>{isOffline ? "Investigate" : "Open"}</span>
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
        {stations.map(station => {
          const href = getStationHref(station);
          const isOffline = station.status === "OFFLINE";
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
                    isOffline
                      ? `Investigate station ${station.id}`
                      : `Open station ${station.id}`
                  }
                  className="inline-flex min-h-11 items-center gap-1 rounded-[var(--vg-radius-md)] border border-[color:var(--vg-border-control)] bg-[color:var(--vg-surface)] px-3.5 py-2 font-sans text-[0.875rem] font-semibold text-[color:var(--vg-text-primary)] hover:bg-[color:var(--vg-surface-subtle)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--vg-focus)]"
                >
                  <span>{isOffline ? "Investigate" : "Open station"}</span>
                  <span aria-hidden="true">→</span>
                </Link>
              </div>
            </li>
          );
        })}
      </ul>
    </>
  );
}
