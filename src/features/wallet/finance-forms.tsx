import { Feather } from '@expo/vector-icons';
import { PropsWithChildren, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useAppDialog } from '@/components/AppDialog';
import { colors, fonts, radius } from '@/constants/theme';
import { useItems } from '@/store/ItemsContext';
import { InvestmentAsset, MoneyTransactionType, MonthlyBudget, RecurringRule, RecurringRuleKind, SavingsGoal } from '@/types';
import { appendDecimalPoint, normalizeDecimalQuantityInput, parsePesoToMinor } from '@/utils/money';
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
  const { showDialog } = useAppDialog();
  const type = initialType;
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
      showDialog({ title: 'Check this record', message: detail, tone: 'warning' });
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
      showDialog({ title: 'Could not save record', message: detail, tone: 'danger' });
      setSaving(false);
    }
  };

  return (
    <FormCard title={type === 'income' ? 'Add money' : 'Record expense'} description={type === 'income' ? 'Use this for salary, deposits, or a cash adjustment after your tracking start date.' : 'Record money that left your wallet.'} onClose={onCancel}>
      <Field label="Description" value={title} onChangeText={setTitle} placeholder={type === 'income' ? 'Salary or starting balance' : 'Groceries or internet bill'} />
      <Field label="Category" value={category} onChangeText={setCategory} placeholder="Income, Groceries, Utilities…" />
      <Field label="Amount" hint="Stored in Philippine pesos" value={amount} onChangeText={setAmount} keyboardType="decimal-pad" placeholder="0.00" prefix="₱" />
      <Field label="Date" hint="YYYY-MM-DD" value={date} onChangeText={setDate} placeholder="2026-08-24" />
      {error ? <View style={styles.error}><Feather name="alert-circle" size={16} color={colors.danger} /><Text style={styles.errorText}>{error}</Text></View> : null}
      <SubmitButton label={saving ? 'Saving…' : type === 'income' ? 'Add money' : 'Save expense'} disabled={saving} onPress={save} />
    </FormCard>
  );
}

export function WalletSetupForm({ onDone, onCancel }: { onDone: FormCompletion; onCancel: FormCompletion }) {
  const { walletSetup, setWalletSetup } = useItems();
  const { showDialog } = useAppDialog();
  const [amount, setAmount] = useState(walletSetup ? String(walletSetup.openingBalanceMinor / 100) : '0');
  const [startsOn, setStartsOn] = useState(walletSetup?.startsOn ?? localDateKey(new Date()));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const save = async () => {
    const openingBalanceMinor = parsePesoToMinor(amount);
    if (openingBalanceMinor == null || !validDate(startsOn)) {
      const detail = 'Enter your wallet amount and a valid tracking date in YYYY-MM-DD format.';
      setError(detail);
      showDialog({ title: 'Check your starting point', message: detail, tone: 'warning' });
      return;
    }
    setError(null);
    setSaving(true);
    try {
      await setWalletSetup({ openingBalanceMinor, startsOn });
      onDone();
    } catch (error) {
      const detail = message(error);
      setError(detail);
      showDialog({ title: 'Could not save starting point', message: detail, tone: 'danger' });
      setSaving(false);
    }
  };

  return (
    <FormCard title={walletSetup ? 'Edit wallet starting point' : 'Set wallet starting point'} description="Choose the cash you want to start with. Older income, expenses, and investment purchases stay in your records but no longer change this wallet balance." onClose={onCancel}>
      <Field label="Starting wallet amount" hint="Cash available on the start date" value={amount} onChangeText={setAmount} keyboardType="decimal-pad" placeholder="0.00" prefix="₱" />
      <Field label="Start tracking on" hint="YYYY-MM-DD" value={startsOn} onChangeText={setStartsOn} placeholder="2026-08-31" />
      <Text style={styles.note}>Your BTC and VOO quantities and cost history are preserved. Only wallet movements dated on or after this day affect available cash.</Text>
      {error ? <View style={styles.error}><Feather name="alert-circle" size={16} color={colors.danger} /><Text style={styles.errorText}>{error}</Text></View> : null}
      <SubmitButton label={saving ? 'Saving…' : 'Use this starting point'} disabled={saving} onPress={save} />
    </FormCard>
  );
}

