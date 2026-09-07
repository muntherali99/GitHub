import { useState, useCallback, useEffect, useRef } from "react";
import {
  ArrowRight,
  TrendingUp,
  Download,
  Sparkles,
  ShieldCheck,
  Building2,
  Trophy,
  RefreshCw,
  Search,
  X,
  Star,
  CheckCircle2,
  ClipboardList,
  ChevronLeft,
} from "lucide-react";
import { request } from "../api";
import type { Group, PublicData } from "../types";
import { GROUPS } from "../../shared/rules.mjs";
import { caps } from "../../shared/engine.mjs";
import {
  Notice,
  Movement,
  Trend,
  Stat,
  BalanceChart,
  achievement,
  number,
  signed,
  date,
  groupLabel,
} from "../components/common";
export default function Public() {
  const params = new URLSearchParams(location.search);
  const [group, setGroup] = useState<Group>(
      params.get("group") === "leaders" ? "leaders" : "cubs",
    ),
    [season, setSeason] = useState(params.get("season") || ""),
    [meeting, setMeeting] = useState(params.get("meeting") || "");
  const [data, setData] = useState<PublicData | null>(null),
    [error, setError] = useState(""),
    [search, setSearch] = useState(""),
    [loading, setLoading] = useState(true),
    [favorite, setFavorite] = useState(() => {
      try {
        return localStorage.getItem("labeeb-favorite") || "";
      } catch {
        return "";
      }
    });
  const sequence = useRef(0);
  const load = useCallback(async () => {
    const requestId = ++sequence.current;
    try {
      const query = new URLSearchParams({
        group,
        ...(season ? { season } : {}),
        ...(meeting ? { meeting } : {}),
      });
      const d = await request<PublicData>("/api/public?" + query);
      if (requestId !== sequence.current) return;
      setData(d);
      setError("");
    } catch (e) {
      if (requestId === sequence.current) setError((e as Error).message);
    } finally {
      if (requestId === sequence.current) setLoading(false);
    }
  }, [group, season, meeting]);
  useEffect(() => {
    setLoading(true);
    load();
    const timer = setInterval(() => {
      if (!document.hidden) load();
    }, 20000);
    return () => {
      clearInterval(timer);
      sequence.current++;
    };
  }, [load]);
  const selectGroup = (g: Group) => {
    setGroup(g);
    setMeeting("");
    setSearch("");
  };
  const toggleFavorite = (id: string) => {
    const next = favorite === id ? "" : id;
    setFavorite(next);
    try {
      localStorage.setItem("labeeb-favorite", next);
    } catch {
      /* التفضيل المحلي اختياري */
    }
  };
  const href = (id: string) =>
    "/company/" +
    encodeURIComponent(id) +
    "?" +
    new URLSearchParams({
      group,
      season: data?.seasonId || season,
      ...(meeting ? { meeting } : {}),
    });
  if (!data)
    return (
      <main className="shell">
        {error ? (
          <Notice error>
            {error}
            <button onClick={load}>إعادة المحاولة</button>
          </Notice>
        ) : (
          <div className="loading-skeleton" />
        )}
      </main>
    );
  const companyId = location.pathname.startsWith("/company/")
    ? decodeURIComponent(location.pathname.split("/")[2])
    : null;
  if (companyId) {
    const c = data.companies.find((c) => c.id === companyId);
    return (
      <main className="shell narrow">
        <a
          className="back-link"
          href={
            "/?" +
            new URLSearchParams({
              group,
              season: data.seasonId || "",
              ...(meeting ? { meeting } : {}),
            })
          }
        >
          <ArrowRight size={17} /> العودة للبورصة
        </a>
        {error && <Notice error>{error}</Notice>}
        {c ? (
          <>
            <div className="company-hero">
              <span className="eyebrow">ملف الشركة · {groupLabel(group)}</span>
              <h1>{c.name}</h1>
              <div className="huge-number">
                {number(c.balance)} <small>سهم</small>
              </div>
              <div className="company-badges">
                <span>المركز {number(c.rank)}</span>
                <Movement value={c.rankChange} />
              </div>
            </div>
            <div className="stats-grid">
              <Stat label="مكاسب أساسية" value={c.totalBase} />
              <Stat label="مكافآت التميز" value={c.totalBonus} />
              <Stat label="الخصم المطبق" value={c.totalPenalty} />
              <Stat label="رصيد البداية" value={100} />
            </div>
            <section className="panel">
              <div className="section-title">
                <h2>رحلة أسهمك</h2>
                <TrendingUp size={20} />
              </div>
              <BalanceChart company={c} />
              <div className="growth-row">
                <span>النمو منذ البداية</span>
                <strong dir="ltr">{signed(c.growth)}%</strong>
              </div>
              <div className="growth-row">
                <span>التغير عن اللقاء السابق</span>
                <Trend value={c.net} percent={c.percent} />
              </div>
            </section>
            <section className="panel">
              <h2>من أين جاءت أسهم اللقاء؟</h2>
              {c.breakdown.map((b, i) => (
                <div className="breakdown-row" key={i}>
                  <span>{b.label}</span>
                  <b className={b.value ? "positive" : "muted"} dir="ltr">
                    {b.value ? "+" + b.value : "0"} <small>/ {b.max}</small>
                  </b>
                </div>
              ))}
              <div className="breakdown-row">
                <span>مجموع الخصم المطبق</span>
                <b className="negative" dir="ltr">
                  {c.penalty ? -c.penalty : 0}
                </b>
              </div>
            </section>
            <section className="panel">
              <h2>سجل اللقاءات</h2>
              {[...c.history].reverse().map((h) => (
                <div className="history-row" key={h.meetingId}>
                  <span>
                    <b>{h.label}</b>
                    <small>{date(h.date)}</small>
                  </span>
                  <span>
                    <b>{number(h.balance)} سهم</b>
                    <Trend value={h.net} />
                  </span>
                </div>
              ))}
            </section>
            <button
              className="button gold wide"
              onClick={() =>
                achievement(c, group).catch((e) => setError(e.message))
              }
            >
              <Download size={18} /> تنزيل بطاقة الإنجاز
            </button>
          </>
        ) : (
          <Notice>الشركة غير موجودة ضمن نتائج اللقاء المحدد.</Notice>
        )}
      </main>
    );
  }
  const filtered = data.companies.filter((c) => c.name.includes(search.trim())),
    leader = data.companies[0],
    limit = caps(data.rules);
  return (
    <main className="shell">
      <section className="hero">
        <div className="hero-art" aria-hidden="true">
          <div />
          <div />
          <div />
          <div />
          <svg viewBox="0 0 300 130">
            <path
              d="M0 118 L50 103 L90 110 L140 62 L185 76 L238 28 L288 8"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            />
          </svg>
        </div>
        <span className="eyebrow">
          <span className="gold-dot" /> منصة الإنجاز والتميز
        </span>
        <h1>
          بورصة <em>لبيب</em>
        </h1>
        <p>استثمر في نفسك… وارفع أسهمك</p>
        <div className="hero-facts">
          <span>
            <b>100</b> سهم لبدايتك
          </span>
          <span>
            <b>{limit.base + limit.bonus}</b> سهم متاحة للقاء
          </span>
        </div>
      </section>
      <div className="market-tabs" role="tablist" aria-label="الفئة">
        {GROUPS.map((g) => (
          <button
            key={g.id}
            role="tab"
            aria-selected={group === g.id}
            className={group === g.id ? "active" : ""}
            onClick={() => selectGroup(g.id as Group)}
          >
            {g.id === "cubs" ? (
              <Sparkles size={17} />
            ) : (
              <ShieldCheck size={17} />
            )}
            بورصة {g.label}
          </button>
        ))}
      </div>
      <section className="market-controls">
        <label>
          الموسم
          <select
            value={season || data.seasonId || ""}
            onChange={(e) => {
              setSeason(e.target.value);
              setMeeting("");
            }}
          >
            {data.seasons.map((s) => (
              <option key={s.id} value={s.id}>
                {s.label}
              </option>
            ))}
          </select>
        </label>
        <label>
          النتائج
          <select value={meeting} onChange={(e) => setMeeting(e.target.value)}>
            <option value="">أحدث لقاء معتمد</option>
            {data.meetings.map((m) => (
              <option key={m.id} value={m.id}>
                {m.label}
              </option>
            ))}
          </select>
        </label>
      </section>
      {error && (
        <Notice error>
          {error} · النتائج الظاهرة آخر بيانات تم تحميلها.
          <button onClick={load}>إعادة الاتصال</button>
        </Notice>
      )}
      {data.setupRequired ? (
        <Notice>
          الموقع جاهز لربط البيانات. أكمل إعداد Firebase وفق دليل التشغيل.
        </Notice>
      ) : !leader ? (
        <section className="empty-state">
          <Building2 size={42} />
          <h2>البورصة تستعد للانطلاق</h2>
          <p>ستظهر الشركات والأرصدة هنا بعد اعتماد أول لقاء.</p>
        </section>
      ) : (
        <>
          <section className="leader-card">
            <div className="leader-top">
              <span className="eyebrow">في صدارة البورصة</span>
              <Trophy size={24} />
            </div>
            <div className="leader-main">
              <div>
                <h2>{leader.name}</h2>
                <span className="muted-light">
                  {data.companies.filter((c) => c.rank === 1).length > 1
                    ? "صدارة مشتركة"
                    : "بخطوات ثابتة نحو التميز"}
                </span>
              </div>
              <div className="leader-balance">
                <b>{number(leader.balance)}</b>
                <small>سهم</small>
              </div>
            </div>
            <div className="leader-bottom">
              <span>
                <TrendingUp size={15} /> نمو منذ البداية
              </span>
              <b dir="ltr">{signed(leader.growth)}%</b>
            </div>
          </section>
          <section className="ranking">
            <div className="section-title">
              <div>
                <span className="eyebrow muted">
                  {data.selectedMeeting
                    ? "حصاد " + data.selectedMeeting.label
                    : "رصيد الانطلاق"}
                </span>
                <h2>
                  الشركات المدرجة <small>{data.companies.length}</small>
                </h2>
              </div>
              <button
                className="icon-button"
                aria-label="تحديث النتائج"
                onClick={load}
              >
                <RefreshCw size={18} className={loading ? "spin" : ""} />
              </button>
            </div>
            <div className="search-box">
              <Search size={19} />
              <input
                aria-label="ابحث عن شركتك"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="ابحث عن شركتك…"
              />
              {search && (
                <button aria-label="مسح البحث" onClick={() => setSearch("")}>
                  <X size={17} />
                </button>
              )}
            </div>
            <div className="ranking-help">
              <span>الشركة / ترتيبها</span>
              <span>الرصيد / صافي اللقاء</span>
            </div>
            <div className="company-list">
              {filtered.map((c) => (
                <article
                  className={
                    "company-card " + (c.id === favorite ? "is-favorite" : "")
                  }
                  key={c.id}
                >
                  <div className={"rank-badge rank-" + c.rank}>
                    {c.rank === 1 ? <Trophy size={19} /> : number(c.rank)}
                  </div>
                  <a className="company-card-content" href={href(c.id)}>
                    <div className="company-name">
                      <h3>{c.name}</h3>
                      <Movement value={c.rankChange} />
                    </div>
                    <div className="company-numbers">
                      <b>
                        {number(c.balance)} <small>سهم</small>
                      </b>
                      <Trend value={c.net} />
                    </div>
                  </a>
                  <button
                    className="favorite-button"
                    aria-label={"تفضيل " + c.name}
                    aria-pressed={c.id === favorite}
                    onClick={() => toggleFavorite(c.id)}
                  >
                    <Star
                      size={17}
                      fill={c.id === favorite ? "currentColor" : "none"}
                    />
                  </button>
                </article>
              ))}
            </div>
            {!filtered.length && <Notice>لا توجد شركة مطابقة للبحث.</Notice>}
            <div className="last-update">
              <CheckCircle2 size={14} />
              <span>
                آخر اعتماد: {date(data.selectedMeeting?.publishedAt || null)} ·
                تُحدَّث النتائج بعد الاعتماد
              </span>
            </div>
          </section>
        </>
      )}
      <details className="rules-panel">
        <summary>
          <ClipboardList size={18} /> كيف تنمو أسهم شركتك؟{" "}
          <ChevronLeft size={17} />
        </summary>
        <div>
          <p>
            100 سهم لبدايتك، ثم مكاسب لقاءاتك ومكافآتك، مع احتساب الخصومات
            المعتمدة.
          </p>
          {data.rules.criteria.map((c) => (
            <div className="breakdown-row" key={c.id}>
              <span>{c.label}</span>
              <b
                className={c.kind === "penalty" ? "negative" : "positive"}
                dir="ltr"
              >
                {c.kind === "penalty" ? "-" : "+"}
                {c.value}
              </b>
            </div>
          ))}
          <p className="muted">
            الخصومات بقرار موثق. وقد يتراجع ترتيبك رغم زيادة رصيدك إذا تقدمت
            شركات أخرى.
          </p>
        </div>
      </details>
      <p className="closing-line">
        شركتك تحمل اسمك، وأسهمك تنمو بالتزامك
        <br />
        ومشاركتك وإنجازك.
      </p>
    </main>
  );
}
