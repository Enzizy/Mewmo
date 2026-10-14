import { Feather } from '@expo/vector-icons';
import { Href, useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { Platform, Pressable, Text, TextInput, View } from 'react-native';
import { AppScreen } from '@/components/AppScreen';
import { PageHeader } from '@/components/page-header';
import { SectionHeading } from '@/components/section-heading';
import { colors, fonts, themedStyles } from '@/constants/theme';
import { useTheme } from '@/store/ThemeContext';

const tools = [
  { id: 'image-tools', title: 'Image Tools', description: 'Convert, compress, and resize images.', icon: 'image' as const, route: '/tools/image-tools' as const, availability: 'Runs on your device', badgeIcon: 'smartphone' as const },
  { id: 'pdf-tools', title: 'PDF & Document Tools', description: 'Create, merge, extract, and reorder PDF pages.', icon: 'file-text' as const, route: '/tools/pdf-tools' as const, availability: 'Private on-device processing', badgeIcon: 'lock' as const },
  { id: 'weather', title: 'Weather Forecast', description: 'Current conditions and a seven-day outlook for your saved city.', icon: 'cloud' as const, route: '/tools/weather' as const, availability: 'Free live forecast · cached offline', badgeIcon: 'wifi' as const },
  { id: 'currency-converter', title: 'Currency Converter', description: 'Compare amounts across currencies with clear rate details.', icon: 'dollar-sign' as const, route: '/tools/currency-converter' as const, availability: 'Live Twelve Data rates', badgeIcon: 'wifi' as const },
  { id: 'unit-converter', title: 'Unit Converter', description: 'Convert everyday measurements without leaving the app.', icon: 'sliders' as const, route: '/tools/unit-converter' as const, availability: 'Instant offline calculations', badgeIcon: 'smartphone' as const },
  { id: 'ar-measure', title: 'AR Measure', description: 'Pin two camera points for an approximate real-world length.', icon: 'maximize-2' as const, route: '/tools/ar-measure' as const, availability: 'Android only', badgeIcon: 'camera' as const },
];

export default function ToolsScreen() {
  useTheme();
  const router = useRouter();
  const [query, setQuery] = useState('');
  const filtered = useMemo(() => tools.filter((tool) => `${tool.title} ${tool.description}`.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase())), [query]);
  return (
    <AppScreen assistant>
      <PageHeader title="Tools" supporting="Choose what you need to do." />
      <View style={styles.searchWrap}><Feather name="search" size={19} color={colors.muted} /><TextInput accessibilityLabel="Search tools" value={query} onChangeText={setQuery} placeholder="Try PDF, resize, or weather" placeholderTextColor={colors.muted} autoCorrect={false} autoCapitalize="none" returnKeyType="search" style={styles.searchInput} />{query ? <Pressable accessibilityRole="button" accessibilityLabel="Clear tool search" onPress={() => setQuery('')} style={styles.clear}><Feather name="x" size={18} color={colors.secondary} /></Pressable> : null}</View>
      {!filtered.length ? <Pressable accessibilityRole="button" onPress={() => setQuery('')} style={({ pressed }) => [styles.reset, pressed && styles.pressed]}><Feather name="arrow-left" size={18} color={colors.accent} /><Text style={styles.resetText}>Clear search and show all tools</Text></Pressable> : null}
      <View style={styles.section}><SectionHeading title="Choose a tool" detail={`${filtered.length} ${filtered.length === 1 ? 'tool' : 'tools'}`} /><View style={styles.list}>{filtered.map((tool) => { const unavailable = tool.id === 'ar-measure' && Platform.OS !== 'android'; return <Pressable accessibilityRole="button" accessibilityState={{ disabled: unavailable }} disabled={unavailable} key={tool.id} onPress={() => router.push(tool.route as Href)} style={({ pressed }) => [styles.tool, unavailable && styles.toolUnavailable, pressed && styles.pressed]}><View style={styles.toolIcon}><Feather name={tool.icon} size={21} color={unavailable ? colors.muted : colors.ink} /></View><View style={styles.main}><Text style={styles.toolTitle}>{tool.title}</Text><Text numberOfLines={2} style={styles.toolDetail}>{tool.description}</Text><View style={styles.localBadge}><Feather name={tool.badgeIcon} size={12} color={colors.secondary} /><Text style={styles.localText}>{tool.availability}</Text></View></View><Feather name={unavailable ? 'lock' : 'chevron-right'} size={18} color={colors.muted} /></Pressable>; })}{!filtered.length ? <View style={styles.empty}><Text style={styles.emptyTitle}>No matching tools</Text><Text style={styles.emptyText}>Try a broader search.</Text></View> : null}</View></View>
    </AppScreen>
  );
}

const styles = themedStyles(() => ({
  searchWrap: { minHeight: 50, marginTop: 24, paddingHorizontal: 15, flexDirection: 'row', alignItems: 'center', gap: 11, borderRadius: 12, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.paper },
  searchInput: { flex: 1, minHeight: 48, fontFamily: fonts.body, fontSize: 14, color: colors.ink },
  clear: { width: 40, height: 44, marginRight: -10, alignItems: 'center', justifyContent: 'center' },
  section: { marginTop: 28 },
  list: { marginTop: 12, gap: 9 },
  tool: { minHeight: 96, padding: 14, flexDirection: 'row', alignItems: 'center', gap: 12, borderWidth: 1, borderColor: colors.border, borderRadius: 14, backgroundColor: colors.paper },
  toolUnavailable: { opacity: 0.58 },
  toolIcon: { width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.accentSoft },
  main: { flex: 1, minWidth: 0 },
  toolTitle: { fontFamily: fonts.bodySemiBold, fontSize: 15, lineHeight: 20, color: colors.ink },
  toolDetail: { marginTop: 3, fontFamily: fonts.body, fontSize: 12, lineHeight: 17, color: colors.secondary },
  localBadge: { marginTop: 6, flexDirection: 'row', alignItems: 'center', gap: 5 },
  localText: { flex: 1, fontFamily: fonts.bodyMedium, fontSize: 12, lineHeight: 17, color: colors.secondary },
  reset: { minHeight: 48, marginTop: 12, flexDirection: 'row', alignItems: 'center', gap: 8 },
  resetText: { flex: 1, fontFamily: fonts.bodySemiBold, fontSize: 14, color: colors.accent },
  empty: { minHeight: 110, justifyContent: 'center', borderBottomWidth: 1, borderBottomColor: colors.border },
  emptyTitle: { fontFamily: fonts.bodySemiBold, fontSize: 14, color: colors.ink },
  emptyText: { marginTop: 4, fontFamily: fonts.body, fontSize: 13, color: colors.secondary },
  pressed: { opacity: 0.68 },
}));
