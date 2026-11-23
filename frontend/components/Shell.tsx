"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { ThemeToggle } from "@/components/ThemeToggle";
import { api, User } from "@/lib/api";

type NavItem = {
  href: string;
  label: string;
  adminOnly?: boolean;
  icon: "dash" | "providers" | "keys" | "projects" | "usage" | "settings";
};

type NavGroup = { label: string; items: NavItem[] };

const NAV_GROUPS: NavGroup[] = [
  {
    label: "Platform",
    items: [
      { href: "/dashboard", label: "Dashboard", icon: "dash" },
      { href: "/providers", label: "Providers", icon: "providers" },
      { href: "/usage", label: "Usage", icon: "usage" },
    ],
  },
  {
    label: "Manage",
    items: [
      { href: "/keys", label: "API Keys", icon: "keys", adminOnly: true },
      { href: "/projects", label: "Projects", icon: "projects" },
    ],
  },
  {
    label: "Account",
    items: [{ href: "/settings", label: "Settings", icon: "settings" }],
  },
];

const COLLAPSE_KEY = "keymon-sidebar-collapsed";

function NavIcon({ name }: { name: NavItem["icon"] }) {
  const common = {
    width: 16,
    height: 16,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.75,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    "aria-hidden": true,
  };
  switch (name) {
    case "dash":
      return (
        <svg {...common}>
          <rect x="3" y="3" width="7" height="9" rx="1.5" />
          <rect x="14" y="3" width="7" height="5" rx="1.5" />
          <rect x="14" y="12" width="7" height="9" rx="1.5" />
          <rect x="3" y="16" width="7" height="5" rx="1.5" />
        </svg>
      );
    case "providers":
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="3" />
          <path d="M12 2v3M12 19v3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M2 12h3M19 12h3M4.9 19.1 7 17M17 7l2.1-2.1" />
        </svg>
      );
    case "keys":
      return (
        <svg {...common}>
          <circle cx="8" cy="15" r="4" />
          <path d="M11.5 12.5 20 4l2 2-2 2 2 2-2.5 1.5L17 9.5" />
        </svg>
      );
    case "projects":
      return (
        <svg {...common}>
          <path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2Z" />
        </svg>
      );
    case "usage":
      return (
        <svg {...common}>
          <path d="M4 19V5M4 19h16" />
          <path d="M8 15v-4M12 15V8M16 15v-7" />
        </svg>
      );
    case "settings":
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="3" />
          <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9c.3.6.9 1 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1Z" />
        </svg>
      );
  }
}

