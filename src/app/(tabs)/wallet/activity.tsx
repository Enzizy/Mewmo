import { Feather } from '@expo/vector-icons';
import { useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { AppScreen } from '@/components/AppScreen';
import { useAppDialog } from '@/components/AppDialog';
import { PageHeader } from '@/components/page-header';
import { ScreenHeader } from '@/components/ScreenHeader';
import { colors, fonts, radius } from '@/constants/theme';
import { TransactionForm } from '@/features/wallet/finance-forms';
import { useItems } from '@/store/ItemsContext';
import { FinancialTransaction } from '@/types';
import { confirmAction } from '@/utils/confirm-action';
import { formatPeso } from '@/utils/money';

type EntryType = 'income' | 'expense';

export default function WalletActivityScreen() {
  const { showDialog } = useAppDialog();
  const params = useLocalSearchParams<{ action?: string; type?: string }>();
  const { transactions, deleteTransaction } = useItems();
  const [formType, setFormType] = useState<EntryType>(params.type === 'income' ? 'income' : 'expense');
  const [showForm, setShowForm] = useState(params.action === 'add');

  useEffect(() => {
    if (params.action === 'add') {
      setFormType(params.type === 'income' ? 'income' : 'expense');
      setShowForm(true);
    }
  }, [params.action, params.type]);

  const remove = (item: FinancialTransaction) => showDialog(confirmAction({
    title: `Delete “${item.title}”?`,
    message: item.type === 'investment' ? 'This removes both the wallet movement and its linked investment purchase.' : 'This removes the record from your wallet history.',
    confirmLabel: 'Delete',
    onConfirm: () => deleteTransaction(item.id).catch((error) => showDialog({ title: 'Could not delete record', message: error instanceof Error ? error.message : 'Try again.', tone: 'danger' })),
  }));

  const openForm = (type: EntryType) => { setFormType(type); setShowForm(true); };

  return (
    <AppScreen tabbed assistant={!showForm}>
      <ScreenHeader back />
      <PageHeader title="Activity" supporting="Add income and expenses, then review every confirmed money movement." />
      <View style={styles.entryChoices}>
        <Pressable accessibilityRole="button" onPress={() => openForm('income')} style={({ pressed }) => [styles.entryChoice, pressed && styles.pressed]}><View style={[styles.entryIcon, styles.incomeIcon]}><Feather name="arrow-down-left" size={18} color={colors.green} /></View><View style={styles.entryMain}><Text style={styles.entryTitle}>Add money</Text><Text style={styles.entryDetail}>Salary, deposit, or cash adjustment</Text></View><Feather name="chevron-right" size={18} color={colors.muted} /></Pressable>
        <Pressable accessibilityRole="button" onPress={() => openForm('expense')} style={({ pressed }) => [styles.entryChoice, pressed && styles.pressed]}><View style={styles.entryIcon}><Feather name="arrow-up-right" size={18} color={colors.ink} /></View><View style={styles.entryMain}><Text style={styles.entryTitle}>Record expense</Text><Text style={styles.entryDetail}>Purchase, subscription, or bill</Text></View><Feather name="chevron-right" size={18} color={colors.muted} /></Pressable>
      </View>
      {showForm ? <TransactionForm key={formType} initialType={formType} onDone={() => setShowForm(false)} onCancel={() => setShowForm(false)} /> : null}
      <View style={styles.sectionHeader}><Text accessibilityRole="header" style={styles.sectionTitle}>All activity</Text><Text style={styles.count}>{transactions.length}</Text></View>
      <View style={styles.list}>
        {transactions.map((item) => <View key={item.id} style={styles.row}><View style={styles.icon}><Feather name={item.type === 'income' ? 'arrow-down-left' : item.type === 'investment' ? 'trending-up' : 'arrow-up-right'} size={17} color={colors.ink} /></View><View style={styles.main}><Text style={styles.title}>{item.title}</Text><Text style={styles.meta}>{item.category} · {new Intl.DateTimeFormat('en-PH', { month: 'short', day: 'numeric', year: 'numeric' }).format(new Date(item.occurredAt))}</Text></View><Text style={[styles.value, item.type === 'income' && styles.positive]}>{item.type === 'income' ? '+' : '−'}{formatPeso(item.amountMinor)}</Text><Pressable accessibilityLabel={`Delete ${item.title}`} accessibilityRole="button" onPress={() => remove(item)} style={styles.deleteButton}><Feather name="trash-2" size={16} color={colors.muted} /></Pressable></View>)}
        {!transactions.length ? <View style={styles.empty}><View style={styles.emptyIcon}><Feather name="credit-card" size={21} color={colors.muted} /></View><View style={styles.emptyMain}><Text style={styles.emptyTitle}>No money records yet</Text><Text style={styles.emptyText}>Add your current cash as income, then LifeDesk can calculate the wallet total from real records.</Text></View></View> : null}
      </View>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  entryChoices: { marginTop: 20, gap: 9 },
  entryChoice: { minHeight: 66, paddingHorizontal: 13, flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.paper },
  entryIcon: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background },
  incomeIcon: { backgroundColor: colors.greenSoft },
  entryMain: { flex: 1 },
  entryTitle: { fontFamily: fonts.bodySemiBold, fontSize: 13, color: colors.ink },
  entryDetail: { marginTop: 2, fontFamily: fonts.body, fontSize: 11, color: colors.secondary },
  sectionHeader: { minHeight: 56, marginTop: 28, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  sectionTitle: { fontFamily: fonts.bodySemiBold, fontSize: 17, color: colors.ink },
  count: { minWidth: 28, height: 28, paddingHorizontal: 8, textAlign: 'center', lineHeight: 28, borderRadius: 14, backgroundColor: colors.paper, borderWidth: 1, borderColor: colors.border, fontFamily: fonts.bodySemiBold, fontSize: 11, color: colors.secondary },
  list: { borderTopWidth: 1, borderTopColor: colors.border },
  row: { minHeight: 76, flexDirection: 'row', alignItems: 'center', gap: 10, borderBottomWidth: 1, borderBottomColor: colors.border },
  icon: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.paper, borderWidth: 1, borderColor: colors.border },
  main: { flex: 1, minWidth: 0 },
  title: { fontFamily: fonts.bodyMedium, fontSize: 14, color: colors.ink },
  meta: { marginTop: 4, fontFamily: fonts.body, fontSize: 11, lineHeight: 15, color: colors.secondary },
  value: { maxWidth: '29%', fontFamily: fonts.bodySemiBold, fontSize: 12, fontVariant: ['tabular-nums'], color: colors.ink },
  positive: { color: colors.green },
  deleteButton: { width: 38, height: 44, alignItems: 'center', justifyContent: 'center' },
  empty: { minHeight: 130, flexDirection: 'row', alignItems: 'center', gap: 14, borderBottomWidth: 1, borderBottomColor: colors.border },
  emptyIcon: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.paper, borderWidth: 1, borderColor: colors.border },
  emptyMain: { flex: 1 },
  emptyTitle: { fontFamily: fonts.bodySemiBold, fontSize: 14, color: colors.ink },
  emptyText: { marginTop: 4, fontFamily: fonts.body, fontSize: 12, lineHeight: 18, color: colors.secondary },
  pressed: { opacity: 0.72, transform: [{ scale: 0.99 }] },
});
