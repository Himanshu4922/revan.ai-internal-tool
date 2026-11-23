import type { CreditSnapshot, DashboardItem, ProjectDashboard } from "./api";

export type FlatRow = {
  projectId: string;
  projectName: string;
  key: DashboardItem["key"];
  snapshot?: CreditSnapshot;
  status: CreditSnapshot["status"] | "unknown";
};

export type ProviderStats = {
  provider: string;
  keyCount: number;
  ok: number;
  low: number;
  exhausted: number;
  error: number;
  unknown: number;
  balanceSum: number | null;
  balanceCurrency?: string;
  spendSum: number | null;
  spendCurrency?: string;
  lastChecked?: string;
};

export type ProjectSpend = {
  projectId: string;
  projectName: string;
  keyCount: number;
  spendSum: number | null;
  balanceSum: number | null;
  currency?: string;
  attention: number;
};

export type DashboardTotals = {
  providerCount: number;
  keyCount: number;
  balanceSum: number | null;
  balanceCurrency?: string;
  spendSum: number | null;
  spendCurrency?: string;
  attentionCount: number;
  ok: number;
  low: number;
  exhausted: number;
  error: number;
  unknown: number;
};

function isAttention(status: string) {
  return status === "low" || status === "exhausted" || status === "error";
}

export function flattenProjects(projects: ProjectDashboard[]): FlatRow[] {
  const rows: FlatRow[] = [];
  for (const pd of projects) {
    for (const item of pd.items || []) {
      rows.push({
        projectId: pd.project.id,
        projectName: pd.project.name,
        key: item.key,
        snapshot: item.snapshot,
        status: item.snapshot?.status || "unknown",
      });
    }
  }
  return rows;
}

export function computeTotals(projects: ProjectDashboard[]): DashboardTotals {
  const rows = flattenProjects(projects);
  const providers = new Set(rows.map((r) => r.key.provider.toLowerCase()));
  let balanceSum = 0;
  let balanceCount = 0;
  let balanceCurrency: string | undefined;
  let spendSum = 0;
  let spendCount = 0;
  let spendCurrency: string | undefined;
  let ok = 0;
  let low = 0;
  let exhausted = 0;
  let error = 0;
  let unknown = 0;
  let attentionCount = 0;

  for (const r of rows) {
    switch (r.status) {
      case "ok":
        ok++;
        break;
      case "low":
        low++;
        attentionCount++;
        break;
      case "exhausted":
        exhausted++;
        attentionCount++;
        break;
      case "error":
        error++;
        attentionCount++;
        break;
      default:
        unknown++;
    }
    if (r.snapshot?.balance != null) {
      balanceSum += r.snapshot.balance;
      balanceCount++;
      balanceCurrency = balanceCurrency || r.snapshot.currency;
    }
    if (r.snapshot?.spend_amount != null) {
      spendSum += r.snapshot.spend_amount;
      spendCount++;
      spendCurrency = spendCurrency || r.snapshot.currency;
    }
  }

  return {
    providerCount: providers.size,
    keyCount: rows.length,
    balanceSum: balanceCount > 0 ? balanceSum : null,
    balanceCurrency,
    spendSum: spendCount > 0 ? spendSum : null,
    spendCurrency,
    attentionCount,
    ok,
    low,
    exhausted,
    error,
    unknown,
  };
}

export function groupByProvider(projects: ProjectDashboard[]): ProviderStats[] {
  const map = new Map<string, ProviderStats>();
  for (const r of flattenProjects(projects)) {
    const name = r.key.provider;
    const key = name.toLowerCase();
    let g = map.get(key);
    if (!g) {
      g = {
        provider: name,
        keyCount: 0,
        ok: 0,
        low: 0,
        exhausted: 0,
        error: 0,
        unknown: 0,
        balanceSum: null,
        spendSum: null,
      };
      map.set(key, g);
    }
    g.keyCount++;
    switch (r.status) {
      case "ok":
        g.ok++;
        break;
      case "low":
        g.low++;
        break;
      case "exhausted":
        g.exhausted++;
        break;
      case "error":
        g.error++;
        break;
      default:
        g.unknown++;
    }
    if (r.snapshot?.balance != null) {
      g.balanceSum = (g.balanceSum ?? 0) + r.snapshot.balance;
      g.balanceCurrency = g.balanceCurrency || r.snapshot.currency;
    }
    if (r.snapshot?.spend_amount != null) {
      g.spendSum = (g.spendSum ?? 0) + r.snapshot.spend_amount;
      g.spendCurrency = g.spendCurrency || r.snapshot.currency;
    }
    const checked = r.snapshot?.checked_at;
    if (checked && (!g.lastChecked || checked > g.lastChecked)) {
      g.lastChecked = checked;
    }
  }
  return Array.from(map.values()).sort((a, b) => b.keyCount - a.keyCount);
}

export function groupByProject(projects: ProjectDashboard[]): ProjectSpend[] {
  return projects.map((pd) => {
    let spendSum: number | null = null;
    let balanceSum: number | null = null;
    let currency: string | undefined;
    let attention = 0;
    for (const item of pd.items || []) {
      const status = item.snapshot?.status || "unknown";
      if (isAttention(status)) attention++;
      if (item.snapshot?.spend_amount != null) {
        spendSum = (spendSum ?? 0) + item.snapshot.spend_amount;
        currency = currency || item.snapshot.currency;
      }
      if (item.snapshot?.balance != null) {
        balanceSum = (balanceSum ?? 0) + item.snapshot.balance;
        currency = currency || item.snapshot.currency;
      }
    }
    return {
      projectId: pd.project.id,
      projectName: pd.project.name,
      keyCount: pd.items?.length || 0,
      spendSum,
      balanceSum,
      currency,
      attention,
    };
  });
}

export function attentionRows(projects: ProjectDashboard[]): FlatRow[] {
  return flattenProjects(projects).filter((r) => isAttention(r.status));
}

export type ChartDatum = { label: string; value: number; color?: string };

const CHART_COLORS = ["#f97316", "#fb923c", "#22c55e", "#eab308", "#a855f7", "#f43f5e", "#06b6d4", "#84cc16"];

export function providerSpendChart(stats: ProviderStats[]): ChartDatum[] {
  return stats
    .filter((s) => s.spendSum != null && s.spendSum > 0)
    .map((s, i) => ({
      label: s.provider,
      value: s.spendSum as number,
      color: CHART_COLORS[i % CHART_COLORS.length],
    }));
}

export function providerKeyChart(stats: ProviderStats[]): ChartDatum[] {
  return stats.map((s, i) => ({
    label: s.provider,
    value: s.keyCount,
    color: CHART_COLORS[i % CHART_COLORS.length],
  }));
}

export function projectSpendChart(rows: ProjectSpend[]): ChartDatum[] {
  return rows
    .filter((r) => r.spendSum != null && r.spendSum > 0)
    .map((r, i) => ({
      label: r.projectName,
      value: r.spendSum as number,
      color: CHART_COLORS[i % CHART_COLORS.length],
    }));
}
