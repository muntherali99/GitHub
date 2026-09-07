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
export default function RulesEditor({
  rules,
  act,
  busy,
}: {
  rules: Rules;
  act: Act;
  busy: boolean;
}) {
  const [criteria, setCriteria] = useState<Criterion[]>(() =>
      structuredClone(rules.criteria),
    ),
    [label, setLabel] = useState("");
  const totals = caps({ criteria });
  return (
    <section className="panel">
      <h2>تطوير بنود البورصة</h2>
      <p className="muted">
        احفظ نسخة جديدة، ثم اخترها عند إنشاء اللقاء القادم. اللقاءات السابقة
        تحتفظ بمعاييرها.
      </p>
      <label className="field">
        اسم الإصدار
        <input
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          placeholder="مثل: المعايير المطورة · الإصدار 2"
        />
      </label>
      {criteria.map((c, i) => (
        <div className="rule-editor" key={c.id}>
          <label>
            البند
            <input
              aria-label={"اسم البند " + (i + 1)}
              value={c.label}
              onChange={(e) =>
                setCriteria((prev) =>
                  prev.map((x, j) =>
                    j === i ? { ...x, label: e.target.value } : x,
                  ),
                )
              }
            />
          </label>
          <label>
            الأسهم
            <input
              aria-label={"قيمة " + c.label}
              type="number"
              min="1"
              max="100"
              value={c.value}
              onChange={(e) =>
                setCriteria((prev) =>
                  prev.map((x, j) =>
                    j === i ? { ...x, value: Number(e.target.value) } : x,
                  ),
                )
              }
            />
          </label>
          <small>
            {c.kind === "base"
              ? "أساسي"
              : c.kind === "bonus"
                ? "مكافأة"
                : "خصم"}{" "}
            · {c.id}
          </small>
        </div>
      ))}
      <div className="button-row">
        {(["base", "bonus", "penalty"] as const).map((kind) => (
          <button
            className="button subtle"
            key={kind}
            onClick={() =>
              setCriteria((prev) => [
                ...prev,
                {
                  id: "custom-" + crypto.randomUUID().slice(0, 8),
                  label: "بند جديد",
                  kind,
                  value: 5,
                },
              ])
            }
          >
            <Plus size={15} />
            {kind === "base"
              ? "بند أساسي"
              : kind === "bonus"
                ? "مكافأة"
                : "خصم"}
          </button>
        ))}
      </div>
      <Notice>
        الحدود الجديدة: أساسي {totals.base} · مكافآت {totals.bonus} · خصومات{" "}
        {totals.penalty}
      </Notice>
      <button
        className="button gold"
        disabled={busy || label.trim().length < 3}
        onClick={() =>
          act("rules.create", { label, criteria })
            .then(() => setLabel(""))
            .catch(() => {})
        }
      >
        <Save size={16} /> حفظ إصدار جديد
      </button>
    </section>
  );
}
