import type { SelectHTMLAttributes } from "react";

export interface SelectOption {
  value: string;
  label: string;
  disabled?: boolean;
}

export interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  /** Marks the select as failing validation (`aria-invalid` and danger border). */
  invalid?: boolean;
  /** Optional declarative options; native `<option>` children are also supported. */
  options?: readonly SelectOption[];
}

/**
 * Native HTML select primitive preserving full keyboard and assistive-technology semantics.
 */
export function Select({
  invalid = false,
  options,
  className,
  children,
  "aria-invalid": ariaInvalid,
  ...props
}: SelectProps) {
  const isInvalid = Boolean(invalid || (ariaInvalid !== undefined && ariaInvalid !== false && ariaInvalid !== "false"));

  const classes = [
    "w-full min-w-0 max-w-full min-h-11 appearance-none truncate rounded-[var(--vg-radius-md)] border py-2.5 pl-3.5 pr-10 font-sans text-[0.875rem] leading-[1.375rem] transition-colors duration-[var(--vg-transition-fast)]",
    "bg-[color:var(--vg-surface)] text-[color:var(--vg-text-primary)]",
    isInvalid
      ? "border-[color:var(--vg-danger)]"
      : "border-[color:var(--vg-border-control)]",
    "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--vg-focus)]",
    "disabled:cursor-not-allowed disabled:border-[color:var(--vg-border)] disabled:bg-[color:var(--vg-neutral-soft)] disabled:text-[color:var(--vg-neutral)]",
    className,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div className="relative w-full min-w-0 max-w-full">
      <select
        aria-invalid={isInvalid ? true : ariaInvalid}
        className={classes}
        {...props}
      >
        {options
          ? options.map(option => (
              <option
                key={option.value}
                value={option.value}
                disabled={option.disabled}
              >
                {option.label}
              </option>
            ))
          : children}
      </select>
      <svg
        aria-hidden="true"
        viewBox="0 0 16 16"
        width="16"
        height="16"
        fill="none"
        className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-[color:var(--vg-text-secondary)]"
      >
        <path
          d="M4 6l4 4 4-4"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </div>
  );
}
