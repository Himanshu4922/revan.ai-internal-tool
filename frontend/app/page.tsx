"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ThemeToggle } from "@/components/ThemeToggle";
import { api } from "@/lib/api";

export default function Home() {
  const router = useRouter();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    api
      .me()
      .then(() => router.replace("/dashboard"))
      .catch(() => setReady(true));
  }, [router]);

  if (!ready) {
    return <div className="shell-loading">Loading…</div>;
  }

  return (
    <div className="landing">
      <header className="landing-nav">
        <Link href="/" className="landing-brand">
          <span className="auth-logo-mark">AK</span>
          <span>Agni Key Monitor</span>
        </Link>
        <div className="landing-nav-actions">
          <ThemeToggle />
          <Link href="/login" className="landing-link">
            Sign in
          </Link>
          <Link href="/signup" className="btn primary">
            Start free
          </Link>
        </div>
      </header>

      <main className="landing-hero">
        <p className="landing-pill">Built for teams shipping AI products</p>
        <h1>
          The ultimate <span className="landing-accent">API key manager.</span>
        </h1>
        <p className="landing-lede">
          One dashboard to monitor providers, encrypted keys, credit balances, and project-wise
          spend — OpenAI, Anthropic, Gemini, and more.
        </p>
        <div className="landing-cta">
          <Link href="/signup" className="btn primary">
            Create your account
          </Link>
          <Link href="/login" className="btn">
            Sign in
          </Link>
        </div>
      </main>

      <section className="landing-preview">
        <div className="landing-preview-frame">
          <div className="landing-preview-bar">
            <span />
            <span />
            <span />
            <em>agni · dashboard / overview</em>
          </div>
          <div className="landing-preview-kpis">
            <div>
              <small>Providers</small>
              <strong>Track all</strong>
            </div>
            <div>
              <small>API keys</small>
              <strong>Encrypted</strong>
            </div>
            <div>
              <small>Credits</small>
              <strong>Live checks</strong>
            </div>
            <div>
              <small>Attention</small>
              <strong>Low &amp; exhausted</strong>
            </div>
          </div>
          <p className="landing-preview-note">
            After you sign in: overview KPIs, provider breakdown, projects, and key management —
            powered by real credit checks, not mock data.
          </p>
        </div>
      </section>

      <section className="landing-features">
        <article>
          <h3>Unified dashboard</h3>
          <p>See status, balance, and spend across every connected provider and project.</p>
        </article>
        <article>
          <h3>Encrypted keys</h3>
          <p>Secrets stay encrypted at rest. The UI only ever shows a short hint.</p>
        </article>
        <article>
          <h3>Credit alerts</h3>
          <p>Low and exhausted keys can notify your team via WhatsApp and calling (server config).</p>
        </article>
      </section>

      <footer className="landing-footer">
        <span>Agni Key Monitor</span>
        <div>
          <Link href="/login">Sign in</Link>
          <Link href="/signup">Start free</Link>
        </div>
      </footer>
    </div>
  );
}
