import { Feather } from '@expo/vector-icons';
import { Host, Switch } from '@expo/ui';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { AppScreen } from '@/components/AppScreen';
import { useAppDialog } from '@/components/AppDialog';
import { PageHeader } from '@/components/page-header';
import { ScreenHeader } from '@/components/ScreenHeader';
import { SectionHeading } from '@/components/section-heading';
import { colors, fonts, radius } from '@/constants/theme';
import { HOME_SHORTCUTS, HOME_WIDGETS } from '@/features/home/home-preferences';
import { useItems } from '@/store/ItemsContext';
import type { HomePreferences, HomeShortcutId, HomeWidgetId } from '@/types';

export default function HomeCustomizeScreen() {
  const router = useRouter();
  const { showDialog } = useAppDialog();
  const { homePreferences, updateHomePreferences } = useItems();
  const [draft, setDraft] = useState<HomePreferences>(homePreferences);
  const [saving, setSaving] = useState(false);

  const move = (id: HomeWidgetId, direction: -1 | 1) => setDraft((current) => {
    const order = [...current.order];
    const index = order.indexOf(id);
    const target = index + direction;
    if (index < 0 || target < 0 || target >= order.length) return current;
    [order[index], order[target]] = [order[target], order[index]];
    return { ...current, order };
  });
  const toggleIn = (key: 'hidden' | 'compact', id: HomeWidgetId) => setDraft((current) => ({ ...current, [key]: current[key].includes(id) ? current[key].filter((value) => value !== id) : [...current[key], id] }));
  const toggleShortcut = (id: HomeShortcutId) => setDraft((current) => {
    if (current.shortcuts.includes(id)) return { ...current, shortcuts: current.shortcuts.filter((value) => value !== id) };
    if (current.shortcuts.length >= 4) {
      showDialog({ title: 'Four shortcuts maximum', message: 'Remove one pinned action before adding another.', tone: 'info' });
      return current;
    }
    return { ...current, shortcuts: [...current.shortcuts, id] };
  });
  const save = async () => {
    setSaving(true);
    try { await updateHomePreferences(draft); router.back(); }
    catch (error) { setSaving(false); showDialog({ title: 'Could not customize Home', message: error instanceof Error ? error.message : 'Try again.', tone: 'danger' }); }
  };

  return <AppScreen>
    <ScreenHeader back />
    <PageHeader title="Customize Home" supporting="Keep important information visible and move supporting widgets out of the way." />

    <View style={styles.balanceRow}><View style={styles.main}><Text style={styles.balanceTitle}>Show financial balances</Text><Text style={styles.balanceDetail}>Turn this off to hide amounts while keeping wallet navigation available.</Text></View><Host accessible accessibilityLabel="Show financial balances on Home" accessibilityRole="switch" accessibilityState={{ checked: draft.balancesVisible }} matchContents><Switch value={draft.balancesVisible} onValueChange={(balancesVisible) => setDraft((current) => ({ ...current, balancesVisible }))} /></Host></View>

    <View style={styles.balanceRow}><View style={styles.main}><Text style={styles.balanceTitle}>Show balance on Android widget</Text><Text style={styles.balanceDetail}>Off by default. Enable only if you are comfortable showing your available wallet while the phone is unlocked.</Text></View><Host accessible accessibilityLabel="Show financial balance on Android widget" accessibilityRole="switch" accessibilityState={{ checked: draft.widgetBalancesVisible }} matchContents><Switch value={draft.widgetBalancesVisible} onValueChange={(widgetBalancesVisible) => setDraft((current) => ({ ...current, widgetBalancesVisible }))} /></Host></View>

    <View style={styles.section}><SectionHeading title="Widgets" detail="Reorder, hide, or use the compact version" /><View style={styles.list}>{draft.order.map((id, index) => { const widget = HOME_WIDGETS.find((candidate) => candidate.id === id)!; const visible = !draft.hidden.includes(id); const compact = draft.compact.includes(id); return <View key={id} style={styles.widget}><View style={styles.reorder}><Pressable accessibilityLabel={`Move ${widget.title} up`} accessibilityRole="button" disabled={index === 0} onPress={() => move(id, -1)} style={[styles.iconButton, index === 0 && styles.disabled]}><Feather name="chevron-up" size={18} color={colors.secondary} /></Pressable><Pressable accessibilityLabel={`Move ${widget.title} down`} accessibilityRole="button" disabled={index === draft.order.length - 1} onPress={() => move(id, 1)} style={[styles.iconButton, index === draft.order.length - 1 && styles.disabled]}><Feather name="chevron-down" size={18} color={colors.secondary} /></Pressable></View><View style={styles.main}><Text style={styles.widgetTitle}>{widget.title}</Text><Text style={styles.widgetDetail}>{widget.detail}</Text><Pressable accessibilityRole="checkbox" accessibilityState={{ checked: compact }} disabled={!visible} onPress={() => toggleIn('compact', id)} style={[styles.compact, !visible && styles.disabled]}><View style={[styles.checkbox, compact && styles.checkboxOn]}>{compact ? <Feather name="check" size={12} color={colors.paper} /> : null}</View><Text style={styles.compactLabel}>Compact</Text></Pressable></View><Host accessible accessibilityLabel={`Show ${widget.title}`} accessibilityRole="switch" accessibilityState={{ checked: visible }} matchContents><Switch value={visible} onValueChange={() => toggleIn('hidden', id)} /></Host></View>; })}</View></View>

    <View style={styles.section}><SectionHeading title="Pinned actions" detail={`${draft.shortcuts.length} of 4 selected`} /><View style={styles.chips}>{HOME_SHORTCUTS.map((shortcut) => { const selected = draft.shortcuts.includes(shortcut.id); return <Pressable accessibilityRole="checkbox" accessibilityState={{ checked: selected }} key={shortcut.id} onPress={() => toggleShortcut(shortcut.id)} style={[styles.chip, selected && styles.chipSelected]}><Feather name={selected ? 'check' : 'plus'} size={14} color={selected ? colors.paper : colors.secondary} /><Text style={[styles.chipText, selected && styles.chipTextSelected]}>{shortcut.title}</Text></Pressable>; })}</View></View>

    <Pressable accessibilityRole="button" disabled={saving} onPress={save} style={[styles.save, saving && styles.disabled]}><Text style={styles.saveText}>{saving ? 'Saving…' : 'Save Home layout'}</Text><Feather name="check" size={18} color={colors.paper} /></Pressable>
  </AppScreen>;
}

