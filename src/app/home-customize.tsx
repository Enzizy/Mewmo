import { Feather } from '@expo/vector-icons';
import { Host, Switch } from '@expo/ui';
import { useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Platform, Pressable, Text, useWindowDimensions, View } from 'react-native';
import { AppScreen } from '@/components/AppScreen';
import { useAppDialog } from '@/components/AppDialog';
import { PageHeader } from '@/components/page-header';
import { ScreenHeader } from '@/components/ScreenHeader';
import { SectionHeading } from '@/components/section-heading';
import { colors, fonts, radius, themedStyles } from '@/constants/theme';
import { DEFAULT_HOME_PREFERENCES, HOME_SHORTCUTS, HOME_WIDGETS } from '@/features/home/home-preferences';
import { useItems } from '@/store/ItemsContext';
import { useTheme } from '@/store/ThemeContext';
import type { HomePreferences, HomeShortcutId, HomeWidgetId } from '@/types';

const widgetIcons: Record<HomeWidgetId, keyof typeof Feather.glyphMap> = {
  review: 'inbox',
  weather: 'cloud',
  money: 'credit-card',
  goals: 'target',
  schedule: 'calendar',
  attention: 'alert-circle',
  'coming-up': 'clock',
  shortcuts: 'zap',
};

const shortcutIcons: Record<HomeShortcutId, keyof typeof Feather.glyphMap> = {
  'add-income': 'plus-circle',
  'add-expense': 'arrow-up-right',
  'add-investment': 'trending-up',
  'add-reminder': 'calendar',
  currency: 'repeat',
  'image-tools': 'image',
  'pdf-tools': 'file-text',
  weather: 'cloud',
};

const cloneDefaultPreferences = (): HomePreferences => ({
  ...DEFAULT_HOME_PREFERENCES,
  order: [...DEFAULT_HOME_PREFERENCES.order],
  hidden: [...DEFAULT_HOME_PREFERENCES.hidden],
  compact: [...DEFAULT_HOME_PREFERENCES.compact],
  shortcuts: [...DEFAULT_HOME_PREFERENCES.shortcuts],
});

