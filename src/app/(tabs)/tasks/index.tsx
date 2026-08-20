import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { AppScreen } from '@/components/AppScreen';
import { ItemRow } from '@/components/ItemRow';
import { PageHeader } from '@/components/page-header';
import { colors, fonts } from '@/constants/theme';
import { useItems } from '@/store/ItemsContext';
import { ThoughtItem } from '@/types';

type ViewMode = 'focus' | 'upcoming' | 'projects' | 'inbox';
const modes: { value: ViewMode; label: string }[] = [
  { value: 'focus', label: 'Focus' },
  { value: 'upcoming', label: 'Upcoming' },
  { value: 'projects', label: 'Projects' },
  { value: 'inbox', label: 'Inbox' },
];

export default function TasksScreen() {
  const router = useRouter();
  const { items, projects } = useItems();
  const [mode, setMode] = useState<ViewMode>('focus');
  const filtered = useMemo(() => filterItems(items, mode), [items, mode]);
  const activeProjects = projects.filter((project) => project.status === 'active');

  return (
    <AppScreen assistant>
      <PageHeader title="Tasks" supporting="Keep the next useful action visible." action={<Pressable accessibilityLabel="Search tasks and captured items" onPress={() => router.push('/search')} style={styles.iconButton}><Feather name="search" size={20} color={colors.ink} /></Pressable>} />
      <View accessibilityRole="tablist" style={styles.tabs}>{modes.map((item) => <Pressable accessibilityRole="tab" accessibilityState={{ selected: mode === item.value }} key={item.value} onPress={() => setMode(item.value)} style={[styles.tab, mode === item.value && styles.tabActive]}><Text numberOfLines={1} style={[styles.tabText, mode === item.value && styles.tabTextActive]}>{item.label}</Text></Pressable>)}</View>

      <View style={styles.contextRow}><Text style={styles.contextTitle}>{modeTitle(mode)}</Text><Text style={styles.count}>{mode === 'projects' ? activeProjects.length : filtered.length}</Text></View>
      <View style={styles.list}>
        {mode === 'projects' ? activeProjects.map((project) => <Pressable accessibilityRole="button" key={project.id} onPress={() => router.push({ pathname: '/project/[id]', params: { id: project.id } })} style={styles.project}><View style={styles.projectIcon}><Feather name="folder" size={19} color={colors.ink} /></View><View style={styles.projectMain}><Text style={styles.projectName}>{project.name}</Text><Text numberOfLines={2} style={styles.projectDetail}>{project.nextAction || project.currentFocus || 'Add a next action when you are ready.'}</Text></View><Feather name="chevron-right" size={19} color={colors.muted} /></Pressable>) : filtered.map((item) => <ItemRow key={item.id} item={item} />)}
        {mode === 'projects' && !activeProjects.length ? <EmptyState title="No active projects" detail="Projects created from a voice capture will appear here." /> : null}
        {mode !== 'projects' && !filtered.length ? <EmptyState title={mode === 'focus' ? 'Nothing needs attention' : mode === 'upcoming' ? 'Nothing scheduled next' : 'Your inbox is clear'} detail={mode === 'focus' ? 'Due and overdue tasks will collect here.' : mode === 'upcoming' ? 'Future tasks and reminders will appear here.' : 'Notes, ideas, and undated items will appear here.'} /> : null}
      </View>
    </AppScreen>
  );
}

function filterItems(items: ThoughtItem[], mode: ViewMode) {
  const todayEnd = new Date(); todayEnd.setHours(23, 59, 59, 999);
  if (mode === 'focus') return items.filter((item) => !item.completed && (item.category === 'task' || item.category === 'reminder') && (!item.dueAt || new Date(item.dueAt) <= todayEnd));
  if (mode === 'upcoming') return items.filter((item) => !item.completed && item.dueAt && new Date(item.dueAt) > todayEnd).sort((a, b) => Date.parse(a.dueAt ?? '') - Date.parse(b.dueAt ?? ''));
  if (mode === 'inbox') return items.filter((item) => item.category === 'idea' || item.category === 'note' || (!item.dueAt && item.category === 'reminder'));
  return [];
}
function modeTitle(mode: ViewMode) { return mode === 'focus' ? 'Needs attention' : mode === 'upcoming' ? 'Coming up' : mode === 'projects' ? 'Active projects' : 'Captured inbox'; }
function EmptyState({ title, detail }: { title: string; detail: string }) { return <View style={styles.empty}><View style={styles.emptyIcon}><Feather name="inbox" size={21} color={colors.muted} /></View><View style={styles.emptyMain}><Text style={styles.emptyTitle}>{title}</Text><Text style={styles.emptyDetail}>{detail}</Text></View></View>; }

const styles = StyleSheet.create({
  iconButton: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: colors.border, backgroundColor: colors.paper },
  tabs: { marginTop: 24, padding: 4, flexDirection: 'row', borderRadius: 12, backgroundColor: colors.border },
  tab: { flex: 1, minWidth: 0, minHeight: 40, paddingHorizontal: 4, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
  tabActive: { backgroundColor: colors.paper },
  tabText: { fontFamily: fonts.bodyMedium, fontSize: 11, color: colors.secondary },
  tabTextActive: { fontFamily: fonts.bodySemiBold, color: colors.ink },
  contextRow: { minHeight: 62, marginTop: 18, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  contextTitle: { fontFamily: fonts.bodySemiBold, fontSize: 17, color: colors.ink },
  count: { minWidth: 28, height: 28, paddingHorizontal: 8, borderRadius: 14, textAlign: 'center', textAlignVertical: 'center', fontFamily: fonts.bodySemiBold, fontSize: 12, lineHeight: 28, color: colors.secondary, backgroundColor: colors.paper, borderWidth: 1, borderColor: colors.border },
  list: { borderTopWidth: 1, borderTopColor: colors.border },
  project: { minHeight: 82, flexDirection: 'row', alignItems: 'center', gap: 13, borderBottomWidth: 1, borderBottomColor: colors.border },
  projectIcon: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.paper, borderWidth: 1, borderColor: colors.border },
  projectMain: { flex: 1, minWidth: 0 },
  projectName: { fontFamily: fonts.bodySemiBold, fontSize: 15, lineHeight: 20, color: colors.ink },
  projectDetail: { marginTop: 4, fontFamily: fonts.body, fontSize: 12, lineHeight: 17, color: colors.secondary },
  empty: { minHeight: 112, flexDirection: 'row', alignItems: 'center', gap: 14, borderBottomWidth: 1, borderBottomColor: colors.border },
  emptyIcon: { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.paper, borderWidth: 1, borderColor: colors.border },
  emptyMain: { flex: 1 },
  emptyTitle: { fontFamily: fonts.bodySemiBold, fontSize: 14, color: colors.ink },
  emptyDetail: { marginTop: 4, fontFamily: fonts.body, fontSize: 13, lineHeight: 19, color: colors.secondary },
});
