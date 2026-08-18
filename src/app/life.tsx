import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import Animated, { FadeIn, FadeInDown, useReducedMotion } from 'react-native-reanimated';
import { AppScreen } from '@/components/AppScreen';
import { PixelCat } from '@/components/PixelCat';
import { colors, fonts, motion } from '@/constants/theme';
import { useItems } from '@/store/ItemsContext';
import { InvestmentAsset, MoneyTransactionType, RecurringRuleKind } from '@/types';
import { DisplayCurrency, estimatedValueMinor, formatMoney, formatPeso, parsePesoToMinor, sumDecimalQuantities } from '@/utils/money';
import { localDateKey, nextScheduledDate, parseMonthlyDays } from '@/utils/recurrence';

type LifeTab = 'work' | 'money';

export default function LifeScreen() {
  const [tab, setTab] = useState<LifeTab>('work');
  const reduceMotion = useReducedMotion();
  return (
    <AppScreen bottomNav background={colors.paper}>
      <View style={styles.header}><Text style={styles.title}>LIFE</Text><PixelCat pose={tab === 'work' ? 'curious' : 'idle'} size={62} /></View>
      <View accessibilityRole="tablist" style={styles.tabs}><Tab label="WORK" active={tab === 'work'} onPress={() => setTab('work')} /><Tab label="MONEY" active={tab === 'money'} onPress={() => setTab('money')} /></View>
      <Animated.View key={tab} entering={reduceMotion ? undefined : FadeIn.duration(motion.base)}>{tab === 'work' ? <WorkPanel /> : <MoneyPanel />}</Animated.View>
    </AppScreen>
  );
}

