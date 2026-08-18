import { Feather } from '@expo/vector-icons';
import { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { AppScreen } from '@/components/AppScreen';
import { TimelineItem } from '@/components/TimelineItem';
import { colors, fonts } from '@/constants/theme';
import { useItems } from '@/store/ItemsContext';
import { ThoughtItem, VoiceDump } from '@/types';
import { timeLabelFor } from '@/utils/date';

type TimelineEntry = { type: 'item'; date: Date; item: ThoughtItem } | { type: 'dump'; date: Date; dump: VoiceDump };

export default function TimelineScreen() {
  const router = useRouter();
  const { items, dumps } = useItems();
  const groups = useMemo(() => {
    const entries: TimelineEntry[] = [
      ...items.map((item): TimelineEntry => ({ type: 'item', date: new Date(item.dueAt ?? item.createdAt ?? Date.now()), item })),
      ...dumps.map((dump): TimelineEntry => ({ type: 'dump', date: new Date(dump.createdAt), dump })),
    ].filter((entry) => !Number.isNaN(entry.date.getTime())).sort((a, b) => b.date.getTime() - a.date.getTime());
    const grouped = new Map<string, TimelineEntry[]>();
    entries.forEach((entry) => {
      const key = `${entry.date.getFullYear()}-${entry.date.getMonth()}-${entry.date.getDate()}`;
      grouped.set(key, [...(grouped.get(key) ?? []), entry]);
    });
    return [...grouped.values()];
  }, [dumps, items]);

  const firstDate = groups[0]?.[0].date ?? new Date();
  const monthLabel = new Intl.DateTimeFormat(undefined, { month: 'long', year: 'numeric' }).format(firstDate).toUpperCase();

  return (
    <AppScreen bottomNav background={colors.paper}>
      <Text style={styles.title}>Timeline</Text>
      <Text style={styles.month}>{monthLabel}</Text>
      <View style={styles.calendarRule} />
      {groups.length ? groups.map((entries) => {
        const date = entries[0].date;
        return <View key={date.toISOString()} style={styles.dayGroup}>
          <View style={styles.day}><Text style={styles.dayNumber}>{date.getDate()}</Text><Text style={styles.weekday}>{new Intl.DateTimeFormat(undefined, { weekday: 'short' }).format(date).toUpperCase()}</Text></View>
          <View style={styles.entries}>
            {entries.map((entry, index) => entry.type === 'dump'
              ? <Pressable accessibilityRole="button" onPress={() => router.push('/')} key={entry.dump.id} style={styles.dumpEntry}><View style={styles.dumpRail}><View style={styles.dumpDot} />{index < entries.length - 1 && <View style={styles.dumpLine} />}</View><Text style={styles.dumpTime}>{timeLabelFor(entry.date)}</Text><View style={styles.dumpMain}><Text style={styles.dumpTitle}>{entry.dump.title}</Text><Text style={styles.dumpLabel}>VOICE NOTE</Text></View></Pressable>
              : <TimelineItem key={entry.item.id} item={entry.item} last={index === entries.length - 1} />)}
          </View>
        </View>;
      }) : <Pressable accessibilityRole="button" onPress={() => router.push('/record')} style={styles.empty}><Feather name="clock" size={28} color={colors.muted} /><Text style={styles.emptyTitle}>Your timeline is ready</Text><Text style={styles.emptyText}>Record a thought to add the first moment.</Text></Pressable>}
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  title: { marginTop: 10, fontFamily: fonts.editorialSemiBold, fontSize: 38, color: colors.ink },
  month: { marginTop: 24, fontFamily: fonts.bodySemiBold, fontSize: 11, letterSpacing: 1.5, color: colors.terracotta },
  calendarRule: { height: 1, marginTop: 12, marginBottom: 6, backgroundColor: colors.borderStrong },
  dayGroup: { flexDirection: 'row', paddingTop: 24 },
  day: { width: 58 },
  dayNumber: { fontFamily: fonts.editorialSemiBold, fontSize: 31, lineHeight: 30, color: colors.ink },
  weekday: { marginTop: 5, fontFamily: fonts.bodySemiBold, fontSize: 10, letterSpacing: 1.2, color: colors.muted },
  entries: { flex: 1 },
  dumpEntry: { minHeight: 78, flexDirection: 'row' },
  dumpRail: { width: 24, alignItems: 'center' },
  dumpDot: { width: 8, height: 8, borderRadius: 4, marginTop: 7, backgroundColor: colors.dark },
  dumpLine: { width: 1, flex: 1, marginTop: 5, backgroundColor: colors.borderStrong },
  dumpTime: { width: 70, paddingTop: 2, fontFamily: fonts.bodyMedium, fontSize: 12, color: colors.secondary },
  dumpMain: { flex: 1 },
  dumpTitle: { fontFamily: fonts.bodyMedium, fontSize: 15, color: colors.ink },
  dumpLabel: { marginTop: 4, fontFamily: fonts.bodyMedium, fontSize: 11, letterSpacing: 0.7, color: colors.secondary },
  empty: { alignItems: 'center', paddingTop: 78 },
  emptyTitle: { marginTop: 14, fontFamily: fonts.bodySemiBold, fontSize: 16, color: colors.ink },
  emptyText: { marginTop: 5, fontFamily: fonts.body, fontSize: 13, color: colors.secondary },
});