const styles = StyleSheet.create({
  balanceRow: { minHeight: 82, marginTop: 20, padding: 16, flexDirection: 'row', alignItems: 'center', gap: 14, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.paper }, main: { flex: 1, minWidth: 0 }, balanceTitle: { fontFamily: fonts.bodySemiBold, fontSize: 14, color: colors.ink }, balanceDetail: { marginTop: 4, fontFamily: fonts.body, fontSize: 11, lineHeight: 16, color: colors.secondary }, section: { marginTop: 32 }, list: { marginTop: 11, borderTopWidth: 1, borderTopColor: colors.border }, widget: { minHeight: 94, paddingVertical: 10, flexDirection: 'row', alignItems: 'center', gap: 9, borderBottomWidth: 1, borderBottomColor: colors.border }, reorder: { width: 42 }, iconButton: { width: 42, height: 36, alignItems: 'center', justifyContent: 'center' }, widgetTitle: { fontFamily: fonts.bodySemiBold, fontSize: 13, color: colors.ink }, widgetDetail: { marginTop: 2, fontFamily: fonts.body, fontSize: 10, lineHeight: 14, color: colors.secondary }, compact: { alignSelf: 'flex-start', minHeight: 34, marginTop: 5, flexDirection: 'row', alignItems: 'center', gap: 6 }, checkbox: { width: 18, height: 18, alignItems: 'center', justifyContent: 'center', borderRadius: 5, borderWidth: 1, borderColor: colors.borderStrong }, checkboxOn: { borderColor: colors.ink, backgroundColor: colors.ink }, compactLabel: { fontFamily: fonts.bodyMedium, fontSize: 11, color: colors.secondary }, disabled: { opacity: 0.35 }, chips: { marginTop: 12, flexDirection: 'row', flexWrap: 'wrap', gap: 8 }, chip: { minHeight: 42, paddingHorizontal: 13, flexDirection: 'row', alignItems: 'center', gap: 7, borderRadius: 21, borderWidth: 1, borderColor: colors.borderStrong, backgroundColor: colors.paper }, chipSelected: { borderColor: colors.ink, backgroundColor: colors.ink }, chipText: { fontFamily: fonts.bodyMedium, fontSize: 12, color: colors.secondary }, chipTextSelected: { color: colors.paper }, save: { minHeight: 54, marginTop: 34, paddingHorizontal: 17, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderRadius: radius.md, backgroundColor: colors.ink }, saveText: { fontFamily: fonts.bodySemiBold, fontSize: 14, color: colors.paper },
});
