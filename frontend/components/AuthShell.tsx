import Link from "next/link";
import type { ReactNode } from "react";
import { ThemeToggle } from "@/components/ThemeToggle";

export function AuthShell({
  title,
  subtitle,
  children,
  footer,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <div className="auth-page">
      <div className="auth-theme-corner">
        <ThemeToggle />
      </div>
      <div className="auth-top">
        <Link href="/" className="auth-logo" aria-label="Agni Key Monitor home">
          <span className="auth-logo-mark">AK</span>
        </Link>
        <h1 className="auth-product">Agni Key Monitor</h1>
        <p className="auth-tagline">Monitor API providers, credits, and encrypted keys</p>
      </div>

      <div className="auth-card">
        <h2 className="auth-card-title">{title}</h2>
        {subtitle ? <p className="auth-card-sub">{subtitle}</p> : null}
        {children}
      </div>

      {footer ? <div className="auth-footer">{footer}</div> : null}
    </div>
  );
}
