import type { CSSProperties, ReactNode } from "react";

export function Skeleton({
  className = "",
  style,
}: {
  className?: string;
  style?: CSSProperties;
}) {
  return <div className={`skeleton ${className}`.trim()} style={style} aria-hidden />;
}

export function SkeletonPage({
  titleWidth = "40%",
  children,
}: {
  titleWidth?: string | number;
  children?: ReactNode;
}) {
  return (
    <div className="page-skeleton" aria-busy="true" aria-live="polite">
      <div className="page-header page-header-static">
        <div style={{ flex: 1, minWidth: 0 }}>
          <Skeleton style={{ height: 22, width: titleWidth, maxWidth: 280 }} />
          <Skeleton style={{ height: 14, width: "min(100%, 420px)", marginTop: 10 }} />
        </div>
        <div className="page-actions" style={{ gap: "0.5rem" }}>
          <Skeleton style={{ height: 36, width: 120, borderRadius: 8 }} />
          <Skeleton style={{ height: 36, width: 100, borderRadius: 8 }} />
        </div>
      </div>
      {children}
    </div>
  );
}

export function SkeletonKpiGrid({ count = 4 }: { count?: number }) {
  return (
    <div className="kpi-grid">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="kpi-card">
          <Skeleton style={{ height: 12, width: "45%" }} />
          <Skeleton style={{ height: 28, width: "55%", marginTop: 12 }} />
          <Skeleton style={{ height: 12, width: "70%", marginTop: 10 }} />
        </div>
      ))}
    </div>
  );
}

export function SkeletonCards({ count = 6, columns = 3 }: { count?: number; columns?: number }) {
  return (
    <div
      className="skeleton-card-grid"
      style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}
    >
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="card skeleton-card">
          <div className="skeleton-card-top">
            <Skeleton style={{ height: 14, width: "55%" }} />
            <Skeleton style={{ height: 22, width: 22, borderRadius: 999 }} />
          </div>
          <Skeleton style={{ height: 12, width: "88%", marginTop: 14 }} />
          <Skeleton style={{ height: 12, width: "72%", marginTop: 8 }} />
          <Skeleton style={{ height: 12, width: "40%", marginTop: 8 }} />
        </div>
      ))}
    </div>
  );
}

export function SkeletonTable({ rows = 6, cols = 5 }: { rows?: number; cols?: number }) {
  return (
    <div className="card table-wrap">
      <table>
        <thead>
          <tr>
            {Array.from({ length: cols }).map((_, i) => (
              <th key={i}>
                <Skeleton style={{ height: 12, width: `${50 + (i % 3) * 12}%` }} />
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {Array.from({ length: rows }).map((_, r) => (
            <tr key={r}>
              {Array.from({ length: cols }).map((_, c) => (
                <td key={c}>
                  <Skeleton style={{ height: 12, width: `${55 + ((r + c) % 4) * 10}%` }} />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function DashboardSkeleton() {
  return (
    <SkeletonPage titleWidth="30%">
      <SkeletonKpiGrid count={4} />
      <div className="split-2" style={{ marginTop: "1.15rem" }}>
        <div className="card">
          <Skeleton style={{ height: 16, width: "40%" }} />
          <Skeleton style={{ height: 12, width: "55%", marginTop: 8 }} />
          <Skeleton style={{ height: 140, width: "100%", marginTop: 16, borderRadius: 10 }} />
        </div>
        <div className="card">
          <Skeleton style={{ height: 16, width: "40%" }} />
          <Skeleton style={{ height: 12, width: "55%", marginTop: 8 }} />
          <Skeleton style={{ height: 140, width: "100%", marginTop: 16, borderRadius: 10 }} />
        </div>
      </div>
      <div style={{ marginTop: "1.15rem" }}>
        <SkeletonTable rows={5} cols={6} />
      </div>
    </SkeletonPage>
  );
}

export function TablePageSkeleton() {
  return (
    <SkeletonPage>
      <SkeletonTable rows={7} cols={6} />
    </SkeletonPage>
  );
}

export function CardsPageSkeleton() {
  return (
    <SkeletonPage>
      <SkeletonCards count={6} columns={3} />
    </SkeletonPage>
  );
}

export function SettingsSkeleton() {
  return (
    <SkeletonPage titleWidth="28%">
      <div className="stack">
        {[0, 1, 2].map((i) => (
          <div key={i} className="card">
            <Skeleton style={{ height: 16, width: "35%" }} />
            <Skeleton style={{ height: 12, width: "70%", marginTop: 10 }} />
            <div className="form-grid" style={{ marginTop: 16 }}>
              <Skeleton style={{ height: 40, width: "100%", borderRadius: 8 }} />
              <Skeleton style={{ height: 40, width: "100%", borderRadius: 8 }} />
            </div>
          </div>
        ))}
      </div>
    </SkeletonPage>
  );
}
