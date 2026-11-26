import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import type { StationDetailPresentationModel } from "@/lib/station-detail-model";
import { ConnectorCard } from "./connector-card";
import { StationDetailRetryState } from "./station-detail-retry-state";

export interface StationConnectorsSectionProps {
  model: StationDetailPresentationModel;
}

/**
 * Full Connectors section showing all reported connectors sorted with faulted
 * and unavailable equipment first alongside illustrative equipment disclaimer.
 */
export function StationConnectorsSection({
  model,
}: StationConnectorsSectionProps) {
  const counts = model.connectorCounts;

  return (
    <section aria-labelledby="station-connectors-title" className="space-y-4">
      <Card padding="md">
        <CardHeader>
          <div className="min-w-0 flex-1">
            <CardTitle id="station-connectors-title">
              Charging equipment & connectors
            </CardTitle>
            <CardDescription>
              Charger illustrations are generic visual representations and do not establish hardware model, cabinet count, power rating, or live vehicle presence.
            </CardDescription>
          </div>
          <p className="font-sans text-[0.8125rem] font-medium text-[color:var(--vg-text-secondary)]">
            {counts === null
              ? "Unavailable"
              : `${counts.total} ${counts.total === 1 ? "connector" : "connectors"} reported`}
          </p>
        </CardHeader>

        {counts !== null && counts.total > 0 ? (
          <CardContent>
            <dl className="flex flex-wrap gap-x-6 gap-y-2 border-t border-[color:var(--vg-border)] pt-4 font-sans text-[0.8125rem]">
              <div>
                <dt className="inline text-[color:var(--vg-text-secondary)]">Available: </dt>
                <dd className="inline font-semibold tabular-nums text-[color:var(--vg-success)]">
                  {counts.available}
                </dd>
              </div>
              <div>
                <dt className="inline text-[color:var(--vg-text-secondary)]">Occupied: </dt>
                <dd className="inline font-semibold tabular-nums text-[color:var(--vg-info)]">
                  {counts.occupied}
                </dd>
              </div>
              <div>
                <dt className="inline text-[color:var(--vg-text-secondary)]">Reserved: </dt>
                <dd className="inline font-semibold tabular-nums text-[color:var(--vg-warning)]">
                  {counts.reserved}
                </dd>
              </div>
              <div>
                <dt className="inline text-[color:var(--vg-text-secondary)]">Unavailable: </dt>
                <dd className="inline font-semibold tabular-nums text-[color:var(--vg-neutral)]">
                  {counts.unavailable}
                </dd>
              </div>
              <div>
                <dt className="inline text-[color:var(--vg-text-secondary)]">Faulted: </dt>
                <dd className="inline font-semibold tabular-nums text-[color:var(--vg-danger)]">
                  {counts.faulted}
                </dd>
              </div>
            </dl>
          </CardContent>
        ) : null}
      </Card>

      {model.connectorsAvailability === "unavailable" ? (
        <StationDetailRetryState
          headingAs="h3"
          title="Unable to load connector equipment"
          message={model.connectorsError ?? "Charging equipment data could not be loaded."}
        />
      ) : model.allConnectors.length > 0 ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {model.allConnectors.map(item => (
            <ConnectorCard
              key={item.compositeKey}
              item={item}
              stationOffline={model.isOffline}
            />
          ))}
        </div>
      ) : (
        <EmptyState
          kind="empty"
          headingAs="h3"
          title="No connectors reported"
          description="Station Service has not received a connector status report for this charging station yet."
        />
      )}
    </section>
  );
}
