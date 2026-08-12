import Link from "next/link";
import type { ReactNode } from "react";
import { ISSUE_STATES } from "@/lib/constants";

export function Card({ children, className = "", id }: { children: ReactNode; className?: string; id?: string }) {
  return (
    <div id={id} className={`rounded-2xl border border-slate-200 bg-white shadow-sm ${className}`}>
      {children}
    </div>
  );
}

export function CardBody({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`p-5 ${className}`}>{children}</div>;
}

export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: string; actions?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-slate-500">{subtitle}</p>}
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  );
}

const buttonStyles = {
  primary: "bg-indigo-600 text-white hover:bg-indigo-700 shadow-sm",
  secondary: "bg-white text-slate-700 border border-slate-300 hover:bg-slate-50",
  danger: "bg-white text-red-600 border border-red-200 hover:bg-red-50",
  ghost: "text-slate-600 hover:bg-slate-100",
} as const;

export function ButtonLink({
  href,
  children,
  variant = "primary",
  className = "",
}: {
  href: string;
  children: ReactNode;
  variant?: keyof typeof buttonStyles;
  className?: string;
}) {
  return (
    <Link
      href={href}
      className={`inline-flex items-center justify-center gap-1.5 rounded-lg px-4 py-2 text-sm font-medium transition ${buttonStyles[variant]} ${className}`}
    >
      {children}
    </Link>
  );
}

export function Button({
  children,
  variant = "primary",
  className = "",
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: keyof typeof buttonStyles;
}) {
  return (
    <button
      {...props}
      className={`inline-flex items-center justify-center gap-1.5 rounded-lg px-4 py-2 text-sm font-medium transition disabled:opacity-50 ${buttonStyles[variant]} ${className}`}
    >
      {children}
    </button>
  );
}

export const inputClass =
  "w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder-slate-400 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-100";

export function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-medium text-slate-700">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-xs text-slate-500">{hint}</span>}
    </label>
  );
}

const badgeStyles: Record<string, string> = {
  slate: "bg-slate-100 text-slate-700",
  green: "bg-emerald-100 text-emerald-800",
  amber: "bg-amber-100 text-amber-800",
  red: "bg-red-100 text-red-700",
  indigo: "bg-indigo-100 text-indigo-700",
  blue: "bg-sky-100 text-sky-800",
};

export function Badge({ children, color = "slate" }: { children: ReactNode; color?: string }) {
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${badgeStyles[color] ?? badgeStyles.slate}`}>
      {children}
    </span>
  );
}

// Restrained product-state marks — a financial app, not an emoji chat.
export function StateMark({ state }: { state: string }) {
  const def = ISSUE_STATES[state as keyof typeof ISSUE_STATES];
  if (!def) return <Badge>{state}</Badge>;
  const colors: Record<string, string> = {
    resolved: "green",
    review: "blue",
    action_needed: "amber",
    urgent: "red",
    info_needed: "slate",
  };
  return (
    <Badge color={colors[state]}>
      <span className="mr-1 font-bold">{def.mark}</span>
      {def.label}
    </Badge>
  );
}

export function ConfidenceBadge({ level }: { level: string }) {
  const map: Record<string, { label: string; color: string }> = {
    high: { label: "High confidence", color: "green" },
    medium: { label: "Moderate confidence", color: "amber" },
    low: { label: "Needs verification", color: "red" },
  };
  const def = map[level] ?? map.medium;
  return <Badge color={def.color}>{def.label}</Badge>;
}

// Evidence-based product statuses — never an AI confidence percentage.
export const EVIDENCE_STATUSES: Record<string, { label: string; color: string; explain: string }> = {
  confirmed: { label: "Confirmed", color: "green", explain: "Evidence supports this finding." },
  likely: { label: "Likely", color: "blue", explain: "Strong indicators, but additional verification needed." },
  possible: { label: "Possible", color: "amber", explain: "There are indicators, but insufficient evidence." },
  needs_verification: { label: "Needs verification", color: "red", explain: "Important information is missing or conflicting." },
  not_supported: { label: "Not supported", color: "slate", explain: "The available evidence doesn't support the concern." },
};

export function EvidenceStatusBadge({ status }: { status: string }) {
  const def = EVIDENCE_STATUSES[status] ?? EVIDENCE_STATUSES.needs_verification;
  return (
    <span title={def.explain}>
      <Badge color={def.color}>{def.label}</Badge>
    </span>
  );
}

export const EVIDENCE_STRENGTHS: Record<string, { label: string; explain: string }> = {
  strong: { label: "Strong", explain: "Supported by multiple independent records." },
  moderate: { label: "Moderate", explain: "Supported by available evidence but requires confirmation." },
  limited: { label: "Limited", explain: "Based primarily on your description or incomplete documents." },
};

export function EvidenceStrengthLine({ strength }: { strength: string }) {
  const def = EVIDENCE_STRENGTHS[strength] ?? EVIDENCE_STRENGTHS.limited;
  return (
    <p className="text-xs text-slate-500">
      <span className="font-semibold text-slate-700">Evidence strength: {def.label}.</span> {def.explain}
    </p>
  );
}

// Item classification — richer than calling everything a "finding".
export const ITEM_KINDS: Record<string, { label: string; color: string }> = {
  finding: { label: "Finding", color: "indigo" },
  issue: { label: "Issue", color: "amber" },
  opportunity: { label: "Opportunity", color: "green" },
  risk: { label: "Risk", color: "red" },
  missing_info: { label: "Missing information", color: "slate" },
};

export function ItemKindBadge({ kind }: { kind: string }) {
  const def = ITEM_KINDS[kind] ?? ITEM_KINDS.issue;
  return (
    <span className={`inline-flex items-center rounded-md px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${badgeStyles[def.color] ?? badgeStyles.slate}`}>
      {def.label}
    </span>
  );
}

export function ProgressBar({ value, label }: { value: number; label?: string }) {
  const clamped = Math.max(0, Math.min(100, value));
  return (
    <div>
      {label && (
        <div className="mb-1 flex items-center justify-between text-sm">
          <span className="font-medium text-slate-700">{label}</span>
          <span className="font-semibold text-slate-900">{clamped}%</span>
        </div>
      )}
      <div className="h-2.5 w-full overflow-hidden rounded-full bg-slate-200">
        <div
          className={`h-full rounded-full transition-all ${clamped >= 70 ? "bg-emerald-500" : clamped >= 40 ? "bg-amber-500" : "bg-indigo-500"}`}
          style={{ width: `${clamped}%` }}
        />
      </div>
    </div>
  );
}

export function Money({ cents, className = "" }: { cents: number | null | undefined; className?: string }) {
  if (cents === null || cents === undefined) return <span className={className}>—</span>;
  return (
    <span className={className}>
      {(cents / 100).toLocaleString("en-US", { style: "currency", currency: "USD" })}
    </span>
  );
}

export function EmptyState({ title, body, action }: { title: string; body?: string; action?: ReactNode }) {
  return (
    <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center">
      <p className="text-base font-semibold text-slate-800">{title}</p>
      {body && <p className="mx-auto mt-1 max-w-md text-sm text-slate-500">{body}</p>}
      {action && <div className="mt-4 flex justify-center">{action}</div>}
    </div>
  );
}

export function Stat({ label, value, sub }: { label: string; value: ReactNode; sub?: string }) {
  return (
    <Card>
      <CardBody>
        <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</p>
        <p className="mt-1 text-2xl font-bold text-slate-900">{value}</p>
        {sub && <p className="mt-0.5 text-xs text-slate-500">{sub}</p>}
      </CardBody>
    </Card>
  );
}
