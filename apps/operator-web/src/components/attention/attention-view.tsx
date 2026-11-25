import { PageHeader } from "@/components/shell/page-header";
import { Alert } from "@/components/ui/alert";
import { EmptyState } from "@/components/ui/empty-state";
import { MetricCard } from "@/components/ui/metric-card";
import type { AttentionPresentationModel } from "@/lib/attention-model";
import { AttentionSessionsSection } from "./attention-sessions-section";
import { AttentionStationsSection } from "./attention-stations-section";

export interface AttentionViewProps {
  model: AttentionPresentationModel;
}

/**
 * Dedicated Needs attention workspace surfacing independent Station Service
 * offline connectivity and incomplete session sequence categories without
 * fabricated incident records, totals, or network-wide fault scans.
 */
export function AttentionView({ model }: AttentionViewProps) {
  const { stationSection, sessionSection } = model;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Needs attention"
        description="Review connectivity issues and incomplete session records."
      />

      <Alert variant="info" announce="none" title="Coverage and scope">
        This workspace tracks offline stations and charging sessions with missing OCPP event sequences separately. Connector-specific reported faults live within individual station details and are not scanned network-wide here.
      </Alert>

      <section
        aria-label="Attention category counts"
        className="grid gap-4 sm:grid-cols-2"
      >
        <MetricCard
          label="Offline stations"
          value={
            stationSection.availability === "live"
              ? stationSection.offlineCount
              : null
          }
          description={
            stationSection.availability === "live"
              ? `Out of ${stationSection.registeredCount} registered ${stationSection.registeredCount === 1 ? "station" : "stations"}`
              : "Authoritative station connectivity could not be loaded"
          }
          href="/stations?status=OFFLINE"
          linkLabel="View all offline stations"
        />

        <MetricCard
          label="Sessions with missing data"
          value={
            sessionSection.availability === "live"
              ? sessionSection.incompleteCount
              : null
          }
          description={
            sessionSection.availability === "live"
              ? "Server count of sessions with missing OCPP sequence numbers"
              : "Session completeness summary could not be loaded"
          }
          href="/sessions?integrityStatus=INCOMPLETE"
          linkLabel="View all sessions with missing data"
        />
      </section>

      {model.isConfirmedClear ? (
        <EmptyState
          headingAs="h2"
          kind="empty"
          title="No offline stations or incomplete session records found."
          description="Station Service reported zero offline stations and zero sessions with missing sequence data at retrieval time. To check connector-level faults or individual hardware status, open a specific charging station from Charging stations."
        />
      ) : null}

      <div className="grid gap-6 lg:grid-cols-2">
        <AttentionStationsSection section={stationSection} />
        <AttentionSessionsSection section={sessionSection} />
      </div>
    </div>
  );
}
