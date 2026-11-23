"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  EmptyState,
  Money,
  ProviderCell,
  RelativeTime,
  StatusBadge,
} from "@/components/widgets";
import { AdminSheet, DataSheet } from "@/components/DataSheet";
import { SheetSearch } from "@/components/SheetSearch";
import { Button } from "@/components/ui/button";
import { api, ProjectDashboard, User } from "@/lib/api";
import { groupByProvider } from "@/lib/dashboardStats";
import { TablePageSkeleton } from "@/components/Skeleton";

export default function ProvidersPage() {
  const [projects, setProjects] = useState<ProjectDashboard[]>([]);
  const [user, setUser] = useState<User | null>(null);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const [me, dash] = await Promise.all([api.me(), api.dashboard()]);
      setUser(me);
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

  const providers = useMemo(() => groupByProvider(projects), [projects]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return providers;
    return providers.filter((p) => p.provider.toLowerCase().includes(q));
  }, [providers, search]);

  function primaryStatus(p: (typeof providers)[0]) {
    if (p.exhausted > 0) return "exhausted";
    if (p.error > 0) return "error";
    if (p.low > 0) return "low";
    if (p.ok > 0) return "ok";
    return "unknown";
  }

  const countLabel =
    filtered.length === providers.length
      ? String(providers.length)
      : `${filtered.length} of ${providers.length}`;

  if (loading) return <TablePageSkeleton title="Providers" />;

  return (
    <AdminSheet>
      <DataSheet
        title="Providers"
        count={countLabel}
        toolbar={
          <>
            <SheetSearch
              value={search}
              onChange={setSearch}
              placeholder="Search providers"
              aria-label="Search providers"
            />
            {user?.role === "admin" ? (
              <Button size="sm" asChild>
                <Link href="/keys">Connect provider</Link>
              </Button>
            ) : null}
          </>
        }
      >
        {error ? <div className="err" style={{ margin: "0.75rem" }}>{error}</div> : null}

        {providers.length === 0 ? (
          <EmptyState
            title="No providers connected"
            action={
              user?.role === "admin" ? (
                <Button asChild>
                  <Link href="/keys">Add an API key</Link>
                </Button>
              ) : null
            }
          >
            Providers appear here once keys are attached to a project.
          </EmptyState>
        ) : filtered.length === 0 ? (
          <div className="px-4 py-16 text-center text-[13px] text-[var(--muted)]">
            No providers match this search.
          </div>
        ) : (
          <table className="sheet-table">
            <thead>
              <tr>
                <th>Provider</th>
                <th>Keys</th>
                <th>Status</th>
                <th>Balance</th>
                <th>Spend</th>
                <th>Last sync</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((p) => {
                const status = primaryStatus(p);
                return (
                  <tr key={p.provider}>
                    <td>
                      <ProviderCell
                        provider={p.provider}
                        subtitle={`${p.ok} ok · ${p.low} low · ${p.exhausted} exhausted`}
                      />
                    </td>
                    <td className="mono">{p.keyCount}</td>
                    <td>
                      <StatusBadge status={status} />
                    </td>
                    <td>
                      <Money amount={p.balanceSum} currency={p.balanceCurrency} />
                    </td>
                    <td>
                      <Money amount={p.spendSum} currency={p.spendCurrency} />
                    </td>
                    <td>
                      <RelativeTime iso={p.lastChecked} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </DataSheet>
    </AdminSheet>
  );
}
