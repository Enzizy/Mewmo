import { Feather } from '@expo/vector-icons';
import { Href, useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { AppScreen } from '@/components/AppScreen';
import { PageHeader } from '@/components/page-header';
import { SectionHeading } from '@/components/section-heading';
import { colors, fonts } from '@/constants/theme';

const tools = [
  { id: 'image-tools', title: 'Image Tools', description: 'Convert, compress, and resize images.', icon: 'image' as const, route: '/tools/image-tools' as const, availability: 'Runs on your device', badgeIcon: 'smartphone' as const },
  { id: 'pdf-tools', title: 'PDF & Document Tools', description: 'Create, merge, extract, and reorder PDF pages.', icon: 'file-text' as const, route: '/tools/pdf-tools' as const, availability: 'Private on-device processing', badgeIcon: 'lock' as const },
  { id: 'weather', title: 'Weather Forecast', description: 'Current conditions and a seven-day outlook for your saved city.', icon: 'cloud' as const, route: '/tools/weather' as const, availability: 'Free live forecast · cached offline', badgeIcon: 'wifi' as const },
  { id: 'currency-converter', title: 'Currency Converter', description: 'Compare amounts across currencies with clear rate details.', icon: 'dollar-sign' as const, route: '/tools/currency-converter' as const, availability: 'Live Twelve Data rates', badgeIcon: 'wifi' as const },
  { id: 'unit-converter', title: 'Unit Converter', description: 'Convert everyday measurements without leaving the app.', icon: 'sliders' as const, route: '/tools/unit-converter' as const, availability: 'Instant offline calculations', badgeIcon: 'smartphone' as const },
  { id: 'ar-measure', title: 'AR Measure', description: 'Pin two camera points for an approximate real-world length.', icon: 'maximize-2' as const, route: '/tools/ar-measure' as const, availability: 'Android · runs on your device', badgeIcon: 'camera' as const },
];

export default function ToolsScreen() {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const filtered = useMemo(() => tools.filter((tool) => `${tool.title} ${tool.description}`.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase())), [query]);
  return (
    <AppScreen assistant>
      <PageHeader title="Tools" supporting="Focused utilities for the jobs you need to finish." />
      <View style={styles.searchWrap}><Feather name="search" size={19} color={colors.muted} /><TextInput accessibilityLabel="Search tools" value={query} onChangeText={setQuery} placeholder="Search tools" placeholderTextColor={colors.muted} returnKeyType="search" style={styles.searchInput} />{query ? <Pressable accessibilityRole="button" accessibilityLabel="Clear tool search" onPress={() => setQuery('')} style={styles.clear}><Feather name="x" size={18} color={colors.secondary} /></Pressable> : null}</View>
      <View style={styles.section}><SectionHeading title="All tools" detail={`${filtered.length} ${filtered.length === 1 ? 'tool' : 'tools'}`} /><View style={styles.list}>{filtered.map((tool) => <Pressable accessibilityRole="button" key={tool.id} onPress={() => router.push(tool.route as Href)} style={({ pressed }) => [styles.tool, pressed && styles.pressed]}><View style={styles.toolIcon}><Feather name={tool.icon} size={22} color={colors.ink} /></View><View style={styles.main}><Text style={styles.toolTitle}>{tool.title}</Text><Text style={styles.toolDetail}>{tool.description}</Text><View style={styles.localBadge}><Feather name={tool.badgeIcon} size={12} color={colors.secondary} /><Text style={styles.localText}>{tool.availability}</Text></View></View><Feather name="chevron-right" size={20} color={colors.muted} /></Pressable>)}{!filtered.length ? <View style={styles.empty}><Text style={styles.emptyTitle}>No matching tools</Text><Text style={styles.emptyText}>Try a broader search.</Text></View> : null}</View></View>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  searchWrap: { minHeight: 50, marginTop: 24, paddingHorizontal: 15, flexDirection: 'row', alignItems: 'center', gap: 11, borderRadius: 12, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.paper },
  searchInput: { flex: 1, minHeight: 48, fontFamily: fonts.body, fontSize: 14, color: colors.ink },
  clear: { width: 40, height: 44, marginRight: -10, alignItems: 'center', justifyContent: 'center' },
  section: { marginTop: 34 },
  list: { marginTop: 12, borderTopWidth: 1, borderTopColor: colors.border },
  tool: { minHeight: 112, paddingVertical: 18, flexDirection: 'row', alignItems: 'center', gap: 14, borderBottomWidth: 1, borderBottomColor: colors.border },
  toolIcon: { width: 48, height: 48, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.paper, borderWidth: 1, borderColor: colors.border },
  main: { flex: 1, minWidth: 0 },
  toolTitle: { fontFamily: fonts.bodySemiBold, fontSize: 16, lineHeight: 21, color: colors.ink },
  toolDetail: { marginTop: 4, fontFamily: fonts.body, fontSize: 13, lineHeight: 19, color: colors.secondary },
  localBadge: { marginTop: 9, flexDirection: 'row', alignItems: 'center', gap: 5 },
  localText: { fontFamily: fonts.bodyMedium, fontSize: 10, color: colors.secondary },
  empty: { minHeight: 110, justifyContent: 'center', borderBottomWidth: 1, borderBottomColor: colors.border },
  emptyTitle: { fontFamily: fonts.bodySemiBold, fontSize: 14, color: colors.ink },
  emptyText: { marginTop: 4, fontFamily: fonts.body, fontSize: 13, color: colors.secondary },
  pressed: { opacity: 0.68 },
});
