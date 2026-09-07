import { useState, useCallback, useEffect } from "react";
import {
  LockKeyhole,
  ShieldCheck,
  ClipboardList,
  Building2,
  Plus,
  Settings2,
  Users,
  History as HistoryIcon,
  LogOut,
  Download,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { request, signIn, signOut, download } from "../api";
import type { AppConfig, State, Group } from "../types";
import { GROUPS } from "../../shared/rules.mjs";
import { Notice } from "../components/common";
import ScoreEditor from "../components/admin/ScoreEditor";
import People from "../components/admin/People";
import MeetingForm from "../components/admin/MeetingForm";
import RulesEditor from "../components/admin/RulesEditor";
import Team from "../components/admin/Team";
import Audit from "../components/admin/Audit";
export default function Admin({
  config,
  email,
}: {
  config: AppConfig;
  email: string | null;
}) {
  const [data, setData] = useState<State | null>(null),
    [error, setError] = useState(""),
    [notice, setNotice] = useState(""),
    [busy, setBusy] = useState(false),
    [tab, setTab] = useState("scores");
  const [group, setGroup] = useState<Group>("cubs"),
    [season, setSeason] = useState(""),
    [meetingId, setMeetingId] = useState("");
  const load = useCallback(async () => {
    try {
      const d = await request<State>("/api/admin");
      setData(d);
      setError("");
      if (d.actor.role === "supervisor" && !d.actor.groups.includes(group))
        setGroup(d.actor.groups[0] || "cubs");
    } catch (e) {
      setError((e as Error).message);
    }
  }, [group]);
  useEffect(() => {
    setData(null);
    if (email) load();
  }, [email]);
  async function act(action: string, payload: unknown, revision?: number) {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const next = await request<State>("/api/admin/action", {
        method: "POST",
        body: JSON.stringify({
          action,
          payload,
          expectedRevision: revision ?? data?.revision,
        }),
      });
      setData(next);
      setNotice(
        action === "meeting.publish"
          ? "اعتمدت النتائج وأصبحت متاحة للعرض."
          : "تم الحفظ بنجاح.",
      );
      return next;
    } catch (e) {
      setError((e as Error).message);
      throw e;
    } finally {
      setBusy(false);
    }
  }
  if (!email)
    return (
      <main className="shell narrow">
        <section className="login-panel">
          <div className="login-icon">
            <LockKeyhole size={30} />
          </div>
          <span className="eyebrow muted">لوحة المشرفين</span>
          <h1>أهلًا بصنّاع الأثر</h1>
          <p>سجّل الدخول لرصد الإنجاز ومراجعة النتائج.</p>
          {!config.configured && !config.demo && (
            <Notice>أكمل إعداد Firebase وبريد المالك في الخادم أولًا.</Notice>
          )}
          {error && <Notice error>{error}</Notice>}
          <button
            className="button gold wide"
            disabled={!config.configured && !config.demo}
            onClick={() => signIn(config).catch((e) => setError(e.message))}
          >
            {config.demo ? "دخول الإدارة التجريبية" : "الدخول بحساب Google"}
            <ShieldCheck size={18} />
          </button>
          <a className="back-link" href="/">
            العودة للعرض العام
          </a>
        </section>
      </main>
    );
  if (!data)
    return (
      <main className="shell narrow">
        {error ? (
          <Notice error>
            {error}
            <button onClick={load}>إعادة المحاولة</button>
          </Notice>
        ) : (
          <p>جارٍ تحميل لوحة الإدارة…</p>
        )}
        <button className="button subtle" onClick={() => signOut(config)}>
          تسجيل الخروج
        </button>
      </main>
    );
  const manager = data.actor.role === "manager",
    currentSeason = season || data.seasons.at(-1)?.id || "",
    meetings = data.meetings
      .filter((m) => m.groupId === group && m.seasonId === currentSeason)
      .sort((a, b) => a.date.localeCompare(b.date)),
    currentMeeting =
      meetings.find((m) => m.id === meetingId) || meetings.at(-1),
    people = data.participants.filter(
      (p) =>
        p.groupId === group &&
        p.seasonId === currentSeason &&
        (currentMeeting?.participantIds
          ? currentMeeting.participantIds.includes(p.id)
          : !p.archived),
    );
  const tabs: Array<[string, string, LucideIcon]> = [
    ["scores", "الرصد", ClipboardList],
  ];
  if (manager)
    tabs.push(
      ["people", "الشركات", Building2],
      ["meetings", "اللقاءات", Plus],
      ["rules", "المعايير", Settings2],
      ["team", "الفريق", Users],
      ["audit", "السجل", HistoryIcon],
    );
  return (
    <main className="shell admin-shell">
      <div className="admin-heading">
        <div>
          <span className="eyebrow muted">لوحة المشرفين</span>
          <h1>إدارة البورصة</h1>
          <p dir="ltr" className="muted account-email">
            {email}
          </p>
        </div>
        <button
          className="icon-button"
          aria-label="تسجيل الخروج"
          onClick={() => signOut(config)}
        >
          <LogOut size={18} />
        </button>
      </div>
      <div className="admin-tabs">
        {tabs.map(([id, label, Icon]) => (
          <button
            className={tab === id ? "active" : ""}
            onClick={() => setTab(id)}
            key={id}
          >
            <Icon size={17} />
            {label}
          </button>
        ))}
      </div>
      <div className="market-controls">
        <label>
          الفئة
          <select
            value={group}
            onChange={(e) => {
              setGroup(e.target.value as Group);
              setMeetingId("");
            }}
          >
            {GROUPS.filter(
              (g) => manager || data.actor.groups.includes(g.id as Group),
            ).map((g) => (
              <option key={g.id} value={g.id}>
                {g.label}
              </option>
            ))}
          </select>
        </label>
        <label>
          الموسم
          <select
            value={currentSeason}
            onChange={(e) => {
              setSeason(e.target.value);
              setMeetingId("");
            }}
          >
            {data.seasons.map((s) => (
              <option key={s.id} value={s.id}>
                {s.label}
              </option>
            ))}
          </select>
        </label>
      </div>
      {error && (
        <Notice error>
          {error}
          <button onClick={load}>تحميل أحدث البيانات</button>
        </Notice>
      )}
      {notice && <Notice>{notice}</Notice>}
      {tab === "scores" && (
        <>
          <label className="field">
            اللقاء
            <select
              value={currentMeeting?.id || ""}
              onChange={(e) => setMeetingId(e.target.value)}
            >
              {meetings.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.label} · {m.publishedRevision ? "منشور" : "مسودة"}
                </option>
              ))}
            </select>
          </label>
          {currentMeeting ? (
            <ScoreEditor
              key={currentMeeting.id + "-" + data.revision}
              data={data}
              meetingId={currentMeeting.id}
              people={people}
              busy={busy}
              act={act}
            />
          ) : (
            <Notice>أنشئ لقاءً وأضف المشاركين لبدء الرصد.</Notice>
          )}
        </>
      )}
      {tab === "people" && (
        <People
          data={data}
          group={group}
          season={currentSeason}
          act={act}
          busy={busy}
        />
      )}
      {tab === "meetings" && (
        <MeetingForm
          data={data}
          group={group}
          season={currentSeason}
          act={act}
          busy={busy}
        />
      )}
      {tab === "rules" && (
        <RulesEditor rules={data.rules.at(-1)!} act={act} busy={busy} />
      )}
      {tab === "team" && <Team data={data} act={act} busy={busy} />}
      {tab === "audit" && <Audit />}
      {manager && (
        <div className="admin-footer">
          <button
            className="button subtle"
            onClick={async () => {
              try {
                const backup = await request<unknown>("/api/admin/backup");
                download(
                  "labeeb-backup.json",
                  JSON.stringify(backup, null, 2),
                  "application/json",
                );
              } catch (e) {
                setError((e as Error).message);
              }
            }}
          >
            <Download size={16} /> نسخة احتياطية JSON
          </button>
          <span className="muted">الإصدار {data.revision}</span>
        </div>
      )}
    </main>
  );
}
