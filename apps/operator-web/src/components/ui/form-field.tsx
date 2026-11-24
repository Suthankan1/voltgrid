import { useId, type ReactNode } from "react";

export interface FormFieldControlProps {
  id: string;
  "aria-describedby"?: string;
  "aria-invalid"?: true;
  required?: boolean;
}

export interface FormFieldProps {
  /** Visible, persistent label text (never replaced by placeholder text). */
  label: string;
  /** Optional explicit control ID; defaults to a stable generated ID. */
  htmlFor?: string;
  /** Optional helper text associated with the control via `aria-describedby`. */
  description?: string;
  /** Validation message; sets `aria-invalid="true"` and associates via `aria-describedby`. */
  error?: string;
  /** Marks the field as required and forwards `required` to render-prop controls. */
  required?: boolean;
  /** Optional additional class names on the field container. */
  className?: string;
  /** Control node or render function receiving wired accessibility attributes. */
  children: ReactNode | ((controlProps: FormFieldControlProps) => ReactNode);
}

/**
 * Accessible form-field wrapper linking a persistent label, description, and error message.
 */
export function FormField({
  label,
  htmlFor,
  description,
  error,
  required = false,
  className,
  children,
}: FormFieldProps) {
  const generatedId = useId();
  const fieldId = htmlFor ?? generatedId;
  const descriptionId = description ? `${fieldId}-description` : undefined;
  const errorId = error ? `${fieldId}-error` : undefined;
  const describedBy =
    [descriptionId, errorId].filter(Boolean).join(" ") || undefined;

  const controlProps: FormFieldControlProps = {
    id: fieldId,
    ...(describedBy ? { "aria-describedby": describedBy } : {}),
    ...(error ? { "aria-invalid": true } : {}),
    ...(required ? { required: true } : {}),
  };

  const containerClasses = ["grid w-full gap-1.5", className]
    .filter(Boolean)
    .join(" ");

  return (
    <div className={containerClasses}>
      <label
        htmlFor={fieldId}
        className="font-sans text-[0.875rem] font-semibold leading-[1.25rem] text-[color:var(--vg-text-primary)]"
      >
        <span>{label}</span>
        {required ? (
          <span
            aria-hidden="true"
            className="ml-1 text-[color:var(--vg-danger)]"
          >
            *
          </span>
        ) : null}
      </label>

      {typeof children === "function" ? children(controlProps) : children}

      {description ? (
        <p
          id={descriptionId}
          className="font-sans text-[0.8125rem] leading-[1.25rem] text-[color:var(--vg-text-secondary)]"
        >
          {description}
        </p>
      ) : null}

      {error ? (
        <p
          id={errorId}
          className="flex items-start gap-1.5 font-sans text-[0.8125rem] font-medium leading-[1.25rem] text-[color:var(--vg-danger)]"
        >
          <svg
            aria-hidden="true"
            viewBox="0 0 16 16"
            width="16"
            height="16"
            fill="none"
            className="mt-0.5 shrink-0"
          >
            <circle cx="8" cy="8" r="6.5" stroke="currentColor" strokeWidth="1.5" />
            <path d="M8 4.75v3.75" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            <circle cx="8" cy="11.25" r="0.85" fill="currentColor" />
          </svg>
          <span>{error}</span>
        </p>
      ) : null}
    </div>
  );
}