export function InvestmentForm({ onDone, onCancel }: { onDone: FormCompletion; onCancel: FormCompletion }) {
  const { addInvestment, walletSetup } = useItems();
  const { showDialog } = useAppDialog();
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
      showDialog({ title: 'Check this investment', message: 'Add the actual quantity, amount paid, optional fees, and a valid date.', tone: 'warning' });
      return;
    }
    setSaving(true);
    try {
      await addInvestment({ asset, quantity: quantity.trim(), amountMinor, feesMinor, occurredAt });
      onDone();
    } catch (error) {
      showDialog({ title: 'Could not save investment', message: message(error), tone: 'danger' });
      setSaving(false);
    }
  };

  return (
    <FormCard title="Add investment purchase" description="Record what you own and what you paid. Live prices are used only to estimate current value." onClose={onCancel}>
      <ChoiceGroup label="Asset" options={[{ value: 'BTC', label: 'Bitcoin (BTC)' }, { value: 'VOO', label: 'Vanguard VOO' }]} value={asset} onChange={setAsset} />
      <QuantityField label={asset === 'BTC' ? 'BTC quantity' : 'Number of shares'} hint="Fractions are supported, up to 8 decimal places" value={quantity} onChangeText={setQuantity} placeholder={asset === 'BTC' ? '0.00125000' : '0.04'} />
      <Field label="Amount paid" hint="Before fees, in Philippine pesos" value={amount} onChangeText={setAmount} keyboardType="decimal-pad" placeholder="0.00" prefix="₱" />
      <Field label="Fees" hint="Optional" value={fees} onChangeText={setFees} keyboardType="decimal-pad" placeholder="0.00" prefix="₱" />
      <Field label="Purchase date" hint="YYYY-MM-DD" value={date} onChangeText={setDate} placeholder="2026-08-24" />
      {walletSetup ? <Text style={styles.note}>A purchase before {walletSetup.startsOn} stays in your portfolio history but will not reduce the tracked wallet.</Text> : <Text style={styles.note}>Set a wallet starting point if this is an existing holding that should not reduce your current cash.</Text>}
      <SubmitButton label={saving ? 'Saving…' : 'Add investment'} disabled={saving} onPress={save} />
    </FormCard>
  );
}

export function QuoteForm({ onDone, onCancel }: { onDone: FormCompletion; onCancel: FormCompletion }) {
  const { updateQuote } = useItems();
  const { showDialog } = useAppDialog();
  const [asset, setAsset] = useState<InvestmentAsset>('BTC');
  const [price, setPrice] = useState('');
  const [saving, setSaving] = useState(false);
  const save = async () => {
    const priceMinor = parsePesoToMinor(price);
    if (!priceMinor) return showDialog({ title: 'Check the price', message: 'Enter the current PHP price for one BTC or one VOO share.', tone: 'warning' });
    setSaving(true);
    try { await updateQuote(asset, priceMinor); onDone(); }
    catch (error) { showDialog({ title: 'Could not save price', message: message(error), tone: 'danger' }); setSaving(false); }
  };
  return (
    <FormCard title="Set a manual price" description="Use this fallback when the live provider is unavailable. The current time is saved with the estimate." onClose={onCancel}>
      <ChoiceGroup label="Asset" options={[{ value: 'BTC', label: 'Bitcoin (BTC)' }, { value: 'VOO', label: 'Vanguard VOO' }]} value={asset} onChange={setAsset} />
      <Field label="Current price per unit" hint="Philippine pesos" value={price} onChangeText={setPrice} keyboardType="decimal-pad" placeholder="0.00" prefix="₱" />
      <SubmitButton label={saving ? 'Saving…' : 'Save manual price'} disabled={saving} onPress={save} />
    </FormCard>
  );
}

