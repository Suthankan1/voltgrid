import Link from "next/link";
import { Card } from "@/components/ui/card";
import { ConnectorStatusIndicator } from "@/components/ui/status-indicator";
import {
  formatUtcDateTime,
  type ConnectorPresentationItem,
} from "@/lib/station-detail-model";
import { ChargerIllustration } from "./charger-illustration";

export interface ConnectorCardProps {
  item: ConnectorPresentationItem;
  stationOffline: boolean;
}

/**
 * Simple Prototype V3 connector card combining generic realistic charger artwork
 * with composite EVSE/connector identity and explicit reported equipment status.
 */
export function ConnectorCard({ item, stationOffline }: ConnectorCardProps) {
  const { connector, compositeLabel, activeSession } = item;
  const updatedAtUtc = formatUtcDateTime(connector.statusUpdatedAt);

  return (
    <Card
      as="article"
      padding="sm"
      className={
        connector.status === "FAULTED"
          ? "border-[color:var(--vg-danger)]/35"
          : undefined
      }
    >
      <div className="flex flex-wrap items-start gap-4">
        <div className="flex shrink-0 items-center justify-center rounded-[var(--vg-radius-md)] border border-[color:var(--vg-border)] bg-[color:var(--vg-canvas)] p-2">
          <ChargerIllustration status={connector.status} size="md" />
        </div>

        <div className="min-w-[9.5rem] flex-1 space-y-2.5">
          <div>
            <h3 className="font-sans text-[1rem] font-semibold leading-[1.5rem] text-[color:var(--vg-text-primary)]">
              Connector {connector.connectorId}
            </h3>
            <p className="font-mono text-[0.8125rem] leading-[1.25rem] text-[color:var(--vg-text-secondary)]">
              {compositeLabel}
            </p>
          </div>

          <div className="space-y-1">
            <ConnectorStatusIndicator status={connector.status} size="sm" />
            {stationOffline ? (
              <p className="font-sans text-[0.75rem] leading-[1.125rem] text-[color:var(--vg-warning)]">
                Last reported before station went offline
              </p>
            ) : null}
          </div>

          <dl className="space-y-1 border-t border-[color:var(--vg-border)] pt-2">
            <div>
              <dt className="font-sans text-[0.75rem] font-medium text-[color:var(--vg-text-secondary)]">
                Status updated
              </dt>
              <dd className="font-mono text-[0.75rem] leading-[1.125rem] text-[color:var(--vg-text-primary)]">
                {updatedAtUtc ?? connector.statusUpdatedAt}
              </dd>
            </div>
          </dl>

          {activeSession ? (
            <div className="pt-0.5">
              <Link
                href={activeSession.href}
                className="inline-flex min-h-11 items-center gap-1 break-all rounded-[var(--vg-radius-sm)] font-sans text-[0.8125rem] font-semibold text-[color:var(--vg-brand)] underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--vg-focus)]"
              >
                <span>Session {activeSession.transactionId}</span>
                <span aria-hidden="true">→</span>
              </Link>
            </div>
          ) : null}
        </div>
      </div>
    </Card>
  );
}
