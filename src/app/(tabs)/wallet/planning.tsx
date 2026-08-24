import { Feather } from '@expo/vector-icons';
import { useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { AppScreen } from '@/components/AppScreen';
import { PageHeader } from '@/components/page-header';
import { ScreenHeader } from '@/components/ScreenHeader';
import { SectionHeading } from '@/components/section-heading';
import { colors, fonts, radius } from '@/constants/theme';
import { BudgetForm, RecurringRuleForm } from '@/features/wallet/finance-forms';
import { useItems } from '@/store/ItemsContext';
import { MonthlyBudget, RecurringRule } from '@/types';
import { confirmAction } from '@/utils/confirm-action';
import { formatPeso } from '@/utils/money';
import { nextScheduledDate } from '@/utils/recurrence';

type Editor = { kind: 'automation'; value?: RecurringRule } | { kind: 'budget'; value?: MonthlyBudget } | null;

export default function PlanningScreen() {
  const params = useLocalSearchParams<{ action?: string }>();
  const { recurringRules, budgets, transactions, toggleRecurringRule, deleteRecurringRule, deleteBudget } = useItems();
  const [editor, setEditor] = useState<Editor>(params.action === 'automation' ? { kind: 'automation' } : params.action === 'budget' ? { kind: 'budget' } : null);
  const now = new Date();
  const monthlyExpenses = transactions.filter((item) => { const date = new Date(item.occurredAt); return item.type === 'expense' && date.getFullYear() === now.getFullYear() && date.getMonth() === now.getMonth(); });

  useEffect(() => {
    if (params.action === 'automation') setEditor({ kind: 'automation' });
    if (params.action === 'budget') setEditor({ kind: 'budget' });
  }, [params.action]);

  const removeRule = (rule: RecurringRule) => confirmAction({ title: 'Delete automation?', message: `“${rule.title}” will stop posting. Existing wallet history stays unchanged.`, confirmLabel: 'Delete', onConfirm: () => deleteRecurringRule(rule.id).catch((error) => Alert.alert('Could not delete automation', error instanceof Error ? error.message : 'Try again.')) });
  const removeBudget = (budget: MonthlyBudget) => confirmAction({ title: 'Delete budget?', message: `This removes the ${budget.category} limit. It does not delete any expenses.`, confirmLabel: 'Delete', onConfirm: () => deleteBudget(budget.id).catch((error) => Alert.alert('Could not delete budget', error instanceof Error ? error.message : 'Try again.')) });

  return (
    <AppScreen tabbed assistant={!editor}>
      <ScreenHeader back />
      <PageHeader title="Plans and budgets" supporting="Automate salary, bills, and investments, then keep flexible spending within a monthly limit." />

      <View style={styles.actions}>
        <Pressable accessibilityRole="button" onPress={() => setEditor({ kind: 'automation' })} style={({ pressed }) => [styles.action, pressed && styles.pressed]}><View style={styles.actionIcon}><Feather name="repeat" size={18} color={colors.ink} /></View><View style={styles.actionMain}><Text style={styles.actionTitle}>Add automation</Text><Text style={styles.actionDetail}>Salary, recurring bill, BTC, or VOO</Text></View><Feather name="plus" size={18} color={colors.ink} /></Pressable>
        <Pressable accessibilityRole="button" onPress={() => setEditor({ kind: 'budget' })} style={({ pressed }) => [styles.action, pressed && styles.pressed]}><View style={styles.actionIcon}><Feather name="pie-chart" size={18} color={colors.ink} /></View><View style={styles.actionMain}><Text style={styles.actionTitle}>Set monthly budget</Text><Text style={styles.actionDetail}>Groceries, transport, or another category</Text></View><Feather name="plus" size={18} color={colors.ink} /></Pressable>
      </View>

      {editor?.kind === 'automation' ? <RecurringRuleForm key={editor.value?.id ?? 'new-rule'} initialRule={editor.value} onDone={() => setEditor(null)} onCancel={() => setEditor(null)} /> : null}
      {editor?.kind === 'budget' ? <BudgetForm key={editor.value?.id ?? 'new-budget'} initialBudget={editor.value} onDone={() => setEditor(null)} onCancel={() => setEditor(null)} /> : null}

      <View style={styles.section}>
        <SectionHeading title="Automations" detail="Posts once on each scheduled date" />
        <View style={styles.list}>
          {recurringRules.map((rule) => <View key={rule.id} style={styles.row}><View style={styles.icon}><Feather name={rule.kind === 'income' ? 'arrow-down-left' : rule.kind === 'investment' ? 'trending-up' : 'arrow-up-right'} size={17} color={colors.ink} /></View><View style={styles.main}><Text style={styles.title}>{rule.title}</Text><Text style={styles.meta}>{labelForKind(rule.kind)} · {formatPeso(rule.amountMinor)} · {rule.days.map(ordinal).join(' and ')}</Text>{rule.asset ? <Text style={styles.meta}>{rule.asset} · {rule.quantity} {rule.asset === 'VOO' ? 'shares' : 'BTC'} each time</Text> : null}<Text style={[styles.status, !rule.active && styles.paused]}>{rule.active ? `Next ${nextScheduledDate(rule) ?? 'date unavailable'}` : 'Paused'}</Text></View><View style={styles.rowActions}><Pressable accessibilityLabel={`Edit ${rule.title}`} accessibilityRole="button" onPress={() => setEditor({ kind: 'automation', value: rule })} style={styles.rowAction}><Feather name="edit-3" size={16} color={colors.secondary} /></Pressable><Pressable accessibilityLabel={rule.active ? `Pause ${rule.title}` : `Resume ${rule.title}`} accessibilityRole="button" onPress={() => toggleRecurringRule(rule.id).catch((error) => Alert.alert('Could not update automation', error instanceof Error ? error.message : 'Try again.'))} style={styles.rowAction}><Feather name={rule.active ? 'pause' : 'play'} size={16} color={colors.ink} /></Pressable><Pressable accessibilityLabel={`Delete ${rule.title}`} accessibilityRole="button" onPress={() => removeRule(rule)} style={styles.rowAction}><Feather name="trash-2" size={16} color={colors.muted} /></Pressable></View></View>)}
          {!recurringRules.length ? <Empty icon="repeat" title="No automations yet" detail="Add salary on the 15th and 30th, monthly bills, or recurring BTC/VOO contributions." /> : null}
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

const styles = StyleSheet.create({
  actions: { marginTop: 20, gap: 9 },
  action: { minHeight: 68, paddingHorizontal: 13, flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.paper },
  actionIcon: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background },
  actionMain: { flex: 1 },
  actionTitle: { fontFamily: fonts.bodySemiBold, fontSize: 13, color: colors.ink },
  actionDetail: { marginTop: 2, fontFamily: fonts.body, fontSize: 11, color: colors.secondary },
  section: { marginTop: 32 },
  list: { marginTop: 12, borderTopWidth: 1, borderTopColor: colors.border },
  row: { minHeight: 92, paddingVertical: 12, flexDirection: 'row', alignItems: 'center', gap: 11, borderBottomWidth: 1, borderBottomColor: colors.border },
  icon: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.paper, borderWidth: 1, borderColor: colors.border },
  main: { flex: 1, minWidth: 0 },
  title: { fontFamily: fonts.bodyMedium, fontSize: 14, lineHeight: 19, color: colors.ink },
  meta: { marginTop: 3, fontFamily: fonts.body, fontSize: 11, lineHeight: 15, color: colors.secondary },
  status: { marginTop: 4, fontFamily: fonts.bodySemiBold, fontSize: 10, color: colors.accent },
  paused: { color: colors.muted },
  rowActions: { flexDirection: 'row', alignItems: 'center' },
  rowAction: { width: 36, height: 44, alignItems: 'center', justifyContent: 'center' },
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
});
