import type { Feather } from '@expo/vector-icons';

export type AssistantStarter = { label: string; prompt: string; icon: keyof typeof Feather.glyphMap };

/** Conversation openers shown on an empty chat and on Home. Each is sent as written. */
export const ASSISTANT_STARTERS: AssistantStarter[] = [
  { label: 'Plan my day', prompt: 'Plan my day around what is due and scheduled.', icon: 'sun' },
  { label: 'What can I safely spend?', prompt: 'What can I safely spend right now?', icon: 'shield' },
  { label: 'What is due this week?', prompt: 'What tasks and reminders are due this week?', icon: 'calendar' },
  { label: 'Log a ₱450 lunch', prompt: 'Log a ₱450 lunch expense from today.', icon: 'arrow-up-right' },
];
