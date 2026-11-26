"use client";

import { StationRegistrationWorkspace } from "@/components/stations/station-registration-workspace";
import {
  registerStationAction,
  verifyStationRegistrationAction,
} from "./actions";

export interface RegistrationFormProps {
  backHref: string;
}

export function RegistrationForm({ backHref }: RegistrationFormProps) {
  return (
    <StationRegistrationWorkspace
      backHref={backHref}
      registerAction={registerStationAction}
      verifyAction={verifyStationRegistrationAction}
    />
  );
}
