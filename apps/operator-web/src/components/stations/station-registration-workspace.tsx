"use client";

import Link from "next/link";
import { useActionState, useEffect, useRef, useState } from "react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import {
  StationStatusIndicator,
  StatusIndicator,
} from "@/components/ui/status-indicator";
import { buildStationDetailSectionHref } from "@/lib/station-detail-model";
import type {
  RegistrationActionState,
  RegistrationVerificationOutcome,
} from "@/lib/station-registration-actions";
import {
  type RegistrationFieldErrors,
  validateStationRegistrationInput,
} from "@/lib/station-registration-validation";
import { StationConnectionGuidance } from "./station-connection-section";

export interface StationRegistrationWorkspaceProps {
  backHref: string;
  registerAction: (
    previousState: RegistrationActionState,
    formData: FormData,
  ) => Promise<RegistrationActionState>;
  verifyAction: (
    previousState: RegistrationVerificationOutcome,
    formData: FormData,
  ) => Promise<RegistrationVerificationOutcome>;
  initialActionState?: RegistrationActionState;
  initialVerificationState?: RegistrationVerificationOutcome;
}

function getInitialFieldValue(
  state: RegistrationActionState,
  field: "name" | "id",
): string {
  if (state.status === "validation-error") {
    return field === "name" ? state.submittedName : state.submittedId;
  }
  if (
    state.status === "duplicate" ||
    state.status === "failure" ||
    state.status === "uncertain" ||
    state.status === "disabled"
  ) {
    return field === "name" ? state.name : state.id;
  }
  return "";
}

/**
 * Interactive station registration workflow supporting accessible inline validation,
 * double-submit protection, confirmed OCPP connection guidance, duplicate detection,
 * and non-destructive uncertain outcome verification.
 */
