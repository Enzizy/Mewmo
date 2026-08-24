import { Feather } from '@expo/vector-icons';
import { Href, useRouter } from 'expo-router';
import { useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { AppScreen } from '@/components/AppScreen';
import { PageHeader } from '@/components/page-header';
import { SectionHeading } from '@/components/section-heading';
import { colors, fonts, radius } from '@/constants/theme';
import { getWalletSummary } from '@/features/wallet/wallet-summary';
import { useItems } from '@/store/ItemsContext';
import { DisplayCurrency, formatMoney } from '@/utils/money';

export default function WalletScreen() {
  const router = useRouter();
  const data = useItems();
  const [currency, setCurrency] = useState<DisplayCurrency>('PHP');
  const summary = getWalletSummary(data);
  const money = (value: number) => formatMoney(value, currency, summary.usdPhp);

  const chooseCurrency = (next: DisplayCurrency) => {
    if (next === 'USD' && !summary.usdPhp) {
      Alert.alert('USD rate unavailable', 'Open Investments and refresh market prices before switching to USD.');
      return;
    }
    setCurrency(next);
  };

  return (
    <AppScreen assistant>
      <PageHeader title="Wallet" supporting="Your cash, investments, plans, and spending in one place." />
      <View accessibilityRole="tablist" style={styles.currencyToggle}>
        {(['PHP', 'USD'] as const).map((value) => <Pressable accessibilityRole="tab" accessibilityState={{ selected: currency === value }} key={value} onPress={() => chooseCurrency(value)} style={[styles.currencyOption, currency === value && styles.currencyActive]}><Text style={[styles.currencyText, currency === value && styles.currencyTextActive]}>{value}</Text></Pressable>)}
      </View>

      <View style={styles.balanceBlock}>
        <Text style={styles.balanceLabel}>Available wallet</Text>
        <Text adjustsFontSizeToFit numberOfLines={1} style={styles.balance}>{money(summary.balance)}</Text>
        <Text style={styles.balanceNote}>Income minus expenses and investment contributions</Text>
      </View>

      <View style={styles.metrics}>
        <Metric label="This month in" value={money(summary.income)} />
        <Metric label="This month out" value={money(summary.spent)} />
        <Metric label={summary.hasLivePortfolio ? 'Portfolio' : 'Invested'} value={money(summary.portfolio)} />
      </View>

      <View style={styles.section}>
        <SectionHeading title="Quick actions" detail="Add a value directly where it belongs" />
        <View style={styles.quickGrid}>
          <QuickAction icon="arrow-down-left" title="Add income" detail="Salary or starting cash" onPress={() => router.push({ pathname: '/wallet/activity', params: { action: 'add', type: 'income' } } as Href)} />
          <QuickAction icon="arrow-up-right" title="Add expense" detail="Purchase or bill" onPress={() => router.push({ pathname: '/wallet/activity', params: { action: 'add', type: 'expense' } } as Href)} />
          <QuickAction icon="trending-up" title="Add investment" detail="BTC or VOO purchase" onPress={() => router.push({ pathname: '/wallet/investments', params: { action: 'add' } } as Href)} />
          <QuickAction icon="repeat" title="Plan month" detail="Salary, bills, budgets" onPress={() => router.push('/wallet/planning' as Href)} />
        </View>
      </View>

      <View style={styles.section}>
        <SectionHeading title="Explore wallet" />
        <View style={styles.list}>
          <DestinationRow icon="list" title="Activity" detail={`${data.transactions.length} money ${data.transactions.length === 1 ? 'record' : 'records'}`} onPress={() => router.push('/wallet/activity' as Href)} />
          <DestinationRow icon="trending-up" title="Investments" detail="BTC and VOO positions" onPress={() => router.push('/wallet/investments' as Href)} />
          <DestinationRow icon="repeat" title="Plans and budgets" detail={`${data.recurringRules.length} automations · ${data.budgets.length} budgets`} onPress={() => router.push('/wallet/planning' as Href)} />
        </View>
      </View>

      <View style={styles.section}>
        <SectionHeading title="Recent activity" action={<Pressable accessibilityRole="button" onPress={() => router.push('/wallet/activity' as Href)} style={styles.textButton}><Text style={styles.textButtonLabel}>See all</Text></Pressable>} />
        <View style={styles.list}>
          {data.transactions.slice(0, 4).map((item) => <View key={item.id} style={styles.transaction}><View style={styles.transactionIcon}><Feather name={item.type === 'income' ? 'arrow-down-left' : item.type === 'investment' ? 'trending-up' : 'arrow-up-right'} size={17} color={colors.ink} /></View><View style={styles.rowMain}><Text style={styles.rowTitle}>{item.title}</Text><Text style={styles.rowDetail}>{item.category} · {new Intl.DateTimeFormat('en-PH', { month: 'short', day: 'numeric' }).format(new Date(item.occurredAt))}</Text></View><Text style={[styles.transactionValue, item.type === 'income' && styles.positive]}>{item.type === 'income' ? '+' : '−'}{money(item.amountMinor)}</Text></View>)}
          {!data.transactions.length ? <View style={styles.empty}><Text style={styles.emptyTitle}>Start with the money you have now</Text><Text style={styles.emptyText}>Tap Add income and label it “Starting balance”, then add any BTC or VOO you already own.</Text></View> : null}
        </View>
      </View>
    </AppScreen>
  );
}

function Metric({ label, value }: { label: string; value: string }) { return <View style={styles.metric}><Text style={styles.metricLabel}>{label}</Text><Text adjustsFontSizeToFit numberOfLines={1} style={styles.metricValue}>{value}</Text></View>; }
function DestinationRow({ icon, title, detail, onPress }: { icon: keyof typeof Feather.glyphMap; title: string; detail: string; onPress: () => void }) { return <Pressable accessibilityRole="button" onPress={onPress} style={styles.destination}><View style={styles.destinationIcon}><Feather name={icon} size={19} color={colors.ink} /></View><View style={styles.rowMain}><Text style={styles.rowTitle}>{title}</Text><Text style={styles.rowDetail}>{detail}</Text></View><Feather name="chevron-right" size={19} color={colors.muted} /></Pressable>; }
function QuickAction({ icon, title, detail, onPress }: { icon: keyof typeof Feather.glyphMap; title: string; detail: string; onPress: () => void }) { return <Pressable accessibilityRole="button" onPress={onPress} style={({ pressed }) => [styles.quickAction, pressed && styles.pressed]}><View style={styles.quickIcon}><Feather name={icon} size={18} color={colors.ink} /></View><Text style={styles.quickTitle}>{title}</Text><Text style={styles.quickDetail}>{detail}</Text></Pressable>; }

const styles = StyleSheet.create({
  currencyToggle: { alignSelf: 'flex-start', marginTop: 20, padding: 3, flexDirection: 'row', borderRadius: 10, backgroundColor: colors.border },
  currencyOption: { minWidth: 54, minHeight: 34, paddingHorizontal: 12, alignItems: 'center', justifyContent: 'center', borderRadius: 8 },
  currencyActive: { backgroundColor: colors.paper },
  currencyText: { fontFamily: fonts.bodySemiBold, fontSize: 11, color: colors.secondary },
  currencyTextActive: { color: colors.ink },
  balanceBlock: { marginTop: 22, paddingVertical: 26, borderTopWidth: 1, borderBottomWidth: 1, borderColor: colors.border },
  balanceLabel: { fontFamily: fonts.bodyMedium, fontSize: 13, color: colors.secondary },
  balance: { marginTop: 6, fontFamily: fonts.bodyBold, fontSize: 38, lineHeight: 46, letterSpacing: -1.3, fontVariant: ['tabular-nums'], color: colors.ink },
  balanceNote: { marginTop: 5, fontFamily: fonts.body, fontSize: 12, lineHeight: 17, color: colors.muted },
  metrics: { marginTop: 18, flexDirection: 'row', gap: 8 },
  metric: { flex: 1, minWidth: 0, padding: 13, borderRadius: radius.md, backgroundColor: colors.paper, borderWidth: 1, borderColor: colors.border },
  metricLabel: { fontFamily: fonts.body, fontSize: 10, lineHeight: 14, color: colors.secondary },
  metricValue: { marginTop: 5, fontFamily: fonts.bodySemiBold, fontSize: 14, lineHeight: 19, fontVariant: ['tabular-nums'], color: colors.ink },
  section: { marginTop: 34 },
  quickGrid: { marginTop: 13, flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  quickAction: { width: '48%', minHeight: 112, flexGrow: 1, padding: 14, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.paper },
  quickIcon: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background },
  quickTitle: { marginTop: 11, fontFamily: fonts.bodySemiBold, fontSize: 13, lineHeight: 18, color: colors.ink },
  quickDetail: { marginTop: 2, fontFamily: fonts.body, fontSize: 11, lineHeight: 15, color: colors.secondary },
  list: { marginTop: 12, borderTopWidth: 1, borderTopColor: colors.border },
  destination: { minHeight: 70, flexDirection: 'row', alignItems: 'center', gap: 13, borderBottomWidth: 1, borderBottomColor: colors.border },
  destinationIcon: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.paper, borderWidth: 1, borderColor: colors.border },
  rowMain: { flex: 1, minWidth: 0 },
  rowTitle: { fontFamily: fonts.bodyMedium, fontSize: 14, lineHeight: 19, color: colors.ink },
  rowDetail: { marginTop: 3, fontFamily: fonts.body, fontSize: 12, lineHeight: 17, color: colors.secondary },
  textButton: { minHeight: 44, justifyContent: 'center' },
  textButtonLabel: { fontFamily: fonts.bodySemiBold, fontSize: 13, color: colors.accent },
  transaction: { minHeight: 70, flexDirection: 'row', alignItems: 'center', gap: 12, borderBottomWidth: 1, borderBottomColor: colors.border },
  transactionIcon: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background },
  transactionValue: { maxWidth: '34%', fontFamily: fonts.bodySemiBold, fontSize: 13, fontVariant: ['tabular-nums'], color: colors.ink },
  positive: { color: colors.green },
  empty: { paddingVertical: 30 },
  emptyTitle: { fontFamily: fonts.bodySemiBold, fontSize: 14, color: colors.ink },
  emptyText: { marginTop: 5, fontFamily: fonts.body, fontSize: 13, lineHeight: 19, color: colors.secondary },
  pressed: { opacity: 0.72, transform: [{ scale: 0.99 }] },
});
