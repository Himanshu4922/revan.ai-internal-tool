"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Shell } from "@/components/Shell";
import {
  EmptyState,
  KpiCard,
  Money,
  PageHeader,
  SvgBarChart,
} from "@/components/ui";
import { api, ProjectDashboard } from "@/lib/api";
import {
  computeTotals,
  groupByProject,
  groupByProvider,
  projectSpendChart,
  providerSpendChart,
} from "@/lib/dashboardStats";
import { fmtMoney } from "@/lib/format";

export default function UsagePage() {
  const [projects, setProjects] = useState<ProjectDashboard[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const dash = await api.dashboard();
      setProjects(dash.projects || []);
      setError("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const totals = useMemo(() => computeTotals(projects), [projects]);
  const byProvider = useMemo(() => groupByProvider(projects), [projects]);
  const byProject = useMemo(() => groupByProject(projects), [projects]);
  const spendByProvider = useMemo(() => providerSpendChart(byProvider), [byProvider]);
  const spendByProject = useMemo(() => projectSpendChart(byProject), [byProject]);

  return (
    <Shell>
      <PageHeader
        title="Usage & analytics"
        description="Current spend and balance aggregates from the latest provider snapshots."
      />

      {error ? <div className="err">{error}</div> : null}

      {loading ? (
        <div className="muted">Loading usage…</div>
      ) : totals.keyCount === 0 ? (
        <EmptyState title="No usage data yet">
          Add keys and run a credit check to populate spend and balance figures.
        </EmptyState>
      ) : (
        <>
          <div className="kpi-grid">
            <KpiCard
              label="Reported spend"
              value={totals.spendSum != null ? fmtMoney(totals.spendSum, totals.spendCurrency) : "—"}
              meta="Sum of latest spend_amount fields"
            />
            <KpiCard
              label="Available credits"
              value={
                totals.balanceSum != null ? fmtMoney(totals.balanceSum, totals.balanceCurrency) : "—"
              }
              meta="Only where providers return a balance"
            />
            <KpiCard label="Providers" value={String(totals.providerCount)} />
            <KpiCard label="Keys tracked" value={String(totals.keyCount)} />
          </div>

          <div className="split-2">
            <div className="card">
              <h2 className="card-title">Spend by provider</h2>
              <p className="card-sub">From latest snapshots</p>
              <div style={{ marginTop: "0.85rem" }}>
                <SvgBarChart
                  data={spendByProvider}
                  emptyLabel="No spend amounts reported by providers yet"
                />
              </div>
            </div>
            <div className="card">
              <h2 className="card-title">Spend by project</h2>
              <p className="card-sub">From latest snapshots</p>
              <div style={{ marginTop: "0.85rem" }}>
                <SvgBarChart
                  data={spendByProject}
                  emptyLabel="No project spend figures in the latest checks"
                />
              </div>
            </div>
          </div>

          <div className="card" style={{ marginBottom: "1.15rem" }}>
            <h2 className="card-title">Historical trends</h2>
            <p className="card-sub" style={{ marginBottom: "0.85rem" }}>
              Daily / weekly / monthly series
            </p>
            <EmptyState title="History not available yet">
              Snapshot history is stored when checks run, but there is no list API yet. This view
              will show trends once a history endpoint is added — without inventing chart data.
            </EmptyState>
          </div>

          <div className="split-2">
            <div className="card table-wrap">
              <h2 className="card-title" style={{ marginBottom: "0.75rem" }}>
                Provider table
              </h2>
              <table>
                <thead>
                  <tr>
                    <th>Provider</th>
                    <th>Keys</th>
                    <th>Spend</th>
                    <th>Balance</th>
                  </tr>
                </thead>
                <tbody>
                  {byProvider.map((p) => (
                    <tr key={p.provider}>
                      <td>{p.provider}</td>
                      <td className="mono">{p.keyCount}</td>
                      <td>
                        <Money amount={p.spendSum} currency={p.spendCurrency} />
                      </td>
                      <td>
                        <Money amount={p.balanceSum} currency={p.balanceCurrency} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="card table-wrap">
              <h2 className="card-title" style={{ marginBottom: "0.75rem" }}>
                Project table
              </h2>
              <table>
                <thead>
                  <tr>
                    <th>Project</th>
                    <th>Keys</th>
                    <th>Spend</th>
                    <th>Balance</th>
                    <th>Attention</th>
                  </tr>
                </thead>
                <tbody>
                  {byProject.map((p) => (
                    <tr key={p.projectId}>
                      <td>{p.projectName}</td>
                      <td className="mono">{p.keyCount}</td>
                      <td>
                        <Money amount={p.spendSum} currency={p.currency} />
                      </td>
                      <td>
                        <Money amount={p.balanceSum} currency={p.currency} />
                      </td>
                      <td className="mono">{p.attention}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </Shell>
  );
}
