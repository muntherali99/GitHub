export type Group = "cubs" | "leaders";
export interface Criterion {
  id: string;
  label: string;
  kind: "base" | "bonus" | "penalty";
  value: number;
}
export interface Rules {
  id: string;
  label: string;
  initialBalance: number;
  criteria: Criterion[];
}
export interface RecordData {
  id?: string;
  meetingId?: string;
  participantId?: string;
  statuses: Record<string, string>;
  reasons: Record<string, string>;
}
export interface Meeting {
  id: string;
  seasonId: string;
  groupId: Group;
  label: string;
  date: string;
  ruleId: string;
  requiresSport: boolean;
  requiresUniform: boolean;
  uniformSame: boolean;
  taskAssigned: boolean;
  taskLabel: string;
  taskDue: string | null;
  draftRevision: number;
  publishedRevision: number;
  publishedAt: string | null;
  participantIds?: string[];
}
export interface Participant {
  id: string;
  seasonId: string;
  groupId: Group;
  displayName: string;
  privateName: string;
  archived: boolean;
}
export interface Actor {
  email: string;
  role: "manager" | "supervisor";
  groups: Group[];
}
export interface State {
  revision: number;
  actor: Actor;
  seasons: { id: string; label: string }[];
  rules: Rules[];
  participants: Participant[];
  meetings: Meeting[];
  drafts: RecordData[];
  published: RecordData[];
  roles: { id: string; email: string; role: string; groups: Group[] }[];
}
export interface History {
  meetingId: string;
  label: string;
  date: string;
  balance: number;
  net: number;
  base: number;
  bonus: number;
  penalty: number;
}
export interface Company {
  id: string;
  name: string;
  balance: number;
  rank: number;
  rankChange: number | null;
  previous: number;
  base: number;
  bonus: number;
  penalty: number;
  net: number;
  percent: number | null;
  growth: number;
  totalBase: number;
  totalBonus: number;
  totalPenalty: number;
  history: History[];
  badges: string[];
  breakdown: { label: string; value: number; max: number; kind: string }[];
}
export interface PublicData {
  setupRequired?: boolean;
  rules: Rules;
  seasonId: string;
  groupId: Group;
  seasons: { id: string; label: string }[];
  meetings: Pick<Meeting, "id" | "label" | "date" | "publishedAt">[];
  selectedMeeting: Pick<
    Meeting,
    "id" | "label" | "date" | "publishedAt"
  > | null;
  companies: Company[];
  waitingCount: number;
}
export interface AppConfig {
  demo: boolean;
  configured: boolean;
  firebase: Record<string, string> | null;
}

export type Act = (
  action: string,
  payload: unknown,
  revision?: number,
) => Promise<State>;
