import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeInDown, LinearTransition } from 'react-native-reanimated';
import { useAppDialog } from '@/components/AppDialog';
import { AppScreen } from '@/components/AppScreen';
import { CategoryIcon, categoryMeta } from '@/components/CategoryIcon';
import { ScreenHeader } from '@/components/ScreenHeader';
import { colors, fonts } from '@/constants/theme';
import { useItems } from '@/store/ItemsContext';
import { Category } from '@/types';

const categories: Category[] = ['task', 'reminder', 'idea', 'note'];

export default function ResultsScreen() {
  const { showDialog } = useAppDialog();
  const router = useRouter();
  const { items, latestItemIds, toggleComplete, deleteItem, changeCategory, scheduleTomorrow } = useItems();
  const resultItems = items.filter((item) => latestItemIds.includes(item.id));
  const [expanded, setExpanded] = useState<Record<Category, boolean>>({ task: true, reminder: true, idea: true, note: true });
  const reportUpdateError = (error: unknown) => showDialog({ title: 'Could not update item', message: error instanceof Error ? error.message : 'Try again.', tone: 'danger' });

  return (
    <AppScreen background={colors.paper}>
      <ScreenHeader action={<Pressable onPress={() => router.replace('/')}><Feather name="x" size={22} color={colors.ink} /></Pressable>} />
      <Animated.View entering={FadeInDown.duration(450)}><Text style={styles.title}>All set.</Text><Text style={styles.subtitle}>Here’s what I found.</Text><Text style={styles.meta}>{resultItems.length} {resultItems.length === 1 ? 'item' : 'items'} from your recording</Text></Animated.View>
      <View style={styles.sections}>
        {categories.map((category) => {
          const categoryItems = resultItems.filter((item) => item.category === category);
          if (!categoryItems.length) return null;
          return (
            <Animated.View layout={LinearTransition} key={category} style={styles.section}>
              <Pressable accessibilityRole="button" onPress={() => setExpanded((value) => ({ ...value, [category]: !value[category] }))} style={styles.sectionHead}>
                <CategoryIcon category={category} /><Text style={styles.sectionTitle}>{categoryMeta[category].label}s</Text><Text style={styles.sectionCount}>{categoryItems.length}</Text><Feather name={expanded[category] ? 'chevron-up' : 'chevron-down'} size={19} color={colors.secondary} />
              </Pressable>
              {expanded[category] && categoryItems.map((item) => (
                <View key={item.id} style={styles.resultRow}>
                  {category === 'task' && <Pressable accessibilityRole="checkbox" accessibilityState={{ checked: Boolean(item.completed) }} accessibilityLabel={`Mark ${item.title} ${item.completed ? 'incomplete' : 'complete'}`} onPress={() => void toggleComplete(item.id).catch(reportUpdateError)} style={[styles.checkbox, item.completed && styles.checkboxDone]}>{item.completed && <Feather name="check" size={13} color={colors.surface} />}</Pressable>}
                  <Pressable onPress={() => router.push({ pathname: '/item/[id]', params: { id: item.id } })} style={styles.resultMain}><Text style={[styles.resultTitle, item.completed && styles.resultDone]}>{item.title}</Text><Text style={styles.resultMeta}>{item.dateLabel}</Text></Pressable>
                  <Pressable accessibilityRole="button" accessibilityLabel={`Change category for ${item.title}`} onPress={() => void changeCategory(item.id, categories[(categories.indexOf(item.category) + 1) % categories.length]).catch(reportUpdateError)} style={styles.rowAction}><Feather name="repeat" size={16} color={colors.secondary} /></Pressable>
                  <Pressable accessibilityRole="button" accessibilityLabel={`Remind me about ${item.title} tomorrow at 9 AM`} onPress={() => void scheduleTomorrow(item.id).catch(reportUpdateError)} style={styles.rowAction}><Feather name="calendar" size={16} color={colors.secondary} /></Pressable>
                  <Pressable accessibilityLabel={`Delete ${item.title}`} onPress={() => deleteItem(item.id)} style={styles.rowAction}><Feather name="trash-2" size={16} color={colors.danger} /></Pressable>
                </View>
              ))}
            </Animated.View>
          );
        })}
      </View>
      <Pressable onPress={() => router.replace('/tasks/timeline')} style={styles.timelineButton}><Text style={styles.timelineText}>View all in timeline</Text><Feather name="arrow-right" size={18} color={colors.surface} /></Pressable>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  title: { marginTop: 8, fontFamily: fonts.editorialSemiBold, fontSize: 38, color: colors.ink },
  subtitle: { fontFamily: fonts.editorial, fontSize: 27, color: colors.secondary },
  meta: { marginTop: 12, fontFamily: fonts.body, fontSize: 12, color: colors.muted },
  sections: { marginTop: 30, borderTopWidth: 1, borderTopColor: colors.border },
  section: { borderBottomWidth: 1, borderBottomColor: colors.border },
  sectionHead: { minHeight: 68, flexDirection: 'row', alignItems: 'center', gap: 12 },
  sectionTitle: { flex: 1, fontFamily: fonts.bodySemiBold, fontSize: 16, color: colors.ink },
  sectionCount: { fontFamily: fonts.bodyMedium, fontSize: 12, color: colors.muted },
  resultRow: { minHeight: 62, paddingLeft: 5, flexDirection: 'row', alignItems: 'center', borderTopWidth: 1, borderTopColor: colors.border, gap: 9 },
  checkbox: { width: 20, height: 20, borderRadius: 5, borderWidth: 1, borderColor: colors.green, alignItems: 'center', justifyContent: 'center' },
  checkboxDone: { backgroundColor: colors.green },
  resultMain: { flex: 1, paddingVertical: 10 },
  resultTitle: { fontFamily: fonts.bodyMedium, fontSize: 14, lineHeight: 19, color: colors.ink },
  resultDone: { color: colors.muted, textDecorationLine: 'line-through' },
  resultMeta: { marginTop: 3, fontFamily: fonts.body, fontSize: 11, color: colors.muted },
  rowAction: { width: 30, height: 40, alignItems: 'center', justifyContent: 'center' },
  timelineButton: { height: 54, marginTop: 28, paddingHorizontal: 18, borderRadius: 12, backgroundColor: colors.dark, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  timelineText: { fontFamily: fonts.bodySemiBold, fontSize: 14, color: colors.surface },
});
