import { Feather } from '@expo/vector-icons';
import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { AppScreen } from '@/components/AppScreen';
import { ItemRow } from '@/components/ItemRow';
import { colors, fonts } from '@/constants/theme';
import { useItems } from '@/store/ItemsContext';
import { Category } from '@/types';
import { categoryMeta } from '@/components/CategoryIcon';

const recentSearches = ['weekend plan', 'portfolio', 'Bohol trip'];
const categories: Category[] = ['task', 'reminder', 'idea', 'note'];

export default function SearchScreen() {
  const { items } = useItems();
  const [query, setQuery] = useState('');
  const results = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return [];
    return items.filter((item) => `${item.title} ${item.detail ?? ''} ${categoryMeta[item.category].label}`.toLowerCase().includes(normalized));
  }, [items, query]);

  return (
    <AppScreen bottomNav background={colors.paper}>
      <Text style={styles.title}>Search your thoughts</Text>
      <View style={styles.searchBar}><Feather name="search" size={20} color={colors.secondary} /><TextInput accessibilityLabel="Search your thoughts" value={query} onChangeText={setQuery} autoCapitalize="none" placeholder="Tasks, notes, recordings..." placeholderTextColor={colors.muted} style={styles.input} />{query.length > 0 && <Pressable accessibilityLabel="Clear search" onPress={() => setQuery('')} style={styles.clear}><Feather name="x" size={18} color={colors.secondary} /></Pressable>}</View>
      {!query ? <View>
        <Text style={styles.help}>Search tasks, ideas, notes, reminders, or even something you said in a recording.</Text>
        <View style={styles.recents}><Text style={styles.sectionLabel}>RECENT SEARCHES</Text>{recentSearches.map((search) => <Pressable accessibilityRole="button" key={search} onPress={() => setQuery(search)} style={styles.recentRow}><Feather name="clock" size={16} color={colors.muted} /><Text style={styles.recentText}>{search}</Text><Feather name="arrow-up-left" size={16} color={colors.muted} /></Pressable>)}</View>
      </View> : <View style={styles.results}>
        <Text style={styles.resultCount}>{results.length} {results.length === 1 ? 'result' : 'results'}</Text>
        {categories.map((category) => {
          const grouped = results.filter((item) => item.category === category);
          if (!grouped.length) return null;
          return <View key={category} style={styles.group}><Text style={styles.sectionLabel}>{categoryMeta[category].label.toUpperCase()}S</Text>{grouped.map((item) => <ItemRow key={item.id} item={item} />)}</View>;
        })}
        {!results.length && <View style={styles.empty}><Feather name="search" size={30} color={colors.muted} /><Text style={styles.emptyTitle}>No matching thoughts</Text><Text style={styles.emptyText}>Try another word or category.</Text></View>}
      </View>}
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  title: { marginTop: 10, fontFamily: fonts.editorialSemiBold, fontSize: 35, lineHeight: 40, color: colors.ink },
  searchBar: { minHeight: 52, marginTop: 24, paddingHorizontal: 15, flexDirection: 'row', alignItems: 'center', gap: 10, borderRadius: 12, borderWidth: 1, borderColor: colors.borderStrong, backgroundColor: colors.surface },
  input: { flex: 1, height: 50, fontFamily: fonts.body, fontSize: 15, color: colors.ink, outlineStyle: 'none' } as never,
  clear: { width: 34, height: 40, alignItems: 'center', justifyContent: 'center' },
  help: { marginTop: 18, maxWidth: 330, fontFamily: fonts.body, fontSize: 14, lineHeight: 22, color: colors.secondary },
  recents: { marginTop: 38 },
  sectionLabel: { marginBottom: 5, fontFamily: fonts.bodySemiBold, fontSize: 10, letterSpacing: 1.2, color: colors.muted },
  recentRow: { minHeight: 52, flexDirection: 'row', alignItems: 'center', gap: 12, borderBottomWidth: 1, borderBottomColor: colors.border },
  recentText: { flex: 1, fontFamily: fonts.body, fontSize: 14, color: colors.ink },
  results: { marginTop: 24 },
  resultCount: { fontFamily: fonts.bodyMedium, fontSize: 12, color: colors.secondary },
  group: { marginTop: 28 },
  empty: { alignItems: 'center', paddingTop: 62 },
  emptyTitle: { marginTop: 14, fontFamily: fonts.bodySemiBold, fontSize: 16, color: colors.ink },
  emptyText: { marginTop: 5, fontFamily: fonts.body, fontSize: 13, color: colors.secondary },
});
