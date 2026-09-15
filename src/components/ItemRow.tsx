import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Pressable, Text, View } from 'react-native';
import { useAppDialog } from '@/components/AppDialog';
import { colors, fonts, themedStyles } from '@/constants/theme';
import { useItems } from '@/store/ItemsContext';
import { ThoughtItem } from '@/types';
import { CategoryIcon, categoryMeta } from './CategoryIcon';
import { useTheme } from '@/store/ThemeContext';

export function ItemRow({ item, showDate = true }: { item: ThoughtItem; showDate?: boolean }) {
  useTheme();
  const router = useRouter();
  const { showDialog } = useAppDialog();
  const { toggleFavorite, toggleComplete } = useItems();
  const reportUpdateError = (error: unknown) => showDialog({ title: 'Could not update item', message: error instanceof Error ? error.message : 'Try again.', tone: 'danger' });
  return (
    <View style={styles.row}>
      {item.category === 'task' ? <Pressable accessibilityRole="checkbox" accessibilityState={{ checked: Boolean(item.completed) }} accessibilityLabel={`Mark ${item.title} ${item.completed ? 'incomplete' : 'complete'}`} onPress={() => void toggleComplete(item.id).catch(reportUpdateError)} style={({ pressed }) => [styles.checkTarget, pressed && styles.pressed]}>
        <View style={[styles.checkbox, item.completed && styles.checked]}>{item.completed ? <Feather name="check" size={18} color={colors.paper} /> : null}</View>
      </Pressable> : <View style={styles.checkTarget}><CategoryIcon category={item.category} /></View>}
      <Pressable accessibilityRole="button" onPress={() => router.push({ pathname: '/item/[id]', params: { id: item.id } })} style={styles.main}>
        <Text numberOfLines={2} style={[styles.title, item.completed && styles.done]}>{item.title}</Text>
        <Text style={styles.meta}>{categoryMeta[item.category].label}{showDate ? `  ·  ${item.dateLabel}${item.time ? `, ${item.time}` : ''}` : ''}</Text>
      </Pressable>
      <Pressable accessibilityRole="button" accessibilityLabel={`${item.favorite ? 'Remove from favorites' : 'Add to favorites'}: ${item.title}`} accessibilityState={{ selected: Boolean(item.favorite) }} onPress={() => toggleFavorite(item.id)} style={({ pressed }) => [styles.star, pressed && styles.pressed]}>
        <Feather name="star" size={20} color={item.favorite ? colors.mustard : colors.secondary} fill={item.favorite ? colors.mustard : 'transparent'} />
      </Pressable>
    </View>
  );
}

const styles = themedStyles(() => ({
  row: { minHeight: 72, flexDirection: 'row', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: colors.border, gap: 13 },
  main: { flex: 1, minHeight: 46, justifyContent: 'center' },
  title: { fontFamily: fonts.bodyMedium, fontSize: 15, lineHeight: 20, color: colors.ink },
  done: { color: colors.muted, textDecorationLine: 'line-through' },
  meta: { marginTop: 4, fontFamily: fonts.body, fontSize: 12, color: colors.secondary },
  star: { width: 44, height: 48, alignItems: 'center', justifyContent: 'center' },
  checkTarget: { width: 44, height: 48, alignItems: 'center', justifyContent: 'center' },
  checkbox: { width: 26, height: 26, borderRadius: 8, borderWidth: 2, borderColor: colors.secondary, alignItems: 'center', justifyContent: 'center' },
  checked: { backgroundColor: colors.green, borderColor: colors.green },
  pressed: { opacity: 0.65 },
}));
