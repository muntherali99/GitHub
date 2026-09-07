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
export default function People({
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
  const [name, setName] = useState(""),
    [rows, setRows] = useState<string[][]>([]),
    [column, setColumn] = useState(0),
    [skipHeader, setSkipHeader] = useState(true),
    [fileError, setFileError] = useState("");
  const people = data.participants.filter(
      (p) => p.groupId === group && p.seasonId === season,
    ),
    names = rows
      .slice(skipHeader ? 1 : 0)
      .map((row) => String(row[column] || "").trim())
      .filter(Boolean),
    namesAsCompanies = names.map((n) =>
      n.startsWith("شركة ") ? n : "شركة " + n,
    ),
    duplicates = namesAsCompanies.filter(
      (n, i) =>
        namesAsCompanies.indexOf(n) !== i ||
        people.some((p) => p.displayName === n),
    );
  async function importFile(file: File) {
    setFileError("");
    try {
      if (file.name.toLowerCase().endsWith(".xlsx")) {
        const { readSheet } = await import("read-excel-file/browser");
        const values = await readSheet(file);
        setRows(values.map((row) => row.map((cell) => String(cell ?? ""))));
      } else setRows(parseCSV(await file.text()));
      setColumn(0);
    } catch (e) {
      setFileError((e as Error).message);
    }
  }
  return (
    <>
      <section className="panel">
        <h2>إضافة شركة</h2>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            act("participant.upsert", {
              displayName: name.startsWith("شركة ") ? name : "شركة " + name,
              privateName: name,
              groupId: group,
              seasonId: season,
            })
              .then(() => setName(""))
              .catch(() => {});
          }}
        >
          <label className="field">
            اسم المشارك
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="الاسم المعتمد للعرض"
              required
              minLength={3}
            />
          </label>
          <button className="button gold" disabled={busy}>
            <Plus size={17} /> إضافة برصيد 100 سهم
          </button>
        </form>
      </section>
      <section className="panel">
        <h2>استيراد Excel أو CSV</h2>
        <p className="muted">
          حدد عمود الأسماء وراجعها قبل الإضافة. الحد 200 اسم لكل دفعة.
        </p>
        <input
          aria-label="ملف الأسماء"
          type="file"
          accept=".xlsx,.csv"
          onChange={(e) => {
            if (e.target.files?.[0]) importFile(e.target.files[0]);
          }}
        />
        {fileError && <Notice error>{fileError}</Notice>}
        {rows.length > 0 && (
          <>
            <label className="field">
              عمود الأسماء
              <select
                value={column}
                onChange={(e) => setColumn(Number(e.target.value))}
              >
                {Array.from(
                  { length: Math.max(...rows.map((r) => r.length)) },
                  (_, i) => (
                    <option key={i} value={i}>
                      العمود {i + 1}: {rows[0][i] || "بدون عنوان"}
                    </option>
                  ),
                )}
              </select>
            </label>
            <label className="checkbox-line">
              <input
                type="checkbox"
                checked={skipHeader}
                onChange={(e) => setSkipHeader(e.target.checked)}
              />{" "}
              الصف الأول عنوان للأعمدة
            </label>
            <div className="import-preview">
              {namesAsCompanies.slice(0, 12).map((n, i) => (
                <div key={i}>{n}</div>
              ))}
            </div>
            <p>{names.length} اسمًا جاهزًا للمراجعة.</p>
            {duplicates.length > 0 && (
              <Notice error>
                أسماء مكررة تحتاج مراجعة:{" "}
                {Array.from(new Set(duplicates)).slice(0, 8).join("، ")}. عدّل
                الملف ثم أعد رفعه.
              </Notice>
            )}
            <button
              className="button gold"
              disabled={
                busy ||
                duplicates.length > 0 ||
                !names.length ||
                names.length > 200
              }
              onClick={() =>
                act("participants.import", {
                  names,
                  groupId: group,
                  seasonId: season,
                })
                  .then(() => setRows([]))
                  .catch(() => {})
              }
            >
              اعتماد الاستيراد
            </button>
          </>
        )}
      </section>
      <section className="panel">
        <div className="section-title">
          <h2>الشركات · {people.length}</h2>
          <button
            className="icon-button"
            aria-label="تصدير أسماء الشركات"
            onClick={() =>
              download(
                "labeeb-companies.csv",
                csvExport([
                  ["المعرف", "اسم الشركة", "الفئة"],
                  ...people.map((p) => [
                    p.id,
                    p.displayName,
                    groupLabel(group),
                  ]),
                ]),
                "text/csv;charset=utf-8",
              )
            }
          >
            <Download size={18} />
          </button>
        </div>
        {people.map((p) => (
          <div className="manage-row" key={p.id}>
            <span>
              {p.displayName}
              <small>{p.archived ? "مؤرشفة" : "نشطة"}</small>
            </span>
            <button
              className="text-button"
              disabled={busy}
              onClick={() =>
                act("participant.upsert", {
                  ...p,
                  archived: !p.archived,
                }).catch(() => {})
              }
            >
              {p.archived ? "استعادة" : "أرشفة"}
            </button>
          </div>
        ))}
      </section>
    </>
  );
}
