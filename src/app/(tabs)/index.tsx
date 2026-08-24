import { Feather } from '@expo/vector-icons';
import { Href, useRouter } from 'expo-router';
import { useMemo } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { AppScreen } from '@/components/AppScreen';
import { InvestmentMark } from '@/components/InvestmentMark';
import { PixelCat } from '@/components/PixelCat';
import { PageHeader } from '@/components/page-header';
import { SectionHeading } from '@/components/section-heading';
import { colors, fonts, radius } from '@/constants/theme';
import { getWalletSummary } from '@/features/wallet/wallet-summary';
import { useItems } from '@/store/ItemsContext';
import { ThoughtItem } from '@/types';
import { formatPeso } from '@/utils/money';
import { nextScheduledDate } from '@/utils/recurrence';

export default function HomeScreen() {
  const router = useRouter();
  const { hydrated, items, projects, transactions, investments, quotes, recurringRules } = useItems();
  const money = useMemo(() => getWalletSummary({ transactions, investments, quotes }), [investments, quotes, transactions]);
  const heldPositions = useMemo(() => {
    return money.positions.filter((position) => position.quantity !== '0' || position.recorded > 0);
  }, [money.positions]);

  const attention = useMemo(() => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(23, 59, 59, 999);
    return items
      .filter((item) => !item.completed && (item.category === 'task' || item.category === 'reminder') && item.dueAt && new Date(item.dueAt) <= tomorrow)
      .sort((a, b) => Date.parse(a.dueAt ?? '') - Date.parse(b.dueAt ?? ''))
      .slice(0, 3);
  }, [items]);

  const upcomingMoney = useMemo(() => recurringRules
    .filter((rule) => rule.active)
    .map((rule) => ({ rule, date: nextScheduledDate(rule) }))
    .filter((entry): entry is { rule: typeof recurringRules[number]; date: string } => Boolean(entry.date))
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(0, 3), [recurringRules]);
  const activeProject = projects.find((project) => project.status === 'active');

  return (
    <AppScreen assistant>
      <PageHeader
        eyebrow={new Intl.DateTimeFormat('en-PH', { weekday: 'long', month: 'long', day: 'numeric' }).format(new Date())}
        title="Good morning, Zhyronne"
        supporting="Here is what deserves your attention today."
        action={<Pressable accessibilityLabel="Open profile and settings" onPress={() => router.push('/profile')} style={styles.profileButton}><Feather name="user" size={20} color={colors.ink} /></Pressable>}
      />

      {!hydrated ? <View style={styles.loading}><ActivityIndicator color={colors.ink} /><Text style={styles.loadingText}>Opening your local records…</Text></View> : <>
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
          <SectionHeading title="Needs attention" detail={attention.length ? `${attention.length} due soon` : 'Nothing urgent'} action={<Pressable accessibilityRole="button" onPress={() => router.push('/tasks' as Href)} style={styles.textAction}><Text style={styles.textActionLabel}>View tasks</Text></Pressable>} />
          <View style={styles.list}>
            {attention.map((item) => <AttentionRow key={item.id} item={item} onPress={() => router.push({ pathname: '/item/[id]', params: { id: item.id } })} />)}
            {!attention.length ? <View style={styles.calmEmpty}><PixelCat pose="sleep" size={54} /><View style={styles.emptyCopy}><Text style={styles.emptyTitle}>You are clear for now</Text><Text style={styles.emptyText}>New urgent tasks and reminders will appear here.</Text></View></View> : null}
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

const styles = StyleSheet.create({
  profileButton: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: colors.border, backgroundColor: colors.paper },
  loading: { minHeight: 260, alignItems: 'center', justifyContent: 'center', gap: 12 },
  loadingText: { fontFamily: fonts.body, fontSize: 13, color: colors.secondary },
  moneySurface: { marginTop: 24, padding: 20, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.paper },
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
