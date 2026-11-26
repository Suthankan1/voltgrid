export const STATION_ID_MAX_LENGTH = 255;
export const STATION_NAME_MAX_LENGTH = 255;

/**
 * Backend Station Service identifier contract:
 * 1-255 ASCII letters, digits, dots, underscores, colons, or hyphens,
 * starting with an ASCII letter or digit. Preserves original casing.
 */
export const STATION_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,254}$/;

export interface RegistrationFieldErrors {
  name?: string;
  id?: string;
}

export interface ValidatedRegistrationInput {
  valid: boolean;
  id: string;
  name: string;
  submittedId: string;
  submittedName: string;
  fieldErrors: RegistrationFieldErrors;
  message?: string;
}

/**
 * Validates and trims station registration inputs without mutating casing.
 * Evaluates all fields so an operator receives complete inline feedback.
 */
export function validateStationRegistrationInput(
  idValue: unknown,
  nameValue: unknown,
): ValidatedRegistrationInput {
  const submittedId = typeof idValue === "string" ? idValue : "";
  const submittedName = typeof nameValue === "string" ? nameValue : "";
  const id = submittedId.trim();
  const name = submittedName.trim();
  const fieldErrors: RegistrationFieldErrors = {};

  if (!name) {
    fieldErrors.name = "Enter a station name (1–255 characters).";
  } else if (name.length > STATION_NAME_MAX_LENGTH) {
    fieldErrors.name = `Station name must be ${STATION_NAME_MAX_LENGTH} characters or fewer.`;
  }

  if (!id) {
    fieldErrors.id = "Enter a station identifier (1–255 characters).";
  } else if (id.length > STATION_ID_MAX_LENGTH) {
    fieldErrors.id = `Station identifier must be ${STATION_ID_MAX_LENGTH} characters or fewer.`;
  } else if (!STATION_ID_PATTERN.test(id)) {
    fieldErrors.id =
      "Use letters, numbers, dots, underscores, colons, or hyphens, starting with a letter or number.";
  }

  const errorMessages = [fieldErrors.name, fieldErrors.id].filter(
    (value): value is string => Boolean(value),
  );

  if (errorMessages.length > 0) {
    return {
      valid: false,
      id,
      name,
      submittedId,
      submittedName,
      fieldErrors,
      message:
        errorMessages.length === 1
          ? errorMessages[0]
          : "Check the station name and identifier below and try again.",
    };
  }

  return {
    valid: true,
    id,
    name,
    submittedId,
    submittedName,
    fieldErrors,
  };
}
