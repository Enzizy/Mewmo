import { Feather } from '@expo/vector-icons';
import { Href, useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, Text, TextInput, View } from 'react-native';
import { AppScreen } from '@/components/AppScreen';
import { useAppDialog } from '@/components/AppDialog';
import { useAppToast } from '@/components/AppToast';
import { PixelCat } from '@/components/PixelCat';
import { ScreenHeader } from '@/components/ScreenHeader';
import { colors, fonts, radius, themedStyles } from '@/constants/theme';
import { AheadEntry, buildWeeklyReview } from '@/features/review/weekly-review';
import { useItems } from '@/store/ItemsContext';
import { useTheme } from '@/store/ThemeContext';
import { formatPeso } from '@/utils/money';

const aheadIcons: Record<AheadEntry['kind'], keyof typeof Feather.glyphMap> = { task: 'check-square', reminder: 'bell', bill: 'file-text', income: 'arrow-down-left', investment: 'trending-up', card: 'credit-card' };

export default function WeeklyReviewScreen() {
  useTheme();
  const router = useRouter();
  const { showDialog } = useAppDialog();
  const { showToast } = useAppToast();
  const data = useItems();
  const review = useMemo(() => buildWeeklyReview(data), [data]);
  const [reflection, setReflection] = useState('');
  const [saving, setSaving] = useState(false);
  const hidden = !data.homePreferences.balancesVisible;
  const peso = (minor: number) => hidden ? '••••' : formatPeso(minor);
  const leave = () => router.canGoBack() ? router.back() : router.replace('/');

  if (!data.hydrated) return <AppScreen><ScreenHeader back /><View style={styles.loading}><ActivityIndicator color={colors.ink} /><Text style={styles.muted}>Gathering your week…</Text></View></AppScreen>;

  const { tasks, money, budgets, goals, cards, projects, ahead } = review;
  const goodWeek = tasks.completed >= 3 || (money.spentChange != null && money.spentChange < 0);
  const finish = async () => {
    setSaving(true);
    try {
      await data.completeWeeklyReview({ weekLabel: review.label, reflection });
      showToast({ message: reflection.trim() ? 'Week reviewed. Your note is saved in Captured.' : 'Week reviewed. See you next Sunday.', icon: 'check-circle' });
      leave();
    } catch (error) {
      setSaving(false);
      showDialog({ title: 'Could not finish the review', message: error instanceof Error ? error.message : 'Try again.', tone: 'danger' });
    }
  };

  return (
    <AppScreen background={colors.paper}>
      <ScreenHeader back />
      <View style={styles.hero}>
        <PixelCat pose={goodWeek ? 'celebrate' : 'curious'} size={92} />
        <Text style={styles.eyebrow}>Week in review · {review.label}</Text>
        <Text accessibilityRole="header" style={styles.title}>{headline(tasks.completed, money.spentChange)}</Text>
        {review.alreadyReviewed ? <View style={styles.doneChip}><Feather name="check" size={13} color={colors.green} /><Text style={styles.doneText}>You already reviewed this week</Text></View> : null}
      </View>

      <View style={styles.stats}>
        <Stat label="Tasks done" value={String(tasks.completed)} />
        <Stat label="Spent" value={peso(money.spentMinor)} detail={changeText(money.spentChange)} tone={money.spentChange == null ? undefined : money.spentChange > 0.1 ? 'up' : money.spentChange < -0.05 ? 'down' : undefined} />
        <Stat label="Came in" value={peso(money.incomeMinor)} />
      </View>

      <Section title="What you finished" empty={tasks.completed ? null : 'No tasks were checked off this week. That is okay; next week is a fresh page.'}>
        {tasks.completedTitles.slice(0, 5).map((title) => <Row key={title} icon="check" iconTone="green" title={title} />)}
        {tasks.completedTitles.length > 5 ? <Text style={styles.more}>+{tasks.completedTitles.length - 5} more</Text> : null}
        {tasks.overdue.length ? <Pressable accessibilityRole="button" onPress={() => router.push('/tasks')} style={styles.callout}><Feather name="alert-circle" size={15} color={colors.danger} /><Text style={styles.calloutText}>{tasks.overdue.length} overdue {tasks.overdue.length === 1 ? 'task' : 'tasks'} to reschedule or drop: {tasks.overdue.slice(0, 2).map((item) => item.title).join(', ')}{tasks.overdue.length > 2 ? '…' : ''}</Text><Feather name="chevron-right" size={15} color={colors.muted} /></Pressable> : null}
      </Section>

      <Section title="Where your money went" empty={money.topCategories.length ? null : 'No expenses were recorded this week.'}>
        {money.topCategories.map((entry) => <Bar key={entry.category} label={entry.category} value={peso(entry.amountMinor)} ratio={entry.amountMinor / (money.topCategories[0]?.amountMinor || 1)} />)}
      </Section>

      {budgets.length ? <Section title="Budgets this month">
        {budgets.map((budget) => <Bar key={budget.category} label={budget.category} value={`${peso(budget.spentMinor)} of ${peso(budget.limitMinor)}`} ratio={budget.ratio} tone={budget.ratio >= 1 ? 'danger' : budget.ratio >= 0.8 ? 'warning' : 'ok'} />)}
      </Section> : null}

      {cards.count ? <Section title="Cards">
        <Row icon="credit-card" title={cards.owedMinor ? `${peso(cards.owedMinor)} owed across credit cards` : 'Nothing owed on your credit cards'} onPress={() => router.push('/wallet/cards' as Href)} />
        {cards.highUsage.map((card) => <Row key={card.id} icon="alert-triangle" iconTone="warning" title={`${card.name} is using ${Math.round((card.balanceMinor / (card.creditLimitMinor || 1)) * 100)}% of its limit`} detail="Paying it below 30% is gentler on your credit standing." onPress={() => router.push({ pathname: '/wallet/card/[id]', params: { id: card.id } })} />)}
      </Section> : null}

      {goals.length ? <Section title="Savings goals">
        {goals.map((goal) => <Bar key={goal.name} label={goal.reservedThisWeekMinor ? `${goal.name} · +${peso(goal.reservedThisWeekMinor)} this week` : goal.name} value={`${Math.round(Math.min(goal.savedMinor / goal.targetMinor, 1) * 100)}%`} ratio={goal.savedMinor / goal.targetMinor} tone="ok" />)}
      </Section> : null}

      {projects.updates || projects.stalled.length ? <Section title="Projects">
        {projects.updates ? <Row icon="folder" title={`${projects.updates} progress ${projects.updates === 1 ? 'note' : 'notes'} saved this week`} /> : null}
        {projects.stalled.slice(0, 3).map((project) => <Row key={project.id} icon="pause-circle" iconTone="warning" title={`${project.name} has been quiet for ${project.days} days`} detail="Add a next step, or pause it so it stops asking for attention." onPress={() => router.push({ pathname: '/project/[id]', params: { id: project.id } })} />)}
      </Section> : null}

      <Section title="The week ahead" empty={ahead.length ? null : 'Nothing is scheduled for the next seven days yet.'}>
        {ahead.slice(0, 8).map((entry, index) => <Row key={`${entry.kind}-${entry.title}-${index}`} icon={aheadIcons[entry.kind]} title={entry.title} detail={`${new Intl.DateTimeFormat('en-PH', { weekday: 'short', month: 'short', day: 'numeric' }).format(entry.date)}${entry.amountMinor ? ` · ${peso(entry.amountMinor)}` : ''}`} onPress={entry.kind === 'card' && entry.id ? () => router.push({ pathname: '/wallet/card/[id]', params: { id: entry.id! } }) : (entry.kind === 'task' || entry.kind === 'reminder') && entry.id ? () => router.push({ pathname: '/item/[id]', params: { id: entry.id! } }) : entry.kind === 'bill' ? () => router.push('/wallet/subscriptions' as Href) : undefined} />)}
      </Section>

      {!review.alreadyReviewed ? <View style={styles.reflect}>
        <Text style={styles.reflectTitle}>One thing to remember from this week?</Text>
        <Text style={styles.reflectDetail}>Optional. A win, a lesson, or what to do differently. It is saved as a note.</Text>
        <TextInput accessibilityLabel="Weekly reflection" value={reflection} onChangeText={setReflection} multiline placeholder="I finally sorted my bills…" placeholderTextColor={colors.muted} style={styles.reflectInput} />
        <Pressable accessibilityRole="button" accessibilityState={{ busy: saving }} disabled={saving} onPress={finish} style={({ pressed }) => [styles.finish, (saving || pressed) && styles.dim]}><Feather name="check" size={18} color={colors.paper} /><Text style={styles.finishText}>{saving ? 'Saving…' : 'Finish review'}</Text></Pressable>
      </View> : null}
    </AppScreen>
  );
}

