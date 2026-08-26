import { Feather } from '@expo/vector-icons';
import { Href, useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { AppScreen } from '@/components/AppScreen';
import { InvestmentMark } from '@/components/InvestmentMark';
import { PixelCat } from '@/components/PixelCat';
import { PageHeader } from '@/components/page-header';
import { SectionHeading } from '@/components/section-heading';
import { colors, fonts, radius } from '@/constants/theme';
import { getWalletSummary } from '@/features/wallet/wallet-summary';
import { loadSavedWeather, WeatherSnapshot } from '@/services/weather';
import { useItems } from '@/store/ItemsContext';
import { ThoughtItem } from '@/types';
import { formatPeso } from '@/utils/money';
import { nextScheduledDate } from '@/utils/recurrence';
import { localDateInput, upcomingReminders } from '@/utils/reminders';
import { roundedTemperature, weatherIcon, weatherLabel } from '@/utils/weather';

export default function HomeScreen() {
  const router = useRouter();
  const [weather, setWeather] = useState<WeatherSnapshot | null>(null);
  const [weatherLoaded, setWeatherLoaded] = useState(false);
  const { hydrated, items, projects, transactions, investments, quotes, recurringRules, walletSetup } = useItems();
  const money = useMemo(() => getWalletSummary({ transactions, investments, quotes, walletSetup }), [investments, quotes, transactions, walletSetup]);
  const heldPositions = useMemo(() => {
    return money.positions.filter((position) => position.quantity !== '0' || position.recorded > 0);
  }, [money.positions]);

  const attention = useMemo(() => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(23, 59, 59, 999);
    return items
      .filter((item) => !item.completed && item.category === 'task' && item.dueAt && new Date(item.dueAt) <= tomorrow)
      .sort((a, b) => Date.parse(a.dueAt ?? '') - Date.parse(b.dueAt ?? ''))
      .slice(0, 3);
  }, [items]);
  const schedule = useMemo(() => upcomingReminders(items, 2), [items]);

  const upcomingMoney = useMemo(() => recurringRules
    .filter((rule) => rule.active)
    .map((rule) => ({ rule, date: nextScheduledDate(rule) }))
    .filter((entry): entry is { rule: typeof recurringRules[number]; date: string } => Boolean(entry.date))
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(0, 3), [recurringRules]);
  const activeProject = projects.find((project) => project.status === 'active');

  useFocusEffect(useCallback(() => {
    const controller = new AbortController();
    loadSavedWeather({ refresh: true, signal: controller.signal }).then((saved) => setWeather(saved.forecast)).catch(() => undefined).finally(() => setWeatherLoaded(true));
    return () => controller.abort();
  }, []));

  return (
    <AppScreen assistant>
      <PageHeader
        eyebrow={new Intl.DateTimeFormat('en-PH', { weekday: 'long', month: 'long', day: 'numeric' }).format(new Date())}
        title="Good morning, Zhyronne"
        supporting="Here is what deserves your attention today."
        action={<Pressable accessibilityLabel="Open profile and settings" onPress={() => router.push('/profile')} style={styles.profileButton}><Feather name="user" size={20} color={colors.ink} /></Pressable>}
      />

      {!hydrated ? <View style={styles.loading}><ActivityIndicator color={colors.ink} /><Text style={styles.loadingText}>Opening your local records…</Text></View> : <>
        <Pressable accessibilityRole="button" accessibilityLabel={weather ? `Open weather for ${weather.location.name}` : 'Choose a weather location'} onPress={() => router.push('/tools/weather' as Href)} style={({ pressed }) => [styles.weatherWidget, pressed && styles.pressed]}>
          <View style={styles.weatherIcon}><Feather name={weather ? weatherIcon(weather.current.code, weather.current.isDay) : 'cloud'} size={21} color={colors.ink} /></View>
          <View style={styles.weatherMain}>{weather ? <><Text numberOfLines={1} style={styles.weatherLocation}>{weather.location.name}</Text><Text numberOfLines={1} style={styles.weatherCondition}>{weatherLabel(weather.current.code)} · H {roundedTemperature(weather.days[0].high)} / L {roundedTemperature(weather.days[0].low)}</Text></> : <><Text style={styles.weatherLocation}>{weatherLoaded ? 'Add your weather' : 'Loading weather…'}</Text><Text style={styles.weatherCondition}>{weatherLoaded ? 'Choose a city for your Home forecast.' : 'Checking your saved city.'}</Text></>}</View>
          {weather ? <Text style={styles.weatherTemp}>{roundedTemperature(weather.current.temperature)}</Text> : null}<Feather name="chevron-right" size={17} color={colors.muted} />
        </Pressable>

        <Pressable accessibilityRole="button" accessibilityLabel="Open wallet and investment details" onPress={() => router.push('/wallet' as Href)} style={({ pressed }) => [styles.moneySurface, pressed && styles.pressed]}>
          <View style={styles.moneyHeader}><Text style={styles.moneyLabel}>Money overview</Text><Feather name="arrow-up-right" size={18} color={colors.secondary} /></View>
          <View style={styles.moneyMetrics}>
            <MoneyMetric label="Available wallet" value={formatPeso(money.balance)} />
            <View style={styles.metricDivider} />
            <MoneyMetric label={money.hasLivePortfolio ? 'Portfolio value' : 'Recorded investments'} value={formatPeso(money.portfolio)} />
          </View>
          <View style={styles.positions}>
            {heldPositions.map((position) => (
              <View key={position.asset} style={styles.positionRow}>
                <InvestmentMark asset={position.asset} size={34} />
                <View style={styles.positionMain}>
                  <Text style={styles.assetName}>{position.asset}</Text>
                  <Text numberOfLines={1} style={styles.assetQuantity}>{position.quantity} {position.asset === 'VOO' ? 'shares' : 'BTC'}</Text>
                </View>
                <View style={styles.positionValueGroup}>
                  <Text numberOfLines={1} adjustsFontSizeToFit style={styles.positionValue}>{formatPeso(position.estimated ?? position.recorded)}</Text>
                  <Text style={styles.positionValueLabel}>{position.estimated != null ? 'Current value' : 'Recorded'}</Text>
                </View>
              </View>
            ))}
            {!heldPositions.length ? (
              <View style={styles.investmentEmpty}>
                <View style={styles.emptyInvestmentIcon}><Feather name="trending-up" size={16} color={colors.secondary} /></View>
                <View style={styles.positionMain}><Text style={styles.emptyInvestmentTitle}>No investments recorded</Text><Text style={styles.emptyInvestmentCopy}>Add BTC or VOO holdings in Wallet.</Text></View>
                <Feather name="chevron-right" size={17} color={colors.muted} />
              </View>
            ) : null}
          </View>
        </Pressable>

        <View style={styles.section}>
          <SectionHeading title="Your schedule" detail={schedule.length ? 'Now and next' : 'Nothing coming up'} action={<Pressable accessibilityRole="button" onPress={() => router.push('/tasks/calendar' as Href)} style={styles.textAction}><Text style={styles.textActionLabel}>View calendar</Text></Pressable>} />
          <Pressable accessibilityRole="button" accessibilityLabel="Open reminder calendar" onPress={() => router.push('/tasks/calendar' as Href)} style={({ pressed }) => [styles.scheduleSurface, pressed && styles.pressed]}>
            <View style={styles.scheduleDate}><Feather name="calendar" size={18} color={colors.ink} /><Text style={styles.scheduleDay}>{new Date().getDate()}</Text></View>
            <View style={styles.scheduleMain}>
              {schedule.map(({ item, date }, index) => <View key={item.id} style={[styles.scheduleItem, index > 0 && styles.scheduleItemBorder]}><View style={styles.scheduleCopy}><Text numberOfLines={1} style={styles.scheduleTitle}>{item.title}</Text><Text style={styles.scheduleMeta}>{formatReminderDate(date)}{item.recurrence ? ` · ${item.recurrence.frequency}` : ''}</Text></View><Feather name="chevron-right" size={17} color={colors.muted} /></View>)}
              {!schedule.length ? <View style={styles.scheduleItem}><View style={styles.scheduleCopy}><Text style={styles.scheduleTitle}>Your calendar is clear</Text><Text style={styles.scheduleMeta}>Tap to add a reminder.</Text></View><Feather name="plus" size={17} color={colors.muted} /></View> : null}
            </View>
          </Pressable>
        </View>

        <View style={styles.section}>
          <SectionHeading title="Needs attention" detail={attention.length ? `${attention.length} due soon` : 'Nothing urgent'} action={<Pressable accessibilityRole="button" onPress={() => router.push('/tasks' as Href)} style={styles.textAction}><Text style={styles.textActionLabel}>View tasks</Text></Pressable>} />
          <View style={styles.list}>
            {attention.map((item) => <AttentionRow key={item.id} item={item} onPress={() => router.push({ pathname: '/item/[id]', params: { id: item.id } })} />)}
            {!attention.length ? <View style={styles.calmEmpty}><PixelCat pose="sleep" size={54} /><View style={styles.emptyCopy}><Text style={styles.emptyTitle}>You are clear for now</Text><Text style={styles.emptyText}>Urgent tasks will appear here.</Text></View></View> : null}
          </View>
        </View>

        <View style={styles.section}>
          <SectionHeading title="Coming up" detail="Scheduled money and your next project step" />
          <View style={styles.list}>
            {upcomingMoney.map(({ rule, date }) => <Pressable key={rule.id} onPress={() => router.push('/wallet/planning' as Href)} style={styles.row}><View style={styles.rowIcon}><Feather name={rule.kind === 'income' ? 'arrow-down-left' : rule.kind === 'investment' ? 'trending-up' : 'arrow-up-right'} size={17} color={colors.ink} /></View><View style={styles.rowMain}><Text style={styles.rowTitle}>{rule.title}</Text><Text style={styles.rowMeta}>{formatDateKey(date)} · {formatPeso(rule.amountMinor)}</Text></View><Feather name="chevron-right" size={18} color={colors.muted} /></Pressable>)}
            {activeProject ? <Pressable onPress={() => router.push({ pathname: '/project/[id]', params: { id: activeProject.id } })} style={styles.row}><View style={styles.rowIcon}><Feather name="folder" size={17} color={colors.ink} /></View><View style={styles.rowMain}><Text style={styles.rowTitle}>{activeProject.name}</Text><Text numberOfLines={1} style={styles.rowMeta}>{activeProject.nextAction || activeProject.currentFocus || 'Add a next action'}</Text></View><Feather name="chevron-right" size={18} color={colors.muted} /></Pressable> : null}
            {!upcomingMoney.length && !activeProject ? <View style={styles.simpleEmpty}><Text style={styles.emptyText}>Scheduled salary, bills, investments, and project actions will appear here.</Text></View> : null}
          </View>
        </View>
      </>}
    </AppScreen>
  );
}

