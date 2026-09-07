import { useState, useEffect } from "react";
import { Plus, Save, Send, Download } from "lucide-react";
import type {
  State,
  Group,
  RecordData,
  Rules,
  Criterion,
  Act,
} from "../../types";
import { request, download, csvExport, parseCSV } from "../../api";
import { GROUPS } from "../../../shared/rules.mjs";
import { calculate, blankRecord, caps } from "../../../shared/engine.mjs";
import { Notice, Stat, groupLabel } from "../common";
export default function ScoreEditor({
  data,
  meetingId,
  people,
  busy,
  act,
}: {
  data: State;
  meetingId: string;
  people: State["participants"];
  busy: boolean;
  act: Act;
}) {
  const meeting = data.meetings.find((m) => m.id === meetingId)!,
    rules = data.rules.find((r) => r.id === meeting.ruleId)!;
  const [records, setRecords] = useState<Record<string, RecordData>>(() =>
      Object.fromEntries(
        people.map((p) => [
          p.id,
          structuredClone(
            data.drafts.find(
              (r) => r.meetingId === meetingId && r.participantId === p.id,
            ) || blankRecord(rules),
          ),
        ]),
      ),
    ),
    [personId, setPersonId] = useState(people[0]?.id || ""),
    [reason, setReason] = useState("");
  const r = records[personId],
    person = people.find((p) => p.id === personId);
  function change(id: string, value: string) {
    setRecords((prev) => ({
      ...prev,
      [personId]: {
        ...prev[personId],
        statuses: { ...prev[personId].statuses, [id]: value },
      },
    }));
  }
  function setCriterionReason(id: string, value: string) {
    setRecords((prev) => ({
      ...prev,
      [personId]: {
        ...prev[personId],
        reasons: { ...prev[personId].reasons, [id]: value },
      },
    }));
  }
  function bulk(id: string) {
    setRecords((prev) =>
      Object.fromEntries(
        Object.entries(prev).map(([pid, row]) => [
          pid,
          {
            ...row,
            statuses: {
              ...row.statuses,
              ...(id === "attendance" || row.statuses.attendance === "earned"
                ? { [id]: "earned" }
                : {}),
            },
          },
        ]),
      ),
    );
  }
  async function save(publish = false) {
    const next = await act("draft.save", {
      meetingId,
      records: Object.entries(records).map(([participantId, row]) => ({
        ...row,
        participantId,
      })),
    });
    if (publish)
      await act("meeting.publish", { meetingId, reason }, next.revision);
  }
  const publishedRules = data.rules;
  let previous = 100;
  for (const m of data.meetings
    .filter(
      (m) =>
        m.seasonId === meeting.seasonId &&
        m.groupId === meeting.groupId &&
        m.date < meeting.date &&
        m.publishedRevision,
    )
    .sort((a, b) => a.date.localeCompare(b.date))) {
    const row = data.published.find(
      (v) => v.meetingId === m.id && v.participantId === personId,
    );
    if (row)
      previous = calculate(
        previous,
        row,
        publishedRules.find((v) => v.id === m.ruleId)!,
      ).balance;
  }
  const preview = r ? calculate(previous, r, rules) : null;
  return (
    <>
      <div className="panel meeting-note">
        <span className="status-chip">
          {meeting.publishedRevision ? "تصحيح نتائج منشورة" : "رصد مسودة"}
        </span>
        <p>
          {meeting.taskAssigned
            ? "المهمة: " + meeting.taskLabel
            : "لا توجد مهمة لهذا اللقاء"}
        </p>
        {meeting.taskDue && (
          <small>
            آخر تسليم:{" "}
            {new Date(meeting.taskDue).toLocaleString("ar-SA", {
              timeZone: "Asia/Riyadh",
              calendar: "gregory",
            })}
          </small>
        )}
        <small>{rules.label} · الرصيد لا يتغير للعامة قبل النشر</small>
      </div>
      <div className="bulk-actions">
        <button
          className="button subtle"
          onClick={() => bulk("attendance")}
          disabled={busy}
        >
          رصد الحضور للجميع
        </button>
        <button
          className="button subtle"
          onClick={() => bulk("uniform")}
          disabled={busy || !meeting.requiresUniform}
        >
          رصد الزي للحاضرين
        </button>
      </div>
      <label className="field">
        الشركة
        <select value={personId} onChange={(e) => setPersonId(e.target.value)}>
          {people.map((p) => (
            <option value={p.id} key={p.id}>
              {p.displayName}
            </option>
          ))}
        </select>
      </label>
      {r && person ? (
        <>
          <section className="panel score-form">
            <div className="section-title">
              <h2>{person.displayName}</h2>
              <span className="muted">
                {people.indexOf(person) + 1} / {people.length}
              </span>
            </div>
            {["base", "bonus", "penalty"].map((kind) => (
              <fieldset key={kind}>
                <legend>
                  {kind === "base"
                    ? "البنود الأساسية"
                    : kind === "bonus"
                      ? "أوسمة التميز"
                      : "الخصومات"}
                </legend>
                {rules.criteria
                  .filter((c) => c.kind === kind)
                  .map((c) => (
                    <div className="score-item" key={c.id}>
                      <label htmlFor={"score-" + c.id}>
                        {c.label}
                        <b
                          className={
                            kind === "penalty" ? "negative" : "positive"
                          }
                          dir="ltr"
                        >
                          {kind === "penalty" ? "-" : "+"}
                          {c.value}
                        </b>
                      </label>
                      <select
                        id={"score-" + c.id}
                        value={r.statuses[c.id] || ""}
                        onChange={(e) => change(c.id, e.target.value)}
                      >
                        {kind === "base" ? (
                          <>
                            <option value="">لم يُرصد</option>
                            <option value="earned">مستحق</option>
                            <option value="missed">لم يتحقق</option>
                            <option value="excused">معذور</option>
                            <option value="na">غير منطبق</option>
                          </>
                        ) : (
                          <>
                            <option value="off">لم يُطبق</option>
                            <option
                              value={kind === "bonus" ? "earned" : "applied"}
                            >
                              {kind === "bonus" ? "منح الوسام" : "تطبيق الخصم"}
                            </option>
                          </>
                        )}
                      </select>
                      {kind !== "base" &&
                        ["earned", "applied"].includes(r.statuses[c.id]) && (
                          <textarea
                            aria-label={"سبب " + c.label}
                            placeholder="سبب داخلي واضح للمشرفين فقط"
                            value={r.reasons[c.id] || ""}
                            onChange={(e) =>
                              setCriterionReason(c.id, e.target.value)
                            }
                          />
                        )}
                    </div>
                  ))}
              </fieldset>
            ))}
          </section>
          <section className="panel">
            <h2>ملخص الرصيد المتوقع</h2>
            <div className="stats-grid">
              <Stat label="السابق" value={previous} />
              <Stat label="الأساسي" value={preview!.base} />
              <Stat label="التميز" value={preview!.bonus} />
              <Stat label="الخصم المطبق" value={preview!.penalty} />
            </div>
            <div className="preview-total">
              <span>الرصيد المتوقع بعد النشر</span>
              <b>
                {preview!.balance} <small>سهم</small>
              </b>
            </div>
            {preview!.unappliedPenalty > 0 && (
              <Notice>
                خصم غير مطبق بسبب بلوغ الصفر: {preview!.unappliedPenalty} سهم.
              </Notice>
            )}
          </section>
          {data.actor.role === "manager" && meeting.publishedRevision > 0 && (
            <label className="field">
              سبب تصحيح النتائج
              <textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="اكتب سبب التصحيح قبل إعادة النشر"
              />
            </label>
          )}
          <div className="sticky-actions">
            <button
              className="button subtle"
              disabled={busy}
              onClick={() => save().catch(() => {})}
            >
              <Save size={17} /> حفظ المسودة
            </button>
            {data.actor.role === "manager" && (
              <button
                className="button gold"
                disabled={busy}
                onClick={() => save(true).catch(() => {})}
              >
                <Send size={17} /> اعتماد ونشر
              </button>
            )}
          </div>
        </>
      ) : (
        <Notice>لا يوجد مشاركون نشطون لهذا اللقاء.</Notice>
      )}
    </>
  );
}
