import { DEFAULT_RULES } from "../shared/rules.mjs";
import { blankRecord } from "../shared/engine.mjs";
export function emptyState() {
  return {
    revision: 0,
    seasons: [{ id: "season-2026", label: "موسم لبيب 1448", active: true }],
    rules: [structuredClone(DEFAULT_RULES)],
    participants: [],
    meetings: [],
    drafts: [],
    published: [],
    roles: [],
  };
}
export function demoState() {
  const s = emptyState();
  const names = [
    "رائد",
    "نواف",
    "سلمان",
    "مازن",
    "أنس",
    "عبدالله",
    "زياد",
    "عمر",
  ];
  for (const groupId of ["cubs", "leaders"]) {
    for (let i = 0; i < names.length; i++)
      s.participants.push({
        id: groupId + "-demo-" + i,
        seasonId: "season-2026",
        groupId,
        displayName: "شركة " + names[i],
        privateName: "اسم تجريبي " + i,
        joinedAt: "2026-08-01",
        archived: false,
      });
    for (let j = 0; j < 3; j++) {
      const date = ["2026-08-21", "2026-08-28", "2026-09-04"][j],
        id = groupId + "-meeting-" + j;
      const m = {
        id,
        seasonId: "season-2026",
        groupId,
        ruleId: DEFAULT_RULES.id,
        label: "اللقاء " + ["الأول", "الثاني", "الثالث"][j],
        date,
        requiresSport: true,
        requiresUniform: true,
        uniformSame: true,
        taskAssigned: true,
        taskDue: date + "T12:00:00Z",
        taskLabel: "إنجاز المهمة الأسبوعية",
        draftRevision: 1,
        publishedRevision: 1,
        publishedAt: date + "T19:00:00Z",
      };
      s.meetings.push(m);
      s.participants
        .filter((p) => p.groupId === groupId)
        .forEach((p, i) => {
          const r = blankRecord(DEFAULT_RULES);
          for (const c of DEFAULT_RULES.criteria)
            if (c.kind === "base") r.statuses[c.id] = "earned";
          if ((i + j) % 3 === 1) r.statuses.prayer = "missed";
          if ((i + j) % 4 === 2) r.statuses.task = "missed";
          if (i > 3) r.statuses.initiative = "missed";
          if ((i + j) % 3 === 0) {
            r.statuses.kindness = "earned";
            r.reasons.kindness = "موقف أخلاقي تجريبي";
          }
          if ((i + j) % 4 === 0) {
            r.statuses.resourceful = "earned";
            r.reasons.resourceful = "مبادرة تجريبية";
          }
          if (i === 4 && j === 2) {
            r.statuses.sports_penalty = "applied";
            r.reasons.sports_penalty = "ملاحظة تجريبية خاصة بالمشرف";
          }
          const row = {
            id: id + "__" + p.id,
            meetingId: id,
            participantId: p.id,
            ...r,
          };
          s.drafts.push(structuredClone(row));
          s.published.push(row);
        });
    }
  }
  return s;
}