export function RecurringRuleForm({ initialRule, onDone, onCancel, mode = 'automation' }: { initialRule?: RecurringRule; onDone: FormCompletion; onCancel: FormCompletion; mode?: 'automation' | 'subscription' }) {
  const { addRecurringRule, updateRecurringRule } = useItems();
  const { showDialog } = useAppDialog();
  const [kind, setKind] = useState<RecurringRuleKind>(mode === 'subscription' ? 'expense' : initialRule?.kind === 'expense' ? 'income' : initialRule?.kind ?? 'income');
  const [title, setTitle] = useState(initialRule?.title ?? '');
  const [category, setCategory] = useState(initialRule?.category ?? (mode === 'subscription' ? 'Subscriptions' : ''));
  const [amount, setAmount] = useState(initialRule ? String(initialRule.amountMinor / 100) : '');
  const [days, setDays] = useState(initialRule?.days.join(', ') ?? '15, 30');
  const [startsOn, setStartsOn] = useState(initialRule?.startsOn ?? localDateKey(new Date()));
  const [asset, setAsset] = useState<InvestmentAsset>(initialRule?.asset ?? 'BTC');
  const [saving, setSaving] = useState(false);

  const chooseKind = (next: RecurringRuleKind) => {
    setKind(next);
    if (!initialRule) setCategory(next === 'income' ? 'Income' : next === 'expense' ? 'Bills' : 'Investment');
  };
  const save = async () => {
    const amountMinor = parsePesoToMinor(amount);
    const monthlyDays = parseMonthlyDays(days);
    if (!title.trim() || !category.trim() || !amountMinor || !monthlyDays || !validDate(startsOn)) {
      showDialog({ title: mode === 'subscription' ? 'Check this subscription or bill' : 'Check this automation', message: 'Add a name, category, amount, valid start date, and unique calendar days from 1 to 31.', tone: 'warning' });
      return;
    }
    setSaving(true);
    const input = { kind, title, category, amountMinor, days: monthlyDays, startsOn, asset: kind === 'investment' ? asset : undefined };
    try {
      if (initialRule) await updateRecurringRule(initialRule.id, input);
      else await addRecurringRule(input);
      onDone();
    } catch (error) {
      showDialog({ title: mode === 'subscription' ? 'Could not save subscription or bill' : 'Could not save automation', message: message(error), tone: 'danger' });
      setSaving(false);
    }
  };

  return (
    <FormCard title={mode === 'subscription' ? initialRule ? 'Edit subscription or bill' : 'Add subscription or bill' : initialRule ? 'Edit automation' : 'Add monthly automation'} description={mode === 'subscription' ? 'Each due date becomes a pending payment for you to edit or confirm.' : 'Each due salary or investment becomes an editable item in Review.'} onClose={onCancel}>
      {mode === 'automation' ? <ChoiceGroup label="Automation type" options={[{ value: 'income', label: 'Salary / income' }, { value: 'investment', label: 'Investment' }]} value={kind as Exclude<RecurringRuleKind, 'expense'>} onChange={chooseKind} /> : null}
      {kind === 'investment' ? <ChoiceGroup label="Asset" options={[{ value: 'BTC', label: 'Bitcoin (BTC)' }, { value: 'VOO', label: 'Vanguard VOO' }]} value={asset} onChange={setAsset} /> : null}
      <Field label="Name" value={title} onChangeText={setTitle} placeholder={kind === 'income' ? 'Salary' : kind === 'expense' ? 'Home internet' : `${asset} contribution`} />
      <Field label="Category" value={category} onChangeText={setCategory} placeholder="Income, Utilities, Investment…" />
      <Field label={kind === 'investment' ? 'Investment budget each time' : 'Amount each time'} hint="Philippine pesos" value={amount} onChangeText={setAmount} keyboardType="decimal-pad" placeholder="0.00" prefix="₱" />
      <Field label="Days of the month" hint="Comma-separated, for example 15, 30" value={days} onChangeText={setDays} keyboardType="numbers-and-punctuation" placeholder="15, 30" />
      <Field label="Start date" hint="YYYY-MM-DD; older dates can create due entries when saved" value={startsOn} onChangeText={setStartsOn} placeholder="2026-08-24" />
      {kind === 'investment' ? <Text style={styles.note}>LifeDesk may show an estimate using the latest price, but confirmation asks for the exact fractional {asset === 'VOO' ? 'shares' : 'BTC'} and purchase date from your broker. This tracks your plan; it does not place an order.</Text> : null}
      <Text style={styles.note}>If a month is shorter than the chosen day, LifeDesk uses that month’s final day. Nothing changes your wallet until you confirm the pending occurrence.</Text>
      <SubmitButton label={saving ? 'Saving…' : initialRule ? 'Save changes' : mode === 'subscription' ? 'Add subscription or bill' : 'Add automation'} disabled={saving} onPress={save} />
    </FormCard>
  );
}

