import { PageHeader } from "@/components/shell/page-header";
import {
  AddStationAction,
  ReadOnlyConsoleNotice,
} from "@/components/stations/station-console-controls";

export interface OverviewHeaderProps {
  registrationEnabled: boolean;
}

export function OverviewHeader({ registrationEnabled }: OverviewHeaderProps) {
  return (
    <div>
      <PageHeader
        title="Overview"
        description="Monitor your charging network."
        actions={registrationEnabled ? <AddStationAction /> : undefined}
      />

      {!registrationEnabled ? <ReadOnlyConsoleNotice /> : null}
    </div>
  );
}