function MoneyMetric({ label, value }: { label: string; value: string }) {
  return <View style={styles.metric}><Text style={styles.metricLabel}>{label}</Text><Text numberOfLines={1} adjustsFontSizeToFit style={styles.metricValue}>{value}</Text></View>;
}

function AttentionRow({ item, onPress }: { item: ThoughtItem; onPress: () => void }) {
  return <Pressable accessibilityRole="button" onPress={onPress} style={styles.row}><View style={[styles.rowIcon, item.category === 'reminder' && styles.reminderIcon]}><Feather name={item.category === 'reminder' ? 'bell' : 'check'} size={17} color={colors.ink} /></View><View style={styles.rowMain}><Text numberOfLines={2} style={styles.rowTitle}>{item.title}</Text><Text style={styles.rowMeta}>{item.dateLabel}{item.time ? ` · ${item.time}` : ''}</Text></View><Feather name="chevron-right" size={18} color={colors.muted} /></Pressable>;
}

function formatDateKey(value: string) {
  const [year, month, day] = value.split('-').map(Number);
  return new Intl.DateTimeFormat('en-PH', { month: 'short', day: 'numeric' }).format(new Date(year, month - 1, day));
}

function formatReminderDate(date: Date) {
  const today = localDateInput();
  const tomorrowDate = new Date(); tomorrowDate.setDate(tomorrowDate.getDate() + 1);
  const day = localDateInput(date);
  const prefix = day === today ? 'Today' : day === localDateInput(tomorrowDate) ? 'Tomorrow' : new Intl.DateTimeFormat('en-PH', { month: 'short', day: 'numeric' }).format(date);
  return `${prefix} · ${new Intl.DateTimeFormat('en-PH', { timeStyle: 'short' }).format(date)}`;
}

