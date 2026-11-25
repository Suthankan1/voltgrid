import Link from "next/link";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { MetricCard } from "@/components/ui/metric-card";
import { StatusIndicator } from "@/components/ui/status-indicator";
import {
  buildStationDetailSectionHref,
  type StationDetailPresentationModel,
} from "@/lib/station-detail-model";
import { ConnectorCard } from "./connector-card";
import { StationDetailRetryState } from "./station-detail-retry-state";
import { StationSessionsRecords } from "./station-sessions-section";

export interface StationOverviewSectionProps {
  model: StationDetailPresentationModel;
}

/**
 * Concise Prototype V3 station overview uniting KPI summary, station-local attention,
 * realistic generic connector cards, and bounded recent charging sessions.
 */
export function StationOverviewSection({ model }: StationOverviewSectionProps) {
  const counts = model.connectorCounts;
  const connectorsHref = buildStationDetailSectionHref(
    model.station.id,
    "connectors",
    model.returnPath,
  );
  const sessionsHref = buildStationDetailSectionHref(
    model.station.id,
    "sessions",
    model.returnPath,
  );

  const attentionIndicator =
    model.attention.kind === "offline"
      ? { tone: "neutral" as const, label: "Offline" }
      : model.attention.kind === "equipment-issues"
        ? { tone: "danger" as const, label: "Attention needed" }
        : model.attention.kind === "unverified"
          ? { tone: "warning" as const, label: "Unverified" }
          : { tone: "success" as const, label: "Connected" };

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard
          label="Total connectors"
          value={counts !== null ? counts.total : null}
          description={
            counts !== null
              ? "Reported connector records"
              : "Connector data unavailable"
          }
          href={counts !== null && counts.total > 0 ? connectorsHref : undefined}
          linkLabel="View connectors"
        />
        <MetricCard
          label="Available"
          value={counts !== null ? counts.available : null}
          description={
            counts === null
              ? "Connector data unavailable"
              : model.isOffline
                ? "Last reported before offline"
                : "Reported ready"
          }
        />
        <MetricCard
          label="Occupied"
          value={counts !== null ? counts.occupied : null}
          description={
            counts === null
              ? "Connector data unavailable"
              : "Does not confirm active session"
          }
        />
        <MetricCard
          label="Active sessions"
          value={model.activeSessionCount}
          description={
            model.activeSessionCount !== null
              ? "Open charging sessions"
              : "Session data unavailable"
          }
          href={
            model.totalSessionCount !== null && model.totalSessionCount > 0
              ? sessionsHref
              : undefined
          }
          linkLabel="View sessions"
        />
      </div>

      <Card as="section" aria-labelledby="station-attention-title" padding="md">
        <CardHeader>
          <div>
            <CardTitle id="station-attention-title">
              Station status summary
            </CardTitle>
            <CardDescription>{model.attention.headline}</CardDescription>
          </div>
          <StatusIndicator
            tone={attentionIndicator.tone}
            label={attentionIndicator.label}
            size="sm"
          />
        </CardHeader>
        <CardContent>
          <p className="font-sans text-[0.875rem] leading-[1.375rem] text-[color:var(--vg-text-secondary)]">
            {model.attention.detail}
          </p>
        </CardContent>
      </Card>

      <section aria-labelledby="overview-connectors-title" className="space-y-4">
        <Card padding="md">
          <CardHeader>
            <div>
              <CardTitle id="overview-connectors-title">
                Charging equipment
              </CardTitle>
              <CardDescription>
                Charger illustrations are generic visual representations of charging equipment and do not confirm model, power rating, or physical cabinet count.
              </CardDescription>
            </div>
            {counts !== null && counts.total > 0 ? (
              <Link
                href={connectorsHref}
                className="inline-flex min-h-11 items-center gap-1 rounded-[var(--vg-radius-md)] px-3 py-2 font-sans text-[0.875rem] font-semibold text-[color:var(--vg-brand)] hover:bg-[color:var(--vg-brand-soft)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--vg-focus)]"
              >
                <span>
                  {model.hasMoreConnectors
                    ? `View all ${counts.total} connectors`
                    : "All connectors"}
                </span>
                <span aria-hidden="true">→</span>
              </Link>
            ) : null}
          </CardHeader>
        </Card>

        {model.connectorsAvailability === "unavailable" ? (
          <StationDetailRetryState
            headingAs="h3"
            title="Unable to load connector equipment"
            message={model.connectorsError ?? "Charging equipment data could not be loaded."}
          />
        ) : model.overviewConnectors.length > 0 ? (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {model.overviewConnectors.map(item => (
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

      <Card
        as="section"
        aria-labelledby="overview-sessions-title"
        padding="none"
        className="overflow-hidden"
      >
        <div className="border-b border-[color:var(--vg-border)] p-5 sm:p-6">
          <CardHeader>
            <div>
              <CardTitle id="overview-sessions-title">
                Recent charging sessions
              </CardTitle>
              <CardDescription>
                {model.transactionsAvailability === "live"
                  ? `Showing ${model.overviewSessions.length} of ${model.totalSessionCount} recorded sessions.`
                  : "Charging session history could not be verified."}
              </CardDescription>
            </div>
            {model.totalSessionCount !== null && model.totalSessionCount > 0 ? (
              <Link
                href={sessionsHref}
                className="inline-flex min-h-11 items-center gap-1 rounded-[var(--vg-radius-md)] px-3 py-2 font-sans text-[0.875rem] font-semibold text-[color:var(--vg-brand)] hover:bg-[color:var(--vg-brand-soft)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--vg-focus)]"
              >
                <span>
                  {model.hasMoreSessions
                    ? `View all ${model.totalSessionCount} sessions`
                    : "All sessions"}
                </span>
                <span aria-hidden="true">→</span>
              </Link>
            ) : null}
          </CardHeader>
        </div>

        {model.transactionsAvailability === "unavailable" ? (
          <div className="p-5 sm:p-6">
            <StationDetailRetryState
              headingAs="h3"
              title="Unable to load charging sessions"
              message={model.transactionsError ?? "Charging session history could not be loaded."}
            />
          </div>
        ) : model.overviewSessions.length > 0 ? (
          <StationSessionsRecords
            sessions={model.overviewSessions}
            caption={`Recent charging sessions for station ${model.station.id}`}
          />
        ) : (
          <div className="p-5 sm:p-6">
            <EmptyState
              kind="empty"
              headingAs="h3"
              title="No charging sessions yet"
              description="This charging station has not recorded any charging sessions yet."
            />
          </div>
        )}
      </Card>
    </div>
  );
}
