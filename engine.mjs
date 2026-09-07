export class DomainError extends Error {
  constructor(message, status = 400) {
    super(message);
    this.status = status;
  }
}
export function requireCondition(value, message, status = 400) {
  if (!value) throw new DomainError(message, status);
}
export function caps(rules) {
  return Object.fromEntries(
    ["base", "bonus", "penalty"].map((kind) => [
      kind,
      rules.criteria
        .filter((c) => c.kind === kind)
        .reduce((n, c) => n + c.value, 0),
    ]),
  );
}
export function validateRules(rules) {
  requireCondition(
    Array.isArray(rules.criteria) &&
      rules.criteria.length >= 6 &&
      rules.criteria.length <= 30,
    "عدد البنود غير صحيح.",
  );
  const ids = new Set();
  for (const c of rules.criteria) {
    requireCondition(
      /^[a-z][a-z0-9_-]{1,50}$/.test(c.id) &&
        !["constructor", "prototype"].includes(c.id) &&
        !ids.has(c.id),
      "معرف بند مكرر أو غير صالح.",
    );
    ids.add(c.id);
    requireCondition(
      ["base", "bonus", "penalty"].includes(c.kind),
      "نوع البند غير صالح.",
    );
    requireCondition(
      typeof c.label === "string" &&
        c.label.trim().length > 0 &&
        c.label.length <= 100,
      "اكتب اسمًا واضحًا للبند.",
    );
    requireCondition(
      Number.isInteger(c.value) && c.value > 0 && c.value <= 100,
      "قيمة البند يجب أن تكون عددًا صحيحًا من 1 إلى 100.",
    );
  }
  for (const id of [
    "attendance",
    "uniform",
    "activities",
    "prayer",
    "initiative",
    "task",
  ])
    requireCondition(
      rules.criteria.some((c) => c.id === id && c.kind === "base"),
      "احتفظ بمعرفات البنود الأساسية وأنواعها.",
    );
  for (const id of ["sports_penalty", "uniform_penalty", "task_penalty"])
    requireCondition(
      rules.criteria.some((c) => c.id === id && c.kind === "penalty"),
      "احتفظ بمعرفات الخصومات الأساسية وأنواعها.",
    );
  return rules;
}
export function blankRecord(rules) {
  return {
    statuses: Object.fromEntries(
      rules.criteria.map((c) => [c.id, c.kind === "base" ? "" : "off"]),
    ),
    reasons: {},
  };
}
export function validateRecord(
  input,
  rules,
  meeting,
  complete = false,
  now = Date.now(),
) {
  requireCondition(
    input &&
      input.statuses &&
      typeof input.statuses === "object" &&
      !Array.isArray(input.statuses),
    "سجل الرصد غير صالح.",
  );
  const clean = blankRecord(rules),
    known = new Set(rules.criteria.map((c) => c.id));
  for (const id of Object.keys(input.statuses))
    requireCondition(known.has(id), "يوجد بند غير معروف لهذا اللقاء.");
  for (const c of rules.criteria) {
    const status = input.statuses[c.id] ?? (c.kind === "base" ? "" : "off");
    const choices =
      c.kind === "base"
        ? ["", "earned", "missed", "excused", "na"]
        : ["off", c.kind === "bonus" ? "earned" : "applied"];
    requireCondition(
      choices.includes(status),
      "حالة غير صحيحة للبند: " + c.label,
    );
    if (complete && c.kind === "base")
      requireCondition(status !== "", "الرصد غير مكتمل: " + c.label);
    const reason = String(input.reasons?.[c.id] ?? "")
      .trim()
      .slice(0, 500);
    if (
      (c.kind === "bonus" && status === "earned") ||
      (c.kind === "penalty" && status === "applied")
    )
      requireCondition(reason.length >= 3, "أضف سببًا واضحًا: " + c.label);
    clean.statuses[c.id] = status;
    if (reason) clean.reasons[c.id] = reason;
  }
  const s = clean.statuses;
  if (s.attendance !== "earned") {
    for (const id of ["uniform", "activities", "prayer", "initiative"])
      requireCondition(
        s[id] !== "earned",
        "لا تُمنح بنود اللقاء الحضورية للغائب.",
      );
    for (const id of ["sports_penalty", "uniform_penalty"])
      requireCondition(
        s[id] !== "applied",
        "لا يطبق خصم السلوك أو الزي الرياضي على غائب.",
      );
  }
  if (!meeting.requiresSport) {
    requireCondition(
      s.sports_penalty !== "applied" && s.uniform_penalty !== "applied",
      "هذا اللقاء لا يتضمن نشاطًا رياضيًا.",
    );
  }
  if (!meeting.requiresUniform)
    requireCondition(
      s.uniform !== "earned" && s.uniform_penalty !== "applied",
      "الزي غير مطلوب في هذا اللقاء.",
    );
  if (!meeting.taskAssigned) {
    requireCondition(
      s.task !== "earned" && s.task_penalty !== "applied",
      "لا توجد مهمة معلنة لهذا اللقاء.",
    );
  }
  if (s.task_penalty === "applied") {
    requireCondition(
      s.task === "missed",
      "خصم المهمة يتطلب تسجيل عدم الإنجاز دون عذر.",
    );
    requireCondition(
      meeting.taskDue &&
        Number.isFinite(Date.parse(meeting.taskDue)) &&
        now >= Date.parse(meeting.taskDue),
      "موعد تسليم المهمة لم ينتهِ.",
    );
  }
  if (s.uniform_penalty === "applied" && meeting.uniformSame)
    requireCondition(
      s.uniform === "missed",
      "لا يمكن منح الزي وخصم عدم ارتدائه، أو الخصم من معذور.",
    );
  return clean;
}
export function calculate(previous, record, rules) {
  requireCondition(
    Number.isFinite(previous) && previous >= 0,
    "الرصيد السابق غير صالح.",
  );
  let base = 0,
    bonus = 0,
    requestedPenalty = 0;
  for (const c of rules.criteria) {
    const s = record.statuses[c.id];
    if (c.kind === "base" && s === "earned") base += c.value;
    if (c.kind === "bonus" && s === "earned") bonus += c.value;
    if (c.kind === "penalty" && s === "applied") requestedPenalty += c.value;
  }
  const penalty = Math.min(requestedPenalty, previous + base + bonus),
    balance = previous + base + bonus - penalty,
    net = balance - previous;
  return {
    previous,
    base,
    bonus,
    requestedPenalty,
    penalty,
    unappliedPenalty: requestedPenalty - penalty,
    balance,
    net,
    percent: previous === 0 ? null : (net / previous) * 100,
    growth: ((balance - 100) / 100) * 100,
  };
}
export function rankCompanies(rows) {
  const sorted = [...rows].sort(
    (a, b) =>
      b.balance - a.balance ||
      a.name.localeCompare(b.name, "ar") ||
      a.id.localeCompare(b.id),
  );
  return sorted.map((r, i) => ({
    ...r,
    rank:
      i > 0 && r.balance === sorted[i - 1].balance
        ? sorted.findIndex((t) => t.balance === r.balance) + 1
        : i + 1,
  }));
}
export function publicProjection(state, seasonId, groupId, meetingId) {
  const participants = state.participants.filter(
    (p) => p.seasonId === seasonId && p.groupId === groupId,
  );
  let meetings = state.meetings
    .filter(
      (m) =>
        m.seasonId === seasonId &&
        m.groupId === groupId &&
        m.publishedRevision > 0,
    )
    .sort((a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id));
  const allMeetings = meetings.map((m) => ({
    id: m.id,
    label: m.label,
    date: m.date,
    publishedAt: m.publishedAt,
  }));
  if (meetingId) {
    const end = meetings.findIndex((m) => m.id === meetingId);
    requireCondition(end >= 0, "اللقاء المنشور غير موجود.", 404);
    meetings = meetings.slice(0, end + 1);
  }
  const selected = meetings.at(-1);
  const effectiveRules =
    state.rules.find((r) => r.id === selected?.ruleId) || state.rules.at(-1);
  const rulesById = new Map(state.rules.map((r) => [r.id, r]));
  const entries = new Map(state.published.map((r) => [r.id, r]));
  const data = new Map(
    participants.map((p) => [
      p.id,
      {
        id: p.id,
        name: p.displayName,
        balance: 100,
        previous: 100,
        base: 0,
        bonus: 0,
        penalty: 0,
        net: 0,
        percent: null,
        growth: 0,
        rank: 1,
        rankChange: null,
        totalBase: 0,
        totalBonus: 0,
        totalPenalty: 0,
        history: [],
        breakdown: [],
        badges: [],
        encounters: 0,
      },
    ]),
  );
  let previousRanks = new Map();
  for (const meeting of meetings) {
    const before = previousRanks;
    const active = [];
    for (const p of participants) {
      const row = data.get(p.id),
        entry = entries.get(meeting.id + "__" + p.id);
      if (!entry) continue;
      const rules = rulesById.get(meeting.ruleId),
        calc = calculate(row.balance, entry, rules);
      row.totalBase += calc.base;
      row.totalBonus += calc.bonus;
      row.totalPenalty += calc.penalty;
      row.encounters++;
      Object.assign(row, calc);
      row.history.push({
        meetingId: meeting.id,
        label: meeting.label,
        date: meeting.date,
        ...calc,
      });
      row.breakdown = rules.criteria
        .filter((c) => c.kind !== "penalty")
        .map((c) => ({
          label: c.label,
          value: entry.statuses[c.id] === "earned" ? c.value : 0,
          max: c.value,
          kind: c.kind,
        }));
      row.badges = rules.criteria
        .filter((c) => c.kind === "bonus" && entry.statuses[c.id] === "earned")
        .map((c) => c.label);
      active.push(row);
    }
    const ranked = rankCompanies(active);
    previousRanks = new Map(ranked.map((p) => [p.id, p.rank]));
    for (const r of ranked) {
      const row = data.get(r.id);
      row.rank = r.rank;
      row.rankChange = before.has(r.id) ? before.get(r.id) - r.rank : null;
    }
  }
  // يشمل الترتيب المنشور فقط الشركات التي لها رصد في اللقاء المعروض.
  const rows = selected
    ? rankCompanies(
        [...data.values()].filter((p) =>
          entries.has(selected.id + "__" + p.id),
        ),
      )
    : rankCompanies(
        participants.filter((p) => !p.archived).map((p) => data.get(p.id)),
      );
  return {
    seasonId,
    groupId,
    rules: effectiveRules,
    meetings: allMeetings,
    selectedMeeting: selected
      ? {
          id: selected.id,
          label: selected.label,
          date: selected.date,
          publishedAt: selected.publishedAt,
        }
      : null,
    companies: rows,
    seasons: state.seasons.map((s) => ({ id: s.id, label: s.label })),
    waitingCount: participants.length,
  };
}