export function BudgetForm({ initialBudget, onDone, onCancel }: { initialBudget?: MonthlyBudget; onDone: FormCompletion; onCancel: FormCompletion }) {
  const { saveBudget } = useItems();
  const { showDialog } = useAppDialog();
  const [category, setCategory] = useState(initialBudget?.category ?? '');
  const [amount, setAmount] = useState(initialBudget ? String(initialBudget.limitMinor / 100) : '');
  const [saving, setSaving] = useState(false);
  const save = async () => {
    const limitMinor = parsePesoToMinor(amount);
    if (!category.trim() || !limitMinor) return showDialog({ title: 'Check this budget', message: 'Add a category and valid monthly PHP limit.', tone: 'warning' });
    setSaving(true);
    try { await saveBudget(category, limitMinor, initialBudget?.id); onDone(); }
    catch (error) { showDialog({ title: 'Could not save budget', message: message(error), tone: 'danger' }); setSaving(false); }
  };
  return (
    <FormCard title={initialBudget ? 'Edit monthly budget' : 'Set monthly budget'} description="Expenses count toward this limit when their category matches." onClose={onCancel}>
      <Field label="Expense category" hint="Use the same category when recording an expense" value={category} onChangeText={setCategory} placeholder="Groceries" />
      <Field label="Monthly limit" hint="Philippine pesos" value={amount} onChangeText={setAmount} keyboardType="decimal-pad" placeholder="0.00" prefix="₱" />
      <SubmitButton label={saving ? 'Saving…' : initialBudget ? 'Save changes' : 'Set budget'} disabled={saving} onPress={save} />
    </FormCard>
  );
}

