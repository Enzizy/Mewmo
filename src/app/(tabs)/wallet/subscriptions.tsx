import { Feather } from '@expo/vector-icons';
import { Host, Switch } from '@expo/ui';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { AppScreen } from '@/components/AppScreen';
import { useAppDialog } from '@/components/AppDialog';
import { PageHeader } from '@/components/page-header';
import { ScreenHeader } from '@/components/ScreenHeader';
import { SectionHeading } from '@/components/section-heading';
import { colors, fonts, radius } from '@/constants/theme';
import { RecurringRuleForm } from '@/features/wallet/finance-forms';
import { useItems } from '@/store/ItemsContext';
import { RecurringRule } from '@/types';
import { confirmAction } from '@/utils/confirm-action';
import { formatPeso } from '@/utils/money';
import { nextScheduledDate } from '@/utils/recurrence';

export default function SubscriptionsScreen() {
  const { showDialog } = useAppDialog();
  const { recurringRules, toggleRecurringRule, deleteRecurringRule } = useItems();
  const [editing, setEditing] = useState<RecurringRule | 'new' | null>(null);
  const expenses = recurringRules.filter((rule) => rule.kind === 'expense');
  const monthlyTotal = expenses.filter((rule) => rule.active).reduce((sum, rule) => sum + rule.amountMinor * rule.days.length, 0);

  const remove = (rule: RecurringRule) => showDialog(confirmAction({
    title: 'Delete subscription or bill?',
    message: `“${rule.title}” will stop future deductions. Existing wallet history stays unchanged.`,
    confirmLabel: 'Delete',
    onConfirm: () => deleteRecurringRule(rule.id).catch((error) => showDialog({ title: 'Could not delete item', message: error instanceof Error ? error.message : 'Try again.', tone: 'danger' })),
  }));

  return (
    <AppScreen tabbed assistant={!editing}>
      <ScreenHeader back />
      <PageHeader title="Subscriptions and bills" supporting="Keep every recurring expense and its automatic wallet deduction in one place." />

      <View style={styles.summary}>
        <View><Text style={styles.summaryLabel}>Estimated monthly total</Text><Text style={styles.summaryValue}>{formatPeso(monthlyTotal)}</Text></View>
        <View style={styles.summaryCount}><Text style={styles.countValue}>{expenses.filter((rule) => rule.active).length}</Text><Text style={styles.countLabel}>active</Text></View>
      </View>

      <Pressable accessibilityRole="button" onPress={() => setEditing('new')} style={({ pressed }) => [styles.add, pressed && styles.pressed]}>
        <View style={styles.addIcon}><Feather name="plus" size={19} color={colors.paper} /></View><View style={styles.main}><Text style={styles.addTitle}>Add subscription or bill</Text><Text style={styles.addDetail}>Internet, streaming, rent, insurance, or another monthly charge</Text></View><Feather name="chevron-right" size={19} color={colors.muted} />
      </Pressable>

      {editing ? <RecurringRuleForm mode="subscription" key={editing === 'new' ? 'new-subscription' : editing.id} initialRule={editing === 'new' ? undefined : editing} onDone={() => setEditing(null)} onCancel={() => setEditing(null)} /> : null}

      <View style={styles.section}>
        <SectionHeading title="Recurring expenses" detail="Each due date is deducted once" />
        <View style={styles.list}>
          {expenses.map((rule) => (
            <View key={rule.id} style={styles.rule}>
              <View style={styles.ruleTop}>
                <View style={styles.icon}><Feather name="credit-card" size={18} color={colors.ink} /></View>
                <View style={styles.main}><Text style={styles.title}>{rule.title}</Text><Text style={styles.meta}>{rule.category} · {formatPeso(rule.amountMinor)} · {rule.days.map(ordinal).join(' and ')}</Text><Text style={[styles.status, !rule.active && styles.paused]}>{rule.active ? `Next ${nextScheduledDate(rule) ?? 'date unavailable'}` : 'Paused'}</Text></View>
                <Pressable accessibilityLabel={`Edit ${rule.title}`} accessibilityRole="button" onPress={() => setEditing(rule)} style={styles.rowAction}><Feather name="edit-3" size={16} color={colors.secondary} /></Pressable>
                <Pressable accessibilityLabel={`Delete ${rule.title}`} accessibilityRole="button" onPress={() => remove(rule)} style={styles.rowAction}><Feather name="trash-2" size={16} color={colors.muted} /></Pressable>
              </View>
              <View style={styles.toggleRow}><View style={styles.main}><Text style={styles.toggleTitle}>Automatic deduction</Text><Text style={styles.toggleDetail}>{rule.active ? 'Future due dates will post to Wallet' : 'No new deductions will post'}</Text></View><Host accessible accessibilityLabel={`Automatically deduct ${rule.title}`} accessibilityRole="switch" accessibilityState={{ checked: rule.active }} matchContents><Switch value={rule.active} onValueChange={() => toggleRecurringRule(rule.id).catch((error) => showDialog({ title: 'Could not update item', message: error instanceof Error ? error.message : 'Try again.', tone: 'danger' }))} /></Host></View>
            </View>
          ))}
          {!expenses.length ? <View style={styles.empty}><View style={styles.emptyIcon}><Feather name="credit-card" size={21} color={colors.muted} /></View><View style={styles.main}><Text style={styles.title}>No recurring expenses yet</Text><Text style={styles.emptyText}>Add a subscription or bill here. It will also be included in your forecast automatically.</Text></View></View> : null}
        </View>
      </View>
    </AppScreen>
  );
}

