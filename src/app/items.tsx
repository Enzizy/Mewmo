import { Feather } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { AppScreen } from '@/components/AppScreen';
import { ItemRow } from '@/components/ItemRow';
import { colors, fonts } from '@/constants/theme';
import { useItems } from '@/store/ItemsContext';
import { Category } from '@/types';

type Filter = 'all' | Category;
const filters: { value: Filter; label: string }[] = [
  { value: 'all', label: 'All' }, { value: 'task', label: 'Tasks' }, { value: 'reminder', label: 'Reminders' }, { value: 'idea', label: 'Ideas' }, { value: 'note', label: 'Notes' },
];

export default function AllItemsScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ category?: Category }>();
  const { items } = useItems();
  const [filter, setFilter] = useState<Filter>(params.category ?? 'all');
  const filtered = useMemo(() => filter === 'all' ? items : items.filter((item) => item.category === filter), [filter, items]);
  const groups = [...new Set(filtered.map((item) => item.dateLabel))];

  return (
    <AppScreen bottomNav background={colors.paper}>
      <View style={styles.topbar}><View><Text style={styles.title}>QUESTS</Text><Text style={styles.count}>{filtered.length} thoughts, neatly gathered</Text></View><Pressable accessibilityLabel="Search quests" onPress={() => router.push('/search')} style={styles.search}><Feather name="search" size={21} color={colors.ink} /></Pressable></View>
      <View accessibilityRole="tablist" style={styles.filters}>{filters.map((item) => <Pressable accessibilityRole="tab" accessibilityState={{ selected: filter === item.value }} key={item.value} onPress={() => setFilter(item.value)} style={[styles.filter, filter === item.value && styles.filterActive]}><Text style={[styles.filterText, filter === item.value && styles.filterTextActive]}>{item.label}</Text></Pressable>)}</View>
      {groups.map((group) => {
        const groupItems = filtered.filter((item) => item.dateLabel === group);
        if (!groupItems.length) return null;
        return <View key={group} style={styles.group}><Text style={styles.groupTitle}>{group.toUpperCase()}</Text>{groupItems.map((item) => <ItemRow key={item.id} item={item} showDate={false} />)}</View>;
      })}
      {!filtered.length && <View style={styles.empty}><Feather name="inbox" size={28} color={colors.muted} /><Text style={styles.emptyTitle}>Nothing here yet</Text><Text style={styles.emptyText}>Your next Mewmo recording can fill this space.</Text></View>}
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  topbar: { minHeight: 64, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  search: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  title: { fontFamily: fonts.editorialSemiBold, fontSize: 36, color: colors.ink },
  count: { marginTop: 4, fontFamily: fonts.body, fontSize: 13, color: colors.secondary },
  filters: { flexDirection: 'row', gap: 7, marginTop: 24, marginHorizontal: -2 },
  filter: { minHeight: 36, paddingHorizontal: 12, borderRadius: 10, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' },
  filterActive: { backgroundColor: colors.dark, borderColor: colors.dark },
  filterText: { fontFamily: fonts.bodyMedium, fontSize: 12, color: colors.secondary },
  filterTextActive: { color: colors.surface },
  group: { marginTop: 30 },
  groupTitle: { marginBottom: 4, fontFamily: fonts.bodySemiBold, fontSize: 11, letterSpacing: 1.2, color: colors.muted },
  empty: { alignItems: 'center', paddingVertical: 64 },
  emptyTitle: { marginTop: 14, fontFamily: fonts.bodySemiBold, fontSize: 16, color: colors.ink },
  emptyText: { marginTop: 5, fontFamily: fonts.body, fontSize: 13, color: colors.secondary },
});