export function SavingsGoalForm({ initialGoal, onDone, onCancel }: { initialGoal?: SavingsGoal; onDone: FormCompletion; onCancel: FormCompletion }) {
  const { saveGoal } = useItems();
  const { showDialog } = useAppDialog();
  const [name, setName] = useState(initialGoal?.name ?? '');
  const [target, setTarget] = useState(initialGoal ? String(initialGoal.targetMinor / 100) : '');
  const [saved, setSaved] = useState(initialGoal ? String(initialGoal.savedMinor / 100) : '0');
  const [paydayContribution, setPaydayContribution] = useState(initialGoal ? String(initialGoal.paydayContributionMinor / 100) : '0');
  const [targetDate, setTargetDate] = useState(initialGoal?.targetDate ?? '');
  const [saving, setSaving] = useState(false);

  const save = async () => {
    const targetMinor = parsePesoToMinor(target);
    const savedMinor = parsePesoToMinor(saved);
    const paydayContributionMinor = parsePesoToMinor(paydayContribution);
    if (!name.trim() || !targetMinor || savedMinor == null || paydayContributionMinor == null || (targetDate && !validDate(targetDate))) {
      return showDialog({ title: 'Check this savings goal', message: 'Add a name, target, valid reserved amount, optional payday suggestion, and a target date in YYYY-MM-DD format.', tone: 'warning' });
    }
    setSaving(true);
    try {
      await saveGoal({ name, targetMinor, savedMinor, paydayContributionMinor, targetDate: targetDate || undefined }, initialGoal?.id);
      onDone();
    } catch (error) {
      showDialog({ title: 'Could not save goal', message: message(error), tone: 'danger' });
      setSaving(false);
    }
  };

  return (
    <FormCard title={initialGoal ? 'Edit savings goal' : 'Add savings goal'} description="Reserve part of your existing wallet for a purpose without recording it as money spent." onClose={onCancel}>
      <Field label="Goal name" value={name} onChangeText={setName} placeholder="Emergency fund" />
      <Field label="Target amount" hint="Philippine pesos" value={target} onChangeText={setTarget} keyboardType="decimal-pad" placeholder="0.00" prefix="₱" />
      <Field label="Reserved so far" hint="Reduces safe-to-spend, not wallet balance" value={saved} onChangeText={setSaved} keyboardType="decimal-pad" placeholder="0.00" prefix="₱" />
      <Field label="Suggest after each payday" hint="Optional; you still confirm it" value={paydayContribution} onChangeText={setPaydayContribution} keyboardType="decimal-pad" placeholder="0.00" prefix="₱" />
      <Field label="Target date" hint="Optional · YYYY-MM-DD" value={targetDate} onChangeText={setTargetDate} placeholder="2027-01-31" />
      <Text style={styles.note}>A payday suggestion appears in Review only after confirmed income. Confirming it increases this reserved progress; it never creates an expense.</Text>
      <SubmitButton label={saving ? 'Saving…' : initialGoal ? 'Save changes' : 'Add goal'} disabled={saving} onPress={save} />
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
  return <View><View style={styles.fieldHeader}><Text style={styles.label}>{label}</Text>{hint ? <Text style={styles.hint}>{hint}</Text> : null}</View><View style={styles.inputShell}>{prefix ? <Text style={styles.prefix}>{prefix}</Text> : null}<TextInput placeholderTextColor={colors.muted} style={styles.input} {...inputProps} accessibilityLabel={inputProps.accessibilityLabel ?? label} /></View></View>;
}

function QuantityField({ label, hint, value, onChangeText, placeholder }: { label: string; hint: string; value: string; onChangeText: (value: string) => void; placeholder: string }) {
  const insertDecimal = () => onChangeText(appendDecimalPoint(value));
  return (
    <View>
      <View style={styles.fieldHeader}><Text style={styles.label}>{label}</Text><Text style={styles.hint}>{hint}</Text></View>
      <View style={styles.inputShell}>
        <TextInput
          accessibilityLabel={label}
          autoCorrect={false}
          inputMode="decimal"
          keyboardType="decimal-pad"
          onChangeText={(next) => onChangeText(normalizeDecimalQuantityInput(next))}
          placeholder={placeholder}
          placeholderTextColor={colors.muted}
          style={styles.input}
          value={value}
        />
        <Pressable
          accessibilityLabel="Insert decimal point"
          accessibilityRole="button"
          disabled={value.includes('.')}
          onPress={insertDecimal}
          style={({ pressed }) => [styles.decimalButton, value.includes('.') && styles.decimalButtonDisabled, pressed && styles.pressed]}
        >
          <Text style={styles.decimalButtonText}>.</Text>
        </Pressable>
      </View>
    </View>
  );
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
  decimalButton: { width: 44, height: 44, marginRight: -8, alignItems: 'center', justifyContent: 'center', borderRadius: radius.sm, backgroundColor: colors.paper },
  decimalButtonDisabled: { opacity: 0.35 },
  decimalButtonText: { marginTop: -8, fontFamily: fonts.bodyBold, fontSize: 25, color: colors.ink },
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
