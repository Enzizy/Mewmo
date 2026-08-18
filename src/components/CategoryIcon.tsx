import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import { StyleSheet, View } from 'react-native';
import { colors } from '@/constants/theme';
import { Category } from '@/types';

export const categoryMeta: Record<Category, { label: string; color: string; soft: string }> = {
  task: { label: 'Task', color: colors.green, soft: colors.greenSoft },
  reminder: { label: 'Reminder', color: colors.mustard, soft: colors.mustardSoft },
  idea: { label: 'Idea', color: colors.blue, soft: colors.blueSoft },
  note: { label: 'Note', color: colors.terracotta, soft: colors.terracottaSoft },
};

export function CategoryIcon({ category, size = 18, contained = true }: { category: Category; size?: number; contained?: boolean }) {
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

const styles = StyleSheet.create({
  container: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
});
