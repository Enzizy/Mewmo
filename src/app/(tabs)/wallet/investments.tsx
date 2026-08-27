import { Feather } from '@expo/vector-icons';
import { useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useAppDialog } from '@/components/AppDialog';
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
  const { showDialog } = useAppDialog();
  const params = useLocalSearchParams<{ action?: string }>();
  const data = useItems();
  const summary = getWalletSummary(data);
  const [form, setForm] = useState<FormKind>(params.action === 'add' ? 'investment' : null);
  const [currency, setCurrency] = useState<DisplayCurrency>('PHP');
  const [refreshing, setRefreshing] = useState(false);
  const money = (value: number) => formatMoney(value, currency, summary.usdPhp);
  const signedMoney = (value: number) => `${value >= 0 ? '+' : ''}${money(value)}`;
  const heldPositions = summary.heldPositions;
  const allocationTotal = heldPositions.reduce((sum, position) => sum + (position.estimated ?? position.recorded), 0);

  useEffect(() => { if (params.action === 'add') setForm('investment'); }, [params.action]);

  const refresh = async () => {
    setRefreshing(true);
    try { await data.refreshMarketQuotes(); }
    catch (error) { showDialog({ title: 'Could not refresh prices', message: error instanceof Error ? error.message : 'Try again.', tone: 'danger' }); }
    finally { setRefreshing(false); }
  };

  const chooseCurrency = (next: DisplayCurrency) => {
    if (next === 'USD' && !summary.usdPhp) return showDialog({ title: 'USD rate unavailable', message: 'Refresh live prices first. The saved USD/PHP rate will enable this view.', tone: 'warning' });
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
      {data.marketRefreshError ? <View accessibilityRole="alert" style={styles.priceError}><Feather name="alert-circle" size={15} color={colors.danger} /><Text style={styles.priceErrorText}>Live prices could not update. {data.marketRefreshError} Tap Refresh prices to retry.</Text></View> : null}

      {form === 'investment' ? <InvestmentForm onDone={() => setForm(null)} onCancel={() => setForm(null)} /> : null}
      {form === 'quote' ? <QuoteForm onDone={() => setForm(null)} onCancel={() => setForm(null)} /> : null}

      <View style={styles.performanceCard}>
        <View style={styles.performanceHeader}><View><Text style={styles.performanceEyebrow}>PORTFOLIO PERFORMANCE</Text><Text style={styles.totalLabel}>{summary.hasCompleteLivePortfolio ? 'Current value' : 'Best available value'}</Text></View><Pressable accessibilityRole="button" onPress={() => setForm('quote')} style={styles.manualButton}><Feather name="edit-3" size={14} color={colors.secondary} /><Text style={styles.manualText}>Manual price</Text></Pressable></View>
        <Text numberOfLines={1} adjustsFontSizeToFit style={styles.totalValue}>{money(summary.portfolio)}</Text>
        {summary.portfolioReturn ? <View style={styles.returnBadge}><Feather name={summary.portfolioReturn.gainMinor >= 0 ? 'trending-up' : 'trending-down'} size={15} color={summary.portfolioReturn.gainMinor >= 0 ? colors.green : colors.danger} /><Text style={[styles.returnValue, summary.portfolioReturn.gainMinor < 0 && styles.returnNegative]}>{signedMoney(summary.portfolioReturn.gainMinor)} · {formatPercent(summary.portfolioReturn.percent)}</Text><Text style={styles.returnPeriod}>since purchase</Text></View> : <View style={styles.returnUnavailable}><Feather name="info" size={14} color={colors.secondary} /><Text style={styles.returnUnavailableText}>{heldPositions.length ? 'Refresh every held asset to calculate your total return.' : 'Add a holding to start tracking performance.'}</Text></View>}
        <View style={styles.performanceMetrics}><View style={styles.performanceMetric}><Text style={styles.metricLabel}>Cost basis</Text><Text style={styles.metricValue}>{money(summary.recordedInvestments)}</Text></View><View style={styles.metricDivider} /><View style={styles.performanceMetric}><Text style={styles.metricLabel}>Positions</Text><Text style={styles.metricValue}>{heldPositions.length}</Text></View></View>
        {allocationTotal > 0 && heldPositions.length ? <View style={styles.allocation}><View style={styles.allocationHeader}><Text style={styles.metricLabel}>Allocation</Text><Text style={styles.allocationHint}>By current or recorded value</Text></View><View accessibilityLabel={allocationAccessibilityLabel(heldPositions, allocationTotal)} style={styles.allocationTrack}>{heldPositions.map((position) => { const portion = (position.estimated ?? position.recorded) / allocationTotal; return <View key={position.asset} style={[styles.allocationSegment, { flex: portion }, position.asset === 'BTC' ? styles.bitcoinSegment : styles.vanguardSegment]} />; })}</View><View style={styles.allocationLegend}>{heldPositions.map((position) => { const percent = ((position.estimated ?? position.recorded) / allocationTotal) * 100; return <View key={position.asset} style={styles.legendItem}><View style={[styles.legendDot, position.asset === 'BTC' ? styles.bitcoinSegment : styles.vanguardSegment]} /><Text style={styles.legendText}>{position.asset} {Math.round(percent)}%</Text></View>; })}</View></View> : null}
      </View>

      <View style={styles.sectionHeader}><View><Text accessibilityRole="header" style={styles.sectionTitle}>Your positions</Text><Text style={styles.sectionDetail}>Quantity determines value; recorded amount is what you paid.</Text></View></View>
      {heldPositions.length ? <View style={styles.list}>
        {heldPositions.map((position) => <View key={position.asset} style={styles.position}><InvestmentMark asset={position.asset} size={42} /><View style={styles.main}><Text style={styles.asset}>{position.asset === 'BTC' ? 'Bitcoin' : 'Vanguard S&P 500 ETF'}</Text><Text style={styles.ticker}>{position.quantity} {position.asset === 'VOO' ? 'shares' : 'BTC'}</Text><Text style={styles.source}>{position.quote ? `${position.quote.source} · ${new Intl.DateTimeFormat('en-PH', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }).format(new Date(position.quote.asOf))}` : 'Current price unavailable'}</Text></View><View style={styles.values}><Text style={styles.value}>{money(position.estimated ?? position.recorded)}</Text>{position.return ? <Text style={[styles.positionReturn, position.return.gainMinor < 0 && styles.returnNegative]}>{signedMoney(position.return.gainMinor)} · {formatPercent(position.return.percent)}</Text> : <Text style={styles.recorded}>{money(position.recorded)} paid</Text>}</View></View>)}
      </View> : <View style={styles.empty}><Feather name="trending-up" size={22} color={colors.muted} /><View style={styles.emptyMain}><Text style={styles.emptyTitle}>Add what you already own</Text><Text style={styles.emptyText}>Enter the BTC quantity or VOO shares and the amount you paid. Refresh prices afterward to see an estimated current value.</Text></View></View>}
    </AppScreen>
  );
}