const styles = StyleSheet.create({
  profileButton: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: colors.border, backgroundColor: colors.paper },
  loading: { minHeight: 260, alignItems: 'center', justifyContent: 'center', gap: 12 },
  loadingText: { fontFamily: fonts.body, fontSize: 13, color: colors.secondary },
  weatherWidget: { minHeight: 76, marginTop: 20, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', gap: 11, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.paper },
  weatherIcon: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.accentSoft },
  weatherMain: { flex: 1, minWidth: 0 },
  weatherLocation: { fontFamily: fonts.bodySemiBold, fontSize: 13, color: colors.ink },
  weatherCondition: { marginTop: 3, fontFamily: fonts.body, fontSize: 11, lineHeight: 15, color: colors.secondary },
  weatherTemp: { fontFamily: fonts.bodyBold, fontSize: 22, fontVariant: ['tabular-nums'], color: colors.ink },
  moneySurface: { marginTop: 12, padding: 20, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.paper },
  moneyHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  moneyLabel: { fontFamily: fonts.bodySemiBold, fontSize: 14, color: colors.ink },
  moneyMetrics: { marginTop: 21, flexDirection: 'row', alignItems: 'stretch' },
  metric: { flex: 1, minWidth: 0 },
  metricDivider: { width: 1, marginHorizontal: 16, backgroundColor: colors.border },
  metricLabel: { fontFamily: fonts.body, fontSize: 11, lineHeight: 15, color: colors.secondary },
  metricValue: { marginTop: 6, fontFamily: fonts.bodySemiBold, fontSize: 20, lineHeight: 26, letterSpacing: -0.5, fontVariant: ['tabular-nums'], color: colors.ink },
  positions: { marginTop: 20, borderTopWidth: 1, borderTopColor: colors.border },
  positionRow: { minHeight: 64, flexDirection: 'row', alignItems: 'center', gap: 11, borderBottomWidth: 1, borderBottomColor: colors.border },
  positionMain: { flex: 1, minWidth: 0 },
  assetName: { fontFamily: fonts.bodySemiBold, fontSize: 13, color: colors.ink },
  assetQuantity: { marginTop: 2, fontFamily: fonts.body, fontSize: 11, lineHeight: 15, color: colors.secondary },
  positionValueGroup: { maxWidth: '44%', alignItems: 'flex-end' },
  positionValue: { fontFamily: fonts.bodySemiBold, fontSize: 14, fontVariant: ['tabular-nums'], color: colors.ink },
  positionValueLabel: { marginTop: 2, fontFamily: fonts.body, fontSize: 10, color: colors.secondary },
  investmentEmpty: { minHeight: 68, flexDirection: 'row', alignItems: 'center', gap: 11 },
  emptyInvestmentIcon: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background },
  emptyInvestmentTitle: { fontFamily: fonts.bodySemiBold, fontSize: 13, color: colors.ink },
  emptyInvestmentCopy: { marginTop: 2, fontFamily: fonts.body, fontSize: 11, lineHeight: 15, color: colors.secondary },
  section: { marginTop: 34 },
  scheduleSurface: { marginTop: 12, minHeight: 82, padding: 12, flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.paper },
  scheduleDate: { width: 48, height: 56, borderRadius: 12, alignItems: 'center', justifyContent: 'center', gap: 1, backgroundColor: colors.accentSoft },
  scheduleDay: { fontFamily: fonts.bodyBold, fontSize: 13, color: colors.ink },
  scheduleMain: { flex: 1, minWidth: 0 },
  scheduleItem: { minHeight: 49, flexDirection: 'row', alignItems: 'center', gap: 8 },
  scheduleItemBorder: { borderTopWidth: 1, borderTopColor: colors.border },
  scheduleCopy: { flex: 1, minWidth: 0 },
  scheduleTitle: { fontFamily: fonts.bodyMedium, fontSize: 13, lineHeight: 18, color: colors.ink },
  scheduleMeta: { marginTop: 2, fontFamily: fonts.body, fontSize: 11, lineHeight: 15, color: colors.secondary },
  textAction: { minHeight: 44, paddingHorizontal: 4, justifyContent: 'center' },
  textActionLabel: { fontFamily: fonts.bodySemiBold, fontSize: 13, color: colors.accent },
  list: { marginTop: 12, borderTopWidth: 1, borderTopColor: colors.border },
  row: { minHeight: 68, flexDirection: 'row', alignItems: 'center', gap: 12, borderBottomWidth: 1, borderBottomColor: colors.border },
  rowIcon: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background },
  reminderIcon: { backgroundColor: colors.accentSoft },
  rowMain: { flex: 1, minWidth: 0 },
  rowTitle: { fontFamily: fonts.bodyMedium, fontSize: 14, lineHeight: 20, color: colors.ink },
  rowMeta: { marginTop: 3, fontFamily: fonts.body, fontSize: 12, lineHeight: 17, color: colors.secondary },
  calmEmpty: { minHeight: 104, flexDirection: 'row', alignItems: 'center', gap: 16, borderBottomWidth: 1, borderBottomColor: colors.border },
  simpleEmpty: { minHeight: 74, justifyContent: 'center', borderBottomWidth: 1, borderBottomColor: colors.border },
  emptyCopy: { flex: 1 },
  emptyTitle: { fontFamily: fonts.bodySemiBold, fontSize: 14, color: colors.ink },
  emptyText: { marginTop: 3, fontFamily: fonts.body, fontSize: 13, lineHeight: 19, color: colors.secondary },
  pressed: { opacity: 0.72 },
});