export default function HomeCustomizeScreen() {
  useTheme();
  const router = useRouter();
  const { width } = useWindowDimensions();
  const isNarrow = width < 600;
  const { showDialog } = useAppDialog();
  const { hydrated, homePreferences, updateHomePreferences } = useItems();
  const [draft, setDraft] = useState<HomePreferences>(homePreferences);
  const [draftReady, setDraftReady] = useState(hydrated);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!hydrated || draftReady) return;
    setDraft(homePreferences);
    setDraftReady(true);
  }, [draftReady, homePreferences, hydrated]);

  const changed = useMemo(
    () => draftReady && JSON.stringify(draft) !== JSON.stringify(homePreferences),
    [draft, draftReady, homePreferences],
  );
  const atDefaults = useMemo(
    () => JSON.stringify(draft) === JSON.stringify(DEFAULT_HOME_PREFERENCES),
    [draft],
  );
  const visibleWidgets = draft.order.filter((id) => !draft.hidden.includes(id));
  const hiddenWidgets = draft.order.filter((id) => draft.hidden.includes(id));

  const move = (id: HomeWidgetId, direction: -1 | 1) => setDraft((current) => {
    const visible = current.order.filter((widgetId) => !current.hidden.includes(widgetId));
    const hidden = current.order.filter((widgetId) => current.hidden.includes(widgetId));
    const index = visible.indexOf(id);
    const target = index + direction;
    if (index < 0 || target < 0 || target >= visible.length) return current;
    [visible[index], visible[target]] = [visible[target], visible[index]];
    return { ...current, order: [...visible, ...hidden] };
  });

  const setCardSize = (id: HomeWidgetId, compact: boolean) => setDraft((current) => {
    if (current.compact.includes(id) === compact) return current;
    return {
      ...current,
      compact: compact
        ? [...current.compact, id]
        : current.compact.filter((value) => value !== id),
    };
  });

  const setWidgetVisible = (id: HomeWidgetId, visible: boolean) => setDraft((current) => {
    const shown = current.order.filter((widgetId) => widgetId !== id && !current.hidden.includes(widgetId));
    const hidden = current.order.filter((widgetId) => widgetId !== id && current.hidden.includes(widgetId));
    return visible
      ? { ...current, order: [...shown, id, ...hidden], hidden: current.hidden.filter((widgetId) => widgetId !== id) }
      : { ...current, order: [...shown, ...hidden, id], hidden: [...current.hidden.filter((widgetId) => widgetId !== id), id] };
  });

  const toggleShortcut = (id: HomeShortcutId) => setDraft((current) => {
    if (current.shortcuts.includes(id)) {
      return { ...current, shortcuts: current.shortcuts.filter((value) => value !== id) };
    }
    if (current.shortcuts.length >= 4) {
      showDialog({ title: 'Four actions maximum', message: 'Remove one pinned action before adding another.', tone: 'info' });
      return current;
    }
    return { ...current, shortcuts: [...current.shortcuts, id] };
  });

  const leave = () => {
    if (!changed) {
      router.canGoBack() ? router.back() : router.replace('/');
      return;
    }
    showDialog({
      title: 'Discard your changes?',
      message: 'Your Home layout has unsaved changes.',
      tone: 'warning',
      dismissible: false,
      actions: [
        { label: 'Keep editing', variant: 'secondary' },
        { label: 'Discard', variant: 'danger', onPress: () => router.canGoBack() ? router.back() : router.replace('/') },
      ],
    });
  };

  const save = async () => {
    if (!draftReady || saving || !changed) return;
    setSaving(true);
    try {
      await updateHomePreferences(draft);
      router.replace('/');
    } catch (error) {
      setSaving(false);
      showDialog({ title: 'Could not customize Home', message: error instanceof Error ? error.message : 'Try again.', tone: 'danger' });
    }
  };

  const saveButton = (
    <Pressable
      accessibilityLabel={changed ? 'Save Home changes' : 'Home changes saved'}
      accessibilityRole="button"
      accessibilityState={{ disabled: !changed || saving }}
      disabled={!draftReady || saving || !changed}
      onPress={save}
      style={[styles.save, !changed && styles.saved, (!draftReady || saving) && styles.disabled]}
    >
      {saving ? <ActivityIndicator size="small" color={colors.paper} /> : <Feather name="check" size={16} color={changed ? colors.paper : colors.green} />}
      <Text style={[styles.saveText, !changed && styles.savedText]}>{saving ? 'Saving…' : changed ? 'Save changes' : 'Saved'}</Text>
    </Pressable>
  );

  return (
    <AppScreen>
      <ScreenHeader back onBack={leave} />
      <PageHeader
        title="Customize Home"
        supporting="Choose what you see first. Changes apply after you save."
        action={saveButton}
      />

      {!draftReady ? (
        <View style={styles.loading}>
          <ActivityIndicator color={colors.ink} />
          <Text style={styles.loadingText}>Loading your Home layout…</Text>
        </View>
      ) : (
        <>
          <View style={styles.infoBanner}>
            <View style={styles.infoIcon}><Feather name="smartphone" size={18} color={colors.accent} /></View>
            <View style={styles.main}>
              <Text style={styles.infoTitle}>Mobile Home controls</Text>
              <Text style={styles.infoText}>Order and card size apply to phones. Enabled widgets with nothing to show stay out of the way until they become useful.</Text>
            </View>
          </View>

          <View style={styles.section}>
            <SectionHeading title="Balance privacy" detail="Control where your financial totals appear." />
            <View style={styles.settingsCard}>
              <SettingRow
                title="Show balances in LifeDesk"
                detail="Hide amounts on Home while keeping Wallet available."
                value={draft.balancesVisible}
                onValueChange={(balancesVisible) => setDraft((current) => ({ ...current, balancesVisible }))}
              />
              {Platform.OS === 'android' ? <><View style={styles.settingDivider} /><SettingRow
                title="Show balance on Android widget"
                detail="Displays your available wallet balance on the phone's home screen."
                value={draft.widgetBalancesVisible}
                onValueChange={(widgetBalancesVisible) => setDraft((current) => ({ ...current, widgetBalancesVisible }))}
              /></> : null}
            </View>
          </View>

          <View style={styles.section}>
            <SectionHeading
              title="Visible widgets"
              detail={`${visibleWidgets.length} enabled on Home`}
              action={(
                <Pressable
                  accessibilityRole="button"
                  accessibilityState={{ disabled: atDefaults }}
                  disabled={atDefaults}
                  onPress={() => setDraft(cloneDefaultPreferences())}
                  style={[styles.resetButton, atDefaults && styles.disabled]}
                >
                  <Feather name="rotate-ccw" size={14} color={colors.secondary} />
                  <Text style={styles.resetText}>Reset</Text>
                </Pressable>
              )}
            />
            <View style={styles.widgetList}>
              {visibleWidgets.map((id, index) => {
                const widget = HOME_WIDGETS.find((candidate) => candidate.id === id)!;
                const compact = draft.compact.includes(id);
                return (
                  <View key={id} style={styles.widgetCard}>
                    <View style={styles.widgetHeader}>
                      <View style={styles.orderBadge}><Text style={styles.orderText}>{index + 1}</Text></View>
                      <View style={styles.widgetIcon}><Feather name={widgetIcons[id]} size={18} color={colors.accent} /></View>
                      <View style={styles.main}>
                        <Text style={styles.widgetTitle}>{widget.title}</Text>
                        <Text style={styles.widgetDetail}>{widget.detail}</Text>
                      </View>
                      <Pressable
                        accessibilityLabel={`Hide ${widget.title}`}
                        accessibilityRole="button"
                        onPress={() => setWidgetVisible(id, false)}
                        style={styles.hideButton}
                      >
                        <Feather name="eye-off" size={14} color={colors.secondary} />
                        <Text style={styles.hideText}>Hide</Text>
                      </Pressable>
                    </View>

                    {isNarrow ? (
                      <View style={styles.mobileWidgetControls}>
                        <Pressable
                          accessibilityLabel={`Move ${widget.title} up`}
                          accessibilityRole="button"
                          accessibilityState={{ disabled: index === 0 }}
                          disabled={index === 0}
                          onPress={() => move(id, -1)}
                          style={[styles.mobileControlButton, index === 0 && styles.disabled]}
                        >
                          <Feather name="arrow-up" size={15} color={colors.ink} />
                          <Text style={styles.mobileControlText}>Up</Text>
                        </Pressable>
                        <Pressable
                          accessibilityLabel={`Move ${widget.title} down`}
                          accessibilityRole="button"
                          accessibilityState={{ disabled: index === visibleWidgets.length - 1 }}
                          disabled={index === visibleWidgets.length - 1}
                          onPress={() => move(id, 1)}
                          style={[styles.mobileControlButton, index === visibleWidgets.length - 1 && styles.disabled]}
                        >
                          <Feather name="arrow-down" size={15} color={colors.ink} />
                          <Text style={styles.mobileControlText}>Down</Text>
                        </Pressable>
                        <Pressable
                          accessibilityLabel={`Use ${compact ? 'standard' : 'compact'} size for ${widget.title}`}
                          accessibilityRole="button"
                          onPress={() => setCardSize(id, !compact)}
                          style={[styles.mobileControlButton, styles.mobileSizeButton]}
                        >
                          <Feather name={compact ? 'minimize-2' : 'maximize-2'} size={15} color={colors.accent} />
                          <Text style={[styles.mobileControlText, styles.mobileSizeText]}>{compact ? 'Compact' : 'Standard'}</Text>
                        </Pressable>
                      </View>
                    ) : (
                      <View style={styles.widgetControls}>
                        <View style={styles.controlBlock}>
                          <Text style={styles.controlLabel}>POSITION</Text>
                          <View style={styles.buttonGroup}>
                            <Pressable
                              accessibilityLabel={`Move ${widget.title} up`}
                              accessibilityRole="button"
                              accessibilityState={{ disabled: index === 0 }}
                              disabled={index === 0}
                              onPress={() => move(id, -1)}
                              style={[styles.controlButton, index === 0 && styles.disabled]}
                            >
                              <Feather name="arrow-up" size={14} color={colors.ink} />
                              <Text style={styles.controlButtonText}>Up</Text>
                            </Pressable>
                            <Pressable
                              accessibilityLabel={`Move ${widget.title} down`}
                              accessibilityRole="button"
                              accessibilityState={{ disabled: index === visibleWidgets.length - 1 }}
                              disabled={index === visibleWidgets.length - 1}
                              onPress={() => move(id, 1)}
                              style={[styles.controlButton, index === visibleWidgets.length - 1 && styles.disabled]}
                            >
                              <Feather name="arrow-down" size={14} color={colors.ink} />
                              <Text style={styles.controlButtonText}>Down</Text>
                            </Pressable>
                          </View>
                        </View>

                        <View style={styles.controlBlock}>
                          <Text style={styles.controlLabel}>PHONE CARD SIZE</Text>
                          <View style={styles.segmentedControl}>
                            <Pressable
                              accessibilityRole="radio"
                              accessibilityState={{ checked: !compact }}
                              onPress={() => setCardSize(id, false)}
                              style={[styles.segment, !compact && styles.segmentSelected]}
                            >
                              <Text style={[styles.segmentText, !compact && styles.segmentTextSelected]}>Standard</Text>
                            </Pressable>
                            <Pressable
                              accessibilityRole="radio"
                              accessibilityState={{ checked: compact }}
                              onPress={() => setCardSize(id, true)}
                              style={[styles.segment, compact && styles.segmentSelected]}
                            >
                              <Text style={[styles.segmentText, compact && styles.segmentTextSelected]}>Compact</Text>
                            </Pressable>
                          </View>
                        </View>
                      </View>
                    )}
                  </View>
                );
              })}
            </View>
          </View>

          {hiddenWidgets.length ? (
            <View style={styles.section}>
              <SectionHeading title="Hidden widgets" detail="These will not appear on Home." />
              <View style={styles.hiddenList}>
                {hiddenWidgets.map((id, index) => {
                  const widget = HOME_WIDGETS.find((candidate) => candidate.id === id)!;
                  return (
                    <View key={id} style={[styles.hiddenRow, index > 0 && styles.hiddenDivider]}>
                      <View style={styles.hiddenIcon}><Feather name={widgetIcons[id]} size={17} color={colors.secondary} /></View>
                      <View style={styles.main}>
                        <Text style={styles.widgetTitle}>{widget.title}</Text>
                        <Text style={styles.widgetDetail}>{widget.detail}</Text>
                      </View>
                      <Pressable accessibilityRole="button" onPress={() => setWidgetVisible(id, true)} style={styles.showButton}>
                        <Feather name="plus" size={14} color={colors.accent} />
                        <Text style={styles.showText}>Show</Text>
                      </Pressable>
                    </View>
                  );
                })}
              </View>
            </View>
          ) : null}

          <View style={styles.section}>
            <SectionHeading title="Pinned actions" detail="Choose up to 4 shortcuts for Home." />
            {draft.hidden.includes('shortcuts') ? (
              <View style={styles.hiddenNotice}>
                <Feather name="eye-off" size={16} color={colors.mustard} />
                <Text style={styles.hiddenNoticeText}>Pinned actions is hidden from Home.</Text>
                <Pressable accessibilityRole="button" onPress={() => setWidgetVisible('shortcuts', true)} style={styles.noticeButton}>
                  <Text style={styles.noticeButtonText}>Show widget</Text>
                </Pressable>
              </View>
            ) : null}
            <View style={styles.shortcutGrid}>
              {HOME_SHORTCUTS.map((shortcut) => {
                const selectionIndex = draft.shortcuts.indexOf(shortcut.id);
                const selected = selectionIndex >= 0;
                return (
                  <Pressable
                    accessibilityRole="checkbox"
                    accessibilityState={{ checked: selected }}
                    key={shortcut.id}
                    onPress={() => toggleShortcut(shortcut.id)}
                    style={[styles.shortcut, selected && styles.shortcutSelected]}
                  >
                    <View style={[styles.shortcutIcon, selected && styles.shortcutIconSelected]}>
                      {selected
                        ? <Text style={styles.shortcutNumber}>{selectionIndex + 1}</Text>
                        : <Feather name={shortcutIcons[shortcut.id]} size={17} color={colors.secondary} />}
                    </View>
                    <Text style={[styles.shortcutText, selected && styles.shortcutTextSelected]}>{shortcut.title}</Text>
                    <Feather name={selected ? 'check-circle' : 'plus-circle'} size={17} color={selected ? colors.accent : colors.muted} />
                  </Pressable>
                );
              })}
            </View>
            <Text style={styles.selectionHelp}>{draft.shortcuts.length} of 4 selected · Numbers show their order on Home</Text>
          </View>

          <View style={styles.footer}>
            <View style={styles.footerCopy}>
              <Text style={styles.footerTitle}>{changed ? 'Ready to update Home?' : 'Your Home is up to date'}</Text>
              <Text style={styles.footerText}>{changed ? 'Save to apply visibility, order, and shortcut changes.' : 'Change any option above to create a new layout.'}</Text>
            </View>
            {saveButton}
          </View>
        </>
      )}
    </AppScreen>
  );
}

