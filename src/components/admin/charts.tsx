// Dependency-free chart primitives for the admin analytics dashboard.

const PALETTE = ["#4f46e5", "#8b5cf6", "#0ea5e9", "#10b981", "#f59e0b", "#ef4444", "#64748b", "#ec4899"];

export function BarSeries({
  data,
  height = 120,
  color = "#4f46e5",
  valueFormat = (v: number) => String(v),
}: {
  data: { label: string; value: number }[];
  height?: number;
  color?: string;
  valueFormat?: (v: number) => string;
}) {
  const max = Math.max(1, ...data.map((d) => d.value));
  const barW = 100 / Math.max(data.length, 1);
  return (
    <div>
      <svg viewBox={`0 0 100 ${height / 4}`} className="w-full" preserveAspectRatio="none" style={{ height }}>
        {data.map((d, i) => {
          const h = (d.value / max) * (height / 4 - 2);
          return (
            <rect
              key={i}
              x={i * barW + barW * 0.15}
              y={height / 4 - h}
              width={barW * 0.7}
              height={h}
              rx={0.6}
              fill={color}
              opacity={d.value === 0 ? 0.15 : 0.85}
            >
              <title>{`${d.label}: ${valueFormat(d.value)}`}</title>
            </rect>
          );
        })}
      </svg>
      <div className="mt-1 flex justify-between text-[10px] text-slate-400">
        <span>{data[0]?.label}</span>
        <span>{data[Math.floor(data.length / 2)]?.label}</span>
        <span>{data[data.length - 1]?.label}</span>
      </div>
    </div>
  );
}

export function Donut({
  segments,
  centerLabel,
  centerValue,
}: {
  segments: { label: string; value: number }[];
  centerLabel?: string;
  centerValue?: string;
}) {
  const total = segments.reduce((s, x) => s + x.value, 0);
  let acc = 0;
  const stops = segments
    .map((s, i) => {
      const start = total ? (acc / total) * 360 : 0;
      acc += s.value;
      const end = total ? (acc / total) * 360 : 0;
      return `${PALETTE[i % PALETTE.length]} ${start}deg ${end}deg`;
    })
    .join(", ");

  return (
    <div className="flex items-center gap-4">
      <div className="relative h-28 w-28 shrink-0">
        <div
          className="h-28 w-28 rounded-full"
          style={{ background: total ? `conic-gradient(${stops})` : "#e2e8f0" }}
        />
        <div className="absolute inset-3 flex flex-col items-center justify-center rounded-full bg-white">
          <span className="text-lg font-bold text-slate-900">{centerValue ?? total}</span>
          {centerLabel && <span className="text-[9px] uppercase tracking-wide text-slate-400">{centerLabel}</span>}
        </div>
      </div>
      <ul className="min-w-0 flex-1 space-y-1">
        {segments.map((s, i) => (
          <li key={s.label} className="flex items-center justify-between gap-2 text-xs">
            <span className="flex min-w-0 items-center gap-1.5 text-slate-600">
              <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: PALETTE[i % PALETTE.length] }} />
              <span className="truncate">{s.label}</span>
            </span>
            <span className="font-semibold text-slate-800">
              {s.value}
              {total > 0 && <span className="ml-1 font-normal text-slate-400">({Math.round((s.value / total) * 100)}%)</span>}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function HBars({
  data,
  valueFormat = (v: number) => String(v),
}: {
  data: { label: string; value: number }[];
  valueFormat?: (v: number) => string;
}) {
  const max = Math.max(1, ...data.map((d) => d.value));
  return (
    <ul className="space-y-2.5">
      {data.map((d, i) => (
        <li key={d.label}>
          <div className="mb-0.5 flex items-center justify-between text-xs">
            <span className="text-slate-600">{d.label}</span>
            <span className="font-semibold text-slate-800">{valueFormat(d.value)}</span>
          </div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
            <div
              className="h-full rounded-full"
              style={{ width: `${(d.value / max) * 100}%`, background: PALETTE[i % PALETTE.length] }}
            />
          </div>
        </li>
      ))}
      {data.length === 0 && <li className="text-xs text-slate-400">No data yet.</li>}
    </ul>
  );
}

export function KpiCard({
  label,
  value,
  delta,
  deltaLabel = "vs prior 30 days",
  sub,
}: {
  label: string;
  value: string;
  delta?: number | null;
  deltaLabel?: string;
  sub?: string;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">{label}</p>
      <p className="mt-1 text-2xl font-bold text-slate-900">{value}</p>
      {delta !== undefined && delta !== null && (
        <p className={`mt-0.5 text-xs font-semibold ${delta > 0 ? "text-emerald-600" : delta < 0 ? "text-red-500" : "text-slate-400"}`}>
          {delta > 0 ? "▲" : delta < 0 ? "▼" : "—"} {Math.abs(delta)} <span className="font-normal text-slate-400">{deltaLabel}</span>
        </p>
      )}
      {sub && <p className="mt-0.5 text-xs text-slate-500">{sub}</p>}
    </div>
  );
}