function headline(completed: number, spentChange: number | null) {
  if (completed >= 5) return 'A productive week.';
  if (spentChange != null && spentChange < -0.1) return 'You spent less than last week.';
  if (completed > 0) return 'Steady progress this week.';
  return 'Here is how your week went.';
}

function changeText(change: number | null) {
  if (change == null) return undefined;
  if (Math.abs(change) < 0.05) return 'About the same as last week';
  return `${Math.round(Math.abs(change) * 100)}% ${change > 0 ? 'more' : 'less'} than last week`;
}

function Stat({ label, value, detail, tone }: { label: string; value: string; detail?: string; tone?: 'up' | 'down' }) {
  return <View style={styles.stat}><Text style={styles.statLabel}>{label}</Text><Text numberOfLines={1} adjustsFontSizeToFit style={styles.statValue}>{value}</Text>{detail ? <Text style={[styles.statDetail, tone === 'up' && styles.danger, tone === 'down' && styles.positive]}>{detail}</Text> : null}</View>;
}

function Section({ title, empty, children }: { title: string; empty?: string | null; children?: React.ReactNode }) {
  return <View style={styles.section}><Text accessibilityRole="header" style={styles.sectionTitle}>{title}</Text><View style={styles.sectionBody}>{empty ? <Text style={styles.muted}>{empty}</Text> : children}</View></View>;
}

