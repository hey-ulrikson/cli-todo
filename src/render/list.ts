import type { Status } from '../task';

export const SECTION_ORDER = ['general', 'coding', 'review', 'waiting', 'someday'] as const satisfies readonly Exclude<Status, 'done'>[];

export const STATUS_DISPLAY: Record<Exclude<Status, 'done'>, { emoji: string; label: string }> = {
  general: { emoji: '📅', label: 'General' },
  coding: { emoji: '💻', label: 'Coding' },
  review: { emoji: '🔍', label: 'Reviews' },
  waiting: { emoji: '🤝', label: 'Waiting On' },
  someday: { emoji: '💭', label: 'Someday / Maybe' },
};
