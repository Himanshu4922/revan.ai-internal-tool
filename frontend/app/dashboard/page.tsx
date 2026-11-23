"use client";

import { useCallback, useEffect, useState } from "react";
import { Shell } from "@/components/Shell";
import { api, ProjectDashboard, ProjectWithMembers, User } from "@/lib/api";

function fmtMoney(n?: number, cur?: string) {
  if (n === undefined || n === null) return "—";
  return `${n.toLocaleString(undefined, { maximumFractionDigits: 4 })}${cur ? ` ${cur}` : ""}`;
}

function fmtTime(iso?: string) {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso;
  }
}

export default function DashboardPage() {
  const [projects, setProjects] = useState<ProjectDashboard[]>([]);
  const [allProjects, setAllProjects] = useState<ProjectWithMembers[]>([]);
  const [filter, setFilter] = useState("");
  const [user, setUser] = useState<User | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

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

  return (
    <Shell>
      <div className="toolbar">
        <div>
          <h1 style={{ margin: 0, fontSize: "1.25rem" }}>Credit dashboard</h1>
          <p className="muted" style={{ margin: "0.25rem 0 0" }}>
            Project-wise status, env, team, and spend
          </p>
        </div>
        <div className="row-actions">
          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            style={{
              background: "#0c1117",
              border: "1px solid var(--border)",
              color: "var(--text)",
              borderRadius: 6,
              padding: "0.45rem 0.7rem",
            }}
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
        </div>
      </div>
      {error ? <div className="err">{error}</div> : null}

      {projects.length === 0 ? (
        <div className="panel muted">No projects yet. Admin can create them on the Projects page.</div>
      ) : (
        projects.map((pd) => (
          <div key={pd.project.id} className="panel" style={{ marginBottom: "1.25rem" }}>
            <div className="toolbar" style={{ marginBottom: "0.75rem" }}>
              <div>
                <h2 style={{ margin: 0, fontSize: "1.05rem" }}>{pd.project.name}</h2>
                <p className="muted" style={{ margin: "0.2rem 0 0" }}>
                  {pd.project.description || "No description"}
                </p>
                <p className="muted" style={{ margin: "0.35rem 0 0" }}>
                  Team:{" "}
                  {pd.members.length
                    ? pd.members
                        .map((m) => `${m.name}${m.role_label ? ` (${m.role_label})` : ""}`)
                        .join(", ")
                    : "none assigned"}
                </p>
              </div>
              <div className="muted" style={{ textAlign: "right", fontSize: "0.85rem" }}>
                <div>
                  {pd.summary.total} keys · ok {pd.summary.ok} · low {pd.summary.low} · exhausted{" "}
                  {pd.summary.exhausted} · error {pd.summary.error}
                </div>
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
                            <div>{row.key.provider}</div>
                            <div className="muted">{row.key.label || `…${row.key.key_hint}`}</div>
                          </td>
                          <td>{row.key.project_env}</td>
                          <td>
                            <span className={`badge ${status}`}>{status}</span>
                          </td>
                          <td className="mono">{fmtMoney(s?.balance, s?.currency)}</td>
                          <td className="mono">
                            {s?.spend_amount != null
                              ? `${fmtMoney(s.spend_amount, s.currency)}${s.spend_period ? ` (${s.spend_period})` : ""}`
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
        ))
      )}
    </Shell>
  );
}