function Row({ icon, iconTone, title, detail, onPress }: { icon: keyof typeof Feather.glyphMap; iconTone?: 'green' | 'warning'; title: string; detail?: string; onPress?: () => void }) {
  const content = <><View style={[styles.rowIcon, iconTone === 'green' && styles.rowIconGreen, iconTone === 'warning' && styles.rowIconWarning]}><Feather name={icon} size={15} color={iconTone === 'green' ? colors.green : iconTone === 'warning' ? colors.mustard : colors.ink} /></View><View style={styles.rowMain}><Text style={styles.rowTitle}>{title}</Text>{detail ? <Text style={styles.rowDetail}>{detail}</Text> : null}</View>{onPress ? <Feather name="chevron-right" size={16} color={colors.muted} /> : null}</>;
  return onPress ? <Pressable accessibilityRole="button" onPress={onPress} style={({ pressed }) => [styles.row, pressed && styles.dim]}>{content}</Pressable> : <View style={styles.row}>{content}</View>;
}

function Bar({ label, value, ratio, tone }: { label: string; value: string; ratio: number; tone?: 'ok' | 'warning' | 'danger' }) {
  return <View style={styles.bar}><View style={styles.barHead}><Text numberOfLines={1} style={styles.barLabel}>{label}</Text><Text style={styles.barValue}>{value}</Text></View><View style={styles.track}><View style={[styles.fill, { width: `${Math.max(2, Math.min(ratio, 1) * 100)}%` }, tone === 'ok' && styles.fillOk, tone === 'warning' && styles.fillWarning, tone === 'danger' && styles.fillDanger]} /></View></View>;
}