function Tab({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return <Pressable accessibilityRole="tab" accessibilityState={{ selected: active }} onPress={onPress} style={[styles.tab, active && styles.tabActive]}><Text style={[styles.tabText, active && styles.tabTextActive]}>{label}</Text></Pressable>;
}

function WorkPanel() {
  const router = useRouter();
  const { projects, addProject } = useItems();
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState('');
  const [nextAction, setNextAction] = useState('');

  const create = async () => {
    if (!name.trim()) return;
    const project = await addProject({ name, nextAction });
    setName(''); setNextAction(''); setAdding(false);
    router.push({ pathname: '/project/[id]', params: { id: project.id } });
  };

  return <View style={styles.panel}>
    <View style={styles.sectionHead}><View><Text style={styles.sectionTitle}>ACTIVE PROJECTS</Text><Text style={styles.sectionSupport}>Pick up exactly where you stopped.</Text></View><Pressable accessibilityLabel="Add project" onPress={() => setAdding((value) => !value)} style={styles.squareButton}><Feather name={adding ? 'x' : 'plus'} size={20} color={colors.ink} /></Pressable></View>
    {adding ? <View style={styles.form}><TextInput value={name} onChangeText={setName} placeholder="Project name" placeholderTextColor={colors.muted} style={styles.input} /><TextInput value={nextAction} onChangeText={setNextAction} placeholder="First next action" placeholderTextColor={colors.muted} style={styles.input} /><Pressable onPress={create} style={styles.primary}><Text style={styles.primaryText}>CREATE PROJECT</Text></Pressable></View> : null}
    <View style={styles.ruledList}>
      {projects.filter((project) => project.status === 'active').map((project) => <Pressable key={project.id} onPress={() => router.push({ pathname: '/project/[id]', params: { id: project.id } })} style={styles.projectRow}><Feather name="folder" size={22} color={colors.ink} /><View style={styles.rowMain}><Text style={styles.rowTitle}>{project.name}</Text><Text numberOfLines={2} style={styles.rowMeta}>{project.nextAction || project.currentFocus || 'Add a handoff note to remember the next step.'}</Text></View><Feather name="chevron-right" size={20} color={colors.ink} /></Pressable>)}
      {!projects.length ? <View style={styles.empty}><Text style={styles.emptyTitle}>NO PROJECTS YET</Text><Text style={styles.emptyText}>Create one here, or mention a project in your next Mewmo recording.</Text></View> : null}
    </View>
    <Pressable onPress={() => router.push('/projects')} style={styles.secondary}><Text style={styles.secondaryText}>VIEW ALL PROJECTS</Text><Feather name="arrow-right" size={17} color={colors.ink} /></Pressable>
  </View>;
}

function MoneyPanel() {
  const { transactions, investments, quotes, recurringRules, budgets, addTransaction, addInvestment, updateQuote, refreshMarketQuotes, addRecurringRule, toggleRecurringRule, deleteRecurringRule, saveBudget, deleteBudget } = useItems();
  const [form, setForm] = useState<'transaction' | 'investment' | 'quote' | 'recurring' | 'budget' | null>(null);
  const [displayCurrency, setDisplayCurrency] = useState<DisplayCurrency>('PHP');
  const [refreshingQuotes, setRefreshingQuotes] = useState(false);
  const reduceMotion = useReducedMotion();
  const usdPhp = quotes.find((quote) => quote.usdPhp)?.usdPhp;
  const money = (minor: number) => formatMoney(minor, displayCurrency, usdPhp);
  const now = new Date();
  const thisMonth = (occurredAt: string) => { const date = new Date(occurredAt); return date.getFullYear() === now.getFullYear() && date.getMonth() === now.getMonth(); };
  const monthlyTransactions = transactions.filter((item) => thisMonth(item.occurredAt));
  const income = monthlyTransactions.filter((item) => item.type === 'income').reduce((sum, item) => sum + item.amountMinor, 0);
  const spent = monthlyTransactions.filter((item) => item.type === 'expense' || item.type === 'investment').reduce((sum, item) => sum + item.amountMinor, 0);
  const balance = transactions.reduce((sum, item) => sum + (item.type === 'income' ? item.amountMinor : item.type === 'expense' || item.type === 'investment' ? -item.amountMinor : 0), 0);
  const positions = useMemo(() => (['BTC', 'VOO'] as InvestmentAsset[]).map((asset) => {
    const lots = investments.filter((item) => item.asset === asset);
    const quantity = sumDecimalQuantities(lots.map((lot) => lot.quantity)) ?? '0';
    const recorded = lots.reduce((sum, lot) => sum + lot.amountMinor + lot.feesMinor, 0);
    const quote = quotes.find((item) => item.asset === asset);
    const displayPrice = displayCurrency === 'USD' ? quote?.usdPriceMinor : quote?.priceMinor;
    const estimated = displayPrice ? estimatedValueMinor(quantity, displayPrice) : null;
    return { asset, quantity, recorded, quote, estimated };
  }), [displayCurrency, investments, quotes]);

  return <View style={styles.panel}>
    <View style={styles.currencyHeader}><View style={styles.rowMain}><Text style={styles.micro}>{new Intl.DateTimeFormat('en-PH', { month: 'long', year: 'numeric' }).format(new Date()).toUpperCase()} SUMMARY</Text><Text style={styles.currencyNote}>{displayCurrency === 'USD' && usdPhp ? `1 USD = ${usdPhp.toFixed(2)} PHP · TWELVE DATA` : 'RECORDS ARE STORED IN PHP'}</Text></View><View accessibilityRole="tablist" style={styles.currencyToggle}><Pressable accessibilityRole="tab" accessibilityState={{ selected: displayCurrency === 'PHP' }} onPress={() => setDisplayCurrency('PHP')} style={[styles.currencyOption, displayCurrency === 'PHP' && styles.currencyOptionActive]}><Text style={[styles.currencyOptionText, displayCurrency === 'PHP' && styles.currencyOptionTextActive]}>PHP</Text></Pressable><Pressable accessibilityRole="tab" accessibilityState={{ selected: displayCurrency === 'USD', disabled: !usdPhp }} onPress={() => usdPhp ? setDisplayCurrency('USD') : Alert.alert('Refresh prices first', 'Add your Twelve Data key and tap LIVE REFRESH to load the USD/PHP rate.')} style={[styles.currencyOption, displayCurrency === 'USD' && styles.currencyOptionActive, !usdPhp && styles.currencyOptionDisabled]}><Text style={[styles.currencyOptionText, displayCurrency === 'USD' && styles.currencyOptionTextActive]}>USD</Text></Pressable></View></View>
    <View style={styles.summary}><Summary label="BALANCE" value={money(balance)} /><Summary label="INCOME" value={money(income)} /><Summary label="SPENT" value={money(spent)} /></View>
    <View style={styles.actionRow}><Pressable onPress={() => setForm(form === 'transaction' ? null : 'transaction')} style={styles.actionButton}><Feather name="plus" size={16} color={colors.ink} /><Text style={styles.actionText}>TRANSACTION</Text></Pressable><Pressable onPress={() => setForm(form === 'investment' ? null : 'investment')} style={styles.actionButton}><Feather name="trending-up" size={16} color={colors.ink} /><Text style={styles.actionText}>INVESTMENT</Text></Pressable></View>
    <View style={styles.actionRow}><Pressable onPress={() => setForm(form === 'recurring' ? null : 'recurring')} style={styles.actionButton}><Feather name="repeat" size={16} color={colors.ink} /><Text style={styles.actionText}>AUTOMATION</Text></Pressable><Pressable onPress={() => setForm(form === 'budget' ? null : 'budget')} style={styles.actionButton}><Feather name="pie-chart" size={16} color={colors.ink} /><Text style={styles.actionText}>BUDGET</Text></Pressable></View>
    {form ? <Animated.View key={form} entering={reduceMotion ? undefined : FadeInDown.duration(motion.base)}>
      {form === 'transaction' ? <TransactionForm onSave={async (value) => { await addTransaction(value); setForm(null); }} /> : null}
      {form === 'investment' ? <InvestmentForm onSave={async (value) => { await addInvestment(value); setForm(null); }} /> : null}
      {form === 'quote' ? <QuoteForm onSave={async (asset, price) => { await updateQuote(asset, price); setForm(null); }} /> : null}
      {form === 'recurring' ? <RecurringForm onSave={async (value) => { await addRecurringRule(value); setForm(null); }} /> : null}
      {form === 'budget' ? <BudgetForm onSave={async (category, limit) => { await saveBudget(category, limit); setForm(null); }} /> : null}
    </Animated.View> : null}

    <View style={styles.sectionHead}><View><Text style={styles.sectionTitle}>AUTOMATIC MONEY</Text><Text style={styles.sectionSupport}>Posts once when due, or when you next open the app.</Text></View></View>
    <View style={styles.ruledList}>{recurringRules.map((rule) => <View key={rule.id} style={styles.planRow}><View style={styles.rowMain}><Text style={styles.rowTitle}>{rule.title}</Text><Text style={styles.rowMeta}>{rule.kind.toUpperCase()} · {money(rule.amountMinor)} · DAY {rule.days.join(' & ')}{rule.asset ? ` · ${rule.asset} ${rule.quantity}` : ''}</Text><Text style={styles.planNext}>{rule.active ? `NEXT ${nextScheduledDate(rule) ?? '—'}` : 'PAUSED'}</Text></View><Pressable accessibilityLabel={rule.active ? `Pause ${rule.title}` : `Resume ${rule.title}`} onPress={() => toggleRecurringRule(rule.id)} style={styles.rowAction}><Feather name={rule.active ? 'pause' : 'play'} size={16} color={colors.ink} /></Pressable><Pressable accessibilityLabel={`Delete ${rule.title}`} onPress={() => Alert.alert('Delete automation?', 'Already posted transactions will stay in your history.', [{ text: 'Cancel', style: 'cancel' }, { text: 'Delete', style: 'destructive', onPress: () => deleteRecurringRule(rule.id) }])} style={styles.rowAction}><Feather name="trash-2" size={16} color={colors.danger} /></Pressable></View>)}{!recurringRules.length ? <Text style={styles.emptyText}>Add salary dates, monthly bills, or recurring BTC/VOO contributions.</Text> : null}</View>

    <View style={styles.sectionHead}><Text style={styles.sectionTitle}>MONTHLY BUDGETS</Text></View>
    <View style={styles.ruledList}>{budgets.map((budget) => { const used = monthlyTransactions.filter((item) => item.type === 'expense' && item.category.toLocaleLowerCase() === budget.category.toLocaleLowerCase()).reduce((sum, item) => sum + item.amountMinor, 0); const ratio = Math.min(used / budget.limitMinor, 1); return <View key={budget.id} style={styles.budgetRow}><View style={styles.budgetTop}><View><Text style={styles.rowTitle}>{budget.category}</Text><Text style={styles.rowMeta}>{money(used)} of {money(budget.limitMinor)}</Text></View><Pressable accessibilityLabel={`Delete ${budget.category} budget`} onPress={() => deleteBudget(budget.id)} style={styles.rowAction}><Feather name="trash-2" size={16} color={colors.danger} /></Pressable></View><View style={styles.budgetTrack}><View style={[styles.budgetFill, { width: `${ratio * 100}%` }]} /></View></View>; })}{!budgets.length ? <Text style={styles.emptyText}>Set a category budget such as Groceries or Transport.</Text> : null}</View>

    <View style={styles.sectionHead}><Text style={styles.sectionTitle}>RECENT TRANSACTIONS</Text></View>
    <View style={styles.ruledList}>{transactions.slice(0, 5).map((item) => <View key={item.id} style={styles.moneyRow}><View style={styles.moneyIcon}><Feather name={item.type === 'income' ? 'arrow-down' : item.type === 'investment' ? 'trending-up' : 'arrow-up'} size={16} color={colors.ink} /></View><View style={styles.rowMain}><Text style={styles.rowTitle}>{item.title}</Text><Text style={styles.rowMeta}>{item.category} · {new Intl.DateTimeFormat('en-PH', { month: 'short', day: 'numeric' }).format(new Date(item.occurredAt))}</Text></View><Text style={[styles.moneyValue, item.type === 'income' && styles.income]}> {item.type === 'income' ? '+' : '−'}{money(item.amountMinor)}</Text></View>)}{!transactions.length ? <Text style={styles.emptyText}>No money records yet. Add one manually or confirm one from Mewmo.</Text> : null}</View>

    <View style={styles.sectionHead}><Text style={styles.sectionTitle}>INVESTMENTS</Text><View style={styles.inlineLinks}><Pressable disabled={refreshingQuotes} onPress={async () => { setRefreshingQuotes(true); try { await refreshMarketQuotes(); } catch (error) { Alert.alert('Could not refresh prices', error instanceof Error ? error.message : 'Try again.'); } finally { setRefreshingQuotes(false); } }}><Text style={styles.link}>{refreshingQuotes ? 'REFRESHING...' : 'LIVE REFRESH'}</Text></Pressable><Pressable onPress={() => setForm(form === 'quote' ? null : 'quote')}><Text style={styles.link}>MANUAL</Text></Pressable></View></View>
    <View style={styles.ruledList}>{positions.map((position) => <View key={position.asset} style={styles.position}><View style={styles.assetMark}><Text style={styles.assetMarkText}>{position.asset === 'BTC' ? '₿' : 'V'}</Text></View><View style={styles.rowMain}><Text style={styles.rowTitle}>{position.asset}</Text><Text style={styles.rowMeta}>{position.quantity || '0'} {position.asset === 'VOO' ? 'shares' : 'BTC'}</Text></View><View style={styles.positionValues}><Text style={styles.recorded}>{money(position.recorded)} RECORDED</Text><Text style={styles.estimated}>{position.estimated == null ? 'NO ESTIMATE' : `${displayCurrency === 'USD' ? new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(position.estimated / 100) : formatPeso(position.estimated)} EST.`}</Text>{position.quote ? <Text style={styles.quoteTime}>{position.quote.source.toUpperCase()} · {new Intl.DateTimeFormat('en-PH', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }).format(new Date(position.quote.asOf))}</Text> : null}</View></View>)}</View>
  </View>;
}

