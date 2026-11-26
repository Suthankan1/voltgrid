import type { SessionDetailPresentationModel } from "@/lib/session-detail-model";
import { SessionDetailHeader } from "./session-detail-header";
import { SessionDetailMeasurements } from "./session-detail-measurements";
import { SessionDetailOverview } from "./session-detail-overview";
import { SessionDetailTechnical } from "./session-detail-technical";

export interface SessionDetailViewProps {
  model: SessionDetailPresentationModel;
}

/**
 * Coordinates the canonical charging session workspace across Overview,
 * Measurements, and Technical details sections.
 */
export function SessionDetailView({ model }: SessionDetailViewProps) {
  return (
    <div className="space-y-6">
      <SessionDetailHeader model={model} />

      {model.activeSection === "measurements" ? (
        <SessionDetailMeasurements model={model} />
      ) : model.activeSection === "technical" ? (
        <SessionDetailTechnical model={model} />
      ) : (
        <SessionDetailOverview model={model} />
      )}
    </div>
  );
}
