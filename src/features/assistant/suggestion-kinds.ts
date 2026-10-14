import type { Feather } from '@expo/vector-icons';
import { colors } from '@/constants/theme';
import type { SuggestionKind } from '@/types';

type KindMeta = { label: string; icon: keyof typeof Feather.glyphMap; color: string; soft: string };

export const SUGGESTION_KINDS: SuggestionKind[] = ['task', 'reminder', 'project', 'expense', 'income', 'investment', 'idea', 'note'];

/** Read at render time so the colors follow the active theme. */
export function suggestionKindMeta(kind: SuggestionKind): KindMeta {
  switch (kind) {
    case 'task': return { label: 'Task', icon: 'check-square', color: colors.green, soft: colors.greenSoft };
    case 'reminder': return { label: 'Reminder', icon: 'bell', color: colors.mustard, soft: colors.mustardSoft };
    case 'project': return { label: 'Project', icon: 'folder', color: colors.accent, soft: colors.accentSoft };
    case 'expense': return { label: 'Expense', icon: 'arrow-up-right', color: colors.danger, soft: colors.dangerSoft };
    case 'income': return { label: 'Income', icon: 'arrow-down-left', color: colors.green, soft: colors.greenSoft };
    case 'investment': return { label: 'Investment', icon: 'trending-up', color: colors.accent, soft: colors.accentSoft };
    case 'idea': return { label: 'Idea', icon: 'sun', color: colors.mustard, soft: colors.mustardSoft };
    case 'note': return { label: 'Note', icon: 'file-text', color: colors.secondary, soft: colors.background };
  }
}