function Summary({ label, value }: { label: string; value: string }) { return <View style={styles.summaryCell}><Text style={styles.summaryLabel}>{label}</Text><Text adjustsFontSizeToFit numberOfLines={1} style={styles.summaryValue}>{value}</Text></View>; }

function TransactionForm({ onSave }: { onSave: (value: { type: MoneyTransactionType; title: string; category: string; amountMinor: number }) => Promise<void> }) {
  const [type, setType] = useState<MoneyTransactionType>('expense'); const [title, setTitle] = useState(''); const [category, setCategory] = useState('General'); const [amount, setAmount] = useState(''); const [saving, setSaving] = useState(false);
  const save = async () => { const minor = parsePesoToMinor(amount); if (!title.trim() || !minor) return Alert.alert('Check the transaction', 'Add a title and a valid amount.'); setSaving(true); try { await onSave({ type, title, category, amountMinor: minor }); } catch (error) { Alert.alert('Could not save', error instanceof Error ? error.message : 'Try again.'); setSaving(false); } };
  return <View style={styles.form}><View style={styles.choiceRow}><Choice label="EXPENSE" selected={type === 'expense'} onPress={() => setType('expense')} /><Choice label="INCOME" selected={type === 'income'} onPress={() => setType('income')} /><Choice label="TRANSFER" selected={type === 'transfer'} onPress={() => setType('transfer')} /></View><TextInput value={title} onChangeText={setTitle} placeholder="What was it?" placeholderTextColor={colors.muted} style={styles.input} /><TextInput value={category} onChangeText={setCategory} placeholder="Category" placeholderTextColor={colors.muted} style={styles.input} /><TextInput value={amount} onChangeText={setAmount} keyboardType="decimal-pad" placeholder="Amount in PHP" placeholderTextColor={colors.muted} style={styles.input} /><Pressable disabled={saving} onPress={save} style={styles.primary}><Text style={styles.primaryText}>{saving ? 'SAVING...' : 'SAVE TRANSACTION'}</Text></Pressable></View>;
}

