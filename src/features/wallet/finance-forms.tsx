import { Feather } from '@expo/vector-icons';
import { PropsWithChildren, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { colors, fonts, radius } from '@/constants/theme';
import { useItems } from '@/store/ItemsContext';
import { InvestmentAsset, MoneyTransactionType, MonthlyBudget, RecurringRule, RecurringRuleKind } from '@/types';
import { parsePesoToMinor } from '@/utils/money';
import { localDateKey, localNoonIso, parseMonthlyDays } from '@/utils/recurrence';

type FormCompletion = () => void;

export function TransactionForm({ initialType = 'expense', initialTitle = '', initialCategory, onDone, onCancel }: {
  initialType?: Extract<MoneyTransactionType, 'income' | 'expense'>;
  initialTitle?: string;
  initialCategory?: string;
  onDone: FormCompletion;
  onCancel: FormCompletion;
}) {
  const { addTransaction } = useItems();
  const [type, setType] = useState<Extract<MoneyTransactionType, 'income' | 'expense'>>(initialType);
  const [title, setTitle] = useState(initialTitle);
  const [category, setCategory] = useState(initialCategory ?? (initialType === 'income' ? 'Income' : 'General'));
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(localDateKey(new Date()));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const save = async () => {
    const amountMinor = parsePesoToMinor(amount);
    const occurredAt = validDate(date);
    if (!title.trim() || !category.trim() || !amountMinor || !occurredAt) {
      const detail = 'Add a title, category, valid PHP amount, and date in YYYY-MM-DD format.';
      setError(detail);
      Alert.alert('Check this record', detail);
      return;
    }
    setError(null);
    setSaving(true);
    try {
      await addTransaction({ type, title, category, amountMinor, occurredAt });
      onDone();
    } catch (error) {
      const detail = message(error);
      setError(detail);
      Alert.alert('Could not save record', detail);
      setSaving(false);
    }
  };

  return (
    <FormCard title={type === 'income' ? 'Add income' : 'Record expense'} description={type === 'income' ? 'Use this for salary, deposits, or your starting cash balance.' : 'Record money that left your wallet.'} onClose={onCancel}>
      <ChoiceGroup label="Record type" options={[{ value: 'income', label: 'Income' }, { value: 'expense', label: 'Expense' }]} value={type} onChange={(value) => { setType(value); if (!title && !initialTitle) setCategory(value === 'income' ? 'Income' : 'General'); }} />
      <Field label="Description" value={title} onChangeText={setTitle} placeholder={type === 'income' ? 'Salary or starting balance' : 'Groceries or internet bill'} />
      <Field label="Category" value={category} onChangeText={setCategory} placeholder="Income, Groceries, Utilities…" />
      <Field label="Amount" hint="Stored in Philippine pesos" value={amount} onChangeText={setAmount} keyboardType="decimal-pad" placeholder="0.00" prefix="₱" />
      <Field label="Date" hint="YYYY-MM-DD" value={date} onChangeText={setDate} placeholder="2026-08-24" />
      {error ? <View style={styles.error}><Feather name="alert-circle" size={16} color={colors.danger} /><Text style={styles.errorText}>{error}</Text></View> : null}
      <SubmitButton label={saving ? 'Saving…' : type === 'income' ? 'Add income' : 'Save expense'} disabled={saving} onPress={save} />
    </FormCard>
  );
}

export function InvestmentForm({ onDone, onCancel }: { onDone: FormCompletion; onCancel: FormCompletion }) {
  const { addInvestment } = useItems();
  const [asset, setAsset] = useState<InvestmentAsset>('BTC');
  const [quantity, setQuantity] = useState('');
  const [amount, setAmount] = useState('');
  const [fees, setFees] = useState('');
  const [date, setDate] = useState(localDateKey(new Date()));
  const [saving, setSaving] = useState(false);

  const save = async () => {
    const amountMinor = parsePesoToMinor(amount);
    const feesMinor = fees.trim() ? parsePesoToMinor(fees) : 0;
    const occurredAt = validDate(date);
    if (!amountMinor || feesMinor == null || Number(quantity) <= 0 || !occurredAt) {
      Alert.alert('Check this investment', 'Add the actual quantity, amount paid, optional fees, and a valid date.');
      return;
    }
    setSaving(true);
    try {
      await addInvestment({ asset, quantity: quantity.trim(), amountMinor, feesMinor, occurredAt });
      onDone();
    } catch (error) {
      Alert.alert('Could not save investment', message(error));
      setSaving(false);
    }
  };

  return (
    <FormCard title="Add investment purchase" description="Record what you own and what you paid. Live prices are used only to estimate current value." onClose={onCancel}>
      <ChoiceGroup label="Asset" options={[{ value: 'BTC', label: 'Bitcoin (BTC)' }, { value: 'VOO', label: 'Vanguard VOO' }]} value={asset} onChange={setAsset} />
      <Field label={asset === 'BTC' ? 'BTC quantity' : 'Number of shares'} hint="Use the quantity shown by your broker or exchange" value={quantity} onChangeText={setQuantity} keyboardType="decimal-pad" placeholder={asset === 'BTC' ? '0.00125000' : '1.5'} />
      <Field label="Amount paid" hint="Before fees, in Philippine pesos" value={amount} onChangeText={setAmount} keyboardType="decimal-pad" placeholder="0.00" prefix="₱" />
      <Field label="Fees" hint="Optional" value={fees} onChangeText={setFees} keyboardType="decimal-pad" placeholder="0.00" prefix="₱" />
      <Field label="Purchase date" hint="YYYY-MM-DD" value={date} onChangeText={setDate} placeholder="2026-08-24" />
      <SubmitButton label={saving ? 'Saving…' : 'Add investment'} disabled={saving} onPress={save} />
    </FormCard>
  );
}

export function QuoteForm({ onDone, onCancel }: { onDone: FormCompletion; onCancel: FormCompletion }) {
  const { updateQuote } = useItems();
  const [asset, setAsset] = useState<InvestmentAsset>('BTC');
  const [price, setPrice] = useState('');
  const [saving, setSaving] = useState(false);
  const save = async () => {
    const priceMinor = parsePesoToMinor(price);
    if (!priceMinor) return Alert.alert('Check the price', 'Enter the current PHP price for one BTC or one VOO share.');
    setSaving(true);
    try { await updateQuote(asset, priceMinor); onDone(); }
    catch (error) { Alert.alert('Could not save price', message(error)); setSaving(false); }
  };
  return (
    <FormCard title="Set a manual price" description="Use this fallback when the live provider is unavailable. The current time is saved with the estimate." onClose={onCancel}>
      <ChoiceGroup label="Asset" options={[{ value: 'BTC', label: 'Bitcoin (BTC)' }, { value: 'VOO', label: 'Vanguard VOO' }]} value={asset} onChange={setAsset} />
      <Field label="Current price per unit" hint="Philippine pesos" value={price} onChangeText={setPrice} keyboardType="decimal-pad" placeholder="0.00" prefix="₱" />
      <SubmitButton label={saving ? 'Saving…' : 'Save manual price'} disabled={saving} onPress={save} />
    </FormCard>
  );
}

export function RecurringRuleForm({ initialRule, onDone, onCancel }: { initialRule?: RecurringRule; onDone: FormCompletion; onCancel: FormCompletion }) {
  const { addRecurringRule, updateRecurringRule } = useItems();
  const [kind, setKind] = useState<RecurringRuleKind>(initialRule?.kind ?? 'income');
  const [title, setTitle] = useState(initialRule?.title ?? '');
  const [category, setCategory] = useState(initialRule?.category ?? '');
  const [amount, setAmount] = useState(initialRule ? String(initialRule.amountMinor / 100) : '');
  const [days, setDays] = useState(initialRule?.days.join(', ') ?? '15, 30');
  const [startsOn, setStartsOn] = useState(initialRule?.startsOn ?? localDateKey(new Date()));
  const [asset, setAsset] = useState<InvestmentAsset>(initialRule?.asset ?? 'BTC');
  const [quantity, setQuantity] = useState(initialRule?.quantity ?? '');
  const [saving, setSaving] = useState(false);

  const chooseKind = (next: RecurringRuleKind) => {
    setKind(next);
    if (!initialRule) setCategory(next === 'income' ? 'Income' : next === 'expense' ? 'Bills' : 'Investment');
  };
  const save = async () => {
    const amountMinor = parsePesoToMinor(amount);
    const monthlyDays = parseMonthlyDays(days);
    if (!title.trim() || !category.trim() || !amountMinor || !monthlyDays || !validDate(startsOn)) {
      Alert.alert('Check this automation', 'Add a name, category, amount, valid start date, and unique calendar days from 1 to 31.');
      return;
    }
    if (kind === 'investment' && Number(quantity) <= 0) {
      Alert.alert('Actual quantity needed', 'Add the BTC quantity or VOO shares purchased on every scheduled date.');
      return;
    }
    setSaving(true);
    const input = { kind, title, category, amountMinor, days: monthlyDays, startsOn, asset: kind === 'investment' ? asset : undefined, quantity: kind === 'investment' ? quantity.trim() : undefined };
    try {
      if (initialRule) await updateRecurringRule(initialRule.id, input);
      else await addRecurringRule(input);
      onDone();
    } catch (error) {
      Alert.alert('Could not save automation', message(error));
      setSaving(false);
    }
  };

  return (
    <FormCard title={initialRule ? 'Edit automation' : 'Add monthly automation'} description="Salary, bills, and investments post once when due or when you next open Mewmo." onClose={onCancel}>
      <ChoiceGroup label="Automation type" options={[{ value: 'income', label: 'Salary / income' }, { value: 'expense', label: 'Bill / expense' }, { value: 'investment', label: 'Investment' }]} value={kind} onChange={chooseKind} />
      {kind === 'investment' ? <ChoiceGroup label="Asset" options={[{ value: 'BTC', label: 'Bitcoin (BTC)' }, { value: 'VOO', label: 'Vanguard VOO' }]} value={asset} onChange={setAsset} /> : null}
      <Field label="Name" value={title} onChangeText={setTitle} placeholder={kind === 'income' ? 'Salary' : kind === 'expense' ? 'Home internet' : `${asset} contribution`} />
      <Field label="Category" value={category} onChangeText={setCategory} placeholder="Income, Utilities, Investment…" />
      <Field label="Amount each time" hint="Philippine pesos" value={amount} onChangeText={setAmount} keyboardType="decimal-pad" placeholder="0.00" prefix="₱" />
      {kind === 'investment' ? <Field label={asset === 'BTC' ? 'BTC quantity each time' : 'Shares each time'} hint="The app will not guess quantity from a future market price" value={quantity} onChangeText={setQuantity} keyboardType="decimal-pad" placeholder={asset === 'BTC' ? '0.00100000' : '1'} /> : null}
      <Field label="Days of the month" hint="Comma-separated, for example 15, 30" value={days} onChangeText={setDays} keyboardType="numbers-and-punctuation" placeholder="15, 30" />
      <Field label="Start date" hint="YYYY-MM-DD; older dates can create due entries when saved" value={startsOn} onChangeText={setStartsOn} placeholder="2026-08-24" />
      <Text style={styles.note}>If a month is shorter than the chosen day, Mewmo uses that month’s final day. Pausing or deleting the automation keeps posted history.</Text>
      <SubmitButton label={saving ? 'Saving…' : initialRule ? 'Save changes' : 'Add automation'} disabled={saving} onPress={save} />
    </FormCard>
  );
}

export function BudgetForm({ initialBudget, onDone, onCancel }: { initialBudget?: MonthlyBudget; onDone: FormCompletion; onCancel: FormCompletion }) {
  const { saveBudget } = useItems();
  const [category, setCategory] = useState(initialBudget?.category ?? '');
  const [amount, setAmount] = useState(initialBudget ? String(initialBudget.limitMinor / 100) : '');
  const [saving, setSaving] = useState(false);
  const save = async () => {
    const limitMinor = parsePesoToMinor(amount);
    if (!category.trim() || !limitMinor) return Alert.alert('Check this budget', 'Add a category and valid monthly PHP limit.');
    setSaving(true);
    try { await saveBudget(category, limitMinor, initialBudget?.id); onDone(); }
    catch (error) { Alert.alert('Could not save budget', message(error)); setSaving(false); }
  };
  return (
    <FormCard title={initialBudget ? 'Edit monthly budget' : 'Set monthly budget'} description="Expenses count toward this limit when their category matches." onClose={onCancel}>
      <Field label="Expense category" hint="Use the same category when recording an expense" value={category} onChangeText={setCategory} placeholder="Groceries" />
      <Field label="Monthly limit" hint="Philippine pesos" value={amount} onChangeText={setAmount} keyboardType="decimal-pad" placeholder="0.00" prefix="₱" />
      <SubmitButton label={saving ? 'Saving…' : initialBudget ? 'Save changes' : 'Set budget'} disabled={saving} onPress={save} />
    </FormCard>
  );
}

function FormCard({ title, description, onClose, children }: PropsWithChildren<{ title: string; description: string; onClose: () => void }>) {
  return (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <View style={styles.cardCopy}><Text accessibilityRole="header" style={styles.cardTitle}>{title}</Text><Text style={styles.cardDescription}>{description}</Text></View>
        <Pressable accessibilityLabel="Close form" accessibilityRole="button" onPress={onClose} style={({ pressed }) => [styles.close, pressed && styles.pressed]}><Feather name="x" size={19} color={colors.ink} /></Pressable>
      </View>
      {children}
    </View>
  );
}

function ChoiceGroup<T extends string>({ label, options, value, onChange }: { label: string; options: { value: T; label: string }[]; value: T; onChange: (value: T) => void }) {
  return <View><Text style={styles.label}>{label}</Text><View style={styles.choices}>{options.map((option) => <Pressable accessibilityRole="button" accessibilityState={{ selected: option.value === value }} key={option.value} onPress={() => onChange(option.value)} style={({ pressed }) => [styles.choice, option.value === value && styles.choiceSelected, pressed && styles.pressed]}><Text style={[styles.choiceText, option.value === value && styles.choiceTextSelected]}>{option.label}</Text></Pressable>)}</View></View>;
}

function Field({ label, hint, prefix, ...inputProps }: { label: string; hint?: string; prefix?: string } & React.ComponentProps<typeof TextInput>) {
  return <View><View style={styles.fieldHeader}><Text style={styles.label}>{label}</Text>{hint ? <Text style={styles.hint}>{hint}</Text> : null}</View><View style={styles.inputShell}>{prefix ? <Text style={styles.prefix}>{prefix}</Text> : null}<TextInput placeholderTextColor={colors.muted} style={styles.input} {...inputProps} /></View></View>;
}

function SubmitButton({ label, disabled, onPress }: { label: string; disabled?: boolean; onPress: () => void }) {
  return <Pressable accessibilityRole="button" disabled={disabled} onPress={onPress} style={({ pressed }) => [styles.submit, disabled && styles.disabled, pressed && !disabled && styles.submitPressed]}><Text style={styles.submitText}>{label}</Text><Feather name="arrow-right" size={18} color={colors.paper} /></Pressable>;
}

function validDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  try {
    const iso = localNoonIso(value);
    const date = new Date(iso);
    return Number.isNaN(date.getTime()) || localDateKey(date) !== value ? null : iso;
  } catch {
    return null;
  }
}

