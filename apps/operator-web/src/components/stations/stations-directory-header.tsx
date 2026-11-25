import { PageHeader } from "@/components/shell/page-header";
import {
  AddStationAction,
  ReadOnlyConsoleNotice,
} from "./station-console-controls";

export interface StationsDirectoryHeaderProps {
  registrationEnabled: boolean;
}

export function StationsDirectoryHeader({
  registrationEnabled,
}: StationsDirectoryHeaderProps) {
  return (
    <div>
      <PageHeader
        title="Charging stations"
        description="Manage stations connected to your network."
        actions={registrationEnabled ? <AddStationAction /> : undefined}
      />
      {!registrationEnabled ? <ReadOnlyConsoleNotice /> : null}
    </div>
  );
}
