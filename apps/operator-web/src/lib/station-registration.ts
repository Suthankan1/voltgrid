import type { Station, StationStatus } from "./station-api";
import { buildStationDetailOcppPath } from "./station-detail-model";
import {
  type RegistrationFieldErrors,
  validateStationRegistrationInput,
} from "./station-registration-validation";

export {
  type RegistrationFieldErrors,
  STATION_ID_MAX_LENGTH,
  STATION_ID_PATTERN,
  STATION_NAME_MAX_LENGTH,
  type ValidatedRegistrationInput,
  validateStationRegistrationInput,
} from "./station-registration-validation";

export type RegistrationState = {
  message?: string;
  id?: string;
  name?: string;
};

export type RegistrationSubmissionOutcome =
  | {
      status: "disabled";
      id: string;
      name: string;
      message: string;
    }
  | {
      status: "validation-error";
      id: string;
      name: string;
      submittedId: string;
      submittedName: string;
      fieldErrors: RegistrationFieldErrors;
      message: string;
    }
  | {
      status: "success";
      station: Station;
      ocppPath: string;
      protocolLabel: "OCPP 2.0.1";
    }
  | {
      status: "duplicate";
      id: string;
      name: string;
      stationId: string;
      message: string;
    }
  | {
      status: "failure";
      id: string;
      name: string;
      message: string;
    }
  | {
      status: "uncertain";
      id: string;
      name: string;
      stationId: string;
      message: string;
    };

const REGISTER_STATION_MUTATION = `
  mutation OperatorRegister($input: RegisterStationInput!) {
    registerStation(input: $input) {
      id
      name
      status
    }
  }
`;

const LOOPBACK_HOST_PATTERN = /^(localhost|127\.0\.0\.1|\[::1\])(?::\d+)?$/i;

function isStationStatus(value: unknown): value is StationStatus {
  return value === "ONLINE" || value === "OFFLINE";
}

/**
 * Checks whether local station registration writes are explicitly opted in
 * and pointed at a local HTTP Station Service endpoint.
 */
export function localRegistrationEnabled(): boolean {
  if (process.env.OPERATOR_LOCAL_WRITES !== "true") {
    return false;
  }

  try {
    const endpoint = new URL(process.env.STATION_GRAPHQL_URL ?? "");
    return (
      endpoint.protocol === "http:" &&
      ["localhost", "127.0.0.1", "[::1]"].includes(endpoint.hostname)
    );
  } catch {
    return false;
  }
}

/**
 * Validates that an HTTP Host / X-Forwarded-Host header designates a loopback origin.
 */
export function isLoopbackHostHeader(hostHeader: string | null | undefined): boolean {
  if (typeof hostHeader !== "string") {
    return false;
  }
  return LOOPBACK_HOST_PATTERN.test(hostHeader.trim());
}

/**
 * Submits `registerStation(input: { id, name })` against Station Service and classifies
 * confirmed success, duplicate identifier, validation error, confirmed failure,
 * disabled read-only mode, or uncertain ambiguous outcomes cleanly.
 */
export async function submitStationRegistration(
  idValue: unknown,
  nameValue: unknown,
): Promise<RegistrationSubmissionOutcome> {
  const validated = validateStationRegistrationInput(idValue, nameValue);

  if (!localRegistrationEnabled()) {
    return {
      status: "disabled",
      id: validated.id,
      name: validated.name,
      message: "Registration is disabled. This console is in read-only mode.",
    };
  }

  if (!validated.valid) {
    return {
      status: "validation-error",
      id: validated.id,
      name: validated.name,
      submittedId: validated.submittedId,
      submittedName: validated.submittedName,
      fieldErrors: validated.fieldErrors,
      message:
        validated.message ??
        "Check the station name and identifier below and try again.",
    };
  }

  const endpoint = process.env.STATION_GRAPHQL_URL;
  if (!endpoint) {
    return {
      status: "disabled",
      id: validated.id,
      name: validated.name,
      message: "Registration is disabled. This console is in read-only mode.",
    };
  }

  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      cache: "no-store",
      signal: AbortSignal.timeout(5000),
      body: JSON.stringify({
        query: REGISTER_STATION_MUTATION,
        variables: {
          input: {
            id: validated.id,
            name: validated.name,
          },
        },
      }),
    });

    if (!response.ok) {
      throw new Error("Registration HTTP failure");
    }

    const payload = (await response.json()) as {
      data?: {
        registerStation?: {
          id?: unknown;
          name?: unknown;
          status?: unknown;
        } | null;
      };
      errors?: Array<{
        message?: unknown;
      }>;
    } | null;

    if (!payload || typeof payload !== "object") {
      throw new Error("Invalid registration payload");
    }

    if (Array.isArray(payload.errors) && payload.errors.length > 0) {
      const isDuplicate = payload.errors.some(
        (error) =>
          typeof error?.message === "string" &&
          error.message === `Station already exists: ${validated.id}`,
      );

      if (isDuplicate) {
        return {
          status: "duplicate",
          id: validated.id,
          name: validated.name,
          stationId: validated.id,
          message:
            "This station identifier is already registered. Inspect the existing station or choose another identifier.",
        };
      }

      return {
        status: "failure",
        id: validated.id,
        name: validated.name,
        message:
          "Registration was rejected by Station Service. Check the station details and try again.",
      };
    }

    const registered = payload.data?.registerStation;
    if (
      !registered ||
      typeof registered.id !== "string" ||
      registered.id !== validated.id ||
      typeof registered.name !== "string" ||
      !isStationStatus(registered.status)
    ) {
      throw new Error("Invalid registration response");
    }

    return {
      status: "success",
      station: {
        id: registered.id,
        name: registered.name,
        status: registered.status,
      },
      ocppPath: buildStationDetailOcppPath(registered.id),
      protocolLabel: "OCPP 2.0.1",
    };
  } catch {
    return {
      status: "uncertain",
      id: validated.id,
      name: validated.name,
      stationId: validated.id,
      message:
        "We could not confirm whether the station was registered. Check the station identifier before retrying to avoid duplicates.",
    };
  }
}

/**
 * Legacy-compatible wrapper preserving the `{ stationId } | { message, id, name }` signature.
 */
export async function registerStation(
  idValue: unknown,
  nameValue: unknown,
): Promise<RegistrationState & { stationId?: string }> {
  const outcome = await submitStationRegistration(idValue, nameValue);

  if (outcome.status === "success") {
    return { stationId: outcome.station.id };
  }

  return {
    id: outcome.id,
    name: outcome.name,
    message: outcome.message,
  };
}
