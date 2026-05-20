export const STATUSES = ['someday', 'general', 'coding', 'waiting', 'done'] as const;
export const URGENCIES = ['red', 'yellow', 'blue'] as const;

export type Status = (typeof STATUSES)[number];
export type Urgency = (typeof URGENCIES)[number];

export interface Task {
  id: number;
  title: string;
  note: string | null;
  status: Status;
  urgency: Urgency;
  created_at: number;
  updated_at: number;
  done_at: number | null;
  due_at: number | null;
}
