import { Feather } from '@expo/vector-icons';
import { Href, useRouter } from 'expo-router';
import { useMemo } from 'react';
import { Pressable, Text, View } from 'react-native';
import { AppScreen } from '@/components/AppScreen';
import { PageHeader } from '@/components/page-header';
import { ScreenHeader } from '@/components/ScreenHeader';
import { SectionHeading } from '@/components/section-heading';
import { colors, fonts, radius, themedStyles } from '@/constants/theme';
import { calculateFinancialForecast } from '@/features/wallet/financial-forecast';
import { getWalletSummary } from '@/features/wallet/wallet-summary';
import { useItems } from '@/store/ItemsContext';
import { formatPeso } from '@/utils/money';
import { useTheme } from '@/store/ThemeContext';

export default function ForecastScreen() {
  useTheme();
  const router = useRouter();
  const data = useItems();
  // Both walk every transaction and investment lot; keep them off the render path.
  const summary = useMemo(() => getWalletSummary(data), [data]);
  const forecast = useMemo(() => calculateFinancialForecast(data, summary.balance), [data, summary.balance]);
  const shortfall = Math.max(0, -forecast.projectedBalanceMinor);

  return (
    <AppScreen tabbed assistant onRefresh={data.reload}>
      <ScreenHeader back />
      <PageHeader title="Forecast" supporting="See what is safely available after pending and upcoming commitments, budgets, and savings goals." />

      <View style={[styles.hero, shortfall > 0 && styles.heroWarning]}>
        <View style={styles.heroTop}><Text style={styles.eyebrow}>SAFE TO SPEND</Text><Feather name={shortfall ? 'alert-triangle' : 'shield'} size={19} color={colors.paper} /></View>
        <Text adjustsFontSizeToFit numberOfLines={1} style={styles.heroValue}>{formatPeso(forecast.safeToSpendMinor)}</Text>
        <Text style={styles.heroDetail}>{shortfall ? `${formatPeso(shortfall)} more is reserved than your available wallet.` : `Reserved through ${formatDate(forecast.horizon)}.`}</Text>
      </View>

      <View style={styles.breakdown}>
        <BreakdownRow label="Available wallet" value={summary.balance} emphasized />
        <BreakdownRow label="Upcoming subscriptions and bills" value={-forecast.upcomingBillsMinor} />
        <BreakdownRow label="Planned investments" value={-forecast.upcomingInvestmentsMinor} />
        <BreakdownRow label="Unspent monthly budgets" value={-forecast.remainingBudgetMinor} />
        <BreakdownRow label="Reserved for savings goals" value={-forecast.reservedGoalsMinor} />
      </View>

      <View style={styles.section}>
        <SectionHeading title="Next commitments" detail={forecast.nextIncome ? `Until ${forecast.nextIncome.title} on ${formatDate(forecast.nextIncome.date)}` : `Through ${formatDate(forecast.horizon)}`} />
        <View style={styles.list}>
          {forecast.commitments.slice(0, 8).map((item) => <View key={item.id} style={styles.row}><View style={styles.icon}><Feather name={item.kind === 'investment' ? 'trending-up' : 'credit-card'} size={17} color={colors.ink} /></View><View style={styles.main}><Text style={styles.title}>{item.title}</Text><Text style={styles.detail}>{item.kind === 'investment' ? 'Investment' : 'Subscription or bill'} · {formatDate(item.date)}</Text></View><Text style={styles.amount}>−{formatPeso(item.amountMinor)}</Text></View>)}
          {!forecast.commitments.length ? <View style={styles.empty}><Text style={styles.title}>No scheduled deductions before this forecast ends</Text><Text style={styles.detail}>Add recurring expenses or investments to make this estimate more useful.</Text></View> : null}
        </View>
      </View>

      <View style={styles.actions}>
        <Pressable accessibilityRole="button" onPress={() => router.push('/wallet/subscriptions' as Href)} style={({ pressed }) => [styles.action, pressed && styles.pressed]}><Feather name="credit-card" size={18} color={colors.ink} /><Text style={styles.actionText}>Manage subscriptions and bills</Text><Feather name="chevron-right" size={18} color={colors.muted} /></Pressable>
        <Pressable accessibilityRole="button" onPress={() => router.push('/wallet/planning' as Href)} style={({ pressed }) => [styles.action, pressed && styles.pressed]}><Feather name="pie-chart" size={18} color={colors.ink} /><Text style={styles.actionText}>Manage budgets and automations</Text><Feather name="chevron-right" size={18} color={colors.muted} /></Pressable>
        <Pressable accessibilityRole="button" onPress={() => router.push('/wallet/goals' as Href)} style={({ pressed }) => [styles.action, pressed && styles.pressed]}><Feather name="target" size={18} color={colors.ink} /><Text style={styles.actionText}>Manage savings goals</Text><Feather name="chevron-right" size={18} color={colors.muted} /></Pressable>
      </View>
      <Text style={styles.note}>This estimate uses your recorded wallet, pending reviews, active schedules, budgets, and goal reservations. Unrecorded purchases are not included.</Text>
    </AppScreen>
  );
}

