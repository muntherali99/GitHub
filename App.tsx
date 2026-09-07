import { useState, useEffect } from "react";
import { Building2, ShieldCheck, Sparkles } from "lucide-react";
import type { AppConfig } from "./types";
import { request, configureAuth } from "./api";
import { Notice } from "./components/common";
import Public from "./pages/Public";
import Admin from "./pages/Admin";
export default function App() {
  const [config, setConfig] = useState<AppConfig | null>(null),
    [email, setEmail] = useState<string | null>(null),
    [error, setError] = useState("");
  useEffect(() => {
    let stop: (() => void) | undefined,
      cancelled = false;
    request<AppConfig>("/api/config")
      .then(async (c) => {
        if (cancelled) return;
        setConfig(c);
        const unsub = await configureAuth(c, setEmail);
        if (cancelled) unsub();
        else stop = unsub;
      })
      .catch((e) => setError(e.message));
    return () => {
      cancelled = true;
      stop?.();
    };
  }, []);
  const admin = location.pathname.startsWith("/admin");
  return (
    <>
      <header className="site-header">
        <a href="/" className="brand" aria-label="بورصة لبيب الرئيسية">
          <img src="/logo.svg" alt="لبيب الرياض" />
        </a>
        <div className="header-side">
          <span className="season-tag">بورصة لبيب</span>
          <a
            className="icon-button"
            href={admin ? "/" : "/admin"}
            aria-label={admin ? "العرض العام" : "دخول المشرفين"}
          >
            {admin ? <Building2 size={19} /> : <ShieldCheck size={20} />}
          </a>
        </div>
      </header>
      {config?.demo && (
        <div className="demo-banner">
          <Sparkles size={13} /> نسخة تجريبية · الأسماء والنتائج افتراضية
        </div>
      )}
      {error && <Notice error>{error}</Notice>}
      {config ? (
        admin ? (
          <Admin config={config} email={email} />
        ) : (
          <Public />
        )
      ) : (
        <main className="shell">
          <div className="loading-skeleton" />
          <p className="muted">جارٍ فتح البورصة…</p>
        </main>
      )}
      <footer className="site-footer">
        <span>لبيب الرياض</span>
        <span>الأسهم تحفيزية رمزية · كل تقدم يستحق التقدير</span>
      </footer>
    </>
  );
}
