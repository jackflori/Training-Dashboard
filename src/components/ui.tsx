import type { ButtonHTMLAttributes, ReactNode } from "react";

export function Card({
  title,
  action,
  children,
  className = "",
}: {
  title?: ReactNode;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section
      className={`rounded-xl border border-border bg-surface p-4 shadow-sm sm:p-5 ${className}`}
    >
      {(title || action) && (
        <header className="mb-3 flex items-center justify-between gap-3">
          {title && (
            <h2 className="text-xs font-semibold uppercase tracking-wider text-ink-muted">
              {title}
            </h2>
          )}
          {action}
        </header>
      )}
      {children}
    </section>
  );
}

/**
 * Stat tile: label · value · optional sub, with a colored icon carrying the
 * accent. The value stays in ink — color rides the mark beside it, not the
 * text. `emphasis` flips one tile to a filled accent panel; use it for the
 * single headline number on a view, never for a whole row.
 */
export function StatTile({
  label,
  value,
  sub,
  icon,
  emphasis = false,
}: {
  label: string;
  value: ReactNode;
  sub?: ReactNode;
  icon?: ReactNode;
  emphasis?: boolean;
}) {
  return (
    <div
      className={`rounded-lg px-4 py-3 ${
        emphasis
          ? "bg-accent text-on-accent"
          : "bg-surface-muted ring-1 ring-inset ring-border/60"
      }`}
    >
      <div className="flex items-center gap-1.5">
        {icon && (
          <span className={emphasis ? "text-on-accent/80" : "text-accent"}>
            {icon}
          </span>
        )}
        <span
          className={`text-[11px] font-semibold uppercase tracking-wider ${
            emphasis ? "text-on-accent/80" : "text-ink-muted"
          }`}
        >
          {label}
        </span>
      </div>
      {/* Proportional figures — tabular is for columns that must align. */}
      <div
        className={`mt-1 text-2xl font-semibold ${
          emphasis ? "text-on-accent" : "text-ink"
        }`}
      >
        {value}
      </div>
      {sub && (
        <div
          className={`mt-0.5 text-xs ${
            emphasis ? "text-on-accent/75" : "text-ink-muted"
          }`}
        >
          {sub}
        </div>
      )}
    </div>
  );
}

type Variant = "primary" | "ghost" | "danger";

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
};

const VARIANT_STYLES: Record<Variant, string> = {
  primary: "bg-accent text-on-accent hover:bg-accent-strong",
  ghost:
    "border border-border bg-surface text-ink-secondary hover:border-accent-mid hover:text-accent",
  danger: "border border-border bg-surface text-danger hover:bg-danger/10",
};

/** Shared class string so <a> links can look identical to <Button>. */
export function buttonClass(variant: Variant = "ghost", className = ""): string {
  return `inline-flex items-center justify-center rounded-lg px-3 py-1.5 text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-50 ${VARIANT_STYLES[variant]} ${className}`;
}

export function Button({ variant = "ghost", className = "", ...props }: ButtonProps) {
  return <button {...props} className={buttonClass(variant, className)} />;
}

export function Spinner({ className = "" }: { className?: string }) {
  return (
    <span
      className={`inline-block h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent ${className}`}
      aria-hidden
    />
  );
}

/* ---- icons (16px, currentColor) ---- */

function icon(path: ReactNode) {
  return (
    <svg
      width="15"
      height="15"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      {path}
    </svg>
  );
}

export const RouteIcon = () =>
  icon(
    <>
      <circle cx="6" cy="19" r="3" />
      <circle cx="18" cy="5" r="3" />
      <path d="M9 19h5a4 4 0 0 0 0-8h-4a4 4 0 0 1 0-8h5" />
    </>,
  );

export const ClockIcon = () =>
  icon(
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </>,
  );

export const MountainIcon = () => icon(<path d="m3 19 6-10 4 6 2.5-4L21 19H3Z" />);

export const FlagIcon = () =>
  icon(
    <>
      <path d="M4 21V4" />
      <path d="M4 4h12l-2 4 2 4H4" />
    </>,
  );

export const BoltIcon = () => icon(<path d="M13 2 4 14h7l-1 8 9-12h-7l1-8Z" />);