export function StationRegistrationWorkspace({
  backHref,
  registerAction,
  verifyAction,
  initialActionState = { status: "idle" },
  initialVerificationState = { status: "idle" },
}: StationRegistrationWorkspaceProps) {
  const [actionState, formAction, isPending] = useActionState(
    registerAction,
    initialActionState,
  );
  const [verificationState, verifyFormAction, isVerifyPending] = useActionState(
    verifyAction,
    initialVerificationState,
  );

  const [nameValue, setNameValue] = useState(() =>
    getInitialFieldValue(initialActionState, "name"),
  );
  const [idValue, setIdValue] = useState(() =>
    getInitialFieldValue(initialActionState, "id"),
  );

  const [clientErrors, setClientErrors] = useState<RegistrationFieldErrors | null>(
    null,
  );
  const [clientSummaryError, setClientSummaryError] = useState<string | null>(
    null,
  );
  const [clearedServerState, setClearedServerState] =
    useState<RegistrationActionState | null>(null);
  const [clearedServerFields, setClearedServerFields] = useState<{
    name: boolean;
    id: boolean;
  }>({ name: false, id: false });

  const [dismissedSuccessState, setDismissedSuccessState] =
    useState<RegistrationActionState | null>(null);
  const [dismissedVerifyState, setDismissedVerifyState] =
    useState<RegistrationVerificationOutcome | null>(null);

  const nameInputRef = useRef<HTMLInputElement>(null);
  const idInputRef = useRef<HTMLInputElement>(null);
  const successHeadingRef = useRef<HTMLHeadingElement>(null);

  const showSuccess =
    actionState.status === "success" && dismissedSuccessState !== actionState;

  const activeServerValidation =
    actionState.status === "validation-error" &&
    clearedServerState !== actionState
      ? actionState
      : null;

  const effectiveFieldErrors: RegistrationFieldErrors = clientErrors
    ? clientErrors
    : activeServerValidation
      ? {
          name: clearedServerFields.name
            ? undefined
            : activeServerValidation.fieldErrors.name,
          id: clearedServerFields.id
            ? undefined
            : activeServerValidation.fieldErrors.id,
        }
      : {};

  const validationSummaryMessage =
    clientSummaryError ??
    (activeServerValidation &&
    (effectiveFieldErrors.name || effectiveFieldErrors.id)
      ? activeServerValidation.message
      : null);

  const activeVerification =
    verificationState !== dismissedVerifyState
      ? verificationState
      : ({ status: "idle" } as const);

  const returnPathForLinks = backHref === "/stations" ? null : backHref;

  useEffect(() => {
    if (actionState.status === "validation-error") {
      if (actionState.fieldErrors.name) {
        nameInputRef.current?.focus();
      } else if (actionState.fieldErrors.id) {
        idInputRef.current?.focus();
      }
    }
  }, [actionState]);

  useEffect(() => {
    if (showSuccess) {
      successHeadingRef.current?.focus();
    }
  }, [showSuccess, actionState]);

  function handleNameChange(event: React.ChangeEvent<HTMLInputElement>) {
    setNameValue(event.target.value);
    if (clientErrors?.name) {
      const nextErrors: RegistrationFieldErrors = {
        ...clientErrors,
        name: undefined,
      };
      setClientErrors(nextErrors.id ? nextErrors : null);
      if (!nextErrors.id) {
        setClientSummaryError(null);
      }
    }
    if (actionState.status === "validation-error") {
      setClearedServerFields((prev) => ({ ...prev, name: true }));
    }
  }

  function handleIdChange(event: React.ChangeEvent<HTMLInputElement>) {
    setIdValue(event.target.value);
    if (clientErrors?.id) {
      const nextErrors: RegistrationFieldErrors = {
        ...clientErrors,
        id: undefined,
      };
      setClientErrors(nextErrors.name ? nextErrors : null);
      if (!nextErrors.name) {
        setClientSummaryError(null);
      }
    }
    if (actionState.status === "validation-error") {
      setClearedServerFields((prev) => ({ ...prev, id: true }));
    }
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    if (isPending) {
      event.preventDefault();
      return;
    }

    const validated = validateStationRegistrationInput(idValue, nameValue);
    if (!validated.valid) {
      event.preventDefault();
      setClientErrors(validated.fieldErrors);
      setClientSummaryError(
        validated.message ??
          "Check the station name and identifier below and try again.",
      );
      if (validated.fieldErrors.name) {
        nameInputRef.current?.focus();
      } else if (validated.fieldErrors.id) {
        idInputRef.current?.focus();
      }
      return;
    }

    setClientErrors(null);
    setClientSummaryError(null);
    setClearedServerFields({ name: false, id: false });
    if (actionState.status === "validation-error") {
      setClearedServerState(actionState);
    }
    if (verificationState.status !== "idle") {
      setDismissedVerifyState(verificationState);
    }
  }

  function handleRegisterAnother() {
    setDismissedSuccessState(actionState);
    setDismissedVerifyState(verificationState);
    setNameValue("");
    setIdValue("");
    setClientErrors(null);
    setClientSummaryError(null);
    setClearedServerState(actionState);
    setClearedServerFields({ name: false, id: false });
    requestAnimationFrame(() => {
      nameInputRef.current?.focus();
    });
  }

  if (showSuccess && actionState.status === "success") {
    const inspectHref = buildStationDetailSectionHref(
      actionState.station.id,
      "overview",
      returnPathForLinks,
    );
    const connectionHref = buildStationDetailSectionHref(
      actionState.station.id,
      "connection",
      returnPathForLinks,
    );

    return (
      <div className="space-y-6">
        <Card
          as="section"
          aria-labelledby="station-registered-heading"
          padding="lg"
        >
          <CardHeader>
            <div className="space-y-2.5">
              <div className="flex flex-wrap items-center gap-2">
                <StatusIndicator tone="success" label="Registered" size="sm" />
                <StationStatusIndicator
                  status={actionState.station.status}
                  size="sm"
                />
              </div>
              <CardTitle
                id="station-registered-heading"
                ref={successHeadingRef}
                tabIndex={-1}
                className="outline-none"
              >
                Station registered
              </CardTitle>
              <CardDescription>
                Your charging station is registered and ready for OCPP 2.0.1 charger onboarding.
              </CardDescription>
            </div>
          </CardHeader>

          <CardContent className="space-y-5">
            <dl className="grid gap-4 rounded-[var(--vg-radius-md)] border border-[color:var(--vg-border)] bg-[color:var(--vg-surface-subtle)] p-4 sm:grid-cols-2">
              <div className="min-w-0">
                <dt className="font-sans text-[0.75rem] font-semibold uppercase tracking-[0.04em] text-[color:var(--vg-text-secondary)]">
                  Station name
                </dt>
                <dd className="mt-1 break-words font-sans text-[0.9375rem] font-semibold text-[color:var(--vg-text-primary)]">
                  {actionState.station.name}
                </dd>
              </div>
              <div className="min-w-0">
                <dt className="font-sans text-[0.75rem] font-semibold uppercase tracking-[0.04em] text-[color:var(--vg-text-secondary)]">
                  Station identifier
                </dt>
                <dd className="mt-1 break-all font-mono text-[0.875rem] text-[color:var(--vg-text-primary)]">
                  {actionState.station.id}
                </dd>
              </div>
            </dl>

            <div className="flex flex-wrap items-center gap-3">
              <Link
                href={inspectHref}
                className="inline-flex min-h-11 items-center justify-center rounded-[var(--vg-radius-md)] bg-[color:var(--vg-brand)] px-4 py-2.5 font-sans text-[0.875rem] font-semibold leading-[1.25rem] text-[color:var(--vg-text-inverse)] transition-colors duration-[var(--vg-transition-fast)] hover:bg-[color:var(--vg-brand-hover)] active:bg-[color:var(--vg-brand-pressed)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--vg-focus)]"
              >
                Inspect station details
              </Link>
              <Link
                href={connectionHref}
                className="inline-flex min-h-11 items-center justify-center rounded-[var(--vg-radius-md)] border border-[color:var(--vg-border-control)] bg-[color:var(--vg-surface)] px-4 py-2.5 font-sans text-[0.875rem] font-semibold leading-[1.25rem] text-[color:var(--vg-text-primary)] transition-colors duration-[var(--vg-transition-fast)] hover:bg-[color:var(--vg-surface-subtle)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--vg-focus)]"
              >
                Connection details
              </Link>
              <Button
                type="button"
                variant="tertiary"
                size="md"
                onClick={handleRegisterAnother}
              >
                Register another station
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card
          as="section"
          aria-labelledby="registered-connection-setup-title"
          padding="md"
        >
          <CardHeader>
            <div>
              <CardTitle id="registered-connection-setup-title">
                Connection setup
              </CardTitle>
              <CardDescription>
                Use this registered identity and OCPP 2.0.1 path when configuring charging equipment or simulators.
              </CardDescription>
            </div>
          </CardHeader>
          <CardContent>
            <StationConnectionGuidance
              stationId={actionState.station.id}
              ocppPath={actionState.ocppPath}
              protocolLabel={actionState.protocolLabel}
            />
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Card
        as="section"
        aria-labelledby="station-registration-form-title"
        padding="lg"
      >
        <CardHeader>
          <div>
            <CardTitle id="station-registration-form-title">
              Station details
            </CardTitle>
            <CardDescription>
              Provide a display name and the unique OCPP 2.0.1 identifier configured on the charger.
            </CardDescription>
          </div>
        </CardHeader>

        <CardContent className="space-y-5">
          <Alert variant="info" announce="none" title="Initial station state">
            New stations start offline. Reported connectivity updates after the charging station connects and sends a BootNotification over OCPP 2.0.1.
          </Alert>

          {validationSummaryMessage ? (
            <Alert variant="error" title="Check station details">
              {validationSummaryMessage}
            </Alert>
          ) : null}

          {actionState.status === "duplicate" ? (
            <Alert
              variant="warning"
              announce="assertive"
              title="Station identifier already exists"
            >
              <div className="space-y-3">
                <p>{actionState.message}</p>
                <div>
                  <Link
                    href={buildStationDetailSectionHref(
                      actionState.stationId,
                      "overview",
                      returnPathForLinks,
                    )}
                    className="inline-flex min-h-9 items-center font-semibold text-[color:var(--vg-brand)] underline underline-offset-4 hover:text-[color:var(--vg-brand-hover)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--vg-focus)]"
                  >
                    Inspect existing station {actionState.stationId}
                  </Link>
                </div>
              </div>
            </Alert>
          ) : null}

          {actionState.status === "failure" ? (
            <Alert variant="error" title="Registration failed">
              {actionState.message}
            </Alert>
          ) : null}

          {actionState.status === "disabled" ? (
            <Alert
              variant="warning"
              announce="assertive"
              title="Registration disabled"
            >
              {actionState.message}
            </Alert>
          ) : null}

          {actionState.status === "uncertain" ? (
            <Alert
              variant="warning"
              announce="assertive"
              title="Registration could not be confirmed"
            >
              <p>{actionState.message}</p>
            </Alert>
          ) : null}

          <form
            action={formAction}
            onSubmit={handleSubmit}
            noValidate
            className="space-y-5"
          >
            <FormField
              label="Station name"
              htmlFor="station-registration-name"
              required
              description="Human-readable label shown in the operator console (1–255 characters)."
              error={effectiveFieldErrors.name}
            >
              {(controlProps) => (
                <Input
                  ref={nameInputRef}
                  {...controlProps}
                  name="name"
                  type="text"
                  placeholder="Colombo Central"
                  autoComplete="off"
                  value={nameValue}
                  onChange={handleNameChange}
                />
              )}
            </FormField>

            <FormField
              label="Station identifier"
              htmlFor="station-registration-id"
              required
              description="Unique OCPP 2.0.1 identity: letters, numbers, dots, underscores, colons, or hyphens (1–255 characters, starting with a letter or number). Case is preserved."
              error={effectiveFieldErrors.id}
            >
              {(controlProps) => (
                <Input
                  ref={idInputRef}
                  {...controlProps}
                  name="id"
                  type="text"
                  mono
                  placeholder="CP-001"
                  autoComplete="off"
                  autoCapitalize="none"
                  spellCheck={false}
                  value={idValue}
                  onChange={handleIdChange}
                />
              )}
            </FormField>

            <div className="flex flex-wrap items-center gap-3 pt-1">
              <Button
                type="submit"
                variant="primary"
                size="md"
                pending={isPending}
                pendingLabel="Registering station..."
              >
                Register station
              </Button>
              <Link
                href={backHref}
                className="inline-flex min-h-11 items-center justify-center rounded-[var(--vg-radius-md)] border border-[color:var(--vg-border-control)] bg-[color:var(--vg-surface)] px-4 py-2.5 font-sans text-[0.875rem] font-semibold leading-[1.25rem] text-[color:var(--vg-text-primary)] transition-colors duration-[var(--vg-transition-fast)] hover:bg-[color:var(--vg-surface-subtle)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--vg-focus)]"
              >
                Cancel
              </Link>
            </div>
          </form>
        </CardContent>
      </Card>

      {actionState.status === "uncertain" ? (
        <Card
          as="section"
          aria-labelledby="uncertain-lookup-title"
          padding="md"
        >
          <CardHeader>
            <div>
              <CardTitle id="uncertain-lookup-title">
                Verify before trying again
              </CardTitle>
              <CardDescription>
                Run a read-only check to see whether{" "}
                <span className="font-mono text-[color:var(--vg-text-primary)]">
                  {actionState.stationId}
                </span>{" "}
                already exists in Station Service before submitting again.
              </CardDescription>
            </div>
          </CardHeader>

          <CardContent className="space-y-4">
            <form action={verifyFormAction}>
              <input
                type="hidden"
                name="stationId"
                value={actionState.stationId}
              />
              <Button
                type="submit"
                variant="secondary"
                size="md"
                pending={isVerifyPending}
                pendingLabel="Checking station record..."
              >
                Check station record
              </Button>
            </form>

            {activeVerification.status === "found" ? (
              <Alert
                variant="info"
                announce="polite"
                title="Existing station record found"
              >
                <div className="space-y-3">
                  <p>{activeVerification.message}</p>
                  <div className="flex flex-wrap items-center gap-3">
                    <StationStatusIndicator
                      status={activeVerification.station.status}
                      size="sm"
                    />
                    <Link
                      href={buildStationDetailSectionHref(
                        activeVerification.station.id,
                        "overview",
                        returnPathForLinks,
                      )}
                      className="inline-flex min-h-9 items-center font-semibold text-[color:var(--vg-brand)] underline underline-offset-4 hover:text-[color:var(--vg-brand-hover)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--vg-focus)]"
                    >
                      Inspect station {activeVerification.station.id}
                    </Link>
                  </div>
                </div>
              </Alert>
            ) : null}

            {activeVerification.status === "not-found" ? (
              <Alert
                variant="info"
                announce="polite"
                title="No station record found"
              >
                {activeVerification.message}
              </Alert>
            ) : null}

            {activeVerification.status === "unavailable" ? (
              <Alert variant="error" title="Unable to verify station record">
                {activeVerification.message}
              </Alert>
            ) : null}

            {activeVerification.status === "disabled" ? (
              <Alert variant="warning" title="Verification unavailable">
                {activeVerification.message}
              </Alert>
            ) : null}
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
