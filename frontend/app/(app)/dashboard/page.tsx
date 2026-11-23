"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  EmptyState,
  KpiCard,
  Money,
  PageHeader,
  ProviderCell,
  RelativeTime,
  StatusBadge,
  SvgBarChart,
  SvgDonut,
} from "@/components/ui";
import { api, ProjectDashboard, ProjectWithMembers, User } from "@/lib/api";
import {
  attentionRows,
  computeTotals,
  groupByProvider,
  groupByProject,
  providerKeyChart,
  providerSpendChart,
  projectSpendChart,
} from "@/lib/dashboardStats";
import { fmtMoney, fmtTime } from "@/lib/format";
import { DashboardSkeleton } from "@/components/Skeleton";

export default function DashboardPage() {
  const [projects, setProjects] = useState<ProjectDashboard[]>([]);
  const [allProjects, setAllProjects] = useState<ProjectWithMembers[]>([]);
  const [filter, setFilter] = useState("");
  const [user, setUser] = useState<User | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const [me, dash, plist] = await Promise.all([
        api.me(),
        api.dashboard(filter || undefined),
        api.listProjects(),
      ]);
      setUser(me);
      setProjects(dash.projects || []);
      setAllProjects(plist.items || []);
      setError("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => {
    load();
    const t = setInterval(load, 60_000);
    return () => clearInterval(t);
  }, [load]);

  async function refreshAll() {
    setBusy(true);
    try {
      if (filter) await api.checkProject(filter);
      else await api.checkAll();
      setTimeout(load, 2500);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Refresh failed");
    } finally {
      setBusy(false);
    }
  }

  const totals = useMemo(() => computeTotals(projects), [projects]);
  const byProvider = useMemo(() => groupByProvider(projects), [projects]);
  const byProject = useMemo(() => groupByProject(projects), [projects]);
  const attention = useMemo(() => attentionRows(projects), [projects]);
  const spendChart = useMemo(() => providerSpendChart(byProvider), [byProvider]);
  const keyChart = useMemo(() => providerKeyChart(byProvider), [byProvider]);
  const projectChart = useMemo(() => projectSpendChart(byProject), [byProject]);

  if (loading) return <DashboardSkeleton />;

  return (
    <>
      <PageHeader
        title="Overview"
        description="Credit status, spend, and keys across projects — live from the latest provider checks."
        actions={
          <>
            <select
              className="select-input"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              aria-label="Filter by project"
            >
              <option value="">All projects</option>
              {allProjects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
            {user?.role === "admin" ? (
              <button className="btn primary" type="button" onClick={refreshAll} disabled={busy}>
                {busy ? "Checking…" : filter ? "Refresh project" : "Refresh all"}
              </button>
            ) : null}
            {user?.role === "admin" ? (
              <Link className="btn" href="/keys">
                Manage keys
              </Link>
            ) : null}
          </>
        }
      />

      {error ? <div className="err">{error}</div> : null}

      {projects.length === 0 ? (
        <EmptyState
          title="No projects yet"
          action={
            user?.role === "admin" ? (
              <Link className="btn primary" href="/projects">
                Create a project
              </Link>
            ) : null
          }
        >
          Admin can create projects and attach encrypted API keys to start monitoring credits.
        </EmptyState>
      ) : (
        <>
          <div className="kpi-grid">
            <KpiCard label="Providers" value={String(totals.providerCount)} meta="Distinct providers with keys" />
            <KpiCard label="API keys" value={String(totals.keyCount)} meta={`${totals.ok} healthy`} />
            <KpiCard
              label="Available credits"
              value={totals.balanceSum != null ? fmtMoney(totals.balanceSum, totals.balanceCurrency) : "—"}
              meta={
                totals.balanceSum != null
                  ? "Sum of balances where providers report them"
                  : "No balance figures returned yet"
              }
            />
            <KpiCard
              label="Needs attention"
              value={String(totals.attentionCount)}
              meta="Low, exhausted, or error"
            />
          </div>

          {totals.spendSum != null ? (
            <div className="kpi-grid" style={{ gridTemplateColumns: "repeat(2, minmax(0, 1fr))" }}>
              <KpiCard
                label="Reported spend"
                value={fmtMoney(totals.spendSum, totals.spendCurrency)}
                meta="From latest snapshots that include spend"
              />
              <KpiCard
                label="Status mix"
                value={`${totals.ok} ok · ${totals.low} low · ${totals.exhausted} exhausted`}
                meta={`${totals.error} error · ${totals.unknown} unknown`}
              />
            </div>
          ) : null}

          <div className="split-2">
            <div className="card">
              <h2 className="card-title">Provider breakdown</h2>
              <p className="card-sub">
                {spendChart.length ? "Current spend by provider" : "Key count by provider"}
              </p>
              <div style={{ marginTop: "0.85rem" }}>
                {spendChart.length ? (
                  <SvgBarChart data={spendChart} emptyLabel="No spend amounts reported" />
                ) : (
                  <SvgDonut data={keyChart} emptyLabel="No providers yet" />
                )}
              </div>
            </div>
            <div className="card">
              <h2 className="card-title">Project spend</h2>
              <p className="card-sub">Latest spend totals where available</p>
              <div style={{ marginTop: "0.85rem" }}>
                <SvgBarChart
                  data={projectChart}
                  emptyLabel="No project spend figures in the latest checks"
                />
              </div>
            </div>
          </div>

          <div className="card" style={{ marginBottom: "1.15rem" }}>
            <div className="toolbar" style={{ marginBottom: "0.5rem" }}>
              <div>
                <h2 className="card-title">Needs attention</h2>
                <p className="card-sub">Keys with low, exhausted, or error status</p>
              </div>
            </div>
            {attention.length === 0 ? (
              <p className="muted" style={{ margin: 0 }}>
                Nothing needs attention right now.
              </p>
            ) : (
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Provider</th>
                      <th>Project</th>
                      <th>Env</th>
                      <th>Status</th>
                      <th>Balance</th>
                      <th>Checked</th>
                    </tr>
                  </thead>
                  <tbody>
                    {attention.map((r) => (
                      <tr key={r.key.id}>
                        <td>
                          <ProviderCell
                            provider={r.key.provider}
                            subtitle={r.key.label || `…${r.key.key_hint}`}
                          />
                        </td>
                        <td>{r.projectName}</td>
                        <td>
                          <span className="badge env">{r.key.project_env}</span>
                        </td>
                        <td>
                          <StatusBadge status={r.status} />
                        </td>
                        <td>
                          <Money amount={r.snapshot?.balance} currency={r.snapshot?.currency} />
                        </td>
                        <td>
                          <RelativeTime iso={r.snapshot?.checked_at} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <div className="stack">
            {projects.map((pd) => (
              <div key={pd.project.id} className="card">
                <div className="toolbar" style={{ marginBottom: "0.75rem" }}>
                  <div>
                    <h2 className="card-title">{pd.project.name}</h2>
                    <p className="card-sub">{pd.project.description || "No description"}</p>
                    <p className="muted" style={{ margin: "0.35rem 0 0" }}>
                      Team:{" "}
                      {(pd.members || []).length
                        ? (pd.members || [])
                            .map((m) => `${m.name}${m.role_label ? ` (${m.role_label})` : ""}`)
                            .join(", ")
                        : "none assigned"}
                    </p>
                  </div>
                  <div className="muted" style={{ textAlign: "right", fontSize: "0.8rem" }}>
                    {pd.summary.total} keys · ok {pd.summary.ok} · low {pd.summary.low} · exhausted{" "}
                    {pd.summary.exhausted} · error {pd.summary.error}
                  </div>
                </div>
                <div className="table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th>Provider</th>
                        <th>Env</th>
                        <th>Status</th>
                        <th>Balance</th>
                        <th>Spend</th>
                        <th>Summary</th>
                        <th>Checked</th>
                      </tr>
                    </thead>
                    <tbody>
                      {pd.items.length === 0 ? (
                        <tr>
                          <td colSpan={7} className="muted">
                            No keys in this project yet.
                          </td>
                        </tr>
                      ) : (
                        pd.items.map((row) => {
                          const s = row.snapshot;
                          const status = s?.status || "unknown";
                          return (
                            <tr key={row.key.id}>
                              <td>
                                <ProviderCell
                                  provider={row.key.provider}
                                  subtitle={row.key.label || `…${row.key.key_hint}`}
                                />
                              </td>
                              <td>
                                <span className="badge env">{row.key.project_env}</span>
                              </td>
                              <td>
                                <StatusBadge status={status} />
                              </td>
                              <td>
                                <Money amount={s?.balance} currency={s?.currency} />
                              </td>
                              <td className="mono">
                                {s?.spend_amount != null
                                  ? `${fmtMoney(s.spend_amount, s.currency)}${
                                      s.spend_period ? ` (${s.spend_period})` : ""
                                    }`
                                  : "—"}
                              </td>
                              <td>
                                <div>{s?.raw_summary || "—"}</div>
                                {s?.error ? <div className="err">{s.error}</div> : null}
                              </td>
                              <td className="muted">{fmtTime(s?.checked_at)}</td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </>
  );
}
