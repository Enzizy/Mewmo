import { Feather } from '@expo/vector-icons';
import { useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { AppScreen } from '@/components/AppScreen';
import { InvestmentMark } from '@/components/InvestmentMark';
import { PageHeader } from '@/components/page-header';
import { ScreenHeader } from '@/components/ScreenHeader';
import { colors, fonts, radius } from '@/constants/theme';
import { InvestmentForm, QuoteForm } from '@/features/wallet/finance-forms';
import { getWalletSummary } from '@/features/wallet/wallet-summary';
import { useItems } from '@/store/ItemsContext';
import { DisplayCurrency, formatMoney } from '@/utils/money';

type FormKind = 'investment' | 'quote' | null;

export default function InvestmentsScreen() {
  const params = useLocalSearchParams<{ action?: string }>();
  const data = useItems();
  const summary = getWalletSummary(data);
  const [form, setForm] = useState<FormKind>(params.action === 'add' ? 'investment' : null);
  const [currency, setCurrency] = useState<DisplayCurrency>('PHP');
  const [refreshing, setRefreshing] = useState(false);
  const money = (value: number) => formatMoney(value, currency, summary.usdPhp);

  useEffect(() => { if (params.action === 'add') setForm('investment'); }, [params.action]);

  const refresh = async () => {
    setRefreshing(true);
    try { await data.refreshMarketQuotes(); }
    catch (error) { Alert.alert('Could not refresh prices', error instanceof Error ? error.message : 'Try again.'); }
    finally { setRefreshing(false); }
  };

  const chooseCurrency = (next: DisplayCurrency) => {
    if (next === 'USD' && !summary.usdPhp) return Alert.alert('USD rate unavailable', 'Refresh live prices first. The saved USD/PHP rate will enable this view.');
    setCurrency(next);
  };

  return (
    <AppScreen tabbed assistant={!form}>
      <ScreenHeader back />
      <PageHeader title="Investments" supporting="Record BTC and VOO purchases, then refresh prices to estimate what they are worth now." action={<Pressable accessibilityRole="button" onPress={() => setForm('investment')} style={({ pressed }) => [styles.addButton, pressed && styles.pressed]}><Feather name="plus" size={17} color={colors.paper} /><Text style={styles.addButtonText}>Add</Text></Pressable>} />

      <View style={styles.toolbar}>
        <View accessibilityRole="tablist" style={styles.currencyToggle}>{(['PHP', 'USD'] as const).map((value) => <Pressable accessibilityRole="tab" accessibilityState={{ selected: currency === value, disabled: value === 'USD' && !summary.usdPhp }} key={value} onPress={() => chooseCurrency(value)} style={[styles.currencyOption, currency === value && styles.currencyActive, value === 'USD' && !summary.usdPhp && styles.currencyDisabled]}><Text style={[styles.currencyText, currency === value && styles.currencyTextActive]}>{value}</Text></Pressable>)}</View>
        <Pressable accessibilityRole="button" disabled={refreshing} onPress={refresh} style={({ pressed }) => [styles.refreshButton, pressed && styles.pressed, refreshing && styles.disabled]}><Feather name="refresh-cw" size={15} color={colors.ink} /><Text style={styles.refreshText}>{refreshing ? 'Refreshing…' : 'Refresh prices'}</Text></Pressable>
      </View>

      {form === 'investment' ? <InvestmentForm onDone={() => setForm(null)} onCancel={() => setForm(null)} /> : null}
      {form === 'quote' ? <QuoteForm onDone={() => setForm(null)} onCancel={() => setForm(null)} /> : null}

      <View style={styles.total}><View><Text style={styles.totalLabel}>{summary.hasLivePortfolio ? 'Estimated portfolio value' : 'Recorded contributions'}</Text><Text style={styles.totalValue}>{money(summary.portfolio)}</Text></View><Pressable accessibilityRole="button" onPress={() => setForm('quote')} style={styles.manualButton}><Feather name="edit-3" size={15} color={colors.secondary} /><Text style={styles.manualText}>Manual price</Text></Pressable></View>

      <View style={styles.sectionHeader}><View><Text accessibilityRole="header" style={styles.sectionTitle}>Your positions</Text><Text style={styles.sectionDetail}>Quantity determines value; recorded amount is what you paid.</Text></View></View>
      <View style={styles.list}>
        {summary.positions.map((position) => <View key={position.asset} style={styles.position}><InvestmentMark asset={position.asset} size={42} /><View style={styles.main}><Text style={styles.asset}>{position.asset === 'BTC' ? 'Bitcoin' : 'Vanguard S&P 500 ETF'}</Text><Text style={styles.ticker}>{position.asset} · {position.quantity} {position.asset === 'VOO' ? 'shares' : 'BTC'}</Text><Text style={styles.source}>{position.quote ? `${position.quote.source} · ${new Intl.DateTimeFormat('en-PH', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }).format(new Date(position.quote.asOf))}` : 'No live quote saved'}</Text></View><View style={styles.values}><Text style={styles.value}>{money(position.estimated ?? position.recorded)}</Text><Text style={styles.recorded}>{position.estimated != null ? `${money(position.recorded)} paid` : position.recorded ? 'recorded cost' : 'not added yet'}</Text></View></View>)}
      </View>
      {!data.investments.length ? <View style={styles.empty}><Feather name="trending-up" size={22} color={colors.muted} /><View style={styles.emptyMain}><Text style={styles.emptyTitle}>Add what you already own</Text><Text style={styles.emptyText}>Enter the BTC quantity or VOO shares and the amount you paid. Refresh prices afterward to see an estimated current value.</Text></View></View> : null}
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  addButton: { minHeight: 44, paddingHorizontal: 15, flexDirection: 'row', alignItems: 'center', gap: 7, borderRadius: radius.full, backgroundColor: colors.ink },
  addButtonText: { fontFamily: fonts.bodySemiBold, fontSize: 12, color: colors.paper },
  toolbar: { marginTop: 20, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  currencyToggle: { padding: 3, flexDirection: 'row', borderRadius: 10, backgroundColor: colors.border },
  currencyOption: { minWidth: 52, minHeight: 34, paddingHorizontal: 10, alignItems: 'center', justifyContent: 'center', borderRadius: 8 },
  currencyActive: { backgroundColor: colors.paper },
  currencyDisabled: { opacity: 0.42 },
  currencyText: { fontFamily: fonts.bodySemiBold, fontSize: 11, color: colors.secondary },
  currencyTextActive: { color: colors.ink },
  refreshButton: { minHeight: 44, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', gap: 7, borderRadius: radius.full, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.paper },
  refreshText: { fontFamily: fonts.bodySemiBold, fontSize: 11, color: colors.ink },
  total: { marginTop: 24, padding: 20, flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', gap: 12, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.paper },
  totalLabel: { fontFamily: fonts.bodyMedium, fontSize: 12, color: colors.secondary },
  totalValue: { marginTop: 7, fontFamily: fonts.bodyBold, fontSize: 30, letterSpacing: -0.8, fontVariant: ['tabular-nums'], color: colors.ink },
  manualButton: { minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 6 },
  manualText: { fontFamily: fonts.bodySemiBold, fontSize: 11, color: colors.secondary },
  sectionHeader: { marginTop: 30, marginBottom: 12 },
  sectionTitle: { fontFamily: fonts.bodySemiBold, fontSize: 17, color: colors.ink },
  sectionDetail: { marginTop: 4, fontFamily: fonts.body, fontSize: 12, lineHeight: 17, color: colors.secondary },
  list: { borderTopWidth: 1, borderTopColor: colors.border },
  position: { minHeight: 96, flexDirection: 'row', alignItems: 'center', gap: 12, borderBottomWidth: 1, borderBottomColor: colors.border },
  main: { flex: 1, minWidth: 0 },
  asset: { fontFamily: fonts.bodySemiBold, fontSize: 14, color: colors.ink },
  ticker: { marginTop: 3, fontFamily: fonts.body, fontSize: 11, lineHeight: 15, color: colors.secondary },
  source: { marginTop: 3, fontFamily: fonts.body, fontSize: 9, lineHeight: 13, color: colors.muted },
  values: { maxWidth: '35%', alignItems: 'flex-end' },
  value: { fontFamily: fonts.bodySemiBold, fontSize: 13, fontVariant: ['tabular-nums'], color: colors.ink },
  recorded: { marginTop: 4, textAlign: 'right', fontFamily: fonts.body, fontSize: 9, color: colors.secondary },
  empty: { marginTop: 18, padding: 17, flexDirection: 'row', alignItems: 'flex-start', gap: 13, borderRadius: radius.md, backgroundColor: colors.paper, borderWidth: 1, borderColor: colors.border },
  emptyMain: { flex: 1 },
  emptyTitle: { fontFamily: fonts.bodySemiBold, fontSize: 14, color: colors.ink },
  emptyText: { marginTop: 4, fontFamily: fonts.body, fontSize: 12, lineHeight: 18, color: colors.secondary },
  pressed: { opacity: 0.72, transform: [{ scale: 0.99 }] },
  disabled: { opacity: 0.48 },
});
