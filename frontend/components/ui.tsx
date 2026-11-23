import type { ReactNode } from "react";
import type { ChartDatum } from "@/lib/dashboardStats";
import { fmtMoney, relativeTime, titleCase } from "@/lib/format";

export function StatusBadge({ status }: { status: string }) {
  const s = status || "unknown";
  return <span className={`badge ${s}`}>{s}</span>;
}

export function PageHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
}) {
  return (
    <header className="page-header">
      <div>
        <h1>{title}</h1>
        {description ? <p className="lede">{description}</p> : null}
      </div>
      {actions ? <div className="page-actions">{actions}</div> : null}
    </header>
  );
}

export function KpiCard({
  label,
  value,
  meta,
}: {
  label: string;
  value: string;
  meta?: string;
}) {
  return (
    <div className="kpi-card">
      <p className="kpi-label">{label}</p>
      <p className="kpi-value">{value}</p>
      {meta ? <p className="kpi-meta">{meta}</p> : null}
    </div>
  );
}

export function EmptyState({
  title,
  children,
  action,
}: {
  title: string;
  children?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="card empty-state">
      <h3>{title}</h3>
      {children ? <p>{children}</p> : null}
      {action ? <div style={{ marginTop: "1rem" }}>{action}</div> : null}
    </div>
  );
}

export function ProviderMark({ provider }: { provider: string }) {
  const label = (provider || "?").slice(0, 2);
  return (
    <span className="provider-mark" aria-hidden>
      {label}
    </span>
  );
}

export function ProviderCell({
  provider,
  subtitle,
}: {
  provider: string;
  subtitle?: string;
}) {
  return (
    <div className="provider-cell">
      <ProviderMark provider={provider} />
      <div className="provider-cell-text">
        <strong>{titleCase(provider)}</strong>
        {subtitle ? <div className="muted">{subtitle}</div> : null}
      </div>
    </div>
  );
}

export function Money({
  amount,
  currency,
}: {
  amount?: number | null;
  currency?: string;
}) {
  return <span className="mono">{fmtMoney(amount, currency)}</span>;
}

export function RelativeTime({ iso }: { iso?: string }) {
  return (
    <span className="muted" title={iso || undefined}>
      {relativeTime(iso)}
    </span>
  );
}

export function SvgBarChart({
  data,
  emptyLabel = "No values to chart yet",
}: {
  data: ChartDatum[];
  emptyLabel?: string;
}) {
  if (!data.length) {
    return <div className="muted">{emptyLabel}</div>;
  }
  const max = Math.max(...data.map((d) => d.value), 0.0001);
  const barW = 28;
  const gap = 14;
  const height = 140;
  const padTop = 12;
  const padBottom = 28;
  const chartH = height - padTop - padBottom;
  const width = Math.max(data.length * (barW + gap) + gap, 200);

  return (
    <div className="chart-wrap">
      <svg viewBox={`0 0 ${width} ${height}`} width="100%" height={height} role="img">
        {data.map((d, i) => {
          const h = (d.value / max) * chartH;
          const x = gap + i * (barW + gap);
          const y = padTop + chartH - h;
          return (
            <g key={d.label}>
              <rect
                x={x}
                y={y}
                width={barW}
                height={Math.max(h, 2)}
                rx={4}
                fill={d.color || "#3b82f6"}
              >
                <title>
                  {d.label}: {d.value}
                </title>
              </rect>
              <text
                x={x + barW / 2}
                y={height - 8}
                textAnchor="middle"
                fill="#a1a1aa"
                fontSize="10"
              >
                {d.label.length > 8 ? `${d.label.slice(0, 7)}…` : d.label}
              </text>
            </g>
          );
        })}
      </svg>
      <div className="chart-legend">
        {data.map((d) => (
          <span key={d.label}>
            <i className="chart-swatch" style={{ background: d.color || "#3b82f6" }} />
            {d.label}: {d.value.toLocaleString(undefined, { maximumFractionDigits: 4 })}
          </span>
        ))}
      </div>
    </div>
  );
}

export function SvgDonut({
  data,
  emptyLabel = "No breakdown yet",
}: {
  data: ChartDatum[];
  emptyLabel?: string;
}) {
  if (!data.length) {
    return <div className="muted">{emptyLabel}</div>;
  }
  const total = data.reduce((s, d) => s + d.value, 0) || 1;
  const r = 42;
  const c = 2 * Math.PI * r;
  let offset = 0;
  const cx = 56;
  const cy = 56;

  return (
    <div className="chart-wrap" style={{ display: "flex", gap: "1rem", alignItems: "center", flexWrap: "wrap" }}>
      <svg width={112} height={112} viewBox="0 0 112 112" role="img">
        <circle cx={cx} cy={cy} r={r} fill="none" stroke="#27272a" strokeWidth={14} />
        {data.map((d) => {
          const len = (d.value / total) * c;
          const el = (
            <circle
              key={d.label}
              cx={cx}
              cy={cy}
              r={r}
              fill="none"
              stroke={d.color || "#3b82f6"}
              strokeWidth={14}
              strokeDasharray={`${len} ${c - len}`}
              strokeDashoffset={-offset}
              transform={`rotate(-90 ${cx} ${cy})`}
            >
              <title>
                {d.label}: {d.value}
              </title>
            </circle>
          );
          offset += len;
          return el;
        })}
      </svg>
      <div className="chart-legend" style={{ marginTop: 0, flexDirection: "column", gap: "0.4rem" }}>
        {data.map((d) => (
          <span key={d.label}>
            <i className="chart-swatch" style={{ background: d.color || "#3b82f6" }} />
            {d.label} · {d.value}
          </span>
        ))}
      </div>
    </div>
  );
}
