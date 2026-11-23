"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { api, User } from "@/lib/api";

const NAV = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/providers", label: "Providers" },
  { href: "/keys", label: "API Keys", adminOnly: true },
  { href: "/projects", label: "Projects" },
  { href: "/usage", label: "Usage" },
  { href: "/settings", label: "Settings" },
] as const;

export function Shell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [navOpen, setNavOpen] = useState(false);

  useEffect(() => {
    api
      .me()
      .then(setUser)
      .catch(() => router.replace("/login"));
  }, [router]);

  useEffect(() => {
    setNavOpen(false);
  }, [pathname]);

  async function logout() {
    await api.logout().catch(() => undefined);
    router.replace("/login");
  }

  if (!user) {
    return <div className="shell-loading">Loading…</div>;
  }

  const links = NAV.filter((n) => !("adminOnly" in n && n.adminOnly) || user.role === "admin");

  return (
    <div className={`app-shell${navOpen ? " nav-open" : ""}`}>
      <div
        className="sidebar-backdrop"
        role="presentation"
        onClick={() => setNavOpen(false)}
      />
      <aside className="sidebar" id="primary-nav" aria-label="Primary">
        <div className="sidebar-brand">
          <span className="sidebar-brand-mark">AK</span>
          <div>
            <div className="sidebar-brand-text">Agni Key Monitor</div>
            <span className="sidebar-brand-sub">API credits & keys</span>
          </div>
        </div>
        <nav className="sidebar-nav">
          {links.map((item) => {
            const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
            return (
              <Link key={item.href} href={item.href} className={active ? "active" : ""}>
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="sidebar-footer">
          <div className="user-chip">
            <div className="user-chip-email">{user.email}</div>
            <div className="user-chip-role">{user.role}</div>
          </div>
          <button className="btn" type="button" onClick={logout}>
            Log out
          </button>
        </div>
      </aside>
      <div className="main">
        <div className="mobile-bar">
          <button
            className="btn"
            type="button"
            aria-expanded={navOpen}
            aria-controls="primary-nav"
            onClick={() => setNavOpen((o) => !o)}
          >
            Menu
          </button>
          <strong style={{ fontSize: "0.95rem" }}>Agni Key Monitor</strong>
        </div>
        {children}
      </div>
    </div>
  );
}
