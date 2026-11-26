"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import {
  executeRegisterStationAction,
  executeVerifyStationRegistrationAction,
  type RegistrationActionState,
  type RegistrationVerificationOutcome,
} from "@/lib/station-registration-actions";

export type {
  RegistrationActionState,
  RegistrationVerificationOutcome,
} from "@/lib/station-registration-actions";

async function readRequestActionContext() {
  const headerStore = await headers();
  return {
    hostHeader: headerStore.get("host"),
    forwardedHostHeader: headerStore.get("x-forwarded-host"),
    revalidate: revalidatePath,
  };
}

/**
 * Registers a charging station through Station Service and returns structured
 * success, duplicate, validation, failure, disabled, or uncertain feedback without auto-redirecting.
 */
export async function registerStationAction(
  _previousState: RegistrationActionState,
  formData: FormData,
): Promise<RegistrationActionState> {
  const context = await readRequestActionContext();
  return executeRegisterStationAction(formData, context);
}

/**
 * Performs an explicit read-only station lookup so operators can verify whether
 * an uncertain submission created a station before trying again.
 */
export async function verifyStationRegistrationAction(
  _previousState: RegistrationVerificationOutcome,
  formData: FormData,
): Promise<RegistrationVerificationOutcome> {
  const context = await readRequestActionContext();
  return executeVerifyStationRegistrationAction(formData, context);
}
