import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import { View } from 'react-native';
import { colors, themedStyles } from '@/constants/theme';
import { Category } from '@/types';
import { useTheme } from '@/store/ThemeContext';

// Getters, so each read resolves against the active theme instead of the
// palette that happened to be active when this module first loaded.
export const categoryMeta: Record<Category, { label: string; color: string; soft: string }> = {
  get task() { return { label: 'Task', color: colors.green, soft: colors.greenSoft }; },
  get reminder() { return { label: 'Reminder', color: colors.mustard, soft: colors.mustardSoft }; },
  get idea() { return { label: 'Idea', color: colors.blue, soft: colors.blueSoft }; },
  get note() { return { label: 'Note', color: colors.terracotta, soft: colors.terracottaSoft }; },
};

export function CategoryIcon({ category, size = 18, contained = true }: { category: Category; size?: number; contained?: boolean }) {
  useTheme();
  const meta = categoryMeta[category];
  const icon = category === 'task'
    ? <Feather name="check" size={size} color={meta.color} />
    : category === 'reminder'
      ? <Feather name="bell" size={size} color={meta.color} />
      : category === 'idea'
        ? <Feather name="sun" size={size} color={meta.color} />
        : <MaterialCommunityIcons name="note-outline" size={size + 1} color={meta.color} />;

  if (!contained) return icon;
  return <View style={[styles.container, { backgroundColor: meta.soft }]}>{icon}</View>;
}

const styles = themedStyles(() => ({
  container: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
}));
