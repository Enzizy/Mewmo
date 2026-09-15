import { Feather } from '@expo/vector-icons';
import { Host, Switch } from '@expo/ui';
import { useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { AppScreen } from '@/components/AppScreen';
import { useAppDialog } from '@/components/AppDialog';
import { PageHeader } from '@/components/page-header';
import { ScreenHeader } from '@/components/ScreenHeader';
import { SectionHeading } from '@/components/section-heading';
import { colors, fonts, radius, themedStyles } from '@/constants/theme';
import { BudgetForm, RecurringRuleForm } from '@/features/wallet/finance-forms';
import { useItems } from '@/store/ItemsContext';
import { MonthlyBudget, RecurringRule } from '@/types';
import { confirmAction } from '@/utils/confirm-action';
import { formatPeso } from '@/utils/money';
import { nextScheduledDate } from '@/utils/recurrence';
import { useTheme } from '@/store/ThemeContext';

type Editor = { kind: 'automation'; value?: RecurringRule } | { kind: 'budget'; value?: MonthlyBudget } | null;

export default function PlanningScreen() {
  useTheme();
  const { showDialog } = useAppDialog();
  const params = useLocalSearchParams<{ action?: string }>();
  const { recurringRules, budgets, transactions, marketRefreshError, refreshMarketQuotes, toggleRecurringRule, deleteRecurringRule, deleteBudget, reload } = useItems();
  const automationRules = recurringRules.filter((rule) => rule.kind !== 'expense');
  const [editor, setEditor] = useState<Editor>(params.action === 'automation' ? { kind: 'automation' } : params.action === 'budget' ? { kind: 'budget' } : null);
  const [refreshingPrices, setRefreshingPrices] = useState(false);
  const now = new Date();
  const monthlyExpenses = transactions.filter((item) => { const date = new Date(item.occurredAt); return item.type === 'expense' && date.getFullYear() === now.getFullYear() && date.getMonth() === now.getMonth(); });

  useEffect(() => {
    if (params.action === 'automation') setEditor({ kind: 'automation' });
    if (params.action === 'budget') setEditor({ kind: 'budget' });
  }, [params.action]);

  const removeRule = (rule: RecurringRule) => showDialog(confirmAction({ title: 'Delete automation?', message: `“${rule.title}” will stop creating future review items. Confirmed wallet history stays unchanged.`, confirmLabel: 'Delete', onConfirm: () => deleteRecurringRule(rule.id).catch((error) => showDialog({ title: 'Could not delete automation', message: error instanceof Error ? error.message : 'Try again.', tone: 'danger' })) }));
  const removeBudget = (budget: MonthlyBudget) => showDialog(confirmAction({ title: 'Delete budget?', message: `This removes the ${budget.category} limit. It does not delete any expenses.`, confirmLabel: 'Delete', onConfirm: () => deleteBudget(budget.id).catch((error) => showDialog({ title: 'Could not delete budget', message: error instanceof Error ? error.message : 'Try again.', tone: 'danger' })) }));
  const retryPrices = async () => {
    if (refreshingPrices) return;
    setRefreshingPrices(true);
    try { await refreshMarketQuotes(); }
    catch (error) { showDialog({ title: 'Could not update prices', message: error instanceof Error ? error.message : 'Try again when you are online.', tone: 'danger' }); }
    finally { setRefreshingPrices(false); }
  };

  return (
    <AppScreen tabbed assistant={!editor} onRefresh={reload}>
      <ScreenHeader back />
      <PageHeader title="Plans and budgets" supporting="Automate salary and investments, then keep flexible spending within a monthly limit." />

      <View style={styles.actions}>
        <Pressable accessibilityRole="button" onPress={() => setEditor({ kind: 'automation' })} style={({ pressed }) => [styles.action, pressed && styles.pressed]}><View style={styles.actionIcon}><Feather name="repeat" size={18} color={colors.ink} /></View><View style={styles.actionMain}><Text style={styles.actionTitle}>Add automation</Text><Text style={styles.actionDetail}>Salary, BTC, or VOO contributions</Text></View><Feather name="plus" size={18} color={colors.ink} /></Pressable>
        <Pressable accessibilityRole="button" onPress={() => setEditor({ kind: 'budget' })} style={({ pressed }) => [styles.action, pressed && styles.pressed]}><View style={styles.actionIcon}><Feather name="pie-chart" size={18} color={colors.ink} /></View><View style={styles.actionMain}><Text style={styles.actionTitle}>Set monthly budget</Text><Text style={styles.actionDetail}>Groceries, transport, or another category</Text></View><Feather name="plus" size={18} color={colors.ink} /></Pressable>
      </View>

      {editor?.kind === 'automation' ? <RecurringRuleForm key={editor.value?.id ?? 'new-rule'} initialRule={editor.value} onDone={() => setEditor(null)} onCancel={() => setEditor(null)} /> : null}
      {editor?.kind === 'budget' ? <BudgetForm key={editor.value?.id ?? 'new-budget'} initialBudget={editor.value} onDone={() => setEditor(null)} onCancel={() => setEditor(null)} /> : null}

      {marketRefreshError && automationRules.some((rule) => rule.kind === 'investment' && rule.active) ? <View accessibilityRole="alert" style={styles.priceError}><Feather name="alert-circle" size={16} color={colors.danger} /><View style={styles.priceErrorMain}><Text style={styles.priceErrorText}>Live prices could not update. Investment entries wait until a current quote is available.</Text><Text style={styles.priceErrorDetail}>{marketRefreshError}</Text></View><Pressable accessibilityRole="button" disabled={refreshingPrices} onPress={retryPrices} style={({ pressed }) => [styles.retryButton, refreshingPrices && styles.retryDisabled, pressed && !refreshingPrices && styles.pressed]}><Text style={styles.retryText}>{refreshingPrices ? 'Updating…' : 'Retry'}</Text></Pressable></View> : null}

      <View style={styles.section}>
        <SectionHeading title="Automations" detail="Creates one editable review item per scheduled date" />
        <View style={styles.list}>
          {automationRules.map((rule) => (
            <View key={rule.id} style={styles.rule}>
              <View style={styles.ruleTop}>
                <View style={styles.icon}><Feather name={rule.kind === 'income' ? 'arrow-down-left' : rule.kind === 'investment' ? 'trending-up' : 'arrow-up-right'} size={17} color={colors.ink} /></View>
                <View style={styles.main}>
                  <Text style={styles.title}>{rule.title}</Text>
                  <Text style={styles.meta}>{labelForKind(rule.kind)} · {formatPeso(rule.amountMinor)} · {rule.days.map(ordinal).join(' and ')}</Text>
                  {rule.asset ? <Text style={styles.meta}>{rule.asset} · Fractional units calculated from the latest price</Text> : null}
                  <Text style={[styles.status, !rule.active && styles.paused]}>{rule.active ? `Next ${nextScheduledDate(rule) ?? 'date unavailable'}` : 'Paused'}</Text>
                </View>
                <View style={styles.rowActions}>
                  <Pressable accessibilityLabel={`Edit ${rule.title}`} accessibilityRole="button" onPress={() => setEditor({ kind: 'automation', value: rule })} style={styles.rowAction}><Feather name="edit-3" size={16} color={colors.secondary} /></Pressable>
                  <Pressable accessibilityLabel={`Delete ${rule.title}`} accessibilityRole="button" onPress={() => removeRule(rule)} style={styles.rowAction}><Feather name="trash-2" size={16} color={colors.muted} /></Pressable>
                </View>
              </View>
              <View style={styles.automationToggle}>
                <View><Text style={styles.toggleTitle}>Create scheduled reviews</Text><Text style={styles.toggleDetail}>{rule.active ? 'Wallet changes only after you confirm' : 'No new review items will be created'}</Text></View>
                <Host accessible accessibilityLabel={`Create scheduled reviews for ${rule.title}`} accessibilityRole="switch" accessibilityState={{ checked: rule.active }} matchContents>
                  <Switch value={rule.active} onValueChange={() => toggleRecurringRule(rule.id).catch((error) => showDialog({ title: 'Could not update automation', message: error instanceof Error ? error.message : 'Try again.', tone: 'danger' }))} />
                </Host>
              </View>
            </View>
          ))}
          {!automationRules.length ? <Empty icon="repeat" title="No automations yet" detail="Add salary on the 15th and 30th or recurring BTC/VOO contributions." /> : null}
        </View>
      </View>

      <View style={styles.section}>
        <SectionHeading title="Monthly budgets" detail="Matched by expense category" />
        <View style={styles.list}>
          {budgets.map((budget) => { const used = monthlyExpenses.filter((item) => item.category.toLocaleLowerCase() === budget.category.toLocaleLowerCase()).reduce((sum, item) => sum + item.amountMinor, 0); const percent = Math.min(used / budget.limitMinor, 1); return <View key={budget.id} style={styles.budget}><View style={styles.budgetTop}><View style={styles.main}><Text style={styles.title}>{budget.category}</Text><Text style={styles.meta}>{formatPeso(used)} of {formatPeso(budget.limitMinor)}</Text></View><Text style={styles.percent}>{Math.round(percent * 100)}%</Text><Pressable accessibilityLabel={`Edit ${budget.category} budget`} accessibilityRole="button" onPress={() => setEditor({ kind: 'budget', value: budget })} style={styles.rowAction}><Feather name="edit-3" size={16} color={colors.secondary} /></Pressable><Pressable accessibilityLabel={`Delete ${budget.category} budget`} accessibilityRole="button" onPress={() => removeBudget(budget)} style={styles.rowAction}><Feather name="trash-2" size={16} color={colors.muted} /></Pressable></View><View style={styles.track}><View style={[styles.fill, { width: `${percent * 100}%` }]} /></View></View>; })}
          {!budgets.length ? <Empty icon="pie-chart" title="No budgets yet" detail="Set a Groceries budget, then use the same category when recording grocery expenses." /> : null}
        </View>
      </View>
    </AppScreen>
  );
}

function Empty({ icon, title, detail }: { icon: keyof typeof Feather.glyphMap; title: string; detail: string }) { return <View style={styles.empty}><View style={styles.emptyIcon}><Feather name={icon} size={20} color={colors.muted} /></View><View style={styles.main}><Text style={styles.emptyTitle}>{title}</Text><Text style={styles.emptyText}>{detail}</Text></View></View>; }
function ordinal(value: number) { const suffix = value % 10 === 1 && value !== 11 ? 'st' : value % 10 === 2 && value !== 12 ? 'nd' : value % 10 === 3 && value !== 13 ? 'rd' : 'th'; return `${value}${suffix}`; }
function labelForKind(kind: RecurringRule['kind']) { return kind === 'income' ? 'Income' : kind === 'expense' ? 'Bill' : 'Investment'; }

const styles = themedStyles(() => ({
  actions: { marginTop: 20, gap: 9 },
  action: { minHeight: 68, paddingHorizontal: 13, flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.paper },
  actionIcon: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background },
  actionMain: { flex: 1 },
  actionTitle: { fontFamily: fonts.bodySemiBold, fontSize: 13, color: colors.ink },
  actionDetail: { marginTop: 2, fontFamily: fonts.body, fontSize: 11, color: colors.secondary },
  priceError: { marginTop: 16, padding: 12, flexDirection: 'row', alignItems: 'flex-start', gap: 9, borderRadius: radius.sm, backgroundColor: colors.dangerSoft },
  priceErrorMain: { flex: 1, minWidth: 0 },
  priceErrorText: { fontFamily: fonts.bodyMedium, fontSize: 11, lineHeight: 16, color: colors.danger },
  priceErrorDetail: { marginTop: 3, fontFamily: fonts.body, fontSize: 10, lineHeight: 15, color: colors.danger },
  retryButton: { minWidth: 52, minHeight: 44, paddingHorizontal: 9, alignItems: 'center', justifyContent: 'center' },
  retryDisabled: { opacity: 0.55 },
  retryText: { fontFamily: fonts.bodySemiBold, fontSize: 11, color: colors.danger },
  section: { marginTop: 32 },
  list: { marginTop: 12, borderTopWidth: 1, borderTopColor: colors.border },
  rule: { paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: colors.border },
  ruleTop: { minHeight: 68, flexDirection: 'row', alignItems: 'center', gap: 11 },
  icon: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.paper, borderWidth: 1, borderColor: colors.border },
  main: { flex: 1, minWidth: 0 },
  title: { fontFamily: fonts.bodyMedium, fontSize: 14, lineHeight: 19, color: colors.ink },
  meta: { marginTop: 3, fontFamily: fonts.body, fontSize: 11, lineHeight: 15, color: colors.secondary },
  status: { marginTop: 4, fontFamily: fonts.bodySemiBold, fontSize: 10, color: colors.accent },
  paused: { color: colors.muted },
  rowActions: { flexDirection: 'row', alignItems: 'center' },
  rowAction: { width: 36, height: 44, alignItems: 'center', justifyContent: 'center' },
  automationToggle: { minHeight: 52, marginTop: 7, paddingLeft: 49, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  toggleTitle: { fontFamily: fonts.bodyMedium, fontSize: 12, lineHeight: 16, color: colors.ink },
  toggleDetail: { marginTop: 2, fontFamily: fonts.body, fontSize: 10, lineHeight: 14, color: colors.secondary },
  budget: { minHeight: 88, paddingVertical: 15, borderBottomWidth: 1, borderBottomColor: colors.border },
  budgetTop: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  percent: { fontFamily: fonts.bodySemiBold, fontSize: 12, fontVariant: ['tabular-nums'], color: colors.ink },
  track: { height: 5, marginTop: 12, borderRadius: 3, overflow: 'hidden', backgroundColor: colors.border },
  fill: { height: '100%', borderRadius: 3, backgroundColor: colors.accent },
  empty: { minHeight: 112, flexDirection: 'row', alignItems: 'center', gap: 13, borderBottomWidth: 1, borderBottomColor: colors.border },
  emptyIcon: { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.paper, borderWidth: 1, borderColor: colors.border },
  emptyTitle: { fontFamily: fonts.bodySemiBold, fontSize: 14, color: colors.ink },
  emptyText: { marginTop: 4, fontFamily: fonts.body, fontSize: 12, lineHeight: 18, color: colors.secondary },
  pressed: { opacity: 0.72, transform: [{ scale: 0.99 }] },
}));
