import { getStationPageData, type Station, type StationPageDataSnapshot } from "./station-api";
import { buildStationDetailOcppPath } from "./station-detail-model";
import {
  isLoopbackHostHeader,
  localRegistrationEnabled,
  type RegistrationSubmissionOutcome,
  submitStationRegistration,
  validateStationRegistrationInput,
} from "./station-registration";

export type RegistrationActionState =
  | { status: "idle" }
  | RegistrationSubmissionOutcome;

export type RegistrationVerificationOutcome =
  | { status: "idle" }
  | {
      status: "disabled";
      stationId: string;
      message: string;
    }
  | {
      status: "found";
      station: Station;
      ocppPath: string;
      protocolLabel: "OCPP 2.0.1";
      message: string;
    }
  | {
      status: "not-found";
      stationId: string;
      message: string;
    }
  | {
      status: "unavailable";
      stationId: string;
      message: string;
    };

export interface RegistrationActionContext {
  hostHeader: string | null;
  forwardedHostHeader?: string | null;
  revalidate?: (path: string) => void;
  submitRegistration?: typeof submitStationRegistration;
  lookupStation?: (stationId: string) => Promise<StationPageDataSnapshot>;
}

const LOCAL_ONLY_MESSAGE =
  "Station registration is available only from the local console.";

function isAllowedLocalActionRequest(context: RegistrationActionContext): boolean {
  if (!isLoopbackHostHeader(context.hostHeader)) {
    return false;
  }
  if (
    context.forwardedHostHeader &&
    !isLoopbackHostHeader(context.forwardedHostHeader)
  ) {
    return false;
  }
  return true;
}

/**
 * Executes the station registration server workflow with explicit loopback host enforcement,
 * structured outcome mapping, and selective path revalidation on confirmed creation.
 */
export async function executeRegisterStationAction(
  formData: FormData,
  context: RegistrationActionContext,
): Promise<RegistrationSubmissionOutcome> {
  const idValue = formData.get("id");
  const nameValue = formData.get("name");
  const id = typeof idValue === "string" ? idValue.trim() : "";
  const name = typeof nameValue === "string" ? nameValue.trim() : "";

  if (!isAllowedLocalActionRequest(context)) {
    return {
      status: "disabled",
      id,
      name,
      message: LOCAL_ONLY_MESSAGE,
    };
  }

  const submit = context.submitRegistration ?? submitStationRegistration;
  const outcome = await submit(idValue, nameValue);

  if (outcome.status === "success" && context.revalidate) {
    context.revalidate("/");
    context.revalidate("/stations");
  }

  return outcome;
}

/**
 * Performs a read-only `station(id)` lookup after an ambiguous submission outcome
 * so the operator can check whether a station exists without re-submitting a mutation.
 */
export async function executeVerifyStationRegistrationAction(
  formData: FormData,
  context: RegistrationActionContext,
): Promise<RegistrationVerificationOutcome> {
  const validated = validateStationRegistrationInput(
    formData.get("stationId"),
    "lookup",
  );

  if (!isAllowedLocalActionRequest(context)) {
    return {
      status: "disabled",
      stationId: validated.id,
      message: LOCAL_ONLY_MESSAGE,
    };
  }

  if (!localRegistrationEnabled()) {
    return {
      status: "disabled",
      stationId: validated.id,
      message: "Verification lookup is disabled. This console is in read-only mode.",
    };
  }

  if (validated.fieldErrors.id) {
    return {
      status: "unavailable",
      stationId: validated.id,
      message: "Enter a valid station identifier to check Station Service.",
    };
  }

  const lookup = context.lookupStation ?? getStationPageData;
  const snapshot = await lookup(validated.id);

  if (snapshot.state === "live") {
    return {
      status: "found",
      station: snapshot.station,
      ocppPath: buildStationDetailOcppPath(snapshot.station.id),
      protocolLabel: "OCPP 2.0.1",
      message:
        "A station record with this identifier exists in Station Service. Inspect its details before attempting another registration.",
    };
  }

  if (snapshot.state === "not-found") {
    return {
      status: "not-found",
      stationId: validated.id,
      message:
        "No station record with this identifier was found. You can review your details and submit registration again.",
    };
  }

  return {
    status: "unavailable",
    stationId: validated.id,
    message: snapshot.message,
  };
}
