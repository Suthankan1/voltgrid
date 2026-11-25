import { Card } from "@/components/ui/card";
import type { StationDirectoryModel } from "@/lib/stations-directory-model";

export interface StationsDirectorySummaryProps {
  model: StationDirectoryModel;
}

/**
 * Compact full-snapshot station population strip remaining constant across
 * search and connectivity filters.
 */
export function StationsDirectorySummary({
  model,
}: StationsDirectorySummaryProps) {
  const isLive = model.availability === "live";

  const items = [
    {
      label: "Total registered",
      value: isLive && model.totalStations !== null ? String(model.totalStations) : "Unknown",
      toneClass: isLive
        ? "text-[color:var(--vg-text-primary)]"
        : "text-[color:var(--vg-text-secondary)]",
    },
    {
      label: "Online",
      value: isLive && model.onlineStations !== null ? String(model.onlineStations) : "Unknown",
      toneClass: isLive
        ? "text-[color:var(--vg-success)]"
        : "text-[color:var(--vg-text-secondary)]",
    },
    {
      label: "Offline",
      value: isLive && model.offlineStations !== null ? String(model.offlineStations) : "Unknown",
      toneClass: isLive
        ? "text-[color:var(--vg-text-primary)]"
        : "text-[color:var(--vg-text-secondary)]",
    },
  ];

  return (
    <Card as="section" aria-label="Registered station summary" padding="sm">
      <dl className="grid gap-4 divide-y divide-[color:var(--vg-border)] sm:grid-cols-3 sm:divide-x sm:divide-y-0">
        {items.map((item, index) => (
          <div
            key={item.label}
            className={index > 0 ? "pt-3 sm:pl-5 sm:pt-0" : "sm:pr-3"}
          >
            <dt className="font-sans text-[0.75rem] font-medium uppercase tracking-[0.04em] text-[color:var(--vg-text-secondary)]">
              {item.label}
            </dt>
            <dd
              className={`mt-1 font-sans text-[1.25rem] font-bold leading-[1.75rem] tabular-nums ${item.toneClass}`}
            >
              {item.value}
            </dd>
          </div>
        ))}
      </dl>
    </Card>
  );
}