function SettingRow({ title, detail, value, onValueChange }: {
  title: string;
  detail: string;
  value: boolean;
  onValueChange: (value: boolean) => void;
}) {
  return (
    <View style={styles.settingRow}>
      <View style={styles.main}>
        <Text style={styles.settingTitle}>{title}</Text>
        <Text style={styles.settingDetail}>{detail}</Text>
      </View>
      <View style={styles.settingState}>
        <Text style={styles.settingStateText}>{value ? 'Shown' : 'Hidden'}</Text>
        <Host accessible accessibilityLabel={title} accessibilityRole="switch" accessibilityState={{ checked: value }} matchContents>
          <Switch value={value} onValueChange={onValueChange} />
        </Host>
      </View>
    </View>
  );
}

const styles = themedStyles(() => ({
  loading: { minHeight: 260, alignItems: 'center', justifyContent: 'center', gap: 12 },
  loadingText: { fontFamily: fonts.body, fontSize: 13, color: colors.secondary },
  main: { flex: 1, minWidth: 0 },
  disabled: { opacity: 0.38 },
  section: { marginTop: 32 },

  save: { minHeight: 44, paddingHorizontal: 15, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, borderRadius: radius.full, backgroundColor: colors.ink },
  saved: { borderWidth: 1, borderColor: colors.border, backgroundColor: colors.greenSoft },
  saveText: { fontFamily: fonts.bodySemiBold, fontSize: 13, color: colors.paper },
  savedText: { color: colors.green },

  infoBanner: { marginTop: 20, padding: 16, flexDirection: 'row', alignItems: 'flex-start', gap: 12, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.accentSoft },
  infoIcon: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center', borderRadius: 18, backgroundColor: colors.paper },
  infoTitle: { fontFamily: fonts.bodySemiBold, fontSize: 13, lineHeight: 18, color: colors.ink },
  infoText: { marginTop: 3, maxWidth: 650, fontFamily: fonts.body, fontSize: 12, lineHeight: 18, color: colors.secondary },

  settingsCard: { marginTop: 12, overflow: 'hidden', borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.paper },
  settingRow: { minHeight: 86, paddingHorizontal: 16, paddingVertical: 14, flexDirection: 'row', alignItems: 'center', gap: 16 },
  settingDivider: { height: 1, marginHorizontal: 16, backgroundColor: colors.border },
  settingTitle: { fontFamily: fonts.bodySemiBold, fontSize: 14, lineHeight: 19, color: colors.ink },
  settingDetail: { marginTop: 3, maxWidth: 590, fontFamily: fonts.body, fontSize: 12, lineHeight: 17, color: colors.secondary },
  settingState: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  settingStateText: { fontFamily: fonts.bodyMedium, fontSize: 11, color: colors.secondary },

  resetButton: { minHeight: 38, paddingHorizontal: 11, flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: radius.full, borderWidth: 1, borderColor: colors.borderStrong, backgroundColor: colors.paper },
  resetText: { fontFamily: fonts.bodySemiBold, fontSize: 12, color: colors.secondary },
  widgetList: { marginTop: 12, gap: 10 },
  widgetCard: { padding: 15, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.paper },
  widgetHeader: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  orderBadge: { width: 26, height: 26, alignItems: 'center', justifyContent: 'center', borderRadius: 13, backgroundColor: colors.ink },
  orderText: { fontFamily: fonts.bodyBold, fontSize: 11, color: colors.paper },
  widgetIcon: { width: 38, height: 38, alignItems: 'center', justifyContent: 'center', borderRadius: 10, backgroundColor: colors.accentSoft },
  widgetTitle: { fontFamily: fonts.bodySemiBold, fontSize: 13, lineHeight: 18, color: colors.ink },
  widgetDetail: { marginTop: 2, fontFamily: fonts.body, fontSize: 11, lineHeight: 16, color: colors.secondary },
  hideButton: { minHeight: 38, paddingHorizontal: 11, flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: radius.sm, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.background },
  hideText: { fontFamily: fonts.bodySemiBold, fontSize: 11, color: colors.secondary },
  widgetControls: { marginTop: 14, paddingTop: 13, flexDirection: 'row', flexWrap: 'wrap', gap: 18, borderTopWidth: 1, borderTopColor: colors.border },
  mobileWidgetControls: { marginTop: 12, paddingTop: 11, flexDirection: 'row', gap: 7, borderTopWidth: 1, borderTopColor: colors.border },
  mobileControlButton: { minHeight: 40, flex: 1, paddingHorizontal: 8, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, borderRadius: radius.sm, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.background },
  mobileSizeButton: { flex: 1.35, borderColor: colors.accent, backgroundColor: colors.accentSoft },
  mobileControlText: { fontFamily: fonts.bodySemiBold, fontSize: 10, color: colors.ink },
  mobileSizeText: { color: colors.accent },
  controlBlock: { minWidth: 190, flex: 1, gap: 7 },
  controlLabel: { fontFamily: fonts.bodySemiBold, fontSize: 9, letterSpacing: 0.7, color: colors.muted },
  buttonGroup: { flexDirection: 'row', gap: 7 },
  controlButton: { minHeight: 38, minWidth: 84, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, borderRadius: radius.sm, borderWidth: 1, borderColor: colors.borderStrong, backgroundColor: colors.background },
  controlButtonText: { fontFamily: fonts.bodySemiBold, fontSize: 11, color: colors.ink },
  segmentedControl: { minHeight: 38, padding: 3, flexDirection: 'row', borderRadius: 10, backgroundColor: colors.background },
  segment: { minHeight: 32, flex: 1, paddingHorizontal: 12, alignItems: 'center', justifyContent: 'center', borderRadius: 8 },
  segmentSelected: { borderWidth: 1, borderColor: colors.border, backgroundColor: colors.paper },
  segmentText: { fontFamily: fonts.bodyMedium, fontSize: 11, color: colors.secondary },
  segmentTextSelected: { fontFamily: fonts.bodySemiBold, color: colors.ink },

  hiddenList: { marginTop: 12, overflow: 'hidden', borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.paper },
  hiddenRow: { minHeight: 72, paddingHorizontal: 15, paddingVertical: 11, flexDirection: 'row', alignItems: 'center', gap: 11 },
  hiddenDivider: { borderTopWidth: 1, borderTopColor: colors.border },
  hiddenIcon: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center', borderRadius: 10, backgroundColor: colors.background },
  showButton: { minHeight: 38, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: radius.sm, borderWidth: 1, borderColor: colors.accent, backgroundColor: colors.accentSoft },
  showText: { fontFamily: fonts.bodySemiBold, fontSize: 11, color: colors.accent },

  shortcutGrid: { marginTop: 12, flexDirection: 'row', flexWrap: 'wrap', gap: 9 },
  hiddenNotice: { minHeight: 48, marginTop: 12, paddingHorizontal: 12, flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 9, borderRadius: radius.sm, backgroundColor: colors.mustardSoft },
  hiddenNoticeText: { minWidth: 180, flex: 1, fontFamily: fonts.bodyMedium, fontSize: 11, lineHeight: 16, color: colors.ink },
  noticeButton: { minHeight: 34, paddingHorizontal: 10, alignItems: 'center', justifyContent: 'center', borderRadius: radius.sm, backgroundColor: colors.paper },
  noticeButtonText: { fontFamily: fonts.bodySemiBold, fontSize: 11, color: colors.ink },
  shortcut: { minHeight: 52, minWidth: 145, flexGrow: 1, flexBasis: '46%', paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', gap: 9, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.paper },
  shortcutSelected: { borderColor: colors.accent, backgroundColor: colors.accentSoft },
  shortcutIcon: { width: 28, height: 28, alignItems: 'center', justifyContent: 'center', borderRadius: 14, backgroundColor: colors.background },
  shortcutIconSelected: { backgroundColor: colors.accent },
  shortcutNumber: { fontFamily: fonts.bodyBold, fontSize: 11, color: colors.paper },
  shortcutText: { flex: 1, fontFamily: fonts.bodyMedium, fontSize: 12, color: colors.secondary },
  shortcutTextSelected: { fontFamily: fonts.bodySemiBold, color: colors.ink },
  selectionHelp: { marginTop: 10, fontFamily: fonts.body, fontSize: 11, lineHeight: 16, color: colors.muted },

  footer: { marginTop: 36, padding: 18, flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 16, borderRadius: radius.md, backgroundColor: colors.paper, borderWidth: 1, borderColor: colors.border },
  footerCopy: { minWidth: 240, flex: 1 },
  footerTitle: { fontFamily: fonts.bodySemiBold, fontSize: 14, color: colors.ink },
  footerText: { marginTop: 3, fontFamily: fonts.body, fontSize: 12, lineHeight: 17, color: colors.secondary },
}));
