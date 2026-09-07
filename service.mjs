import { randomUUID } from "node:crypto";
import { GROUPS } from "../shared/rules.mjs";
import {
  requireCondition,
  validateRecord,
  validateRules,
  blankRecord,
} from "../shared/engine.mjs";
const identifier = (prefix) => prefix + "-" + randomUUID();
const text = (s, max = 100) =>
  String(s ?? "")
    .trim()
    .slice(0, max);
export function authorize(actor, groupId, manager = false) {
  requireCondition(
    actor &&
      (actor.role === "manager" ||
        (!manager &&
          actor.role === "supervisor" &&
          actor.groups.includes(groupId))),
    "ليس لديك صلاحية لهذه العملية.",
    403,
  );
}
export function scopedState(state, actor) {
  const manager = actor.role === "manager",
    allowed = (groupId) => manager || actor.groups.includes(groupId);
  const meetings = state.meetings.filter((m) => allowed(m.groupId)),
    ids = new Set(meetings.map((m) => m.id));
  return {
    ...state,
    audit: undefined,
    roles: manager ? state.roles : [],
    participants: state.participants.filter((p) => allowed(p.groupId)),
    meetings,
    drafts: state.drafts.filter((r) => ids.has(r.meetingId)),
    published: state.published.filter((r) => ids.has(r.meetingId)),
    actor,
  };
}
export function applyAction(state, actor, body) {
  const { action, payload = {} } = body;
  if (action === "participant.upsert") {
    authorize(actor, payload.groupId, true);
    requireCondition(
      GROUPS.some((g) => g.id === payload.groupId),
      "الفئة غير صحيحة.",
    );
    requireCondition(
      state.seasons.some((s) => s.id === payload.seasonId),
      "الموسم غير صحيح.",
    );
    const name = text(payload.displayName);
    requireCondition(name.length >= 3, "اكتب اسم الشركة.");
    const existing = state.participants.find((p) => p.id === payload.id);
    if (existing) {
      requireCondition(
        existing.seasonId === payload.seasonId &&
          existing.groupId === payload.groupId,
        "تغيير الفئة أو الموسم يحتاج نقلًا مستقلاً للمراجعة.",
      );
      Object.assign(existing, {
        displayName: name,
        privateName: text(payload.privateName),
        archived: !!payload.archived,
      });
    } else {
      requireCondition(
        !state.participants.some(
          (p) =>
            p.groupId === payload.groupId &&
            p.seasonId === payload.seasonId &&
            p.displayName === name,
        ),
        "يوجد اسم مماثل؛ ميّز اسم الشركة أو راجع السجل الحالي.",
      );
      state.participants.push({
        id: identifier("p"),
        seasonId: payload.seasonId,
        groupId: payload.groupId,
        displayName: name,
        privateName: text(payload.privateName),
        joinedAt: new Date().toISOString(),
        archived: false,
      });
    }
  } else if (action === "participants.import") {
    authorize(actor, payload.groupId, true);
    requireCondition(
      GROUPS.some((g) => g.id === payload.groupId) &&
        state.seasons.some((s) => s.id === payload.seasonId),
      "راجع الفئة والموسم.",
    );
    requireCondition(
      Array.isArray(payload.names) &&
        payload.names.length > 0 &&
        payload.names.length <= 200,
      "استورد حتى 200 اسم في الدفعة.",
    );
    for (const value of payload.names) {
      const name = text(value);
      if (!name) continue;
      const displayName = name.startsWith("شركة ") ? name : "شركة " + name;
      requireCondition(
        !state.participants.some(
          (p) =>
            p.displayName === displayName &&
            p.groupId === payload.groupId &&
            p.seasonId === payload.seasonId,
        ),
        "اسم مكرر في الاستيراد: " + displayName,
      );
      state.participants.push({
        id: identifier("p"),
        seasonId: payload.seasonId,
        groupId: payload.groupId,
        displayName,
        privateName: name,
        joinedAt: new Date().toISOString(),
        archived: false,
      });
    }
  } else if (action === "season.create") {
    authorize(actor, "", true);
    const label = text(payload.label);
    requireCondition(label.length >= 3, "اكتب اسم الموسم.");
    state.seasons.push({ id: identifier("season"), label, active: true });
  } else if (action === "meeting.create") {
    authorize(actor, payload.groupId, true);
    requireCondition(
      GROUPS.some((g) => g.id === payload.groupId) &&
        state.seasons.some((s) => s.id === payload.seasonId),
      "راجع الفئة والموسم.",
    );
    requireCondition(
      state.rules.some((r) => r.id === payload.ruleId),
      "إصدار المعايير غير موجود.",
    );
    requireCondition(
      /^\d{4}-\d{2}-\d{2}$/.test(payload.date) &&
        Number.isFinite(Date.parse(payload.date)),
      "تاريخ اللقاء غير صحيح.",
    );
    requireCondition(text(payload.label).length >= 3, "اكتب اسم اللقاء.");
    if (payload.taskAssigned)
      requireCondition(
        Number.isFinite(Date.parse(payload.taskDue)) &&
          text(payload.taskLabel).length > 0,
        "حدد المهمة وموعد تسليمها.",
      );
    state.meetings.push({
      id: identifier("m"),
      seasonId: payload.seasonId,
      groupId: payload.groupId,
      ruleId: payload.ruleId,
      label: text(payload.label),
      date: payload.date,
      requiresSport: !!payload.requiresSport,
      requiresUniform: !!payload.requiresUniform,
      uniformSame: !!payload.uniformSame,
      taskAssigned: !!payload.taskAssigned,
      taskDue: payload.taskAssigned ? payload.taskDue : null,
      taskLabel: text(payload.taskLabel),
      draftRevision: 0,
      publishedRevision: 0,
      publishedAt: null,
    });
  } else if (action === "draft.save") {
    const meeting = state.meetings.find((m) => m.id === payload.meetingId);
    requireCondition(meeting, "اللقاء غير موجود.", 404);
    authorize(actor, meeting.groupId);
    const rules = state.rules.find((r) => r.id === meeting.ruleId);
    requireCondition(
      Array.isArray(payload.records) &&
        payload.records.length > 0 &&
        payload.records.length <= 200,
      "دفعة الرصد غير صحيحة.",
    );
    const seen = new Set();
    let changed = false;
    for (const row of payload.records) {
      requireCondition(!seen.has(row.participantId), "تكرر المشارك في الدفعة.");
      seen.add(row.participantId);
      requireCondition(
        state.participants.some(
          (p) =>
            p.id === row.participantId &&
            p.groupId === meeting.groupId &&
            p.seasonId === meeting.seasonId &&
            (meeting.participantIds
              ? meeting.participantIds.includes(p.id)
              : !p.archived),
        ),
        "المشارك غير متاح في هذا اللقاء.",
      );
      const clean = validateRecord(row, rules, meeting, false);
      const id = meeting.id + "__" + row.participantId,
        old = state.drafts.find((r) => r.id === id);
      const next = {
        ...clean,
        id,
        meetingId: meeting.id,
        participantId: row.participantId,
      };
      if (
        !old ||
        JSON.stringify(old.statuses) !== JSON.stringify(next.statuses) ||
        JSON.stringify(old.reasons) !== JSON.stringify(next.reasons)
      ) {
        if (old) Object.assign(old, next);
        else state.drafts.push(next);
        changed = true;
      }
    }
    if (changed) meeting.draftRevision++;
  } else if (action === "meeting.publish") {
    const meeting = state.meetings.find((m) => m.id === payload.meetingId);
    requireCondition(meeting, "اللقاء غير موجود.", 404);
    authorize(actor, meeting.groupId, true);
    if (
      meeting.publishedRevision > 0 &&
      meeting.publishedRevision === meeting.draftRevision
    )
      return;
    const rules = state.rules.find((r) => r.id === meeting.ruleId),
      participants = state.participants.filter(
        (p) =>
          p.groupId === meeting.groupId &&
          p.seasonId === meeting.seasonId &&
          (meeting.participantIds
            ? meeting.participantIds.includes(p.id)
            : !p.archived),
      );
    requireCondition(participants.length > 0, "أضف المشاركين قبل النشر.");
    if (meeting.publishedRevision > 0)
      requireCondition(
        text(payload.reason, 500).length >= 3,
        "اكتب سبب تصحيح النتائج المنشورة.",
      );
    for (const p of participants) {
      const id = meeting.id + "__" + p.id,
        draft = state.drafts.find((r) => r.id === id) || {
          ...blankRecord(rules),
          participantId: p.id,
        };
      const clean = validateRecord(draft, rules, meeting, true);
      const old = state.published.find((r) => r.id === id),
        next = { ...clean, id, meetingId: meeting.id, participantId: p.id };
      if (old) Object.assign(old, next);
      else state.published.push(next);
    }
    meeting.publishedRevision = meeting.draftRevision || 1;
    meeting.participantIds = participants.map((p) => p.id);
    meeting.draftRevision = meeting.publishedRevision;
    meeting.publishedAt = new Date().toISOString();
    meeting.correctionReason = text(payload.reason, 500);
  } else if (action === "rules.create") {
    authorize(actor, "", true);
    const rules = {
      id: identifier("rules"),
      createdAt: new Date().toISOString(),
      label: text(payload.label) || "إصدار جديد",
      initialBalance: 100,
      criteria: payload.criteria?.map((c) => ({
        id: text(c.id, 50),
        label: text(c.label),
        kind: text(c.kind),
        value: Number(c.value),
      })),
    };
    validateRules(rules);
    state.rules.push(rules);
  } else if (action === "role.upsert") {
    authorize(actor, "", true);
    const email = text(payload.email, 254).toLowerCase();
    requireCondition(
      /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email),
      "البريد الإلكتروني غير صحيح.",
    );
    requireCondition(
      ["manager", "supervisor", "disabled"].includes(payload.role),
      "دور غير صحيح.",
    );
    const groups = (payload.groups || []).filter((g) =>
      GROUPS.some((v) => v.id === g),
    );
    const old = state.roles.find((r) => r.email === email),
      next = {
        id: old?.id || identifier("role"),
        email,
        role: payload.role,
        groups,
      };
    if (old) Object.assign(old, next);
    else state.roles.push(next);
  } else throw Object.assign(new Error("عملية غير معروفة."), { status: 400 });
}
