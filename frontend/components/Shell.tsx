"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { api, User } from "@/lib/api";

export function Shell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    api
      .me()
      .then(setUser)
      .catch(() => router.replace("/login"));
  }, [router]);

  async function logout() {
    await api.logout().catch(() => undefined);
    router.replace("/login");
  }

  if (!user) {
    return <div className="shell muted">Loading…</div>;
  }

  return (
    <div className="shell">
      <header className="topbar">
        <div className="brand">Agni Key Monitor</div>
        <nav className="nav">
          <Link className={pathname === "/dashboard" ? "active" : ""} href="/dashboard">
            Dashboard
          </Link>
          <Link className={pathname === "/projects" ? "active" : ""} href="/projects">
            Projects
          </Link>
          {user.role === "admin" ? (
            <Link className={pathname === "/keys" ? "active" : ""} href="/keys">
              Keys
            </Link>
          ) : null}
          <span className="muted">
            {user.email} · {user.role}
          </span>
          <button className="btn" type="button" onClick={logout}>
            Log out
          </button>
        </nav>
      </header>
      {children}
    </div>
  );
}
