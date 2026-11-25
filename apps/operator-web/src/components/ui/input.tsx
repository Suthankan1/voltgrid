import type { InputHTMLAttributes, Ref } from "react";

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  /** Forwarded ref to the underlying native `<input>` element. */
  ref?: Ref<HTMLInputElement>;
  /** Marks the input as failing validation (`aria-invalid` and danger border). */
  invalid?: boolean;
  /** Uses monospace typography for technical identifiers such as station or session IDs. */
  mono?: boolean;
}

/**
 * Native HTML input primitive styled with Orchid & Clay tokens and responsive sizing.
 */
export function Input({
  invalid = false,
  mono = false,
  type = "text",
  className,
  "aria-invalid": ariaInvalid,
  ...props
}: InputProps) {
  const isInvalid = Boolean(invalid || (ariaInvalid !== undefined && ariaInvalid !== false && ariaInvalid !== "false"));

  const classes = [
    "w-full min-h-11 rounded-[var(--vg-radius-md)] border px-3.5 py-2.5 text-[0.875rem] leading-[1.375rem] transition-colors duration-[var(--vg-transition-fast)]",
    mono ? "font-mono" : "font-sans",
    "bg-[color:var(--vg-surface)] text-[color:var(--vg-text-primary)] placeholder:text-[color:var(--vg-text-secondary)]",
    isInvalid
      ? "border-[color:var(--vg-danger)]"
      : "border-[color:var(--vg-border-control)]",
    "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--vg-focus)]",
    "disabled:cursor-not-allowed disabled:border-[color:var(--vg-border)] disabled:bg-[color:var(--vg-neutral-soft)] disabled:text-[color:var(--vg-neutral)]",
    "read-only:bg-[color:var(--vg-surface-subtle)] read-only:text-[color:var(--vg-text-secondary)]",
    className,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <input
      type={type}
      aria-invalid={isInvalid ? true : ariaInvalid}
      className={classes}
      {...props}
    />
  );
}
