import { Feather } from '@expo/vector-icons';
import { Href, useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { useAppDialog } from '@/components/AppDialog';
import { AppScreen } from '@/components/AppScreen';
import { CardFace } from '@/components/CardFace';
import { PageHeader } from '@/components/page-header';
import { SectionHeading } from '@/components/section-heading';
import { colors, fonts, radius, themedStyles } from '@/constants/theme';
import { getWalletSummary } from '@/features/wallet/wallet-summary';
import { calculateFinancialForecast } from '@/features/wallet/financial-forecast';
import { WalletSetupForm } from '@/features/wallet/finance-forms';
import { summarizeCards } from '@/features/wallet/cards';
import { useItems } from '@/store/ItemsContext';
import { DisplayCurrency, formatMoney } from '@/utils/money';
import { useTheme } from '@/store/ThemeContext';

export default function WalletScreen() {
  useTheme();
  const { showDialog } = useAppDialog();
  const router = useRouter();
  const data = useItems();
  const [currency, setCurrency] = useState<DisplayCurrency>('PHP');
  const [editingStartingPoint, setEditingStartingPoint] = useState(false);
  // Both walk every transaction and investment lot; keep them off the render path.
  const summary = useMemo(() => getWalletSummary(data), [data]);
  const forecast = useMemo(() => calculateFinancialForecast(data, summary.balance), [data, summary.balance]);
  const planCount = data.recurringRules.filter((rule) => rule.kind !== 'expense').length;
  const subscriptionCount = data.recurringRules.filter((rule) => rule.kind === 'expense').length;
  const pendingReviewCount = data.financialOccurrences.filter((item) => item.status === 'pending').length + data.goalSuggestions.filter((item) => item.status === 'pending').length + data.reviewProposals.length;
  const money = (value: number) => formatMoney(value, currency, summary.usdPhp);
  const cardTotals = useMemo(() => summarizeCards(data.cards), [data.cards]);
  const needsStartingPoint = data.hydrated && !summary.walletSetup && data.transactions.length === 0 && data.investments.length === 0;

  const chooseCurrency = (next: DisplayCurrency) => {
    if (next === 'USD' && !summary.usdPhp) {
      showDialog({ title: 'USD rate unavailable', message: 'Open Investments and refresh market prices before switching to USD.', tone: 'warning' });
      return;
    }
    setCurrency(next);
  };

  return (
    <AppScreen assistant={!editingStartingPoint} onRefresh={data.reload}>
      <PageHeader title="Wallet" supporting="Your cash, investments, plans, and spending in one place." />
      {pendingReviewCount > 0 ? <Pressable accessibilityRole="button" onPress={() => router.push('/wallet/inbox' as Href)} style={({ pressed }) => [styles.reviewBanner, pressed && styles.pressed]}><Feather name="inbox" size={22} color={colors.accent} /><View style={styles.rowMain}><Text style={styles.rowTitle}>{pendingReviewCount} waiting for your review</Text><Text style={styles.rowDetail}>Check scheduled payments and suggested changes.</Text></View><Feather name="chevron-right" size={20} color={colors.accent} /></Pressable> : null}
      {editingStartingPoint ? (
        <WalletSetupForm onDone={() => setEditingStartingPoint(false)} onCancel={() => setEditingStartingPoint(false)} />
      ) : needsStartingPoint ? (
        <View style={styles.setupCard}>
          <View style={styles.setupIcon}><Feather name="flag" size={22} color={colors.accent} /></View>
          <Text style={styles.setupTitle}>Start with the money you have now</Text>
          <Text style={styles.setupDetail}>Set your current cash once. LifeDesk will use it as the starting point for future income and expenses.</Text>
          <Pressable accessibilityRole="button" onPress={() => setEditingStartingPoint(true)} style={({ pressed }) => [styles.setupButton, pressed && styles.pressed]}>
            <Text style={styles.setupButtonText}>Set opening balance</Text><Feather name="arrow-right" size={17} color={colors.paper} />
          </Pressable>
        </View>
      ) : (
        <>
          <View style={styles.balanceBlock}>
            <View style={styles.balanceTop}>
              <Text style={styles.balanceLabel}>Cash balance</Text>
              <View accessibilityRole="tablist" style={styles.currencyToggle}>
                {(['PHP', 'USD'] as const).map((value) => <Pressable accessibilityRole="tab" accessibilityState={{ selected: currency === value }} key={value} onPress={() => chooseCurrency(value)} style={[styles.currencyOption, currency === value && styles.currencyActive]}><Text style={[styles.currencyText, currency === value && styles.currencyTextActive]}>{value}</Text></Pressable>)}
              </View>
            </View>
            <Text adjustsFontSizeToFit numberOfLines={1} style={styles.balance}>{money(summary.balance)}</Text>
            <Text style={styles.balanceNote}>{summary.walletSetup ? `Starting cash plus activity since ${formatTrackingDate(summary.walletSetup.startsOn)}` : 'Recorded income minus expenses and investment contributions'}</Text>
            <Pressable accessibilityRole="button" onPress={() => setEditingStartingPoint(true)} style={({ pressed }) => [styles.startingPointButton, pressed && styles.pressed]}><Feather name={summary.walletSetup ? 'edit-3' : 'flag'} size={15} color={colors.accent} /><Text style={styles.startingPointLabel}>{summary.walletSetup ? 'Edit starting point' : 'Set a starting point'}</Text></Pressable>
          </View>

          <View style={styles.metrics}>
            <Metric label="This month in" value={money(summary.income)} />
            <Metric label="This month out" value={money(summary.spent)} />
            <Metric label={summary.hasLivePortfolio ? 'Portfolio' : 'Invested'} value={money(summary.portfolio)} />
          </View>

          <Pressable accessibilityRole="button" onPress={() => router.push('/wallet/forecast' as Href)} style={({ pressed }) => [styles.safeCard, pressed && styles.pressed]}>
            <View style={styles.safeIcon}><Feather name="shield" size={19} color={colors.paper} /></View><View style={styles.rowMain}><Text style={styles.safeLabel}>Safe to spend</Text><Text style={styles.safeValue}>{money(forecast.safeToSpendMinor)}</Text><Text style={styles.safeDetail}>After scheduled commitments, budgets, and savings goals</Text></View><Feather name="chevron-right" size={18} color={colors.muted} />
          </Pressable>
        </>
      )}

      {data.hydrated ? <View style={styles.section}>
        <SectionHeading title="Your cards" detail={data.cards.length ? [cardTotals.debitCount ? `${formatMoney(cardTotals.debitBalanceMinor, 'PHP')} on debit` : null, cardTotals.creditCount ? `${formatMoney(cardTotals.creditOwedMinor, 'PHP')} owed on credit` : null].filter(Boolean).join(' · ') : 'Track every debit and credit card'} action={data.cards.length ? <Pressable accessibilityRole="button" onPress={() => router.push('/wallet/cards' as Href)} style={styles.textButton}><Text style={styles.textButtonLabel}>See all</Text></Pressable> : undefined} />
        {data.cards.length ? <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.cardScroll} contentContainerStyle={styles.cardStrip}>
          {data.cards.map((card) => <Pressable accessibilityRole="button" accessibilityHint="Opens card details" key={card.id} onPress={() => router.push({ pathname: '/wallet/card/[id]', params: { id: card.id } } as Href)} style={({ pressed }) => pressed && styles.pressed}><CardFace card={card} compact balanceHidden={!data.homePreferences.balancesVisible} /></Pressable>)}
          <Pressable accessibilityRole="button" accessibilityLabel="Add a card" onPress={() => router.push({ pathname: '/wallet/cards', params: { action: 'add' } } as Href)} style={({ pressed }) => [styles.addCard, pressed && styles.pressed]}><Feather name="plus" size={22} color={colors.secondary} /><Text style={styles.addCardText}>Add card</Text></Pressable>
        </ScrollView> : <View style={styles.list}><DestinationRow icon="credit-card" title="Add your cards" detail="See debit balances, what you owe on credit, limits, and due dates" onPress={() => router.push({ pathname: '/wallet/cards', params: { action: 'add' } } as Href)} /></View>}
      </View> : null}

      <View style={styles.section}>
        <SectionHeading title="Money actions" detail="Record a change or open your history" />
        <View style={styles.quickGrid}>
          <QuickAction icon="arrow-down-left" title="Add money" detail="Salary, deposit, or cash adjustment" onPress={() => router.push({ pathname: '/wallet/activity', params: { action: 'add', type: 'income' } } as Href)} />
          <QuickAction icon="arrow-up-right" title="Add expense" detail="Purchase or bill" onPress={() => router.push({ pathname: '/wallet/activity', params: { action: 'add', type: 'expense' } } as Href)} />
          <QuickAction icon="trending-up" title="Add investment" detail="BTC or VOO purchase" onPress={() => router.push({ pathname: '/wallet/investments', params: { action: 'add' } } as Href)} />
          <QuickAction icon="list" title="View activity" detail="Income, expenses, and purchases" onPress={() => router.push('/wallet/activity' as Href)} />
        </View>
      </View>

      <View style={styles.section}>
        <SectionHeading title="Grow your money" detail="Your portfolio and what you are saving for" />
        <View style={styles.list}>
          <DestinationRow icon="trending-up" title="Investments" detail="BTC and VOO positions" onPress={() => router.push('/wallet/investments' as Href)} />
          <DestinationRow icon="target" title="Savings goals" detail={`${data.savingsGoals.length} ${data.savingsGoals.length === 1 ? 'goal' : 'goals'} · ${money(forecast.reservedGoalsMinor)} reserved`} onPress={() => router.push('/wallet/goals' as Href)} />
        </View>
      </View>

      <View style={styles.section}>
        <SectionHeading title="Plan ahead" detail="Upcoming commitments and money decisions" />
        <View style={styles.list}>
          <DestinationRow icon="credit-card" title="Subscriptions and bills" detail={`${subscriptionCount} recurring ${subscriptionCount === 1 ? 'expense' : 'expenses'}`} onPress={() => router.push('/wallet/subscriptions' as Href)} />
          <DestinationRow icon="repeat" title="Plans and budgets" detail={`${planCount} automations · ${data.budgets.length} budgets`} onPress={() => router.push('/wallet/planning' as Href)} />
          <DestinationRow icon="inbox" title="Review inbox" detail={pendingReviewCount ? `${pendingReviewCount} waiting for confirmation` : 'You are all caught up'} onPress={() => router.push('/wallet/inbox' as Href)} />
        </View>
      </View>

      {data.transactions.length ? <View style={styles.section}>
        <SectionHeading title="Recent activity" action={<Pressable accessibilityRole="button" onPress={() => router.push('/wallet/activity' as Href)} style={styles.textButton}><Text style={styles.textButtonLabel}>See all</Text></Pressable>} />
        <View style={styles.list}>
          {data.transactions.slice(0, 4).map((item) => <View key={item.id} style={styles.transaction}><View style={styles.transactionIcon}><Feather name={item.type === 'income' ? 'arrow-down-left' : item.type === 'investment' ? 'trending-up' : 'arrow-up-right'} size={17} color={colors.ink} /></View><View style={styles.rowMain}><Text style={styles.rowTitle}>{item.title}</Text><Text style={styles.rowDetail}>{item.category} · {new Intl.DateTimeFormat('en-PH', { month: 'short', day: 'numeric' }).format(new Date(item.occurredAt))}</Text></View><Text style={[styles.transactionValue, item.type === 'income' && styles.positive]}>{item.type === 'income' ? '+' : '−'}{money(item.amountMinor)}</Text></View>)}
        </View>
      </View> : null}
    </AppScreen>
  );
}