const styles = themedStyles(() => ({
  loading: { minHeight: 260, alignItems: 'center', justifyContent: 'center', gap: 12 },
  hero: { alignItems: 'center', paddingTop: 4 },
  eyebrow: { marginTop: 14, fontFamily: fonts.bodySemiBold, fontSize: 12, letterSpacing: 0.4, color: colors.accent },
  title: { marginTop: 6, textAlign: 'center', fontFamily: fonts.bodyBold, fontSize: 26, lineHeight: 32, letterSpacing: -0.6, color: colors.ink },
  doneChip: { marginTop: 10, paddingHorizontal: 11, paddingVertical: 6, flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: radius.full, backgroundColor: colors.greenSoft },
  doneText: { fontFamily: fonts.bodySemiBold, fontSize: 12, color: colors.ink },
  stats: { marginTop: 22, flexDirection: 'row', gap: 8 },
  stat: { flex: 1, minWidth: 0, padding: 12, borderRadius: radius.md, backgroundColor: colors.background },
  statLabel: { fontFamily: fonts.bodyMedium, fontSize: 11, color: colors.secondary },
  statValue: { marginTop: 4, fontFamily: fonts.bodyBold, fontSize: 18, fontVariant: ['tabular-nums'], color: colors.ink },
  statDetail: { marginTop: 3, fontFamily: fonts.body, fontSize: 10, lineHeight: 14, color: colors.secondary },
  danger: { color: colors.danger },
  positive: { color: colors.green },
  section: { marginTop: 28 },
  sectionTitle: { fontFamily: fonts.bodySemiBold, fontSize: 17, color: colors.ink },
  sectionBody: { marginTop: 10, gap: 4 },
  muted: { fontFamily: fonts.body, fontSize: 13, lineHeight: 19, color: colors.secondary },
  more: { marginLeft: 42, fontFamily: fonts.body, fontSize: 12, color: colors.secondary },
  callout: { marginTop: 6, padding: 12, flexDirection: 'row', alignItems: 'center', gap: 9, borderRadius: radius.md, backgroundColor: colors.dangerSoft },
  calloutText: { flex: 1, fontFamily: fonts.bodyMedium, fontSize: 12, lineHeight: 17, color: colors.ink },
  row: { minHeight: 48, paddingVertical: 6, flexDirection: 'row', alignItems: 'center', gap: 10 },
  rowIcon: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background },
  rowIconGreen: { backgroundColor: colors.greenSoft },
  rowIconWarning: { backgroundColor: colors.mustardSoft },
  rowMain: { flex: 1, minWidth: 0 },
  rowTitle: { fontFamily: fonts.bodyMedium, fontSize: 14, lineHeight: 19, color: colors.ink },
  rowDetail: { marginTop: 2, fontFamily: fonts.body, fontSize: 12, lineHeight: 17, color: colors.secondary },
  bar: { paddingVertical: 6, gap: 6 },
  barHead: { flexDirection: 'row', justifyContent: 'space-between', gap: 10 },
  barLabel: { flex: 1, fontFamily: fonts.bodyMedium, fontSize: 13, color: colors.ink },
  barValue: { fontFamily: fonts.bodySemiBold, fontSize: 13, fontVariant: ['tabular-nums'], color: colors.ink },
  track: { height: 7, overflow: 'hidden', borderRadius: 4, backgroundColor: colors.border },
  fill: { height: '100%', borderRadius: 4, backgroundColor: colors.accent },
  fillOk: { backgroundColor: colors.green },
  fillWarning: { backgroundColor: colors.mustard },
  fillDanger: { backgroundColor: colors.danger },
  reflect: { marginTop: 32, padding: 16, gap: 8, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.background },
  reflectTitle: { fontFamily: fonts.bodySemiBold, fontSize: 16, color: colors.ink },
  reflectDetail: { fontFamily: fonts.body, fontSize: 12, lineHeight: 17, color: colors.secondary },
  reflectInput: { minHeight: 88, marginTop: 4, padding: 12, borderRadius: radius.sm, borderWidth: 1, borderColor: colors.borderStrong, backgroundColor: colors.paper, fontFamily: fonts.body, fontSize: 14, lineHeight: 20, color: colors.ink, textAlignVertical: 'top' },
  finish: { minHeight: 52, marginTop: 6, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderRadius: radius.md, backgroundColor: colors.ink },
  finishText: { fontFamily: fonts.bodySemiBold, fontSize: 15, color: colors.paper },
  dim: { opacity: 0.7 },
}));