function InvestmentForm({ onSave }: { onSave: (value: { asset: InvestmentAsset; quantity: string; amountMinor: number }) => Promise<void> }) {
  const [asset, setAsset] = useState<InvestmentAsset>('BTC'); const [quantity, setQuantity] = useState(''); const [amount, setAmount] = useState(''); const [saving, setSaving] = useState(false);
  const save = async () => { const minor = parsePesoToMinor(amount); if (!minor || Number(quantity) <= 0) return Alert.alert('Check the investment', 'Add a valid quantity and invested amount.'); setSaving(true); try { await onSave({ asset, quantity, amountMinor: minor }); } catch (error) { Alert.alert('Could not save', error instanceof Error ? error.message : 'Try again.'); setSaving(false); } };
  return <View style={styles.form}><View style={styles.choiceRow}><Choice label="BTC" selected={asset === 'BTC'} onPress={() => setAsset('BTC')} /><Choice label="VOO" selected={asset === 'VOO'} onPress={() => setAsset('VOO')} /></View><TextInput value={quantity} onChangeText={setQuantity} keyboardType="decimal-pad" placeholder={asset === 'BTC' ? 'BTC quantity' : 'Number of shares'} placeholderTextColor={colors.muted} style={styles.input} /><TextInput value={amount} onChangeText={setAmount} keyboardType="decimal-pad" placeholder="Amount invested in PHP" placeholderTextColor={colors.muted} style={styles.input} /><Text style={styles.formNote}>This creates one linked cash movement and investment lot.</Text><Pressable disabled={saving} onPress={save} style={styles.primary}><Text style={styles.primaryText}>{saving ? 'SAVING...' : 'RECORD INVESTMENT'}</Text></Pressable></View>;
}

