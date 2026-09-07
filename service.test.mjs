import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { FileStore } from "./store.mjs";
import { applyAction, scopedState } from "./service.mjs";
import { emptyState, demoState } from "./demo.mjs";
import { blankRecord, publicProjection } from "./engine.mjs";
import { DEFAULT_RULES as rules } from "./rules.mjs";
const manager = {
  email: "owner@example.invalid",
  role: "manager",
  groups: ["cubs", "leaders"],
};
const supervisor = {
  email: "staff@example.invalid",
  role: "supervisor",
  groups: ["cubs"],
};
const act = (state, action, payload = {}, actor = manager) =>
  applyAction(state, actor, { action, payload });
function fixture() {
  const state = emptyState();
  act(state, "participant.upsert", {
    displayName: "شركة تجربة",
    privateName: "PRIVATE",
    seasonId: "season-2026",
    groupId: "cubs",
  });
  act(state, "meeting.create", {
    label: "لقاء البداية",
    date: "2026-08-01",
    groupId: "cubs",
    seasonId: "season-2026",
    ruleId: rules.id,
    requiresSport: true,
    requiresUniform: true,
    uniformSame: true,
    taskAssigned: true,
    taskDue: "2026-07-31",
    taskLabel: "مهمة",
  });
  return state;
}
function fullRecord() {
  const record = blankRecord(rules);
  for (const c of rules.criteria)
    if (c.kind === "base") record.statuses[c.id] = "earned";
  return record;
}
function save(state, record = fullRecord(), meeting = state.meetings[0]) {
  act(state, "draft.save", {
    meetingId: meeting.id,
    records: [{ ...record, participantId: state.participants[0].id }],
  });
}
const projection = (s) => publicProjection(s, "season-2026", "cubs");
test("منحة البداية تظهر مرة واحدة قبل أول لقاء", () => {
  const s = fixture();
  assert.equal(projection(s).companies[0].balance, 100);
});
test("الحفظ لا ينشر، وتكرار النشر لا يضاعف الأرصدة", () => {
  const s = fixture(),
    m = s.meetings[0];
  save(s);
  assert.equal(projection(s).companies[0].balance, 100);
  act(s, "meeting.publish", { meetingId: m.id });
  assert.equal(projection(s).companies[0].balance, 200);
  const before = JSON.stringify(s);
  save(s);
  act(s, "meeting.publish", { meetingId: m.id });
  assert.equal(JSON.stringify(s), before);
});
test("التصحيح يحتاج سببًا ويعيد حساب اللقاءات التالية", () => {
  const s = fixture(),
    first = s.meetings[0];
  save(s);
  act(s, "meeting.publish", { meetingId: first.id });
  act(s, "meeting.create", {
    ...first,
    id: undefined,
    label: "اللقاء التالي",
    date: "2026-08-08",
  });
  const next = s.meetings[1];
  save(s, fullRecord(), next);
  act(s, "meeting.publish", { meetingId: next.id });
  assert.equal(projection(s).companies[0].balance, 300);
  const correction = fullRecord();
  correction.statuses.task = "missed";
  save(s, correction, first);
  assert.throws(
    () => act(s, "meeting.publish", { meetingId: first.id }),
    /سبب/,
  );
  act(s, "meeting.publish", {
    meetingId: first.id,
    reason: "تصحيح المهمة بعد المراجعة",
  });
  assert.equal(projection(s).companies[0].balance, 275);
  assert.deepEqual(
    projection(s).companies[0].history.map((h) => h.balance),
    [175, 275],
  );
});
test("تعديل المعايير يحفظ النسخة المستخدمة في اللقاء المنشور", () => {
  const s = fixture(),
    m = s.meetings[0];
  save(s);
  act(s, "meeting.publish", { meetingId: m.id });
  act(s, "rules.create", {
    label: "معايير جديدة",
    criteria: rules.criteria.map((c) => ({
      ...c,
      value: c.id === "attendance" ? 40 : c.value,
    })),
  });
  assert.equal(projection(s).companies[0].balance, 200);
  assert.equal(s.rules[0].criteria[0].value, 25);
  assert.equal(s.rules.length, 2);
});
test("المشرف لا يدير الحسابات ولا ينشر ولا يصل إلى الفئة الأخرى", () => {
  const s = demoState();
  assert.throws(
    () =>
      act(s, "role.upsert", { email: "x@y.com", role: "manager" }, supervisor),
    /صلاحية/,
  );
  assert.throws(
    () =>
      act(s, "meeting.publish", { meetingId: s.meetings[0].id }, supervisor),
    /صلاحية/,
  );
  const leaders = s.meetings.find((m) => m.groupId === "leaders");
  assert.throws(
    () =>
      act(s, "draft.save", { meetingId: leaders.id, records: [] }, supervisor),
    /صلاحية/,
  );
  const scoped = scopedState(s, supervisor);
  assert.equal(
    scoped.participants.some((p) => p.groupId === "leaders"),
    false,
  );
  assert.equal(scoped.roles.length, 0);
});
test("لقاء منشور يحتفظ بمشاركيه عند إضافة شركة أو أرشفتها لاحقًا", () => {
  const s = fixture(),
    m = s.meetings[0];
  save(s);
  act(s, "meeting.publish", { meetingId: m.id });
  act(s, "participant.upsert", {
    displayName: "شركة جديدة",
    groupId: "cubs",
    seasonId: "season-2026",
  });
  s.participants[0].archived = true;
  const r = fullRecord();
  r.statuses.task = "missed";
  save(s, r);
  act(s, "meeting.publish", { meetingId: m.id, reason: "تصحيح سجل مؤرشف" });
  assert.equal(projection(s).companies.length, 1);
  assert.equal(projection(s).companies[0].balance, 175);
});
test("تعارض مشرفين لا يكتب فوق رصد سابق، ويستمر الحفظ بعد إعادة الفتح", async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "labeeb-test-"));
  try {
    const store = new FileStore(dir);
    await store.init();
    const revision = (await store.load()).revision;
    const results = await Promise.allSettled(
      ["موسم ألف", "موسم باء"].map((label) =>
        store.mutate(revision, manager, "season.create", (s) =>
          act(s, "season.create", { label }),
        ),
      ),
    );
    assert.equal(results.filter((r) => r.status === "fulfilled").length, 1);
    assert.equal(
      results.find((r) => r.status === "rejected").reason.status,
      409,
    );
    const reopened = new FileStore(dir);
    await reopened.init();
    assert.equal((await reopened.load()).revision, revision + 1);
    assert.equal((await reopened.audit()).length, 1);
    const before = JSON.stringify(await reopened.load());
    await assert.rejects(
      () =>
        reopened.mutate(revision + 1, manager, "participants.import", (s) =>
          act(s, "participants.import", {
            groupId: "cubs",
            seasonId: "season-2026",
            names: ["اسم متكرر", "اسم متكرر"],
          }),
        ),
      /مكرر/,
    );
    assert.equal(JSON.stringify(await reopened.load()), before);
  } finally {
    await fs.rm(dir, { recursive: true, force: true });
  }
});
