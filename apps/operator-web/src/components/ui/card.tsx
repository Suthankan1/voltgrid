import type { HTMLAttributes, Ref } from "react";

export type CardVariant = "default" | "subtle";
export type CardPadding = "none" | "sm" | "md" | "lg";
export type CardElement = "div" | "section" | "article";

const CARD_VARIANT_CLASSES: Record<CardVariant, string> = {
  default:
    "bg-[color:var(--vg-surface)] border border-[color:var(--vg-border)] text-[color:var(--vg-text-primary)]",
  subtle:
    "bg-[color:var(--vg-surface-subtle)] border border-[color:var(--vg-border)] text-[color:var(--vg-text-primary)]",
};

const CARD_PADDING_CLASSES: Record<CardPadding, string> = {
  none: "p-0",
  sm: "p-4",
  md: "p-5 sm:p-6",
  lg: "p-6 sm:p-8",
};

export interface CardProps
  extends Omit<HTMLAttributes<HTMLElement>, "onClick"> {
  /** Surface emphasis (`default` white card or `subtle` tinted surface). */
  variant?: CardVariant;
  /** Internal spacing matching design-system card padding tokens. */
  padding?: CardPadding;
  /** Semantic container tag; never turns the card itself into a clickable control. */
  as?: CardElement;
}

/**
 * Non-interactive surface container with subtle border and zero elevation shadow.
 */
export function Card({
  variant = "default",
  padding = "md",
  as = "div",
  className,
  children,
  ...props
}: CardProps) {
  const Component = as;
  const classes = [
    "rounded-[var(--vg-radius-lg)] shadow-none",
    CARD_VARIANT_CLASSES[variant],
    CARD_PADDING_CLASSES[padding],
    className,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <Component className={classes} {...props}>
      {children}
    </Component>
  );
}

export const Surface = Card;
export type SurfaceProps = CardProps;

export type CardHeaderProps = HTMLAttributes<HTMLDivElement>;

/** Top layout region inside a Card for title and supporting actions. */
export function CardHeader({ className, children, ...props }: CardHeaderProps) {
  const classes = ["flex flex-wrap items-start justify-between gap-3", className]
    .filter(Boolean)
    .join(" ");

  return (
    <div className={classes} {...props}>
      {children}
    </div>
  );
}

export interface CardTitleProps extends HTMLAttributes<HTMLHeadingElement> {
  /** Forwarded ref to the underlying heading element. */
  ref?: Ref<HTMLHeadingElement>;
  /** Heading level matching the page's document outline. */
  as?: "h2" | "h3" | "h4";
}

/** Card heading styled with the `--vg-type-card` scale. */
export function CardTitle({
  as = "h2",
  className,
  children,
  ...props
}: CardTitleProps) {
  const Component = as;
  const classes = [
    "font-sans text-[1rem] font-semibold leading-[1.5rem] text-[color:var(--vg-text-primary)]",
    className,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <Component className={classes} {...props}>
      {children}
    </Component>
  );
}

export type CardDescriptionProps = HTMLAttributes<HTMLParagraphElement>;

/** Supporting descriptive text inside a Card header or body. */
export function CardDescription({
  className,
  children,
  ...props
}: CardDescriptionProps) {
  const classes = [
    "mt-1 font-sans text-[0.8125rem] leading-[1.25rem] text-[color:var(--vg-text-secondary)]",
    className,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <p className={classes} {...props}>
      {children}
    </p>
  );
}

export type CardContentProps = HTMLAttributes<HTMLDivElement>;

/** Main body wrapper inside a Card. */
export function CardContent({
  className,
  children,
  ...props
}: CardContentProps) {
  const classes = ["mt-4", className].filter(Boolean).join(" ");

  return (
    <div className={classes} {...props}>
      {children}
    </div>
  );
}

export type CardFooterProps = HTMLAttributes<HTMLDivElement>;

/** Footer wrapper for secondary metadata or action controls inside a Card. */
export function CardFooter({
  className,
  children,
  ...props
}: CardFooterProps) {
  const classes = [
    "mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-[color:var(--vg-border)] pt-4",
    className,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div className={classes} {...props}>
      {children}
    </div>
  );
}
