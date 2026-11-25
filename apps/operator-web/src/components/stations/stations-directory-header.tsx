import { PageHeader } from "@/components/shell/page-header";
import {
  AddStationAction,
  ReadOnlyConsoleNotice,
} from "./station-console-controls";

export interface StationsDirectoryHeaderProps {
  registrationEnabled: boolean;
  returnPath?: string | null;
}

export function StationsDirectoryHeader({
  registrationEnabled,
  returnPath,
}: StationsDirectoryHeaderProps) {
  return (
    <div>
      <PageHeader
        title="Charging stations"
        description="Manage stations connected to your network."
        actions={
          registrationEnabled ? (
            <AddStationAction returnPath={returnPath} />
          ) : undefined
        }
      />
      {!registrationEnabled ? <ReadOnlyConsoleNotice /> : null}
    </div>
  );
}
