import test from "node:test";
import assert from "node:assert/strict";
import { DEFAULT_RULES as rules } from "./rules.mjs";
import {
  blankRecord,
  calculate,
  validateRecord,
  rankCompanies,
  publicProjection,
} from "./engine.mjs";
const meeting = {
  requiresSport: true,
  requiresUniform: true,
  uniformSame: true,
  taskAssigned: true,
  taskDue: "2026-01-01",
};
function record(earned = [], penalties = []) {
  const r = blankRecord(rules);
  for (const c of rules.criteria)
    r.statuses[c.id] = c.kind === "base" ? "missed" : "off";
  for (const id of earned) {
    r.statuses[id] = "earned";
    r.reasons[id] = "موقف موثق";
  }
  for (const id of penalties) {
    r.statuses[id] = "applied";
    r.reasons[id] = "بعد التنبيه ودون عذر";
  }
  return r;
}
test("المكاسب الأساسية 60، والإضافات والخصومات", () => {
  const r = record(["attendance", "uniform", "activities", "initiative"]);
  assert.equal(calculate(100, r, rules).balance, 160);
  r.statuses.kindness = "earned";
  r.statuses.sports_penalty = "applied";
  assert.equal(calculate(100, r, rules).balance, 160);
  const t = record(
    ["attendance", "activities", "prayer", "kindness"],
    ["uniform_penalty"],
  );
  assert.equal(calculate(100, t, rules).balance, 160);
});
test("الحد الأقصى 230 مع البداية", () => {
  const r = record(
    rules.criteria.filter((c) => c.kind !== "penalty").map((c) => c.id),
  );
  assert.equal(calculate(100, r, rules).balance, 230);
});
test("حماية الصفر وإظهار الخصم المطبق فقط", () => {
  const r = record(
    [],
    rules.criteria.filter((c) => c.kind === "penalty").map((c) => c.id),
  );
  assert.deepEqual(
    [
      calculate(20, r, rules).balance,
      calculate(20, r, rules).penalty,
      calculate(20, r, rules).unappliedPenalty,
    ],
    [0, 20, 20],
  );
});
test("النسبة من صفر غير محسوبة", () =>
  assert.equal(calculate(0, record(["attendance"]), rules).percent, null));
test("المسودة غير المكتملة لا تنشر", () =>
  assert.throws(
    () => validateRecord(blankRecord(rules), rules, meeting, true),
    /غير مكتمل/,
  ));
test("الخصم صريح ويتطلب سببًا", () => {
  const r = record(["attendance"]);
  assert.equal(calculate(100, r, rules).penalty, 0);
  r.statuses.sports_penalty = "applied";
  assert.throws(() => validateRecord(r, rules, meeting, true), /سببًا/);
});
test("تعارض المهمة ومنع الخصم قبل الموعد", () => {
  const r = record(["attendance", "task"], ["task_penalty"]);
  assert.throws(() => validateRecord(r, rules, meeting, true), /عدم الإنجاز/);
  r.statuses.task = "missed";
  assert.throws(
    () => validateRecord(r, rules, { ...meeting, taskDue: "2099-01-01" }, true),
    /لم ينته/,
  );
});
test("منع خصم رياضي لغائب", () =>
  assert.throws(
    () => validateRecord(record([], ["sports_penalty"]), rules, meeting, true),
    /غائب/,
  ));
test("تعادل 1، 1، 3", () =>
  assert.deepEqual(
    rankCompanies([
      { id: "a", name: "أ", balance: 200 },
      { id: "b", name: "ب", balance: 200 },
      { id: "c", name: "ج", balance: 100 },
    ]).map((x) => x.rank),
    [1, 1, 3],
  ));
test("الواجهة العامة لا تتضمن الملاحظات أو المسودات", () => {
  const r = record(["attendance"]);
  r.reasons.attendance = "PRIVATE";
  const state = {
    seasons: [{ id: "s", label: "موسم" }],
    rules: [rules],
    participants: [
      {
        id: "p",
        seasonId: "s",
        groupId: "cubs",
        displayName: "شركة تجربة",
        privateName: "PRIVATE",
      },
    ],
    meetings: [
      {
        ...meeting,
        id: "m",
        seasonId: "s",
        groupId: "cubs",
        ruleId: rules.id,
        label: "لقاء",
        date: "2026-09-01",
        publishedRevision: 1,
      },
    ],
    published: [{ ...r, id: "m__p" }],
    drafts: [{ reasons: "PRIVATE" }],
  };
  const result = publicProjection(state, "s", "cubs");
  assert.equal(result.companies[0].balance, 125);
  assert.equal(JSON.stringify(result).includes("PRIVATE"), false);
});