function formatPercent(value: number) {
  return `${value >= 0 ? '+' : ''}${value.toFixed(2)}%`;
}

function allocationAccessibilityLabel(positions: ReturnType<typeof getWalletSummary>['heldPositions'], total: number) {
  return `Portfolio allocation: ${positions.map((position) => `${position.asset} ${Math.round(((position.estimated ?? position.recorded) / total) * 100)} percent`).join(', ')}`;
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
  priceError: { marginTop: 12, padding: 11, flexDirection: 'row', alignItems: 'flex-start', gap: 8, borderRadius: radius.sm, backgroundColor: colors.dangerSoft },
  priceErrorText: { flex: 1, fontFamily: fonts.body, fontSize: 11, lineHeight: 16, color: colors.danger },
  performanceCard: { marginTop: 24, padding: 20, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.paper },
  performanceHeader: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 },
  performanceEyebrow: { fontFamily: fonts.bodySemiBold, fontSize: 9, letterSpacing: 1.1, color: colors.muted },
  totalLabel: { fontFamily: fonts.bodyMedium, fontSize: 12, color: colors.secondary },
  totalValue: { marginTop: 8, fontFamily: fonts.bodyBold, fontSize: 32, lineHeight: 39, letterSpacing: -1, fontVariant: ['tabular-nums'], color: colors.ink },
  manualButton: { minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 6 },
  manualText: { fontFamily: fonts.bodySemiBold, fontSize: 11, color: colors.secondary },
  returnBadge: { minHeight: 28, marginTop: 4, flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 6 },
  returnValue: { fontFamily: fonts.bodySemiBold, fontSize: 12, fontVariant: ['tabular-nums'], color: colors.green },
  returnNegative: { color: colors.danger },
  returnPeriod: { fontFamily: fonts.body, fontSize: 11, color: colors.secondary },
  returnUnavailable: { marginTop: 7, flexDirection: 'row', alignItems: 'center', gap: 7 },
  returnUnavailableText: { flex: 1, fontFamily: fonts.body, fontSize: 11, lineHeight: 16, color: colors.secondary },
  performanceMetrics: { marginTop: 20, paddingVertical: 14, flexDirection: 'row', borderTopWidth: 1, borderBottomWidth: 1, borderColor: colors.border },
  performanceMetric: { flex: 1, minWidth: 0 },
  metricDivider: { width: 1, marginHorizontal: 16, backgroundColor: colors.border },
  metricLabel: { fontFamily: fonts.body, fontSize: 10, lineHeight: 14, color: colors.secondary },
  metricValue: { marginTop: 4, fontFamily: fonts.bodySemiBold, fontSize: 14, fontVariant: ['tabular-nums'], color: colors.ink },
  allocation: { marginTop: 16 },
  allocationHeader: { flexDirection: 'row', justifyContent: 'space-between', gap: 10 },
  allocationHint: { fontFamily: fonts.body, fontSize: 9, color: colors.muted },
  allocationTrack: { height: 8, marginTop: 9, flexDirection: 'row', overflow: 'hidden', borderRadius: 4, backgroundColor: colors.border },
  allocationSegment: { height: '100%' },
  bitcoinSegment: { backgroundColor: colors.bitcoin },
  vanguardSegment: { backgroundColor: colors.vanguard },
  allocationLegend: { marginTop: 9, flexDirection: 'row', flexWrap: 'wrap', gap: 14 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  legendDot: { width: 7, height: 7, borderRadius: 4 },
  legendText: { fontFamily: fonts.bodyMedium, fontSize: 10, fontVariant: ['tabular-nums'], color: colors.secondary },
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
  positionReturn: { marginTop: 4, textAlign: 'right', fontFamily: fonts.bodySemiBold, fontSize: 9, fontVariant: ['tabular-nums'], color: colors.green },
  empty: { marginTop: 18, padding: 17, flexDirection: 'row', alignItems: 'flex-start', gap: 13, borderRadius: radius.md, backgroundColor: colors.paper, borderWidth: 1, borderColor: colors.border },
  emptyMain: { flex: 1 },
  emptyTitle: { fontFamily: fonts.bodySemiBold, fontSize: 14, color: colors.ink },
  emptyText: { marginTop: 4, fontFamily: fonts.body, fontSize: 12, lineHeight: 18, color: colors.secondary },
  pressed: { opacity: 0.72, transform: [{ scale: 0.99 }] },
  disabled: { opacity: 0.48 },
});