function BreakdownRow({ label, value, emphasized = false }: { label: string; value: number; emphasized?: boolean }) { return <View style={styles.breakdownRow}><Text style={[styles.breakdownLabel, emphasized && styles.emphasized]}>{label}</Text><Text style={[styles.breakdownValue, emphasized && styles.emphasized]}>{value < 0 ? '−' : ''}{formatPeso(Math.abs(value))}</Text></View>; }
function formatDate(value: string) { return new Intl.DateTimeFormat('en-PH', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${value}T00:00:00Z`)); }

const styles = themedStyles(() => ({
  hero: { marginTop: 22, minHeight: 170, padding: 22, justifyContent: 'center', borderRadius: radius.lg, backgroundColor: colors.ink },
  heroWarning: { backgroundColor: colors.warningOnInk },
  heroTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  eyebrow: { fontFamily: fonts.bodySemiBold, fontSize: 11, letterSpacing: 1.2, color: colors.onInkMuted },
  heroValue: { marginTop: 17, fontFamily: fonts.bodyBold, fontSize: 40, letterSpacing: -1.2, fontVariant: ['tabular-nums'], color: colors.paper },
  heroDetail: { marginTop: 8, fontFamily: fonts.body, fontSize: 12, lineHeight: 18, color: colors.onInkMuted },
  breakdown: { marginTop: 14, paddingHorizontal: 16, borderRadius: radius.md, backgroundColor: colors.paper, borderWidth: 1, borderColor: colors.border },
  breakdownRow: { minHeight: 54, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 16, borderBottomWidth: 1, borderBottomColor: colors.border },
  breakdownLabel: { flex: 1, fontFamily: fonts.body, fontSize: 12, color: colors.secondary },
  breakdownValue: { fontFamily: fonts.bodyMedium, fontSize: 12, fontVariant: ['tabular-nums'], color: colors.ink },
  emphasized: { fontFamily: fonts.bodySemiBold, color: colors.ink },
  section: { marginTop: 34 },
  list: { marginTop: 12, borderTopWidth: 1, borderTopColor: colors.border },
  row: { minHeight: 70, flexDirection: 'row', alignItems: 'center', gap: 12, borderBottomWidth: 1, borderBottomColor: colors.border },
  icon: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.paper, borderWidth: 1, borderColor: colors.border },
  main: { flex: 1, minWidth: 0 },
  title: { fontFamily: fonts.bodyMedium, fontSize: 13, lineHeight: 18, color: colors.ink },
  detail: { marginTop: 3, fontFamily: fonts.body, fontSize: 11, lineHeight: 16, color: colors.secondary },
  amount: { fontFamily: fonts.bodySemiBold, fontSize: 12, fontVariant: ['tabular-nums'], color: colors.ink },
  empty: { minHeight: 100, justifyContent: 'center', borderBottomWidth: 1, borderBottomColor: colors.border },
  actions: { marginTop: 28, gap: 9 },
  action: { minHeight: 58, paddingHorizontal: 15, flexDirection: 'row', alignItems: 'center', gap: 11, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.paper },
  actionText: { flex: 1, fontFamily: fonts.bodyMedium, fontSize: 13, color: colors.ink },
  note: { marginTop: 18, fontFamily: fonts.body, fontSize: 11, lineHeight: 17, color: colors.muted },
  pressed: { opacity: 0.72, transform: [{ scale: 0.99 }] },
}));
