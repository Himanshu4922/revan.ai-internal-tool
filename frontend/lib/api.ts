export type Role = "admin" | "viewer";

export type User = {
  id: string;
  email: string;
  role: Role;
};

export type ProjectEnv = "prod" | "staging" | "testing" | "other";

export type Project = {
  id: string;
  name: string;
  description?: string;
  created_at: string;
  updated_at: string;
};

export type ProjectMember = {
  id: string;
  project_id: string;
  name: string;
  email?: string;
  phone?: string;
  role_label?: string;
  created_at: string;
};

export type ProjectWithMembers = Project & { members: ProjectMember[] };

export type APIKey = {
  id: string;
  provider: string;
  label: string;
  project_id: string;
  project_name: string;
  project_env: ProjectEnv;
  key_hint: string;
  meta?: Record<string, unknown>;
  notes?: string;
  created_at: string;
  updated_at: string;
};

export type CreditSnapshot = {
  id: string;
  api_key_id: string;
  status: "ok" | "low" | "exhausted" | "error" | "unknown";
  balance?: number;
  currency?: string;
  spend_period?: string;
  spend_amount?: number;
  raw_summary?: string;
  error?: string;
  checked_at: string;
};

export type DashboardItem = {
  key: APIKey;
  snapshot?: CreditSnapshot;
};

export type ProjectDashboard = {
  project: Project;
  members: ProjectMember[];
  items: DashboardItem[];
  summary: {
    ok: number;
    low: number;
    exhausted: number;
    error: number;
    unknown: number;
    total: number;
  };
};

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    ...init,
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers || {}),
    },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error((data as { error?: string }).error || `HTTP ${res.status}`);
  }
  return data as T;
}

export const api = {
  login: (email: string, password: string) =>
    request<{ user: User; token: string }>("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    }),
  signup: (body: { email: string; password: string; company_name?: string }) =>
    request<{ user: User; token: string }>("/api/auth/signup", {
      method: "POST",
      body: JSON.stringify(body),
    }),
  logout: () => request<{ ok: boolean }>("/api/auth/logout", { method: "POST" }),
  me: () => request<User>("/api/auth/me"),
  dashboard: (projectId?: string) =>
    request<{ projects: ProjectDashboard[] }>(
      projectId ? `/api/dashboard?project_id=${encodeURIComponent(projectId)}` : "/api/dashboard"
    ),
  listProjects: () => request<{ items: ProjectWithMembers[] }>("/api/projects"),
  getProject: (id: string) =>
    request<{ project: Project; members: ProjectMember[] }>(`/api/projects/${id}`),
  createProject: (body: { name: string; description?: string }) =>
    request<Project>("/api/projects", { method: "POST", body: JSON.stringify(body) }),
  updateProject: (id: string, body: { name: string; description?: string }) =>
    request<Project>(`/api/projects/${id}`, { method: "PUT", body: JSON.stringify(body) }),
  deleteProject: (id: string) =>
    request<{ ok: boolean }>(`/api/projects/${id}`, { method: "DELETE" }),
  addMember: (projectId: string, body: Record<string, string>) =>
    request<ProjectMember>(`/api/projects/${projectId}/members`, {
      method: "POST",
      body: JSON.stringify(body),
    }),
  updateMember: (projectId: string, memberId: string, body: Record<string, string>) =>
    request<ProjectMember>(`/api/projects/${projectId}/members/${memberId}`, {
      method: "PUT",
      body: JSON.stringify(body),
    }),
  deleteMember: (projectId: string, memberId: string) =>
    request<{ ok: boolean }>(`/api/projects/${projectId}/members/${memberId}`, {
      method: "DELETE",
    }),
  checkProject: (id: string) =>
    request<{ ok: boolean }>(`/api/projects/${id}/check`, { method: "POST" }),
  listKeys: (projectId?: string) =>
    request<{ items: APIKey[] }>(
      projectId ? `/api/keys?project_id=${encodeURIComponent(projectId)}` : "/api/keys"
    ),
  createKey: (body: Record<string, unknown>) =>
    request<APIKey>("/api/keys", { method: "POST", body: JSON.stringify(body) }),
  updateKey: (id: string, body: Record<string, unknown>) =>
    request<APIKey>(`/api/keys/${id}`, { method: "PUT", body: JSON.stringify(body) }),
  deleteKey: (id: string) =>
    request<{ ok: boolean }>(`/api/keys/${id}`, { method: "DELETE" }),
  checkKey: (id: string) =>
    request<CreditSnapshot>(`/api/keys/${id}/check`, { method: "POST" }),
  checkAll: () =>
    request<{ ok: boolean }>("/api/keys/check-all", { method: "POST" }),
};
