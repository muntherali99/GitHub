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
import { request, download, csvExport, parseCSV } from "./api";
import { GROUPS } from "./rules.mjs";
import { calculate, blankRecord, caps } from "./engine.mjs";
import { Notice, Stat, groupLabel } from "./common";
export default function Team({
  data,
  act,
  busy,
}: {
  data: State;
  act: Act;
  busy: boolean;
}) {
  const [email, setEmail] = useState(""),
    [role, setRole] = useState("supervisor"),
    [groups, setGroups] = useState<Group[]>(["cubs"]);
  return (
    <section className="panel">
      <h2>حسابات المشرفين</h2>
      <p className="muted">
        أضف بريد حساب Google الذي سيستخدمه المشرف. حساب المالك يحدد من إعدادات
        الخادم.
      </p>
      <form
        className="form-stack"
        onSubmit={(e) => {
          e.preventDefault();
          act("role.upsert", { email, role, groups })
            .then(() => setEmail(""))
            .catch(() => {});
        }}
      >
        <label>
          البريد الإلكتروني
          <input
            type="email"
            required
            dir="ltr"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </label>
        <label>
          الصلاحية
          <select value={role} onChange={(e) => setRole(e.target.value)}>
            <option value="supervisor">مشرف رصد</option>
            <option value="manager">مدير البرنامج</option>
            <option value="disabled">إيقاف الوصول</option>
          </select>
        </label>
        <div className="button-row">
          {GROUPS.map((g) => (
            <label className="checkbox-line" key={g.id}>
              <input
                type="checkbox"
                checked={groups.includes(g.id as Group)}
                onChange={(e) =>
                  setGroups((prev) =>
                    e.target.checked
                      ? [...prev, g.id as Group]
                      : prev.filter((v) => v !== g.id),
                  )
                }
              />
              {g.label}
            </label>
          ))}
        </div>
        <button className="button gold" disabled={busy}>
          حفظ صلاحية الحساب
        </button>
      </form>
      {data.roles.map((r) => (
        <div className="manage-row" key={r.id}>
          <span className="account-email" dir="ltr">
            {r.email}
          </span>
          <small>
            {r.role === "manager"
              ? "مدير"
              : r.role === "disabled"
                ? "موقوف"
                : "مشرف"}
          </small>
        </div>
      ))}
    </section>
  );
}
