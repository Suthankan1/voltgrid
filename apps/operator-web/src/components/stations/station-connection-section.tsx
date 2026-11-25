import { Alert } from "@/components/ui/alert";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { StationDetailPresentationModel } from "@/lib/station-detail-model";
import { CopyValueButton } from "./copy-value-button";

export interface StationConnectionGuidanceProps {
  stationId: string;
  ocppPath: string;
  protocolLabel?: string;
}

/**
 * Shared safe OCPP connection guidance without exposing server-only configuration
 * or fabricating undeclared public gateway hostnames.
 */
export function StationConnectionGuidance({
  stationId,
  ocppPath,
  protocolLabel = "OCPP 2.0.1",
}: StationConnectionGuidanceProps) {
  return (
    <>
      <dl className="divide-y divide-[color:var(--vg-border)] border-y border-[color:var(--vg-border)]">
        <div className="flex flex-wrap items-center justify-between gap-3 py-4">
          <div className="min-w-0 flex-1">
            <dt className="font-sans text-[0.75rem] font-semibold uppercase tracking-[0.04em] text-[color:var(--vg-text-secondary)]">
              Registered station identifier
            </dt>
            <dd className="mt-1 break-all font-mono text-[0.875rem] text-[color:var(--vg-text-primary)]">
              {stationId}
            </dd>
          </div>
          <CopyValueButton
            value={stationId}
            label="Copy station ID"
            ariaLabel={`Copy station identifier ${stationId}`}
          />
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 py-4">
          <div className="min-w-0 flex-1">
            <dt className="font-sans text-[0.75rem] font-semibold uppercase tracking-[0.04em] text-[color:var(--vg-text-secondary)]">
              Supported protocol
            </dt>
            <dd className="mt-1 font-mono text-[0.875rem] text-[color:var(--vg-text-primary)]">
              {protocolLabel} (WebSocket subprotocol <code>ocpp2.0.1</code>)
            </dd>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 py-4">
          <div className="min-w-0 flex-1">
            <dt className="font-sans text-[0.75rem] font-semibold uppercase tracking-[0.04em] text-[color:var(--vg-text-secondary)]">
              OCPP WebSocket path
            </dt>
            <dd className="mt-1 break-all font-mono text-[0.875rem] text-[color:var(--vg-text-primary)]">
              {ocppPath}
            </dd>
          </div>
          <CopyValueButton
            value={ocppPath}
            label="Copy OCPP path"
            ariaLabel={`Copy OCPP path ${ocppPath}`}
          />
        </div>
      </dl>

      <div className="mt-5 space-y-3">
        <Alert variant="info" announce="none" title="Endpoint configuration">
          No public WebSocket gateway URL is configured for display in this console. Pair this relative path and station identifier with the Station Service WebSocket host provisioned for your environment, then restart or send a BootNotification from the charger.
        </Alert>

        <p className="font-sans text-[0.8125rem] leading-[1.25rem] text-[color:var(--vg-text-secondary)]">
          Monitoring console scope: Station Service tracks station registration and reported status only. Remote start/stop, unlock connector, reset, and firmware actions are not enabled here.
        </p>
      </div>
    </>
  );
}

export interface StationConnectionSectionProps {
  model: StationDetailPresentationModel;
}

/**
 * Station details connection section presenting OCPP 2.0.1 setup guidance.
 */
export function StationConnectionSection({
  model,
}: StationConnectionSectionProps) {
  return (
    <section aria-labelledby="station-connection-title" className="space-y-4">
      <Card padding="md">
        <CardHeader>
          <div>
            <CardTitle id="station-connection-title">
              Connection details
            </CardTitle>
            <CardDescription>
              Use this registered station identity and OCPP 2.0.1 path when configuring charging equipment or simulators.
            </CardDescription>
          </div>
        </CardHeader>

        <CardContent>
          <StationConnectionGuidance
            stationId={model.station.id}
            ocppPath={model.ocppPath}
            protocolLabel={model.protocolLabel}
          />
        </CardContent>
      </Card>
    </section>
  );
}
