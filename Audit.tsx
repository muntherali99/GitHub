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
export default function Audit() {
  const [rows, setRows] = useState<
      {
        at: string;
        actor: string;
        action: string;
        revision: number;
        changes: unknown[];
      }[]
    >([]),
    [error, setError] = useState("");
  useEffect(() => {
    request<typeof rows>("/api/admin/audit")
      .then(setRows)
      .catch((e) => setError(e.message));
  }, []);
  const labels: Record<string, string> = {
    "draft.save": "حفظ الرصد",
    "meeting.publish": "نشر النتائج",
    "meeting.create": "إنشاء لقاء",
    "participant.upsert": "تعديل شركة",
    "participants.import": "استيراد شركات",
    "rules.create": "إصدار معايير",
    "role.upsert": "تعديل صلاحيات",
    "season.create": "إنشاء موسم",
  };
  return (
    <section className="panel">
      <h2>سجل التعديلات</h2>
      <p className="muted">آخر 80 عملية. يحتفظ الخادم بالسجل الكامل.</p>
      {error && <Notice error>{error}</Notice>}
      {rows.map((r, i) => (
        <details className="audit-row" key={i}>
          <summary>
            <b>{labels[r.action] || r.action}</b>
            <span>الإصدار {r.revision}</span>
          </summary>
          <p className="account-email" dir="ltr">
            {r.actor}
          </p>
          <small>
            {new Date(r.at).toLocaleString("ar-SA", {
              timeZone: "Asia/Riyadh",
            })}
          </small>
          <pre dir="ltr">{JSON.stringify(r.changes, null, 2)}</pre>
        </details>
      ))}
    </section>
  );
}