function ordinal(value: number) { const suffix = value % 10 === 1 && value !== 11 ? 'st' : value % 10 === 2 && value !== 12 ? 'nd' : value % 10 === 3 && value !== 13 ? 'rd' : 'th'; return `${value}${suffix}`; }

const styles = StyleSheet.create({
  summary: { marginTop: 22, padding: 18, minHeight: 100, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderRadius: radius.lg, backgroundColor: colors.ink },
  summaryLabel: { fontFamily: fonts.bodyMedium, fontSize: 12, color: '#B8B8B8' },
  summaryValue: { marginTop: 6, fontFamily: fonts.bodyBold, fontSize: 27, fontVariant: ['tabular-nums'], color: colors.paper },
  summaryCount: { alignItems: 'center', paddingLeft: 18, borderLeftWidth: 1, borderLeftColor: '#3A3A3A' },
  countValue: { fontFamily: fonts.bodyBold, fontSize: 21, color: colors.paper },
  countLabel: { marginTop: 2, fontFamily: fonts.body, fontSize: 10, color: '#B8B8B8' },
  add: { minHeight: 78, marginTop: 18, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.paper },
  addIcon: { width: 38, height: 38, alignItems: 'center', justifyContent: 'center', borderRadius: 19, backgroundColor: colors.ink },
  addTitle: { fontFamily: fonts.bodySemiBold, fontSize: 14, color: colors.ink },
  addDetail: { marginTop: 3, fontFamily: fonts.body, fontSize: 11, lineHeight: 16, color: colors.secondary },
  section: { marginTop: 32 },
  list: { marginTop: 12, borderTopWidth: 1, borderTopColor: colors.border },
  rule: { paddingVertical: 13, borderBottomWidth: 1, borderBottomColor: colors.border },
  ruleTop: { minHeight: 68, flexDirection: 'row', alignItems: 'center', gap: 10 },
  icon: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center', borderRadius: 20, backgroundColor: colors.paper, borderWidth: 1, borderColor: colors.border },
  main: { flex: 1, minWidth: 0 },
  title: { fontFamily: fonts.bodyMedium, fontSize: 14, lineHeight: 19, color: colors.ink },
  meta: { marginTop: 3, fontFamily: fonts.body, fontSize: 11, lineHeight: 15, color: colors.secondary },
  status: { marginTop: 4, fontFamily: fonts.bodySemiBold, fontSize: 10, color: colors.accent },
  paused: { color: colors.muted },
  rowAction: { width: 36, height: 44, alignItems: 'center', justifyContent: 'center' },
  toggleRow: { minHeight: 52, marginTop: 6, paddingLeft: 50, flexDirection: 'row', alignItems: 'center', gap: 12 },
  toggleTitle: { fontFamily: fonts.bodyMedium, fontSize: 12, color: colors.ink },
  toggleDetail: { marginTop: 2, fontFamily: fonts.body, fontSize: 10, lineHeight: 14, color: colors.secondary },
  empty: { minHeight: 120, flexDirection: 'row', alignItems: 'center', gap: 13, borderBottomWidth: 1, borderBottomColor: colors.border },
  emptyIcon: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', borderRadius: 22, backgroundColor: colors.paper, borderWidth: 1, borderColor: colors.border },
  emptyText: { marginTop: 4, fontFamily: fonts.body, fontSize: 12, lineHeight: 18, color: colors.secondary },
  pressed: { opacity: 0.72, transform: [{ scale: 0.99 }] },
});