function QuoteForm({ onSave }: { onSave: (asset: InvestmentAsset, priceMinor: number) => Promise<void> }) {
  const [asset, setAsset] = useState<InvestmentAsset>('BTC'); const [price, setPrice] = useState('');
  const save = async () => { const minor = parsePesoToMinor(price); if (!minor) return Alert.alert('Check the price', 'Enter the current PHP price per BTC or VOO share.'); await onSave(asset, minor); };
  return <View style={styles.form}><Text style={styles.formNote}>Manual quotes are estimates and always include this update time.</Text><View style={styles.choiceRow}><Choice label="BTC" selected={asset === 'BTC'} onPress={() => setAsset('BTC')} /><Choice label="VOO" selected={asset === 'VOO'} onPress={() => setAsset('VOO')} /></View><TextInput value={price} onChangeText={setPrice} keyboardType="decimal-pad" placeholder="Current PHP price per unit" placeholderTextColor={colors.muted} style={styles.input} /><Pressable onPress={save} style={styles.primary}><Text style={styles.primaryText}>SAVE ESTIMATE</Text></Pressable></View>;
}

function RecurringForm({ onSave }: { onSave: (value: { kind: RecurringRuleKind; title: string; category: string; amountMinor: number; days: number[]; asset?: InvestmentAsset; quantity?: string; startsOn?: string }) => Promise<void> }) {
  const [kind, setKind] = useState<RecurringRuleKind>('income');
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState('');
  const [amount, setAmount] = useState('');
  const [days, setDays] = useState('15, 30');
  const [startsOn, setStartsOn] = useState(localDateKey(new Date()));
  const [asset, setAsset] = useState<InvestmentAsset>('BTC');
  const [quantity, setQuantity] = useState('');
  const [saving, setSaving] = useState(false);
  const chooseKind = (next: RecurringRuleKind) => { setKind(next); setTitle(''); setCategory(''); };
  const save = async () => {
    const amountMinor = parsePesoToMinor(amount); const monthlyDays = parseMonthlyDays(days);
    if (!amountMinor || !monthlyDays || !/^\d{4}-\d{2}-\d{2}$/.test(startsOn)) return Alert.alert('Check the schedule', 'Enter a valid amount, start date, and unique days from 1 to 31 separated by commas.');
    if (kind === 'investment' && Number(quantity) <= 0) return Alert.alert('Actual quantity needed', 'Add the BTC quantity or VOO shares purchased each occurrence. The app will not invent it from a market estimate.');
    setSaving(true); try { await onSave({ kind, title, category, amountMinor, days: monthlyDays, startsOn, asset: kind === 'investment' ? asset : undefined, quantity: kind === 'investment' ? quantity : undefined }); } catch (error) { Alert.alert('Could not save automation', error instanceof Error ? error.message : 'Try again.'); setSaving(false); }
  };
  return <View style={styles.form}><Text style={styles.formHeading}>NEW MONTHLY AUTOMATION</Text><View style={styles.choiceRow}><Choice label="SALARY" selected={kind === 'income'} onPress={() => chooseKind('income')} /><Choice label="BILL" selected={kind === 'expense'} onPress={() => chooseKind('expense')} /><Choice label="INVEST" selected={kind === 'investment'} onPress={() => chooseKind('investment')} /></View>{kind === 'investment' ? <View style={styles.choiceRow}><Choice label="BTC" selected={asset === 'BTC'} onPress={() => setAsset('BTC')} /><Choice label="VOO" selected={asset === 'VOO'} onPress={() => setAsset('VOO')} /></View> : null}<TextInput value={title} onChangeText={setTitle} placeholder="Schedule name" placeholderTextColor={colors.muted} style={styles.input} /><TextInput value={category} onChangeText={setCategory} placeholder="Category" placeholderTextColor={colors.muted} style={styles.input} /><TextInput value={amount} onChangeText={setAmount} keyboardType="decimal-pad" placeholder="Amount in PHP" placeholderTextColor={colors.muted} style={styles.input} />{kind === 'investment' ? <TextInput value={quantity} onChangeText={setQuantity} keyboardType="decimal-pad" placeholder={asset === 'BTC' ? 'Actual BTC per occurrence' : 'Actual shares per occurrence'} placeholderTextColor={colors.muted} style={styles.input} /> : null}<TextInput value={days} onChangeText={setDays} keyboardType="numbers-and-punctuation" placeholder="Days, e.g. 15, 30" placeholderTextColor={colors.muted} style={styles.input} /><TextInput value={startsOn} onChangeText={setStartsOn} placeholder="Starts YYYY-MM-DD" placeholderTextColor={colors.muted} style={styles.input} /><Text style={styles.formNote}>Day 30 becomes the last day of shorter months. Transactions already posted remain when an automation is paused or deleted.</Text><Pressable accessibilityRole="button" disabled={saving} onPress={save} style={styles.primary}><Text style={styles.primaryText}>{saving ? 'SAVING...' : 'SAVE AUTOMATION'}</Text></Pressable></View>;
}

