import { Feather } from '@expo/vector-icons';
import { Host, Switch } from '@expo/ui';
import { Href, useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';
import { AppScreen } from '@/components/AppScreen';
import { useAppDialog } from '@/components/AppDialog';
import { InvestmentMark } from '@/components/InvestmentMark';
import { PageHeader } from '@/components/page-header';
import { ScreenHeader } from '@/components/ScreenHeader';
import { SectionHeading } from '@/components/section-heading';
import { colors, fonts, radius, themedStyles } from '@/constants/theme';
import { useItems } from '@/store/ItemsContext';
import { FinancialOccurrence, ReviewProposal } from '@/types';
import { appendDecimalPoint, formatPeso, normalizeDecimalQuantityInput, parsePesoToMinor, quantityFromAmountAndUnitPrice } from '@/utils/money';
import { localDateKey } from '@/utils/recurrence';
import { isMarketQuoteFresh } from '@/utils/market';
import { useTheme } from '@/store/ThemeContext';

export default function ReviewInboxScreen() {
  useTheme();
  const router = useRouter();
  const { showDialog } = useAppDialog();
  const data = useItems();
  const pending = data.financialOccurrences.filter((item) => item.status === 'pending');
  const goalSuggestions = data.goalSuggestions.filter((item) => item.status === 'pending');
  const [selected, setSelected] = useState<FinancialOccurrence | null>(null);

  const resolveGoal = async (id: string, status: 'confirmed' | 'skipped') => {
    try { await data.resolveGoalSuggestion(id, status); }
    catch (error) { showDialog({ title: 'Could not update goal', message: error instanceof Error ? error.message : 'Try again.', tone: 'danger' }); }
  };

  return (
    <AppScreen assistant={!selected} onRefresh={data.reload}>
      <ScreenHeader back />
      <PageHeader title="Review inbox" supporting="Nothing changes your wallet, investments, goals, or calendar until you confirm it." />

      <View style={styles.summary}>
        <ReviewMetric value={pending.length} label="Money" />
        <View style={styles.divider} />
        <ReviewMetric value={data.reviewProposals.length} label="AI proposals" />
        <View style={styles.divider} />
        <ReviewMetric value={goalSuggestions.length} label="Goal suggestions" />
      </View>

      {selected ? <OccurrenceForm key={selected.id} occurrence={selected} data={data} onDone={() => setSelected(null)} onCancel={() => setSelected(null)} /> : null}

      <View style={styles.section}>
        <SectionHeading title="Scheduled money" detail={pending.length ? `${pending.length} waiting for you` : 'All caught up'} />
        <View style={styles.list}>
          {pending.map((item) => <Pressable accessibilityRole="button" key={item.id} onPress={() => setSelected(item)} style={({ pressed }) => [styles.row, pressed && styles.pressed]}>{item.asset ? <InvestmentMark asset={item.asset} size={38} /> : <View style={[styles.icon, item.kind === 'income' && styles.incomeIcon]}><Feather name={item.kind === 'income' ? 'arrow-down-left' : 'arrow-up-right'} size={18} color={colors.ink} /></View>}<View style={styles.main}><View style={styles.titleLine}><Text numberOfLines={1} style={styles.rowTitle}>{item.title}</Text>{item.dueDate < localDateKey(new Date()) ? <Text style={styles.overdue}>OVERDUE</Text> : null}</View><Text style={styles.meta}>Expected {formatDate(item.scheduledDate)} · {formatPeso(item.plannedAmountMinor)}</Text><Text style={styles.status}>Tap to enter what actually happened</Text></View><Feather name="chevron-right" size={19} color={colors.muted} /></Pressable>)}
          {!pending.length ? <Empty icon="check-circle" title="No money waiting" detail="Due salary, bills, subscriptions, and investment plans will appear here for confirmation." /> : null}
        </View>
      </View>

      <View style={styles.section}>
        <SectionHeading title="AI proposals" detail="Changes waiting for your approval" />
        <View style={styles.list}>
          {data.reviewProposals.map((proposal) => <Pressable accessibilityRole="button" key={proposal.id} onPress={() => router.push({ pathname: '/review', params: { id: proposal.id } })} style={({ pressed }) => [styles.row, pressed && styles.pressed]}><View style={styles.icon}><Feather name={proposalSourceIcon(proposal.source)} size={18} color={colors.ink} /></View><View style={styles.main}><Text numberOfLines={1} style={styles.rowTitle}>{proposal.organized.title}</Text><Text style={styles.meta}>{proposal.organized.items.length} suggested {proposal.organized.items.length === 1 ? 'change' : 'changes'} · {proposalSourceLabel(proposal.source)}</Text></View><Feather name="chevron-right" size={19} color={colors.muted} /></Pressable>)}
          {!data.reviewProposals.length ? <Empty icon="message-square" title="No AI proposals" detail="Any supported action that could change your records waits here until reviewed." /> : null}
        </View>
      </View>

      <View style={styles.section}>
        <SectionHeading title="Payday goal suggestions" detail="These reserve money; they are never expenses" />
        <View style={styles.list}>
          {goalSuggestions.map((suggestion) => { const goal = data.savingsGoals.find((candidate) => candidate.id === suggestion.goalId); if (!goal) return null; return <View key={suggestion.id} style={styles.goalRow}><View style={styles.icon}><Feather name="target" size={18} color={colors.ink} /></View><View style={styles.main}><Text style={styles.rowTitle}>Reserve for {goal.name}</Text><Text style={styles.meta}>{formatPeso(suggestion.amountMinor)} from confirmed payday income</Text></View><Pressable accessibilityRole="button" accessibilityLabel={`Skip ${goal.name} suggestion`} onPress={() => resolveGoal(suggestion.id, 'skipped')} style={styles.smallButton}><Feather name="x" size={17} color={colors.secondary} /></Pressable><Pressable accessibilityRole="button" onPress={() => resolveGoal(suggestion.id, 'confirmed')} style={styles.confirmSmall}><Text style={styles.confirmSmallText}>Reserve</Text></Pressable></View>; })}
          {!goalSuggestions.length ? <Empty icon="target" title="No goal suggestions" detail="If a goal has a payday amount, a suggestion appears after you confirm income." /> : null}
        </View>
      </View>
    </AppScreen>
  );
}

function proposalSourceIcon(source: ReviewProposal['source']): keyof typeof Feather.glyphMap {
  if (source === 'voice') return 'mic';
  return 'message-circle';
}

function proposalSourceLabel(source: ReviewProposal['source']) {
  if (source === 'voice') return 'Voice Capture';
  return 'Ask My Cat';
}

function OccurrenceForm({ occurrence, data, onDone, onCancel }: { occurrence: FinancialOccurrence; data: ReturnType<typeof useItems>; onDone: () => void; onCancel: () => void }) {
  const { showDialog } = useAppDialog();
  const [amount, setAmount] = useState(String(occurrence.plannedAmountMinor / 100));
  const [actualDate, setActualDate] = useState(localDateKey(new Date()));
  const [quantity, setQuantity] = useState('');
  const [fees, setFees] = useState('0');
  const [note, setNote] = useState('');
  const [updateFuture, setUpdateFuture] = useState(false);
  const [saving, setSaving] = useState(false);
  const amountMinor = parsePesoToMinor(amount);
  const feesMinor = parsePesoToMinor(fees);
  const quote = occurrence.asset ? data.quotes.find((item) => item.asset === occurrence.asset) : undefined;
  const estimatedQuantity = occurrence.kind === 'investment' && amountMinor && isMarketQuoteFresh(quote) ? quantityFromAmountAndUnitPrice(amountMinor, quote!.priceMinor) : null;
  const recordedTransactionAmountMinor = amountMinor == null
    ? -1
    : amountMinor + (occurrence.kind === 'investment' ? (feesMinor ?? 0) : 0);
  const possibleDuplicate = useMemo(() => data.transactions.find((transaction) => transaction.type === occurrence.kind && transaction.amountMinor === recordedTransactionAmountMinor && localDateKey(new Date(transaction.occurredAt)) === actualDate), [actualDate, data.transactions, occurrence.kind, recordedTransactionAmountMinor]);

  const confirm = async () => {
    if (!amountMinor || !/^\d{4}-\d{2}-\d{2}$/.test(actualDate) || feesMinor == null || (occurrence.kind === 'investment' && Number(quantity) <= 0)) {
      return showDialog({ title: 'Check what happened', message: occurrence.kind === 'investment' ? 'Add the actual amount, purchase date, exact fractional quantity from your broker, and valid fees.' : 'Add the actual amount and date in YYYY-MM-DD format.', tone: 'warning' });
    }
    const run = async () => {
      setSaving(true);
      try {
        await data.confirmOccurrence(occurrence.id, { amountMinor, actualDate, quantity, feesMinor, note, updateFutureAmount: updateFuture });
        onDone();
      } catch (error) {
        setSaving(false);
        showDialog({ title: 'Could not confirm entry', message: error instanceof Error ? error.message : 'Try again.', tone: 'danger' });
      }
    };
    if (possibleDuplicate) return showDialog({ title: 'Possible duplicate', message: `A ${formatPeso(possibleDuplicate.amountMinor)} ${possibleDuplicate.type} already exists on this date. Match it to this schedule, or save another only if both really happened.`, tone: 'warning', dismissible: true, actions: [{ label: 'Save another', variant: 'secondary', onPress: run }, { label: 'Match existing', variant: 'primary', onPress: async () => { setSaving(true); try { await data.matchOccurrence(occurrence.id, possibleDuplicate.id); onDone(); } catch (error) { setSaving(false); showDialog({ title: 'Could not match entry', message: error instanceof Error ? error.message : 'Try again.', tone: 'danger' }); } } }] });
    await run();
  };

  const skip = () => showDialog({ title: 'Skip this occurrence?', message: 'It will stay in review history as skipped and will not change your wallet or holdings.', tone: 'warning', dismissible: true, actions: [{ label: 'Keep reviewing', variant: 'secondary' }, { label: 'Skip occurrence', variant: 'danger', onPress: async () => { await data.skipOccurrence(occurrence.id, note); onDone(); } }] });
  const postpone = async () => { const next = new Date(); next.setDate(next.getDate() + 1); try { await data.postponeOccurrence(occurrence.id, localDateKey(next)); onDone(); } catch (error) { showDialog({ title: 'Could not postpone', message: error instanceof Error ? error.message : 'Try again.', tone: 'danger' }); } };

  return <View style={styles.form}>
    <View style={styles.formHead}><View style={styles.main}><Text accessibilityRole="header" style={styles.formTitle}>{occurrence.kind === 'investment' ? `Confirm ${occurrence.asset} purchase` : occurrence.kind === 'income' ? 'Confirm received income' : 'Confirm payment'}</Text><Text style={styles.formDetail}>Planned for {formatDate(occurrence.scheduledDate)} at {formatPeso(occurrence.plannedAmountMinor)}. Change this occurrence to match reality.</Text></View><Pressable accessibilityLabel="Close review form" accessibilityRole="button" onPress={onCancel} style={styles.smallButton}><Feather name="x" size={20} color={colors.ink} /></Pressable></View>
    <Field label={occurrence.kind === 'income' ? 'Amount actually received' : 'Amount actually paid'}><View style={styles.inputShell}><Text style={styles.prefix}>₱</Text><TextInput accessibilityLabel="Actual amount in Philippine pesos" keyboardType="decimal-pad" value={amount} onChangeText={setAmount} placeholder="0.00" placeholderTextColor={colors.muted} style={styles.input} /></View></Field>
    <Field label={occurrence.kind === 'investment' ? 'Purchase date' : 'Actual date'} hint="YYYY-MM-DD"><View style={styles.inputShell}><TextInput accessibilityLabel="Actual date" value={actualDate} onChangeText={setActualDate} placeholder="2026-08-26" placeholderTextColor={colors.muted} style={styles.input} /></View></Field>
    {occurrence.kind === 'investment' ? <><Field label={`Exact ${occurrence.asset === 'VOO' ? 'shares' : 'BTC'} received`} hint="Copy this from your broker"><View style={styles.inputShell}><TextInput accessibilityLabel="Exact fractional quantity received" inputMode="decimal" keyboardType="decimal-pad" value={quantity} onChangeText={(value) => setQuantity(normalizeDecimalQuantityInput(value))} placeholder={estimatedQuantity ?? (occurrence.asset === 'VOO' ? '0.04' : '0.001472')} placeholderTextColor={colors.muted} style={styles.input} /><Pressable accessibilityLabel="Insert decimal point" accessibilityRole="button" onPress={() => setQuantity(appendDecimalPoint(quantity))} style={styles.decimalButton}><Text style={styles.decimal}>.</Text></Pressable></View></Field><Text style={styles.helper}>{estimatedQuantity ? `Current quote estimates about ${estimatedQuantity}, but use the exact quantity from your purchase confirmation.` : 'A live quote estimate is unavailable. Your broker confirmation remains the source of truth.'}</Text><Field label="Fees" hint="Optional"><View style={styles.inputShell}><Text style={styles.prefix}>₱</Text><TextInput accessibilityLabel="Investment fees" keyboardType="decimal-pad" value={fees} onChangeText={setFees} placeholder="0.00" placeholderTextColor={colors.muted} style={styles.input} /></View></Field></> : null}
    <Field label="Adjustment note" hint="Optional"><View style={styles.inputShell}><TextInput accessibilityLabel="Adjustment note" value={note} onChangeText={setNote} placeholder={occurrence.kind === 'income' ? 'Unpaid leave or holiday adjustment' : 'Paid one day later'} placeholderTextColor={colors.muted} style={styles.input} /></View></Field>
    <View style={styles.switchRow}><View style={styles.main}><Text style={styles.switchTitle}>Use this amount for future dates</Text><Text style={styles.switchDetail}>Off changes this occurrence only. The schedule dates stay the same.</Text></View><Host accessible accessibilityLabel="Use actual amount for future dates" accessibilityRole="switch" accessibilityState={{ checked: updateFuture }} matchContents><Switch value={updateFuture} onValueChange={setUpdateFuture} /></Host></View>
    {possibleDuplicate ? <View accessibilityRole="alert" style={styles.warning}><Feather name="alert-triangle" size={16} color={colors.mustard} /><Text style={styles.warningText}>A similar transaction already exists on this date. LifeDesk will ask before saving another.</Text></View> : null}
    <Pressable accessibilityRole="button" disabled={saving} onPress={confirm} style={[styles.confirm, saving && styles.disabled]}><Text style={styles.confirmText}>{saving ? 'Confirming…' : occurrence.kind === 'income' ? 'Confirm received' : occurrence.kind === 'investment' ? 'Confirm purchase' : 'Confirm paid'}</Text><Feather name="check" size={18} color={colors.paper} /></Pressable>
    <View style={styles.secondaryActions}><Pressable accessibilityRole="button" onPress={postpone} style={styles.secondaryButton}><Text style={styles.secondaryText}>Review tomorrow</Text></Pressable><Pressable accessibilityRole="button" onPress={skip} style={styles.secondaryButton}><Text style={styles.skipText}>Skip this occurrence</Text></Pressable></View>
  </View>;
}

function ReviewMetric({ value, label }: { value: number; label: string }) { return <View style={styles.metric}><Text style={styles.metricValue}>{value}</Text><Text style={styles.metricLabel}>{label}</Text></View>; }
function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) { return <View style={styles.field}><View style={styles.fieldHead}><Text style={styles.label}>{label}</Text>{hint ? <Text style={styles.hint}>{hint}</Text> : null}</View>{children}</View>; }
function Empty({ icon, title, detail }: { icon: keyof typeof Feather.glyphMap; title: string; detail: string }) { return <View style={styles.empty}><View style={styles.icon}><Feather name={icon} size={19} color={colors.muted} /></View><View style={styles.main}><Text style={styles.emptyTitle}>{title}</Text><Text style={styles.emptyDetail}>{detail}</Text></View></View>; }
function formatDate(value: string) { return new Intl.DateTimeFormat('en-PH', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${value}T00:00:00Z`)); }

const styles = themedStyles(() => ({
  summary: { marginTop: 20, padding: 16, flexDirection: 'row', borderRadius: radius.lg, backgroundColor: colors.ink }, metric: { flex: 1, alignItems: 'center' }, metricValue: { fontFamily: fonts.bodyBold, fontSize: 24, fontVariant: ['tabular-nums'], color: colors.paper }, metricLabel: { marginTop: 3, textAlign: 'center', fontFamily: fonts.body, fontSize: 10, lineHeight: 14, color: colors.onInkMuted }, divider: { width: 1, backgroundColor: colors.onInkBorder },
  section: { marginTop: 32 }, list: { marginTop: 11, borderTopWidth: 1, borderTopColor: colors.border }, row: { minHeight: 76, flexDirection: 'row', alignItems: 'center', gap: 11, borderBottomWidth: 1, borderBottomColor: colors.border }, goalRow: { minHeight: 84, flexDirection: 'row', alignItems: 'center', gap: 8, borderBottomWidth: 1, borderBottomColor: colors.border }, icon: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: colors.border, backgroundColor: colors.paper }, incomeIcon: { backgroundColor: colors.greenSoft }, main: { flex: 1, minWidth: 0 }, titleLine: { flexDirection: 'row', alignItems: 'center', gap: 7 }, rowTitle: { flexShrink: 1, fontFamily: fonts.bodySemiBold, fontSize: 14, lineHeight: 19, color: colors.ink }, meta: { marginTop: 3, fontFamily: fonts.body, fontSize: 11, lineHeight: 16, color: colors.secondary }, status: { marginTop: 3, fontFamily: fonts.bodySemiBold, fontSize: 10, color: colors.accent }, overdue: { paddingHorizontal: 6, paddingVertical: 3, borderRadius: 4, overflow: 'hidden', fontFamily: fonts.bodyBold, fontSize: 8, color: colors.danger, backgroundColor: colors.dangerSoft }, pressed: { opacity: 0.7 },
  smallButton: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }, confirmSmall: { minHeight: 42, paddingHorizontal: 12, alignItems: 'center', justifyContent: 'center', borderRadius: 10, backgroundColor: colors.ink }, confirmSmallText: { fontFamily: fonts.bodySemiBold, fontSize: 11, color: colors.paper }, empty: { minHeight: 96, flexDirection: 'row', alignItems: 'center', gap: 12, borderBottomWidth: 1, borderBottomColor: colors.border }, emptyTitle: { fontFamily: fonts.bodySemiBold, fontSize: 13, color: colors.ink }, emptyDetail: { marginTop: 3, fontFamily: fonts.body, fontSize: 11, lineHeight: 16, color: colors.secondary },
  form: { marginTop: 20, padding: 18, gap: 16, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.borderStrong, backgroundColor: colors.paper }, formHead: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 }, formTitle: { fontFamily: fonts.bodyBold, fontSize: 20, lineHeight: 25, color: colors.ink }, formDetail: { marginTop: 5, fontFamily: fonts.body, fontSize: 12, lineHeight: 18, color: colors.secondary }, field: { gap: 7 }, fieldHead: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', gap: 10 }, label: { fontFamily: fonts.bodySemiBold, fontSize: 12, lineHeight: 16, color: colors.ink }, hint: { flex: 1, textAlign: 'right', fontFamily: fonts.body, fontSize: 10, color: colors.muted }, inputShell: { minHeight: 50, paddingHorizontal: 13, flexDirection: 'row', alignItems: 'center', borderRadius: radius.sm, borderWidth: 1, borderColor: colors.borderStrong }, prefix: { marginRight: 7, fontFamily: fonts.bodySemiBold, fontSize: 15, color: colors.secondary }, input: { flex: 1, minHeight: 48, paddingVertical: 10, fontFamily: fonts.body, fontSize: 15, color: colors.ink }, decimalButton: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }, decimal: { marginTop: -8, fontFamily: fonts.bodyBold, fontSize: 26, color: colors.ink }, helper: { marginTop: -8, fontFamily: fonts.body, fontSize: 10, lineHeight: 15, color: colors.secondary }, switchRow: { minHeight: 60, flexDirection: 'row', alignItems: 'center', gap: 12 }, switchTitle: { fontFamily: fonts.bodySemiBold, fontSize: 12, color: colors.ink }, switchDetail: { marginTop: 3, fontFamily: fonts.body, fontSize: 10, lineHeight: 15, color: colors.secondary }, warning: { padding: 11, flexDirection: 'row', alignItems: 'flex-start', gap: 8, borderRadius: radius.sm, backgroundColor: colors.mustardSoft }, warningText: { flex: 1, fontFamily: fonts.body, fontSize: 11, lineHeight: 16, color: colors.ink }, confirm: { minHeight: 52, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderRadius: radius.md, backgroundColor: colors.ink }, confirmText: { fontFamily: fonts.bodySemiBold, fontSize: 14, color: colors.paper }, disabled: { opacity: 0.5 }, secondaryActions: { flexDirection: 'row', justifyContent: 'space-between', gap: 8 }, secondaryButton: { minHeight: 44, paddingHorizontal: 5, justifyContent: 'center' }, secondaryText: { fontFamily: fonts.bodySemiBold, fontSize: 12, color: colors.accent }, skipText: { fontFamily: fonts.bodySemiBold, fontSize: 12, color: colors.danger },
}));
