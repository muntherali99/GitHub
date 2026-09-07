// أنشئ إصدارًا جديدًا من لوحة الإدارة. اللقاءات السابقة تحتفظ بإصدارها.
export const GROUPS = [
  { id: "cubs", label: "الأشبال" },
  { id: "leaders", label: "القادة" },
];
export const DEFAULT_RULES = {
  id: "rules-v1",
  label: "المعايير الأساسية · الإصدار 1",
  initialBalance: 100,
  criteria: [
    { id: "attendance", label: "الحضور", kind: "base", value: 25 },
    { id: "uniform", label: "الزي المطلوب", kind: "base", value: 10 },
    { id: "activities", label: "التفاعل بالأنشطة", kind: "base", value: 15 },
    {
      id: "prayer",
      label: "الأذان أو الإقامة أو كلمة",
      kind: "base",
      value: 15,
    },
    { id: "initiative", label: "المبادرة والتعاون", kind: "base", value: 10 },
    { id: "task", label: "حفظ الذكر أو مهمة الأسبوع", kind: "base", value: 25 },
    { id: "kindness", label: "وسام الخلوق", kind: "bonus", value: 15 },
    { id: "resourceful", label: "وسام الشقردي", kind: "bonus", value: 15 },
    {
      id: "sports_penalty",
      label: "عدم الالتزام بالأخلاق الرياضية",
      kind: "penalty",
      value: 15,
    },
    {
      id: "uniform_penalty",
      label: "عدم الالتزام بالزي الرياضي",
      kind: "penalty",
      value: 10,
    },
    {
      id: "task_penalty",
      label: "عدم إنجاز مهمة الأسبوع",
      kind: "penalty",
      value: 15,
    },
  ],
};
