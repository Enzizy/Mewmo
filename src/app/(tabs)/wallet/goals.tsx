import { Feather } from '@expo/vector-icons';
import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { AppScreen } from '@/components/AppScreen';
import { useAppDialog } from '@/components/AppDialog';
import { PageHeader } from '@/components/page-header';
import { ScreenHeader } from '@/components/ScreenHeader';
import { colors, fonts, radius, themedStyles } from '@/constants/theme';
import { SavingsGoalForm } from '@/features/wallet/finance-forms';
import { useItems } from '@/store/ItemsContext';
import { SavingsGoal } from '@/types';
import { confirmAction } from '@/utils/confirm-action';
import { formatPeso } from '@/utils/money';
import { useTheme } from '@/store/ThemeContext';

export default function SavingsGoalsScreen() {
  useTheme();
  const { showDialog } = useAppDialog();
  const { savingsGoals, deleteGoal, reload } = useItems();
  const [editing, setEditing] = useState<SavingsGoal | 'new' | null>(null);
  const totalReserved = savingsGoals.filter((goal) => goal.active).reduce((sum, goal) => sum + goal.savedMinor, 0);

  const remove = (goal: SavingsGoal) => showDialog(confirmAction({
    title: `Delete “${goal.name}”?`,
    message: 'This removes the goal and its pending contribution suggestions. Your wallet and transaction history will not change.',
    confirmLabel: 'Delete goal',
    onConfirm: () => deleteGoal(goal.id).catch((error) => showDialog({ title: 'Could not delete goal', message: error instanceof Error ? error.message : 'Try again.', tone: 'danger' })),
  }));

  return (
    <AppScreen tabbed assistant={!editing} onRefresh={reload}>
      <ScreenHeader back />
      <PageHeader title="Savings goals" supporting="Reserve part of your wallet for what matters without treating it as spent." action={<Pressable accessibilityRole="button" onPress={() => setEditing('new')} style={styles.add}><Feather name="plus" size={17} color={colors.paper} /><Text style={styles.addText}>Add</Text></Pressable>} />
      <View style={styles.summary}><Text style={styles.summaryLabel}>Reserved across active goals</Text><Text selectable style={styles.summaryValue}>{formatPeso(totalReserved)}</Text><Text style={styles.summaryNote}>Included as a reservation in safe-to-spend. Your available wallet stays unchanged.</Text></View>

      {editing ? <SavingsGoalForm key={editing === 'new' ? 'new' : editing.id} initialGoal={editing === 'new' ? undefined : editing} onDone={() => setEditing(null)} onCancel={() => setEditing(null)} /> : null}

      <View style={styles.list}>
        {savingsGoals.map((goal) => {
          const progress = Math.min(goal.savedMinor / goal.targetMinor, 1);
          return <View key={goal.id} style={styles.goal}>
            <View style={styles.goalTop}><View style={styles.goalIcon}><Feather name="target" size={18} color={colors.ink} /></View><View style={styles.main}><Text style={styles.title}>{goal.name}</Text><Text style={styles.meta}>{formatPeso(goal.savedMinor)} of {formatPeso(goal.targetMinor)}{goal.targetDate ? ` · by ${formatDate(goal.targetDate)}` : ''}</Text></View><Pressable accessibilityLabel={`Edit ${goal.name}`} accessibilityRole="button" onPress={() => setEditing(goal)} style={styles.iconButton}><Feather name="edit-3" size={16} color={colors.secondary} /></Pressable><Pressable accessibilityLabel={`Delete ${goal.name}`} accessibilityRole="button" onPress={() => remove(goal)} style={styles.iconButton}><Feather name="trash-2" size={16} color={colors.muted} /></Pressable></View>
            <View style={styles.track}><View style={[styles.fill, { width: `${progress * 100}%` }]} /></View>
            <View style={styles.goalFoot}><Text style={styles.percent}>{Math.round(progress * 100)}% reserved</Text><Text style={styles.payday}>{goal.paydayContributionMinor ? `${formatPeso(goal.paydayContributionMinor)} suggested after payday` : 'No payday suggestion'}</Text></View>
          </View>;
        })}
        {!savingsGoals.length ? <View style={styles.empty}><View style={styles.emptyIcon}><Feather name="target" size={22} color={colors.muted} /></View><View style={styles.main}><Text style={styles.emptyTitle}>No savings goals yet</Text><Text style={styles.emptyText}>Create an emergency fund or another target, then choose how much of your wallet is reserved for it.</Text></View></View> : null}
      </View>
    </AppScreen>
  );
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat('en-PH', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${value}T00:00:00Z`));
}

const styles = themedStyles(() => ({
  add: { minHeight: 44, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', gap: 7, borderRadius: 22, backgroundColor: colors.ink },
  addText: { fontFamily: fonts.bodySemiBold, fontSize: 13, color: colors.paper },
  summary: { marginTop: 20, padding: 18, borderRadius: radius.lg, backgroundColor: colors.ink },
  summaryLabel: { fontFamily: fonts.bodyMedium, fontSize: 12, color: colors.onInkMuted },
  summaryValue: { marginTop: 7, fontFamily: fonts.bodyBold, fontSize: 30, lineHeight: 36, fontVariant: ['tabular-nums'], color: colors.paper },
  summaryNote: { marginTop: 6, fontFamily: fonts.body, fontSize: 11, lineHeight: 16, color: colors.onInkMuted },
  list: { marginTop: 24, borderTopWidth: 1, borderTopColor: colors.border },
  goal: { paddingVertical: 17, borderBottomWidth: 1, borderBottomColor: colors.border },
  goalTop: { minHeight: 52, flexDirection: 'row', alignItems: 'center', gap: 10 },
  goalIcon: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.paper, borderWidth: 1, borderColor: colors.border },
  main: { flex: 1, minWidth: 0 },
  title: { fontFamily: fonts.bodySemiBold, fontSize: 14, lineHeight: 19, color: colors.ink },
  meta: { marginTop: 3, fontFamily: fonts.body, fontSize: 11, lineHeight: 16, color: colors.secondary },
  iconButton: { width: 42, height: 44, alignItems: 'center', justifyContent: 'center' },
  track: { height: 6, marginTop: 12, overflow: 'hidden', borderRadius: 3, backgroundColor: colors.border },
  fill: { height: '100%', borderRadius: 3, backgroundColor: colors.accent },
  goalFoot: { marginTop: 8, flexDirection: 'row', justifyContent: 'space-between', gap: 12 },
  percent: { fontFamily: fonts.bodySemiBold, fontSize: 10, color: colors.ink },
  payday: { flex: 1, textAlign: 'right', fontFamily: fonts.body, fontSize: 10, color: colors.secondary },
  empty: { minHeight: 132, flexDirection: 'row', alignItems: 'center', gap: 13 },
  emptyIcon: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.paper, borderWidth: 1, borderColor: colors.border },
  emptyTitle: { fontFamily: fonts.bodySemiBold, fontSize: 14, color: colors.ink },
  emptyText: { marginTop: 4, fontFamily: fonts.body, fontSize: 12, lineHeight: 18, color: colors.secondary },
}));