function message(error: unknown) { return error instanceof Error ? error.message : 'Try again.'; }

const styles = StyleSheet.create({
  card: { marginTop: 20, padding: 18, gap: 17, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.borderStrong, backgroundColor: colors.paper },
  cardHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  cardCopy: { flex: 1 },
  cardTitle: { fontFamily: fonts.bodyBold, fontSize: 20, lineHeight: 25, letterSpacing: -0.3, color: colors.ink },
  cardDescription: { marginTop: 5, fontFamily: fonts.body, fontSize: 13, lineHeight: 19, color: colors.secondary },
  close: { width: 44, height: 44, marginTop: -7, marginRight: -7, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  fieldHeader: { marginBottom: 7, flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', gap: 12 },
  label: { fontFamily: fonts.bodySemiBold, fontSize: 12, lineHeight: 16, color: colors.ink },
  hint: { flex: 1, textAlign: 'right', fontFamily: fonts.body, fontSize: 10, lineHeight: 14, color: colors.muted },
  inputShell: { minHeight: 50, paddingHorizontal: 13, flexDirection: 'row', alignItems: 'center', borderRadius: radius.sm, borderWidth: 1, borderColor: colors.borderStrong, backgroundColor: colors.surface },
  prefix: { marginRight: 7, fontFamily: fonts.bodySemiBold, fontSize: 15, color: colors.secondary },
  input: { flex: 1, minHeight: 48, paddingVertical: 10, fontFamily: fonts.body, fontSize: 15, color: colors.ink },
  choices: { marginTop: 7, padding: 3, flexDirection: 'row', gap: 3, borderRadius: radius.md, backgroundColor: colors.background, borderWidth: 1, borderColor: colors.border },
  choice: { flex: 1, minHeight: 42, paddingHorizontal: 7, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
  choiceSelected: { backgroundColor: colors.paper, borderWidth: 1, borderColor: colors.borderStrong },
  choiceText: { textAlign: 'center', fontFamily: fonts.bodyMedium, fontSize: 11, lineHeight: 15, color: colors.secondary },
  choiceTextSelected: { fontFamily: fonts.bodySemiBold, color: colors.ink },
  note: { fontFamily: fonts.body, fontSize: 11, lineHeight: 17, color: colors.secondary },
  submit: { minHeight: 52, paddingHorizontal: 17, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderRadius: radius.md, backgroundColor: colors.ink },
  submitPressed: { backgroundColor: '#2A2A2A' },
  submitText: { fontFamily: fonts.bodySemiBold, fontSize: 14, color: colors.paper },
  disabled: { opacity: 0.48 },
  error: { padding: 11, flexDirection: 'row', alignItems: 'flex-start', gap: 8, borderRadius: radius.sm, backgroundColor: colors.dangerSoft },
  errorText: { flex: 1, fontFamily: fonts.body, fontSize: 12, lineHeight: 17, color: colors.danger },
  pressed: { opacity: 0.7 },
});
