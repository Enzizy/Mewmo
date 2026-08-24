import { Feather } from '@expo/vector-icons';
import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { AppScreen } from '@/components/AppScreen';
import { categoryMeta } from '@/components/CategoryIcon';
import { ItemRow } from '@/components/ItemRow';
import { PageHeader } from '@/components/page-header';
import { ScreenHeader } from '@/components/ScreenHeader';
import { colors, fonts } from '@/constants/theme';
import { useItems } from '@/store/ItemsContext';
import { Category } from '@/types';

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
    <AppScreen assistant background={colors.paper}>
      <ScreenHeader back />
      <PageHeader title="Search" supporting="Find tasks, reminders, ideas, and notes stored on this device." />
      <View style={styles.searchBar}><Feather name="search" size={20} color={colors.secondary} /><TextInput accessibilityLabel="Search your thoughts" value={query} onChangeText={setQuery} autoCapitalize="none" autoFocus placeholder="Search your records…" placeholderTextColor={colors.muted} style={styles.input} />{query.length > 0 ? <Pressable accessibilityLabel="Clear search" accessibilityRole="button" onPress={() => setQuery('')} style={styles.clear}><Feather name="x" size={18} color={colors.secondary} /></Pressable> : null}</View>
      {!query ? <View style={styles.ready}><View style={styles.readyIcon}><Feather name="search" size={22} color={colors.muted} /></View><View style={styles.readyMain}><Text style={styles.readyTitle}>Type anything you remember</Text><Text style={styles.help}>Mewmo searches only your real saved records; it does not show sample or suggested history.</Text></View></View> : <View style={styles.results}>
        <Text style={styles.resultCount}>{results.length} {results.length === 1 ? 'result' : 'results'}</Text>
        {categories.map((category) => { const grouped = results.filter((item) => item.category === category); if (!grouped.length) return null; return <View key={category} style={styles.group}><Text style={styles.sectionLabel}>{categoryMeta[category].label.toUpperCase()}S</Text>{grouped.map((item) => <ItemRow key={item.id} item={item} />)}</View>; })}
        {!results.length ? <View style={styles.empty}><Feather name="search" size={28} color={colors.muted} /><Text style={styles.emptyTitle}>No matching records</Text><Text style={styles.emptyText}>Try another word or category.</Text></View> : null}
      </View>}
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  searchBar: { minHeight: 52, marginTop: 22, paddingHorizontal: 15, flexDirection: 'row', alignItems: 'center', gap: 10, borderRadius: 12, borderWidth: 1, borderColor: colors.borderStrong, backgroundColor: colors.surface },
  input: { flex: 1, height: 50, fontFamily: fonts.body, fontSize: 15, color: colors.ink, outlineStyle: 'none' } as never,
  clear: { width: 38, height: 44, alignItems: 'center', justifyContent: 'center' },
  ready: { minHeight: 130, marginTop: 28, flexDirection: 'row', alignItems: 'center', gap: 14, borderTopWidth: 1, borderBottomWidth: 1, borderColor: colors.border },
  readyIcon: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background },
  readyMain: { flex: 1 },
  readyTitle: { fontFamily: fonts.bodySemiBold, fontSize: 14, color: colors.ink },
  help: { marginTop: 4, fontFamily: fonts.body, fontSize: 12, lineHeight: 18, color: colors.secondary },
  results: { marginTop: 24 },
  resultCount: { fontFamily: fonts.bodyMedium, fontSize: 12, color: colors.secondary },
  group: { marginTop: 28 },
  sectionLabel: { marginBottom: 5, fontFamily: fonts.bodySemiBold, fontSize: 10, letterSpacing: 1.2, color: colors.muted },
  empty: { alignItems: 'center', paddingTop: 62 },
  emptyTitle: { marginTop: 14, fontFamily: fonts.bodySemiBold, fontSize: 16, color: colors.ink },
  emptyText: { marginTop: 5, fontFamily: fonts.body, fontSize: 13, color: colors.secondary },
});