function Metric({ label, value }: { label: string; value: string }) { return <View style={styles.metric}><Text style={styles.metricLabel}>{label}</Text><Text adjustsFontSizeToFit numberOfLines={1} style={styles.metricValue}>{value}</Text></View>; }
function DestinationRow({ icon, title, detail, onPress }: { icon: keyof typeof Feather.glyphMap; title: string; detail: string; onPress: () => void }) { return <Pressable accessibilityRole="button" onPress={onPress} style={styles.destination}><View style={styles.destinationIcon}><Feather name={icon} size={19} color={colors.ink} /></View><View style={styles.rowMain}><Text style={styles.rowTitle}>{title}</Text><Text style={styles.rowDetail}>{detail}</Text></View><Feather name="chevron-right" size={19} color={colors.muted} /></Pressable>; }
function QuickAction({ icon, title, detail, onPress }: { icon: keyof typeof Feather.glyphMap; title: string; detail: string; onPress: () => void }) { return <Pressable accessibilityRole="button" onPress={onPress} style={({ pressed }) => [styles.quickAction, pressed && styles.pressed]}><View style={styles.quickIcon}><Feather name={icon} size={18} color={colors.ink} /></View><Text style={styles.quickTitle}>{title}</Text><Text style={styles.quickDetail}>{detail}</Text></Pressable>; }
function formatTrackingDate(value: string) { return new Intl.DateTimeFormat('en-PH', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${value}T00:00:00Z`)); }

const styles = themedStyles(() => ({
  setupCard: { marginTop: 20, padding: 20, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.accent, backgroundColor: colors.accentSoft },
  setupIcon: { width: 42, height: 42, borderRadius: 13, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.paper },
  setupTitle: { marginTop: 16, fontFamily: fonts.bodyBold, fontSize: 19, lineHeight: 25, color: colors.ink },
  setupDetail: { marginTop: 6, fontFamily: fonts.body, fontSize: 13, lineHeight: 19, color: colors.secondary },
  setupButton: { minHeight: 48, marginTop: 17, paddingHorizontal: 15, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderRadius: 11, backgroundColor: colors.ink },
  setupButtonText: { fontFamily: fonts.bodySemiBold, fontSize: 13, color: colors.paper },
  balanceTop: { minHeight: 34, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  currencyToggle: { padding: 3, flexDirection: 'row', borderRadius: 9, backgroundColor: colors.border },
  currencyOption: { minWidth: 48, minHeight: 34, paddingHorizontal: 9, alignItems: 'center', justifyContent: 'center', borderRadius: 7 },
  currencyActive: { backgroundColor: colors.paper },
  currencyText: { fontFamily: fonts.bodySemiBold, fontSize: 11, color: colors.secondary },
  currencyTextActive: { color: colors.ink },
  balanceBlock: { marginTop: 20, padding: 22, borderRadius: radius.lg, backgroundColor: colors.paper, borderWidth: 1, borderColor: colors.border },
  balanceLabel: { fontFamily: fonts.bodyMedium, fontSize: 13, color: colors.secondary },
  balance: { marginTop: 6, fontFamily: fonts.bodyBold, fontSize: 38, lineHeight: 46, letterSpacing: -1.3, fontVariant: ['tabular-nums'], color: colors.ink },
  balanceNote: { marginTop: 5, fontFamily: fonts.body, fontSize: 12, lineHeight: 17, color: colors.muted },
  startingPointButton: { alignSelf: 'flex-start', minHeight: 44, marginTop: 9, flexDirection: 'row', alignItems: 'center', gap: 7 },
  startingPointLabel: { fontFamily: fonts.bodySemiBold, fontSize: 12, color: colors.accent },
  metrics: { marginTop: 18, flexDirection: 'row', gap: 8 },
  metric: { flex: 1, minWidth: 0, padding: 10, borderRadius: radius.md, backgroundColor: colors.paper, borderWidth: 1, borderColor: colors.border },
  metricLabel: { fontFamily: fonts.body, fontSize: 12, lineHeight: 17, color: colors.secondary },
  metricValue: { marginTop: 5, fontFamily: fonts.bodySemiBold, fontSize: 14, lineHeight: 19, fontVariant: ['tabular-nums'], color: colors.ink },
  safeCard: { minHeight: 112, marginTop: 12, padding: 16, flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: radius.md, backgroundColor: colors.accentSoft },
  reviewBanner: { marginTop: 20, padding: 16, flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: radius.md, backgroundColor: colors.accentSoft },
  safeIcon: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.ink },
  safeLabel: { fontFamily: fonts.bodySemiBold, fontSize: 13, color: colors.ink },
  safeDetail: { marginTop: 4, fontFamily: fonts.body, fontSize: 12, lineHeight: 18, color: colors.secondary },
  safeValue: { marginTop: 4, fontFamily: fonts.bodyBold, fontSize: 24, fontVariant: ['tabular-nums'], color: colors.ink },
  section: { marginTop: 34 },
  cardScroll: { marginTop: 13, marginHorizontal: -22 },
  cardStrip: { paddingHorizontal: 22, paddingVertical: 6, gap: 12 },
  addCard: { width: 120, height: 146, alignItems: 'center', justifyContent: 'center', gap: 6, borderRadius: 14, borderWidth: 1.5, borderStyle: 'dashed', borderColor: colors.borderStrong },
  addCardText: { fontFamily: fonts.bodySemiBold, fontSize: 12, color: colors.secondary },
  quickGrid: { marginTop: 13, flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  quickAction: { width: '48%', minHeight: 96, flexGrow: 1, padding: 13, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.paper },
  quickIcon: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background },
  quickTitle: { marginTop: 11, fontFamily: fonts.bodySemiBold, fontSize: 13, lineHeight: 18, color: colors.ink },
  quickDetail: { marginTop: 4, fontFamily: fonts.body, fontSize: 12, lineHeight: 18, color: colors.secondary },
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
  pressed: { opacity: 0.72, transform: [{ scale: 0.99 }] },
}));