function BudgetForm({ onSave }: { onSave: (category: string, limitMinor: number) => Promise<void> }) {
  const [category, setCategory] = useState(''); const [amount, setAmount] = useState(''); const [saving, setSaving] = useState(false);
  const save = async () => { const limit = parsePesoToMinor(amount); if (!category.trim() || !limit) return Alert.alert('Check the budget', 'Add a category and valid monthly amount.'); setSaving(true); try { await onSave(category, limit); } catch (error) { Alert.alert('Could not save budget', error instanceof Error ? error.message : 'Try again.'); setSaving(false); } };
  return <View style={styles.form}><Text style={styles.formHeading}>MONTHLY CATEGORY BUDGET</Text><TextInput value={category} onChangeText={setCategory} placeholder="Category, e.g. Groceries" placeholderTextColor={colors.muted} style={styles.input} /><TextInput value={amount} onChangeText={setAmount} keyboardType="decimal-pad" placeholder="Monthly limit in PHP" placeholderTextColor={colors.muted} style={styles.input} /><Text style={styles.formNote}>Expenses count toward a budget when their category matches this name.</Text><Pressable accessibilityRole="button" disabled={saving} onPress={save} style={styles.primary}><Text style={styles.primaryText}>{saving ? 'SAVING...' : 'SAVE BUDGET'}</Text></Pressable></View>;
}

