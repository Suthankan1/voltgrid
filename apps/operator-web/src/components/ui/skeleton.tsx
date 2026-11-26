import type { HTMLAttributes } from "react";

export type SkeletonVariant = "text" | "heading" | "block" | "circle";

const SKELETON_VARIANT_CLASSES: Record<SkeletonVariant, string> = {
  text: "h-4 w-full rounded-[var(--vg-radius-sm)]",
  heading: "h-7 w-2/5 rounded-[var(--vg-radius-sm)]",
  block: "h-24 w-full rounded-[var(--vg-radius-lg)]",
  circle: "h-10 w-10 rounded-full",
};

export interface SkeletonProps extends HTMLAttributes<HTMLSpanElement> {
  /** Shape preset preserving approximate layout space while loading. */
  variant?: SkeletonVariant;
  /** Optional subtle pulse animation; automatically disabled for `prefers-reduced-motion`. */
  animate?: boolean;
}

/**
 * Decorative loading placeholder hidden from assistive technology.
 * Wrap collections inside `SkeletonGroup` so the region exposes `aria-busy`.
 */
export function Skeleton({
  variant = "text",
  animate = true,
  className,
  ...props
}: SkeletonProps) {
  const classes = [
    "block bg-[color:var(--vg-neutral-soft)]",
    animate ? "animate-pulse motion-reduce:animate-none" : undefined,
    SKELETON_VARIANT_CLASSES[variant],
    className,
  ]
    .filter(Boolean)
    .join(" ");

  return <span aria-hidden="true" className={classes} {...props} />;
}

export interface SkeletonGroupProps extends HTMLAttributes<HTMLDivElement> {
  /** Accessible status message describing the loading region. */
  label?: string;
}

/**
 * Accessible loading container announcing `aria-busy="true"` while hiding decorative bars.
 */
export function SkeletonGroup({
  label = "Loading content",
  className,
  children,
  ...props
}: SkeletonGroupProps) {
  return (
    <div
      role="status"
      aria-busy="true"
      aria-label={label}
      className={className}
      {...props}
    >
      <span className="sr-only">{label}</span>
      {children}
    </div>
  );
}
