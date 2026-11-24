"use client";

import type { ButtonHTMLAttributes, MouseEvent, ReactNode } from "react";

export type ButtonVariant = "primary" | "secondary" | "tertiary";
export type ButtonSize = "sm" | "md" | "lg";

const VARIANT_CLASSES: Record<ButtonVariant, string> = {
  primary:
    "bg-[color:var(--vg-brand)] text-[color:var(--vg-text-inverse)] border border-transparent hover:bg-[color:var(--vg-brand-hover)] active:bg-[color:var(--vg-brand-pressed)]",
  secondary:
    "bg-[color:var(--vg-surface)] text-[color:var(--vg-text-primary)] border border-[color:var(--vg-border-control)] hover:bg-[color:var(--vg-surface-subtle)] active:bg-[color:var(--vg-brand-soft)]",
  tertiary:
    "bg-transparent text-[color:var(--vg-brand)] border border-transparent hover:bg-[color:var(--vg-brand-soft)] active:bg-[color:var(--vg-surface-subtle)]",
};

const BUTTON_SIZE_CLASSES: Record<ButtonSize, string> = {
  sm: "min-h-9 px-3 py-1.5 text-[0.8125rem] leading-[1.25rem]",
  md: "min-h-11 px-4 py-2.5 text-[0.875rem] leading-[1.25rem]",
  lg: "min-h-12 px-5 py-3 text-[0.9375rem] leading-[1.375rem]",
};

const ICON_BUTTON_SIZE_CLASSES: Record<ButtonSize, string> = {
  sm: "min-h-9 min-w-9 p-2",
  md: "min-h-11 min-w-11 p-2.5",
  lg: "min-h-12 min-w-12 p-3",
};

const BASE_CONTROL_CLASSES =
  "inline-flex items-center justify-center gap-2 rounded-[var(--vg-radius-md)] font-sans font-semibold transition-colors duration-[var(--vg-transition-fast)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--vg-focus)] disabled:cursor-not-allowed disabled:opacity-65";

function PendingSpinner() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 16 16"
      width="16"
      height="16"
      fill="none"
      className="shrink-0 animate-spin motion-reduce:animate-none"
    >
      <circle
        cx="8"
        cy="8"
        r="6"
        stroke="currentColor"
        strokeOpacity="0.28"
        strokeWidth="2"
      />
      <path
        d="M14 8a6 6 0 0 0-6-6"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  /** Visual emphasis matching Orchid & Clay action hierarchy. */
  variant?: ButtonVariant;
  /** Control sizing; `md` and `lg` meet the 44px touch-target floor. */
  size?: ButtonSize;
  /** Marks an active async operation and prevents duplicate activation. */
  pending?: boolean;
  /** Optional visible label shown while `pending` is true. */
  pendingLabel?: string;
  /** Optional decorative leading icon rendered with `aria-hidden="true"`. */
  leadingIcon?: ReactNode;
  /** Optional decorative trailing icon rendered with `aria-hidden="true"`. */
  trailingIcon?: ReactNode;
}

/**
 * Accessible native button primitive using Orchid & Clay tokens.
 * Defaults to `type="button"` and blocks duplicate clicks while pending.
 */
export function Button({
  variant = "primary",
  size = "md",
  type = "button",
  disabled = false,
  pending = false,
  pendingLabel,
  leadingIcon,
  trailingIcon,
  className,
  onClick,
  children,
  ...props
}: ButtonProps) {
  const isBlocked = Boolean(disabled || pending);

  function handleClick(event: MouseEvent<HTMLButtonElement>) {
    if (isBlocked) {
      event.preventDefault();
      return;
    }
    onClick?.(event);
  }

  const classes = [
    BASE_CONTROL_CLASSES,
    VARIANT_CLASSES[variant],
    BUTTON_SIZE_CLASSES[size],
    className,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <button
      type={type}
      disabled={isBlocked}
      aria-busy={pending ? true : undefined}
      onClick={handleClick}
      className={classes}
      {...props}
    >
      {pending ? (
        <PendingSpinner />
      ) : leadingIcon ? (
        <span aria-hidden="true" className="inline-flex shrink-0 items-center">
          {leadingIcon}
        </span>
      ) : null}
      <span>{pending && pendingLabel ? pendingLabel : children}</span>
      {!pending && trailingIcon ? (
        <span aria-hidden="true" className="inline-flex shrink-0 items-center">
          {trailingIcon}
        </span>
      ) : null}
    </button>
  );
}

export interface IconButtonProps
  extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, "aria-label" | "children"> {
  /** Mandatory accessible name describing the button's action. */
  label: string;
  /** Visual icon element; wrapped with `aria-hidden="true"`. */
  icon: ReactNode;
  /** Visual emphasis; defaults to `secondary` with an accessible border. */
  variant?: ButtonVariant;
  /** Sizing; `md` (default, 44x44px) and `lg` (48x48px) satisfy touch targets. */
  size?: ButtonSize;
  /** Marks an active async operation and prevents duplicate activation. */
  pending?: boolean;
}

/**
 * Accessible icon-only button primitive with mandatory `label` and `44x44px` default target.
 */
export function IconButton({
  label,
  icon,
  variant = "secondary",
  size = "md",
  type = "button",
  disabled = false,
  pending = false,
  className,
  onClick,
  ...props
}: IconButtonProps) {
  const isBlocked = Boolean(disabled || pending);

  function handleClick(event: MouseEvent<HTMLButtonElement>) {
    if (isBlocked) {
      event.preventDefault();
      return;
    }
    onClick?.(event);
  }

  const classes = [
    BASE_CONTROL_CLASSES,
    VARIANT_CLASSES[variant],
    ICON_BUTTON_SIZE_CLASSES[size],
    className,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <button
      type={type}
      aria-label={label}
      disabled={isBlocked}
      aria-busy={pending ? true : undefined}
      onClick={handleClick}
      className={classes}
      {...props}
    >
      <span
        aria-hidden="true"
        className="inline-flex shrink-0 items-center justify-center"
      >
        {pending ? <PendingSpinner /> : icon}
      </span>
    </button>
  );
}