function Choice({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) { return <Pressable onPress={onPress} style={[styles.choice, selected && styles.choiceSelected]}><Text style={[styles.choiceText, selected && styles.choiceTextSelected]}>{label}</Text></Pressable>; }

const styles = StyleSheet.create({
  header: { minHeight: 78, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }, title: { fontFamily: fonts.pixelBold, fontSize: 31, color: colors.ink },
  tabs: { height: 48, flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: colors.borderStrong }, tab: { flex: 1, alignItems: 'center', justifyContent: 'center' }, tabActive: { borderBottomWidth: 3, borderBottomColor: colors.accent }, tabText: { fontFamily: fonts.pixelSemiBold, fontSize: 13, color: colors.secondary }, tabTextActive: { color: colors.ink }, panel: { paddingTop: 25 },
  sectionHead: { minHeight: 48, marginTop: 20, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }, sectionTitle: { fontFamily: fonts.pixelSemiBold, fontSize: 16, color: colors.ink }, sectionSupport: { marginTop: 3, fontFamily: fonts.body, fontSize: 12, color: colors.secondary }, squareButton: { width: 44, height: 44, borderWidth: 1, borderColor: colors.borderStrong, alignItems: 'center', justifyContent: 'center' },
  ruledList: { borderTopWidth: 1, borderTopColor: colors.borderStrong }, projectRow: { minHeight: 86, flexDirection: 'row', alignItems: 'center', gap: 13, borderBottomWidth: 1, borderBottomColor: colors.border }, rowMain: { flex: 1 }, rowTitle: { fontFamily: fonts.bodySemiBold, fontSize: 15, color: colors.ink }, rowMeta: { marginTop: 4, fontFamily: fonts.body, fontSize: 12, lineHeight: 17, color: colors.secondary },
  empty: { minHeight: 120, alignItems: 'center', justifyContent: 'center' }, emptyTitle: { fontFamily: fonts.pixelSemiBold, fontSize: 15, color: colors.ink }, emptyText: { marginTop: 6, paddingHorizontal: 24, textAlign: 'center', fontFamily: fonts.body, fontSize: 13, lineHeight: 19, color: colors.secondary }, secondary: { height: 50, marginTop: 12, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderWidth: 1, borderColor: colors.ink }, secondaryText: { fontFamily: fonts.pixelSemiBold, fontSize: 12, color: colors.ink },
  micro: { fontFamily: fonts.pixelSemiBold, fontSize: 12, color: colors.secondary }, currencyHeader: { minHeight: 48, flexDirection: 'row', alignItems: 'center', gap: 12 }, currencyNote: { marginTop: 4, fontFamily: fonts.pixel, fontSize: 8, color: colors.muted }, currencyToggle: { width: 116, height: 38, flexDirection: 'row', borderWidth: 1, borderColor: colors.ink }, currencyOption: { flex: 1, alignItems: 'center', justifyContent: 'center' }, currencyOptionActive: { backgroundColor: colors.ink }, currencyOptionDisabled: { opacity: 0.38 }, currencyOptionText: { fontFamily: fonts.pixelSemiBold, fontSize: 10, color: colors.ink }, currencyOptionTextActive: { color: colors.surface }, summary: { marginTop: 14, flexDirection: 'row', borderTopWidth: 1, borderBottomWidth: 1, borderColor: colors.borderStrong }, summaryCell: { flex: 1, minWidth: 0, paddingVertical: 16, paddingHorizontal: 8, borderRightWidth: 1, borderRightColor: colors.border }, summaryLabel: { fontFamily: fonts.pixel, fontSize: 9, color: colors.secondary }, summaryValue: { marginTop: 7, fontFamily: fonts.bodyBold, fontSize: 15, fontVariant: ['tabular-nums'], color: colors.ink },
  actionRow: { marginTop: 12, flexDirection: 'row', gap: 8 }, actionButton: { flex: 1, minHeight: 46, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, borderWidth: 1, borderColor: colors.borderStrong }, actionText: { fontFamily: fonts.pixelSemiBold, fontSize: 10, color: colors.ink },
  form: { marginTop: 12, padding: 14, gap: 10, borderWidth: 1, borderColor: colors.ink, backgroundColor: colors.background }, formHeading: { fontFamily: fonts.pixelSemiBold, fontSize: 13, color: colors.ink }, input: { height: 48, paddingHorizontal: 12, borderWidth: 1, borderColor: colors.borderStrong, backgroundColor: colors.surface, fontFamily: fonts.body, fontSize: 14, color: colors.ink }, primary: { height: 50, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.ink }, primaryText: { fontFamily: fonts.pixelSemiBold, fontSize: 13, color: colors.surface }, formNote: { fontFamily: fonts.body, fontSize: 11, lineHeight: 16, color: colors.secondary }, choiceRow: { flexDirection: 'row', gap: 6 }, choice: { flex: 1, height: 40, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: colors.borderStrong }, choiceSelected: { backgroundColor: colors.ink, borderColor: colors.ink }, choiceText: { fontFamily: fonts.pixelSemiBold, fontSize: 10, color: colors.ink }, choiceTextSelected: { color: colors.surface },
  moneyRow: { minHeight: 68, flexDirection: 'row', alignItems: 'center', gap: 10, borderBottomWidth: 1, borderBottomColor: colors.border }, moneyIcon: { width: 34, height: 34, borderWidth: 1, borderColor: colors.borderStrong, alignItems: 'center', justifyContent: 'center' }, moneyValue: { fontFamily: fonts.bodySemiBold, fontSize: 13, fontVariant: ['tabular-nums'], color: colors.ink }, income: { color: colors.accent }, link: { fontFamily: fonts.pixelSemiBold, fontSize: 10, color: colors.accent },
  position: { minHeight: 82, flexDirection: 'row', alignItems: 'center', gap: 10, borderBottomWidth: 1, borderBottomColor: colors.border }, assetMark: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.ink }, assetMarkText: { fontFamily: fonts.bodyBold, fontSize: 16, color: colors.surface }, positionValues: { alignItems: 'flex-end' }, recorded: { fontFamily: fonts.pixel, fontSize: 10, color: colors.secondary }, estimated: { marginTop: 3, fontFamily: fonts.pixelSemiBold, fontSize: 11, color: colors.ink }, quoteTime: { marginTop: 3, maxWidth: 135, textAlign: 'right', fontFamily: fonts.body, fontSize: 9, color: colors.muted },
  planRow: { minHeight: 78, flexDirection: 'row', alignItems: 'center', gap: 6, borderBottomWidth: 1, borderBottomColor: colors.border }, planNext: { marginTop: 4, fontFamily: fonts.pixelSemiBold, fontSize: 9, color: colors.accent }, budgetRow: { paddingVertical: 13, borderBottomWidth: 1, borderBottomColor: colors.border }, budgetTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }, budgetTrack: { height: 5, marginTop: 10, backgroundColor: colors.border }, budgetFill: { height: 5, backgroundColor: colors.accent }, inlineLinks: { flexDirection: 'row', alignItems: 'center', gap: 12 }, rowAction: { width: 36, height: 44, alignItems: 'center', justifyContent: 'center' },
});
