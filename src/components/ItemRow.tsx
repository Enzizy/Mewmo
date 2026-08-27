import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useAppDialog } from '@/components/AppDialog';
import { colors, fonts } from '@/constants/theme';
import { useItems } from '@/store/ItemsContext';
import { ThoughtItem } from '@/types';
import { CategoryIcon, categoryMeta } from './CategoryIcon';

export function ItemRow({ item, showDate = true }: { item: ThoughtItem; showDate?: boolean }) {
  const router = useRouter();
  const { showDialog } = useAppDialog();
  const { toggleFavorite, toggleComplete } = useItems();
  const reportUpdateError = (error: unknown) => showDialog({ title: 'Could not update item', message: error instanceof Error ? error.message : 'Try again.', tone: 'danger' });
  return (
    <View style={styles.row}>
      <Pressable accessibilityRole="checkbox" accessibilityState={{ checked: Boolean(item.completed), disabled: item.category !== 'task' }} accessibilityLabel={item.category === 'task' ? `Mark ${item.title} ${item.completed ? 'incomplete' : 'complete'}` : undefined} disabled={item.category !== 'task'} onPress={() => void toggleComplete(item.id).catch(reportUpdateError)}>
        <CategoryIcon category={item.category} />
      </Pressable>
      <Pressable accessibilityRole="button" onPress={() => router.push({ pathname: '/item/[id]', params: { id: item.id } })} style={styles.main}>
        <Text numberOfLines={2} style={[styles.title, item.completed && styles.done]}>{item.title}</Text>
        <Text style={styles.meta}>{categoryMeta[item.category].label}{showDate ? `  ·  ${item.dateLabel}${item.time ? `, ${item.time}` : ''}` : ''}</Text>
      </Pressable>
      <Pressable accessibilityRole="button" accessibilityLabel={item.favorite ? 'Remove from favorites' : 'Add to favorites'} onPress={() => toggleFavorite(item.id)} style={styles.star}>
        <Feather name="star" size={18} color={item.favorite ? colors.mustard : colors.borderStrong} fill={item.favorite ? colors.mustard : 'transparent'} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { minHeight: 72, flexDirection: 'row', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: colors.border, gap: 13 },
  main: { flex: 1, minHeight: 46, justifyContent: 'center' },
  title: { fontFamily: fonts.bodyMedium, fontSize: 15, lineHeight: 20, color: colors.ink },
  done: { color: colors.muted, textDecorationLine: 'line-through' },
  meta: { marginTop: 4, fontFamily: fonts.body, fontSize: 12, color: colors.secondary },
  star: { width: 38, height: 44, alignItems: 'center', justifyContent: 'center' },
});