function CollapseIcon({ collapsed }: { collapsed: boolean }) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
      <rect x="3" y="4" width="18" height="16" rx="2" stroke="currentColor" strokeWidth="1.75" />
      <path d={collapsed ? "M9 12h8M14 9l3 3-3 3" : "M15 12H7M10 9l-3 3 3 3"} stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function Shell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [navOpen, setNavOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [userMenu, setUserMenu] = useState(false);

  useEffect(() => {
    api
      .me()
      .then(setUser)
      .catch(() => router.replace("/login"));
  }, [router]);

  useEffect(() => {
    try {
      setCollapsed(localStorage.getItem(COLLAPSE_KEY) === "1");
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    setNavOpen(false);
    setUserMenu(false);
  }, [pathname]);

  function toggleCollapsed() {
    setCollapsed((c) => {
      const next = !c;
      try {
        localStorage.setItem(COLLAPSE_KEY, next ? "1" : "0");
      } catch {
        /* ignore */
      }
      return next;
    });
  }

  async function logout() {
    setUserMenu(false);
    await api.logout().catch(() => undefined);
    router.replace("/login");
  }

  if (!user) {
    return <div className="shell-loading">Loading…</div>;
  }

  const initials = (user.email || "U").slice(0, 2).toUpperCase();

  return (
    <div
      className={`app-shell${navOpen ? " nav-open" : ""}${collapsed ? " sidebar-collapsed" : ""}`}
    >
      <div className="sidebar-backdrop" role="presentation" onClick={() => setNavOpen(false)} />
      <aside className={`sidebar${collapsed ? " collapsed" : ""}`} id="primary-nav" aria-label="Primary">
        <div className="sidebar-aura" aria-hidden />

        <div className="sidebar-brand">
          {collapsed ? (
            <button
              type="button"
              className="sidebar-icon-btn sidebar-brand-collapsed"
              onClick={toggleCollapsed}
              aria-label="Expand sidebar"
              title="Expand sidebar"
            >
              <span className="sidebar-brand-mark">AK</span>
            </button>
          ) : (
            <>
              <span className="sidebar-brand-mark">AK</span>
              <div className="sidebar-brand-copy">
                <div className="sidebar-brand-text">Agni Key Monitor</div>
                <span className="sidebar-brand-sub">API credits &amp; keys</span>
              </div>
              <button
                type="button"
                className="sidebar-icon-btn sidebar-collapse-btn"
                onClick={toggleCollapsed}
                aria-label="Collapse sidebar"
                title="Collapse sidebar"
              >
                <CollapseIcon collapsed={false} />
              </button>
            </>
          )}
          <button
            type="button"
            className="sidebar-icon-btn sidebar-close-mobile"
            onClick={() => setNavOpen(false)}
            aria-label="Close sidebar"
          >
            ×
          </button>
        </div>

        <nav className="sidebar-nav">
          {NAV_GROUPS.map((group) => {
            const items = group.items.filter(
              (n) => !n.adminOnly || user.role === "admin"
            );
            if (!items.length) return null;
            return (
              <div key={group.label} className="sidebar-group">
                {!collapsed ? <h3 className="sidebar-group-label">{group.label}</h3> : null}
                <ul>
                  {items.map((item) => {
                    const active =
                      pathname === item.href || pathname.startsWith(`${item.href}/`);
                    return (
                      <li key={item.href}>
                        <Link
                          href={item.href}
                          className={`sidebar-link${active ? " active" : ""}`}
                          title={collapsed ? item.label : undefined}
                          onClick={() => setNavOpen(false)}
                        >
                          <span className="sidebar-link-bar" aria-hidden />
                          <span className="sidebar-link-icon">
                            <NavIcon name={item.icon} />
                          </span>
                          {!collapsed ? <span className="sidebar-link-label">{item.label}</span> : null}
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </div>
            );
          })}
        </nav>

        <div className="sidebar-footer">
          <div className={`sidebar-footer-tools${collapsed ? " stacked" : ""}`}>
            <ThemeToggle />
            {!collapsed ? <span className="sidebar-theme-label">Theme</span> : null}
          </div>

          <div className="sidebar-user">
            <button
              type="button"
              className="sidebar-user-btn"
              onClick={() => setUserMenu((o) => !o)}
              aria-expanded={userMenu}
            >
              <span className="sidebar-avatar">{initials}</span>
              {!collapsed ? (
                <>
                  <span className="sidebar-user-meta">
                    <span className="sidebar-user-email">{user.email}</span>
                    <span className="sidebar-user-role">{user.role}</span>
                  </span>
                  <span className={`sidebar-chevron${userMenu ? " open" : ""}`} aria-hidden>
                    ▾
                  </span>
                </>
              ) : null}
            </button>
            {userMenu ? (
              <div className={`sidebar-user-menu${collapsed ? " flyout" : ""}`}>
                <Link href="/settings" className="sidebar-user-menu-item" onClick={() => setUserMenu(false)}>
                  Settings
                </Link>
                <button type="button" className="sidebar-user-menu-item danger" onClick={logout}>
                  Log out
                </button>
              </div>
            ) : null}
          </div>
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
          <ThemeToggle />
        </div>
        {children}
      </div>
    </div>
  );
}
