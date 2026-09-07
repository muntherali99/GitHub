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
export default function MeetingForm({
  data,
  group,
  season,
  act,
  busy,
}: {
  data: State;
  group: Group;
  season: string;
  act: Act;
  busy: boolean;
}) {
  const [label, setLabel] = useState(""),
    [day, setDay] = useState(""),
    [task, setTask] = useState(""),
    [due, setDue] = useState(""),
    [sport, setSport] = useState(true),
    [uniform, setUniform] = useState(true),
    [same, setSame] = useState(true),
    [assigned, setAssigned] = useState(true),
    [rule, setRule] = useState(data.rules.at(-1)!.id),
    [newSeason, setNewSeason] = useState("");
  return (
    <>
      <section className="panel">
        <h2>إنشاء لقاء</h2>
        <form
          className="form-stack"
          onSubmit={(e) => {
            e.preventDefault();
            act("meeting.create", {
              label,
              date: day,
              groupId: group,
              seasonId: season,
              ruleId: rule,
              requiresSport: sport,
              requiresUniform: uniform,
              uniformSame: same,
              taskAssigned: assigned,
              taskLabel: task,
              taskDue: assigned
                ? new Date(due + ":00+03:00").toISOString()
                : null,
            })
              .then(() => {
                setLabel("");
                setDay("");
              })
              .catch(() => {});
          }}
        >
          <label>
            اسم اللقاء
            <input
              required
              minLength={3}
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="مثل: جسور المعرفة"
            />
          </label>
          <label>
            تاريخ اللقاء
            <input
              type="date"
              required
              value={day}
              onChange={(e) => setDay(e.target.value)}
            />
          </label>
          <label>
            نسخة المعايير
            <select value={rule} onChange={(e) => setRule(e.target.value)}>
              {data.rules.map((r) => (
                <option value={r.id} key={r.id}>
                  {r.label}
                </option>
              ))}
            </select>
          </label>
          {[
            [sport, setSport, "يتضمن نشاطًا رياضيًا"],
            [uniform, setUniform, "الزي مطلوب"],
            [same, setSame, "الزي المطلوب هو الزي الرياضي نفسه"],
            [assigned, setAssigned, "توجد مهمة أسبوعية"],
          ].map(([checked, set, text], i) => (
            <label className="checkbox-line" key={i}>
              <input
                type="checkbox"
                checked={checked as boolean}
                onChange={(e) =>
                  (set as (value: boolean) => void)(e.target.checked)
                }
              />
              {text as string}
            </label>
          ))}
          {assigned && (
            <>
              <label>
                المهمة
                <input
                  required
                  value={task}
                  onChange={(e) => setTask(e.target.value)}
                />
              </label>
              <label>
                موعد التسليم بتوقيت الرياض
                <input
                  type="datetime-local"
                  required
                  value={due}
                  onChange={(e) => setDue(e.target.value)}
                />
              </label>
            </>
          )}
          <button className="button gold" disabled={busy}>
            <Plus size={17} /> إنشاء اللقاء
          </button>
        </form>
      </section>
      <section className="panel">
        <h2>موسم جديد</h2>
        <p className="muted">
          لكل موسم شركات وأرصدة مستقلة. تبقى نتائج المواسم السابقة محفوظة.
        </p>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            act("season.create", { label: newSeason })
              .then(() => setNewSeason(""))
              .catch(() => {});
          }}
        >
          <label className="field">
            اسم الموسم
            <input
              required
              minLength={3}
              value={newSeason}
              onChange={(e) => setNewSeason(e.target.value)}
            />
          </label>
          <button className="button subtle" disabled={busy}>
            إضافة الموسم
          </button>
        </form>
      </section>
    </>
  );
}
