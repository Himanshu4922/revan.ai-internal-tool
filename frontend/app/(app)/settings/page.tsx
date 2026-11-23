"use client";

import { useCallback, useEffect, useState } from "react";
import { PageHeader } from "@/components/ui";
import { AdminPad } from "@/components/DataSheet";
import { api, User } from "@/lib/api";
import { SettingsSkeleton } from "@/components/Skeleton";

export default function SettingsPage() {
  const [user, setUser] = useState<User | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const me = await api.me();
      setUser(me);
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

  if (loading) return <SettingsSkeleton />;

  return (
    <AdminPad>
      <PageHeader
        title="Settings"
        description="Account details and how monitoring is configured for this deployment."
      />

      {error ? <div className="err">{error}</div> : null}

      <div className="stack">
        <div className="card">
          <h2 className="card-title">Account</h2>
          <p className="card-sub" style={{ marginBottom: "1rem" }}>
            Signed-in identity for this session
          </p>
          <div className="form-grid">
            <div className="field">
              <label>Email</label>
              <input value={user?.email || "—"} readOnly />
            </div>
            <div className="field">
              <label>Role</label>
              <input value={user?.role || "—"} readOnly />
            </div>
          </div>
          <p className="muted" style={{ margin: 0 }}>
            Accounts are created from server env (<code className="mono">ADMIN_*</code> /{" "}
            <code className="mono">VIEWER_*</code>). Password reset is not available in this build.
          </p>
        </div>

        <div className="card">
          <h2 className="card-title">Security</h2>
          <p className="card-sub" style={{ marginBottom: "0.75rem" }}>
            API secrets are encrypted at rest (AES) and never returned to the browser — only a short
            key hint is shown. Full plaintext reveal is not available by design.
          </p>
        </div>

        <div className="card">
          <h2 className="card-title">Monitoring & alerts</h2>
          <p className="card-sub" style={{ marginBottom: "0.75rem" }}>
            Check interval, low-credit threshold, cooldown, WhatsApp (local Periskope / WhatsAppX),
            and calling alerts are configured on the server via environment variables — not editable
            from this UI.
          </p>
          <ul className="muted" style={{ margin: 0, paddingLeft: "1.1rem", fontSize: "0.85rem" }}>
            <li>
              <code className="mono">CHECK_INTERVAL_MINUTES</code>,{" "}
              <code className="mono">ALERT_LOW_THRESHOLD</code>,{" "}
              <code className="mono">ALERT_COOLDOWN_HOURS</code>
            </li>
            <li>
              <code className="mono">WHATSAPPX_BASE_URL</code>,{" "}
              <code className="mono">WHATSAPPX_API_KEY</code>,{" "}
              <code className="mono">WHATSAPPX_TO</code>
            </li>
            <li>
              <code className="mono">CALLING_*</code> / <code className="mono">ALERT_CALL_*</code>
            </li>
          </ul>
        </div>
      </div>
    </AdminPad>
  );
}
