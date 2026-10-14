import { Feather } from '@expo/vector-icons';
import { Href, useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';
import { useAppDialog } from '@/components/AppDialog';
import { useAppToast } from '@/components/AppToast';
import { AppListScreen } from '@/components/AppScreen';
import { ItemRow } from '@/components/ItemRow';
import { PageHeader } from '@/components/page-header';
import { colors, fonts, themedStyles } from '@/constants/theme';
import { useItems } from '@/store/ItemsContext';
import { filterTaskItems } from '@/utils/task-filters';
import { QuickDue, quickDueDate } from '@/utils/date';
import { Project, ThoughtItem } from '@/types';
import { useTheme } from '@/store/ThemeContext';

type ViewMode = 'focus' | 'upcoming' | 'projects' | 'inbox';
const dueChoices: { value: QuickDue | null; label: string }[] = [
  { value: null, label: 'No date' },
  { value: 'today', label: 'Today' },
  { value: 'tomorrow', label: 'Tomorrow' },
  { value: 'next-week', label: 'Next week' },
];
const modes: { value: ViewMode; label: string }[] = [
  { value: 'focus', label: 'Focus' },
  { value: 'upcoming', label: 'Upcoming' },
  { value: 'projects', label: 'Projects' },
  { value: 'inbox', label: 'Captured' },
];

export default function TasksScreen() {
  useTheme();
  const { showDialog } = useAppDialog();
  const { showToast } = useAppToast();
  const router = useRouter();
  const params = useLocalSearchParams<{ action?: string }>();
  const { items, projects, addProject, addTask, reload } = useItems();
  const [mode, setMode] = useState<ViewMode>('focus');
  const [addingProject, setAddingProject] = useState(false);
  const [projectName, setProjectName] = useState('');
  const [nextAction, setNextAction] = useState('');
  const [savingProject, setSavingProject] = useState(false);
  const [addingTask, setAddingTask] = useState(params.action === 'add');
  const [taskTitle, setTaskTitle] = useState('');
  const [taskDetail, setTaskDetail] = useState('');
  const [taskDue, setTaskDue] = useState<QuickDue | null>(null);
  const [savingTask, setSavingTask] = useState(false);
  const filtered = useMemo(() => mode === 'projects' ? [] : filterTaskItems(items, mode), [items, mode]);
  const activeProjects = projects.filter((project) => project.status === 'active');
  const counts = useMemo<Record<ViewMode, number>>(() => ({ focus: filterTaskItems(items, 'focus').length, upcoming: filterTaskItems(items, 'upcoming').length, inbox: filterTaskItems(items, 'inbox').length, projects: activeProjects.length }), [activeProjects.length, items]);

  useEffect(() => { if (params.action === 'add') setAddingTask(true); }, [params.action]);

  const createProject = async () => {
    if (!projectName.trim()) return showDialog({ title: 'Add a project name', message: 'Name the outcome or area you want LifeDesk to remember.', tone: 'warning' });
    setSavingProject(true);
    try {
      const project = await addProject({ name: projectName, nextAction });
      setProjectName(''); setNextAction(''); setAddingProject(false);
      router.push({ pathname: '/project/[id]', params: { id: project.id } });
    } catch (error) {
      showDialog({ title: 'Could not create project', message: error instanceof Error ? error.message : 'Try again.', tone: 'danger' });
      setSavingProject(false);
    }
  };

  const createTask = async () => {
    if (!taskTitle.trim()) return showDialog({ title: 'Add a task title', message: 'Describe the next action you want to remember.', tone: 'warning' });
    setSavingTask(true);
    try {
      await addTask({ title: taskTitle, detail: taskDetail, dueAt: taskDue ? quickDueDate(taskDue).toISOString() : null });
      // Show the list the new task actually lands in.
      const destination: ViewMode = taskDue === 'tomorrow' || taskDue === 'next-week' ? 'upcoming' : 'focus';
      setTaskTitle(''); setTaskDetail(''); setTaskDue(null); setAddingTask(false); setMode(destination);
      showToast({ message: destination === 'upcoming' ? 'Task added to Upcoming' : 'Task added', icon: 'check' });
    } catch (error) {
      showDialog({ title: 'Could not create task', message: error instanceof Error ? error.message : 'Try again.', tone: 'danger' });
    } finally { setSavingTask(false); }
  };

  const rows: ListRow[] = mode === 'projects'
    ? activeProjects.map((project) => ({ kind: 'project' as const, project }))
    : filtered.map((item) => ({ kind: 'item' as const, item }));

  const header = (
    <>
      <PageHeader title="Tasks" supporting="Keep the next useful action visible." action={<Pressable accessibilityRole="button" accessibilityLabel="Add a task" onPress={() => setAddingTask((value) => !value)} style={styles.addButton}><Feather name={addingTask ? 'x' : 'plus'} size={17} color={colors.paper} /><Text style={styles.addButtonText}>{addingTask ? 'Close' : 'Add task'}</Text></Pressable>} />
      <View style={styles.taskTools}>
        <TaskTool icon="calendar" label="Calendar" onPress={() => router.push('/tasks/calendar' as Href)} />
        <TaskTool icon="clock" label="Timeline" onPress={() => router.push('/tasks/timeline' as Href)} />
        <TaskTool icon="search" label="Search" onPress={() => router.push('/tasks/search')} />
      </View>
      <View accessibilityRole="tablist" style={styles.tabs}>{modes.map((item) => <Pressable accessibilityRole="tab" accessibilityLabel={`${item.label} tasks`} accessibilityState={{ selected: mode === item.value }} key={item.value} onPress={() => setMode(item.value)} style={({ pressed }) => [styles.tab, mode === item.value && styles.tabActive, pressed && styles.tabPressed]}><Text numberOfLines={1} style={[styles.tabText, mode === item.value && styles.tabTextActive]}>{item.label}</Text>{counts[item.value] ? <Text style={[styles.tabCount, mode === item.value && styles.tabCountActive]}>{counts[item.value]}</Text> : null}</Pressable>)}</View>

      {addingTask ? <View style={styles.projectForm}><View><Text style={styles.fieldLabel}>Task</Text><TextInput autoFocus value={taskTitle} onChangeText={setTaskTitle} onSubmitEditing={createTask} placeholder="What needs to be done?" placeholderTextColor={colors.muted} returnKeyType="done" style={styles.input} /></View><View><Text style={styles.fieldLabel}>Notes (optional)</Text><TextInput value={taskDetail} onChangeText={setTaskDetail} placeholder="Helpful context" placeholderTextColor={colors.muted} style={styles.input} /></View><View><Text style={styles.fieldLabel}>Due</Text><View accessibilityRole="radiogroup" style={styles.dueRow}>{dueChoices.map((choice) => <Pressable accessibilityRole="radio" accessibilityState={{ checked: taskDue === choice.value }} key={choice.label} onPress={() => setTaskDue(choice.value)} style={[styles.dueChoice, taskDue === choice.value && styles.dueChoiceActive]}><Text style={[styles.dueText, taskDue === choice.value && styles.dueTextActive]}>{choice.label}</Text></Pressable>)}</View></View><Pressable accessibilityRole="button" disabled={savingTask} onPress={createTask} style={[styles.createButton, savingTask && styles.disabled]}><Text style={styles.createButtonText}>{savingTask ? 'Adding…' : 'Add task'}</Text><Feather name="check" size={18} color={colors.paper} /></Pressable></View> : null}
      <View style={styles.contextRow}><Text style={styles.contextTitle}>{modeTitle(mode)}</Text><View style={styles.contextActions}>{mode === 'projects' ? <Pressable accessibilityRole="button" onPress={() => setAddingProject((value) => !value)} style={styles.newProject}><Feather name={addingProject ? 'x' : 'plus'} size={16} color={colors.ink} /><Text style={styles.newProjectText}>{addingProject ? 'Close' : 'New project'}</Text></Pressable> : null}<Text style={styles.count}>{mode === 'projects' ? activeProjects.length : filtered.length}</Text></View></View>
      {mode === 'projects' && addingProject ? <View style={styles.projectForm}><View><Text style={styles.fieldLabel}>Project name</Text><TextInput value={projectName} onChangeText={setProjectName} placeholder="Portfolio refresh" placeholderTextColor={colors.muted} style={styles.input} /></View><View><Text style={styles.fieldLabel}>First next action</Text><TextInput value={nextAction} onChangeText={setNextAction} placeholder="Choose the first useful step" placeholderTextColor={colors.muted} style={styles.input} /></View><Pressable accessibilityRole="button" disabled={savingProject} onPress={createProject} style={[styles.createButton, savingProject && styles.disabled]}><Text style={styles.createButtonText}>{savingProject ? 'Creating…' : 'Create project'}</Text><Feather name="arrow-right" size={18} color={colors.paper} /></Pressable></View> : null}
      <View style={styles.listTop} />
    </>
  );

  const empty = mode === 'projects'
    ? <EmptyState title="No active projects" detail="Create a project here, or ask the Assistant to start one." actionLabel="New project" onAction={() => setAddingProject(true)} />
    : mode === 'focus'
      ? <EmptyState title="Nothing needs attention" detail="New, due, and overdue tasks will appear here." actionLabel="Add a task" onAction={() => setAddingTask(true)} />
      : mode === 'upcoming'
        ? <EmptyState title="Nothing scheduled next" detail="Future tasks and reminders will appear here." actionLabel="Open calendar" onAction={() => router.push('/tasks/calendar' as Href)} />
        : <EmptyState title="Nothing captured yet" detail="Notes and ideas you save with the Assistant will appear here." actionLabel="Open Assistant" onAction={() => router.push('/chat' as Href)} />;

  return (
    <AppListScreen
      tabbed
      assistant={!addingProject && !addingTask}
      onRefresh={reload}
      data={rows}
      keyExtractor={(row) => row.kind === 'project' ? row.project.id : row.item.id}
      header={header}
      empty={empty}
      renderItem={({ item: row }) => row.kind === 'project'
        ? <Pressable accessibilityRole="button" onPress={() => router.push({ pathname: '/project/[id]', params: { id: row.project.id } })} style={styles.project}><View style={styles.projectIcon}><Feather name="folder" size={19} color={colors.ink} /></View><View style={styles.projectMain}><Text style={styles.projectName}>{row.project.name}</Text><Text numberOfLines={2} style={styles.projectDetail}>{row.project.nextAction || row.project.currentFocus || 'Add a next action when you are ready.'}</Text></View><Feather name="chevron-right" size={19} color={colors.muted} /></Pressable>
        : <ItemRow item={row.item} />}
    />
  );
}

type ListRow = { kind: 'project'; project: Project } | { kind: 'item'; item: ThoughtItem };

function modeTitle(mode: ViewMode) { return mode === 'focus' ? 'Needs attention' : mode === 'upcoming' ? 'Coming up' : mode === 'projects' ? 'Active projects' : 'Captured notes and ideas'; }
function TaskTool({ icon, label, onPress }: { icon: keyof typeof Feather.glyphMap; label: string; onPress: () => void }) { return <Pressable accessibilityRole="button" onPress={onPress} style={({ pressed }) => [styles.taskTool, pressed && styles.taskToolPressed]}><Feather name={icon} size={16} color={colors.secondary} /><Text style={styles.taskToolText}>{label}</Text></Pressable>; }
function EmptyState({ title, detail, actionLabel, onAction }: { title: string; detail: string; actionLabel?: string; onAction?: () => void }) { return <View style={styles.empty}><View style={styles.emptyIcon}><Feather name="inbox" size={21} color={colors.muted} /></View><View style={styles.emptyMain}><Text style={styles.emptyTitle}>{title}</Text><Text style={styles.emptyDetail}>{detail}</Text>{actionLabel && onAction ? <Pressable accessibilityRole="button" accessibilityLabel={actionLabel} onPress={onAction} style={({ pressed }) => [styles.emptyAction, pressed && styles.emptyActionPressed]}><Feather name="plus" size={15} color={colors.ink} /><Text style={styles.emptyActionText}>{actionLabel}</Text></Pressable> : null}</View></View>; }

const styles = themedStyles(() => ({
  addButton: { minHeight: 44, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', gap: 7, borderRadius: 22, backgroundColor: colors.ink },
  addButtonText: { fontFamily: fonts.bodySemiBold, fontSize: 12, color: colors.paper },
  taskTools: { marginTop: 20, flexDirection: 'row', gap: 8 },
  taskTool: { minHeight: 44, flex: 1, paddingHorizontal: 8, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, borderRadius: 11, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.paper },
  taskToolPressed: { opacity: 0.68 },
  taskToolText: { fontFamily: fonts.bodySemiBold, fontSize: 11, color: colors.secondary },
  tabs: { marginTop: 12, padding: 4, flexDirection: 'row', borderRadius: 12, backgroundColor: colors.border },
  tab: { flex: 1, minWidth: 0, minHeight: 40, paddingHorizontal: 4, flexDirection: 'row', gap: 5, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
  tabCount: { fontFamily: fonts.bodySemiBold, fontSize: 10, fontVariant: ['tabular-nums'], color: colors.muted },
  tabCountActive: { color: colors.accent },
  dueRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 },
  dueChoice: { minHeight: 38, paddingHorizontal: 12, alignItems: 'center', justifyContent: 'center', borderRadius: 19, borderWidth: 1, borderColor: colors.borderStrong },
  dueChoiceActive: { borderColor: colors.ink, backgroundColor: colors.ink },
  dueText: { fontFamily: fonts.bodyMedium, fontSize: 12, color: colors.secondary },
  dueTextActive: { color: colors.paper },
  tabActive: { backgroundColor: colors.paper },
  tabPressed: { opacity: 0.72 },
  tabText: { fontFamily: fonts.bodyMedium, fontSize: 11, color: colors.secondary },
  tabTextActive: { fontFamily: fonts.bodySemiBold, color: colors.ink },
  contextRow: { minHeight: 62, marginTop: 18, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  contextTitle: { fontFamily: fonts.bodySemiBold, fontSize: 17, color: colors.ink },
  contextActions: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  newProject: { minHeight: 40, paddingHorizontal: 11, flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: 20, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.paper },
  newProjectText: { fontFamily: fonts.bodySemiBold, fontSize: 11, color: colors.ink },
  count: { minWidth: 28, height: 28, paddingHorizontal: 8, borderRadius: 14, textAlign: 'center', textAlignVertical: 'center', fontFamily: fonts.bodySemiBold, fontSize: 12, lineHeight: 28, color: colors.secondary, backgroundColor: colors.paper, borderWidth: 1, borderColor: colors.border },
  projectForm: { marginBottom: 18, padding: 17, gap: 14, borderRadius: 16, borderWidth: 1, borderColor: colors.borderStrong, backgroundColor: colors.paper },
  fieldLabel: { marginBottom: 7, fontFamily: fonts.bodySemiBold, fontSize: 12, color: colors.ink },
  input: { minHeight: 50, paddingHorizontal: 13, borderRadius: 9, borderWidth: 1, borderColor: colors.borderStrong, fontFamily: fonts.body, fontSize: 14, color: colors.ink },
  createButton: { minHeight: 50, paddingHorizontal: 15, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderRadius: 10, backgroundColor: colors.ink },
  createButtonText: { fontFamily: fonts.bodySemiBold, fontSize: 13, color: colors.paper },
  disabled: { opacity: 0.48 },
  listTop: { borderTopWidth: 1, borderTopColor: colors.border },
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
  emptyAction: { alignSelf: 'flex-start', minHeight: 40, marginTop: 12, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: 20, borderWidth: 1, borderColor: colors.borderStrong, backgroundColor: colors.paper },
  emptyActionPressed: { opacity: 0.62 },
  emptyActionText: { fontFamily: fonts.bodySemiBold, fontSize: 12, color: colors.ink },
}));
