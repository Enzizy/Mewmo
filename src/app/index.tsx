import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { AppScreen } from '@/components/AppScreen';
import { PixelCat } from '@/components/PixelCat';
import { colors, fonts } from '@/constants/theme';
import { useItems } from '@/store/ItemsContext';

export default function TodayScreen() {
  const router = useRouter();
  const { items, projects, level, totalXp, hydrated, toggleComplete } = useItems();
  const openItems = items.filter((item) => item.category === 'task' && !item.completed).slice(0, 2);
  const activeProject = projects.find((project) => project.status === 'active');
  const priorityCount = openItems.length + Number(Boolean(activeProject));
  const levelProgress = totalXp % 50;

  return (
    <AppScreen bottomNav>
      <View style={styles.topbar}><Text style={styles.pageLabel}>TODAY</Text><Pressable accessibilityLabel="Search" onPress={() => router.push('/search')} style={styles.iconButton}><Feather name="search" size={20} color={colors.ink} /></Pressable></View>
      <View style={styles.hero}>
        <View style={styles.greeting}><Text style={styles.title}>GOOD MORNING,{`\n`}ZHYRONNE.</Text><Text style={styles.date}>{new Intl.DateTimeFormat('en-PH', { weekday: 'long', month: 'long', day: 'numeric' }).format(new Date())}</Text></View>
        <PixelCat pose={priorityCount ? 'curious' : 'sleep'} size={104} speech={priorityCount ? 'READY?' : 'ALL CLEAR'} />
      </View>
      <View style={styles.levelRow}><Text style={styles.level}>LV. {String(level).padStart(2, '0')}</Text><Text style={styles.xp}>{levelProgress} / 50 XP</Text></View>
      <View accessibilityRole="progressbar" accessibilityValue={{ min: 0, max: 50, now: levelProgress }} style={styles.track}><View style={[styles.fill, { width: `${levelProgress / 50 * 100}%` }]} /></View>

      <View style={styles.sectionHeader}><Text style={styles.sectionTitle}>WHAT MATTERS NOW</Text><Text style={styles.count}>{hydrated ? priorityCount : '—'}</Text></View>
      <View style={styles.priorityList}>
        {openItems.map((item) => <View key={item.id} style={styles.row}>
          <Pressable accessibilityRole="checkbox" accessibilityState={{ checked: false }} accessibilityLabel={`Complete ${item.title}`} onPress={() => toggleComplete(item.id)} style={styles.checkbox} />
          <Pressable onPress={() => router.push({ pathname: '/item/[id]', params: { id: item.id } })} style={styles.rowMain}><Text style={styles.kind}>TASK</Text><Text numberOfLines={2} style={styles.rowTitle}>{item.title}</Text><Text style={styles.rowMeta}>{item.dateLabel}{item.time ? ` · ${item.time}` : ''}</Text></Pressable>
          <Feather name="chevron-right" size={20} color={colors.ink} />
        </View>)}
        {activeProject ? <Pressable onPress={() => router.push({ pathname: '/project/[id]', params: { id: activeProject.id } })} style={styles.row}>
          <View style={styles.projectIcon}><Feather name="folder" size={19} color={colors.ink} /></View>
          <View style={styles.rowMain}><Text style={styles.kind}>PROJECT</Text><Text numberOfLines={1} style={styles.rowTitle}>{activeProject.name}</Text><Text numberOfLines={1} style={styles.rowMeta}>{activeProject.nextAction || 'Resume where you left off'}</Text></View>
          <Feather name="chevron-right" size={20} color={colors.ink} />
        </Pressable> : null}
        {!priorityCount ? <View style={styles.empty}><PixelCat pose="sleep" size={72} /><View style={styles.emptyCopy}><Text style={styles.emptyTitle}>NOTHING URGENT</Text><Text style={styles.emptyText}>Capture what is on your mind, or enjoy the quiet.</Text></View></View> : null}
      </View>

      <Pressable accessibilityRole="button" onPress={() => router.push('/record')} style={({ pressed }) => [styles.capture, pressed && styles.pressed]}><Feather name="mic" size={24} color={colors.surface} /><Text style={styles.captureText}>TELL MEWMO</Text></Pressable>
      <View style={styles.quickLinks}>
        <Pressable onPress={() => router.push('/projects')} style={styles.quick}><Feather name="folder" size={18} color={colors.ink} /><Text style={styles.quickText}>PROJECTS</Text></Pressable>
        <Pressable onPress={() => router.push('/timeline')} style={styles.quick}><Feather name="clock" size={18} color={colors.ink} /><Text style={styles.quickText}>ACTIVITY</Text></Pressable>
      </View>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  topbar: { minHeight: 44, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  pageLabel: { fontFamily: fonts.pixelBold, fontSize: 20, color: colors.ink },
  iconButton: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  hero: { minHeight: 150, flexDirection: 'row', alignItems: 'center' },
  greeting: { flex: 1 },
  title: { fontFamily: fonts.pixelBold, fontSize: 31, lineHeight: 32, color: colors.ink },
  date: { marginTop: 10, fontFamily: fonts.body, fontSize: 12, color: colors.secondary },
  levelRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  level: { fontFamily: fonts.pixelSemiBold, fontSize: 15, color: colors.ink },
  xp: { fontFamily: fonts.pixel, fontSize: 13, color: colors.secondary },
  track: { height: 7, marginTop: 8, overflow: 'hidden', backgroundColor: colors.border },
  fill: { height: '100%', backgroundColor: colors.accent },
  sectionHeader: { marginTop: 38, paddingBottom: 10, flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: colors.borderStrong },
  sectionTitle: { flex: 1, fontFamily: fonts.pixelSemiBold, fontSize: 16, color: colors.ink },
  count: { fontFamily: fonts.pixelSemiBold, fontSize: 14, color: colors.secondary },
  priorityList: { borderBottomWidth: 1, borderBottomColor: colors.borderStrong },
  row: { minHeight: 92, paddingVertical: 12, flexDirection: 'row', alignItems: 'center', gap: 13, borderBottomWidth: 1, borderBottomColor: colors.border },
  checkbox: { width: 28, height: 28, borderWidth: 2, borderColor: colors.ink },
  projectIcon: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },
  rowMain: { flex: 1 },
  kind: { fontFamily: fonts.pixelSemiBold, fontSize: 11, color: colors.accent },
  rowTitle: { marginTop: 3, fontFamily: fonts.bodySemiBold, fontSize: 15, color: colors.ink },
  rowMeta: { marginTop: 4, fontFamily: fonts.body, fontSize: 12, color: colors.secondary },
  empty: { minHeight: 112, flexDirection: 'row', alignItems: 'center', gap: 14 },
  emptyCopy: { flex: 1 },
  emptyTitle: { fontFamily: fonts.pixelSemiBold, fontSize: 15, color: colors.ink },
  emptyText: { marginTop: 5, fontFamily: fonts.body, fontSize: 13, lineHeight: 19, color: colors.secondary },
  capture: { height: 72, marginTop: 28, paddingHorizontal: 20, borderRadius: 4, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 15, backgroundColor: colors.ink },
  captureText: { fontFamily: fonts.pixelSemiBold, fontSize: 17, color: colors.surface },
  pressed: { transform: [{ scale: 0.985 }], opacity: 0.9 },
  quickLinks: { marginTop: 12, flexDirection: 'row', gap: 8 },
  quick: { flex: 1, minHeight: 48, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderWidth: 1, borderColor: colors.borderStrong },
  quickText: { fontFamily: fonts.pixelSemiBold, fontSize: 11, color: colors.ink },
});
