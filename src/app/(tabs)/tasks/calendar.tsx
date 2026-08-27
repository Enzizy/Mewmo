import { Feather } from '@expo/vector-icons';
import { Host, Switch } from '@expo/ui';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useAppDialog } from '@/components/AppDialog';
import { AppScreen } from '@/components/AppScreen';
import { PageHeader } from '@/components/page-header';
import { ScreenHeader } from '@/components/ScreenHeader';
import { colors, fonts, radius } from '@/constants/theme';
import { useItems } from '@/store/ItemsContext';
import { ReminderFrequency, ThoughtItem } from '@/types';
import { confirmAction } from '@/utils/confirm-action';
import { localDateInput, reminderDateTime, reminderOccurrencesBetween } from '@/utils/reminders';

type RepeatChoice = 'none' | ReminderFrequency;
const repeatChoices: { value: RepeatChoice; label: string }[] = [
  { value: 'none', label: 'Once' }, { value: 'daily', label: 'Daily' }, { value: 'weekly', label: 'Weekly' }, { value: 'monthly', label: 'Monthly' }, { value: 'yearly', label: 'Yearly' },
];

export default function CalendarScreen() {
  const { showDialog } = useAppDialog();
  const { items, addReminder, updateReminder, toggleReminderEnabled, deleteItem, notificationEnabled } = useItems();
  const [month, setMonth] = useState(() => startOfMonth(new Date()));
  const [selected, setSelected] = useState(() => localDateInput());
  const [editor, setEditor] = useState<ThoughtItem | 'new' | null>(null);
  const monthStart = startOfMonth(month);
  const monthEnd = new Date(month.getFullYear(), month.getMonth() + 1, 1);
  const reminderEntries = items
    .filter((item) => item.category === 'reminder')
    .flatMap((item) => reminderOccurrencesBetween(item, monthStart, monthEnd).map((date) => ({ item, date })))
    .sort((a, b) => a.date.getTime() - b.date.getTime());
  const selectedEntries = reminderEntries.filter((entry) => localDateInput(entry.date) === selected);

  const remove = (item: ThoughtItem) => showDialog(confirmAction({ title: 'Delete reminder?', message: `“${item.title}” and its future notification will be removed.`, confirmLabel: 'Delete', onConfirm: () => deleteItem(item.id) }));

  return (
    <AppScreen tabbed assistant={!editor}>
      <ScreenHeader back />
      <PageHeader title="Calendar" supporting="Keep one-time and repeating reminders in one place." action={<Pressable accessibilityRole="button" onPress={() => setEditor('new')} style={styles.addButton}><Feather name="plus" size={18} color={colors.paper} /><Text style={styles.addButtonText}>Add</Text></Pressable>} />

      <View style={styles.calendar}>
        <View style={styles.monthHeader}><Pressable accessibilityRole="button" accessibilityLabel="Previous month" onPress={() => { const next = addMonths(month, -1); setMonth(next); setSelected(localDateInput(next)); }} style={styles.iconButton}><Feather name="chevron-left" size={20} color={colors.ink} /></Pressable><Text style={styles.monthTitle}>{new Intl.DateTimeFormat('en-PH', { month: 'long', year: 'numeric' }).format(month)}</Text><Pressable accessibilityRole="button" accessibilityLabel="Next month" onPress={() => { const next = addMonths(month, 1); setMonth(next); setSelected(localDateInput(next)); }} style={styles.iconButton}><Feather name="chevron-right" size={20} color={colors.ink} /></Pressable></View>
        <View style={styles.weekRow}>{['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((day, index) => <Text key={`${day}-${index}`} style={styles.weekday}>{day}</Text>)}</View>
        <View style={styles.days}>{calendarDays(month).map((date) => { const key = localDateInput(date); const inMonth = date.getMonth() === month.getMonth(); const hasReminder = reminderEntries.some((entry) => localDateInput(entry.date) === key); const isSelected = selected === key; return <Pressable accessibilityRole="button" accessibilityLabel={new Intl.DateTimeFormat('en-PH', { dateStyle: 'full' }).format(date)} accessibilityState={{ selected: isSelected }} key={key} onPress={() => setSelected(key)} style={[styles.day, isSelected && styles.daySelected]}><Text style={[styles.dayText, !inMonth && styles.dayOutside, isSelected && styles.dayTextSelected]}>{date.getDate()}</Text>{hasReminder ? <View style={[styles.dot, isSelected && styles.dotSelected]} /> : null}</Pressable>; })}</View>
      </View>

      {editor ? <ReminderForm initial={editor === 'new' ? undefined : editor} selectedDate={selected} notificationsEnabled={notificationEnabled} onCancel={() => setEditor(null)} onSave={async (input) => { if (editor === 'new') await addReminder(input); else await updateReminder(editor.id, input); setEditor(null); }} /> : null}

      <View style={styles.agendaHeader}><View><Text style={styles.agendaTitle}>{selected === localDateInput() ? 'Today' : new Intl.DateTimeFormat('en-PH', { weekday: 'long', month: 'short', day: 'numeric' }).format(new Date(`${selected}T12:00:00`))}</Text><Text style={styles.agendaDetail}>{selectedEntries.length ? `${selectedEntries.length} scheduled` : 'No reminders scheduled'}</Text></View></View>
      <View style={styles.list}>
        {selectedEntries.map(({ item, date }) => <View key={item.id} style={styles.row}><View style={[styles.bell, item.reminderEnabled === false && styles.bellPaused]}><Feather name="bell" size={17} color={colors.ink} /></View><View style={styles.rowMain}><Text style={styles.rowTitle}>{item.title}</Text><Text style={styles.rowMeta}>{new Intl.DateTimeFormat('en-PH', { timeStyle: 'short' }).format(date)}{item.recurrence ? ` · Repeats ${item.recurrence.frequency}` : ''}</Text></View><Host accessible accessibilityLabel={`${item.reminderEnabled === false ? 'Enable' : 'Pause'} ${item.title}`} accessibilityRole="switch" accessibilityState={{ checked: item.reminderEnabled !== false }} matchContents><Switch value={item.reminderEnabled !== false} onValueChange={() => toggleReminderEnabled(item.id).catch((error) => showDialog({ title: 'Could not update reminder', message: error instanceof Error ? error.message : 'Try again.', tone: 'danger' }))} /></Host><Pressable accessibilityLabel={`Edit ${item.title}`} onPress={() => setEditor(item)} style={styles.rowAction}><Feather name="edit-3" size={16} color={colors.secondary} /></Pressable><Pressable accessibilityLabel={`Delete ${item.title}`} onPress={() => remove(item)} style={styles.rowAction}><Feather name="trash-2" size={16} color={colors.muted} /></Pressable></View>)}
        {!selectedEntries.length ? <View style={styles.empty}><View style={styles.emptyIcon}><Feather name="calendar" size={20} color={colors.muted} /></View><View style={styles.rowMain}><Text style={styles.emptyTitle}>This day is open</Text><Text style={styles.emptyText}>Add a reminder manually or ask LifeDesk during voice capture.</Text></View></View> : null}
      </View>
    </AppScreen>
  );
}

function ReminderForm({ initial, selectedDate, notificationsEnabled, onSave, onCancel }: { initial?: ThoughtItem; selectedDate: string; notificationsEnabled: boolean; onSave: (input: { title: string; detail?: string; dueAt: string; recurrence?: ReminderFrequency | null; enabled?: boolean }) => Promise<void>; onCancel: () => void }) {
  const { showDialog } = useAppDialog();
  const initialDate = initial?.dueAt ? new Date(initial.dueAt) : new Date(`${selectedDate}T09:00:00`);
  const [title, setTitle] = useState(initial?.title ?? '');
  const [detail, setDetail] = useState(initial?.detail ?? '');
  const [date, setDate] = useState(localDateInput(initialDate));
  const [time, setTime] = useState(`${String(initialDate.getHours()).padStart(2, '0')}:${String(initialDate.getMinutes()).padStart(2, '0')}`);
  const [repeat, setRepeat] = useState<RepeatChoice>(initial?.recurrence?.frequency ?? 'none');
  const [enabled, setEnabled] = useState(initial?.reminderEnabled !== false);
  const [saving, setSaving] = useState(false);
  const submit = async () => {
    const dueAt = reminderDateTime(date, time);
    if (!title.trim() || !dueAt) return showDialog({ title: 'Check reminder details', message: 'Add a title and use date YYYY-MM-DD with 24-hour time HH:MM.', tone: 'warning' });
    setSaving(true);
    try { await onSave({ title, detail, dueAt, recurrence: repeat === 'none' ? null : repeat, enabled }); }
    catch (error) { setSaving(false); showDialog({ title: 'Could not save reminder', message: error instanceof Error ? error.message : 'Try again.', tone: 'danger' }); }
  };
  return <View style={styles.form}><View style={styles.formHeader}><View><Text style={styles.formTitle}>{initial ? 'Edit reminder' : 'New reminder'}</Text><Text style={styles.formHelp}>Times use your phone’s local timezone.</Text></View><Pressable accessibilityRole="button" accessibilityLabel="Close reminder form" onPress={onCancel} style={styles.rowAction}><Feather name="x" size={20} color={colors.ink} /></Pressable></View><Field label="Title"><TextInput value={title} onChangeText={setTitle} placeholder="Payday or call Mom" placeholderTextColor={colors.muted} style={styles.input} /></Field><Field label="Notes (optional)"><TextInput value={detail} onChangeText={setDetail} placeholder="Anything useful to remember" placeholderTextColor={colors.muted} multiline style={[styles.input, styles.multiline]} /></Field><View style={styles.fieldRow}><Field label="Date (YYYY-MM-DD)" grow><TextInput value={date} onChangeText={setDate} keyboardType="numbers-and-punctuation" placeholder="2026-08-30" placeholderTextColor={colors.muted} style={styles.input} /></Field><Field label="Time (HH:MM)" narrow><TextInput value={time} onChangeText={setTime} keyboardType="numbers-and-punctuation" placeholder="09:00" placeholderTextColor={colors.muted} style={styles.input} /></Field></View><Text style={styles.fieldLabel}>Repeat</Text><View style={styles.repeatRow}>{repeatChoices.map((choice) => <Pressable accessibilityRole="radio" accessibilityState={{ checked: repeat === choice.value }} key={choice.value} onPress={() => setRepeat(choice.value)} style={[styles.repeatChoice, repeat === choice.value && styles.repeatSelected]}><Text style={[styles.repeatText, repeat === choice.value && styles.repeatTextSelected]}>{choice.label}</Text></Pressable>)}</View><View style={styles.notifyRow}><View style={styles.rowMain}><Text style={styles.notifyTitle}>Phone notification</Text><Text style={styles.notifyHelp}>{notificationsEnabled ? 'Delivered by the installed app' : 'Turn notifications on in Profile to receive alerts'}</Text></View><Host accessible accessibilityLabel="Phone notification" accessibilityRole="switch" accessibilityState={{ checked: enabled }} matchContents><Switch value={enabled} onValueChange={setEnabled} /></Host></View><View style={styles.formActions}><Pressable accessibilityRole="button" onPress={onCancel} style={styles.cancel}><Text style={styles.cancelText}>Cancel</Text></Pressable><Pressable accessibilityRole="button" disabled={saving} onPress={submit} style={[styles.save, saving && styles.disabled]}><Text style={styles.saveText}>{saving ? 'Saving…' : 'Save reminder'}</Text></Pressable></View></View>;
}

function Field({ label, children, grow, narrow }: { label: string; children: React.ReactNode; grow?: boolean; narrow?: boolean }) { return <View style={[styles.field, grow && styles.fieldGrow, narrow && styles.fieldNarrow]}><Text style={styles.fieldLabel}>{label}</Text>{children}</View>; }
function startOfMonth(date: Date) { return new Date(date.getFullYear(), date.getMonth(), 1); }
function addMonths(date: Date, amount: number) { return new Date(date.getFullYear(), date.getMonth() + amount, 1); }
function calendarDays(month: Date) { const first = new Date(month.getFullYear(), month.getMonth(), 1); const start = new Date(first); start.setDate(first.getDate() - first.getDay()); return Array.from({ length: 42 }, (_, index) => { const date = new Date(start); date.setDate(start.getDate() + index); return date; }); }

const styles = StyleSheet.create({
  addButton: { minHeight: 44, paddingHorizontal: 15, flexDirection: 'row', alignItems: 'center', gap: 7, borderRadius: 22, backgroundColor: colors.ink }, addButtonText: { fontFamily: fonts.bodySemiBold, fontSize: 13, color: colors.paper },
  calendar: { marginTop: 20, padding: 14, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.paper }, monthHeader: { minHeight: 44, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }, monthTitle: { fontFamily: fonts.bodySemiBold, fontSize: 15, color: colors.ink }, iconButton: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }, weekRow: { flexDirection: 'row', marginTop: 8 }, weekday: { width: '14.285%', textAlign: 'center', fontFamily: fonts.bodySemiBold, fontSize: 10, color: colors.muted }, days: { flexDirection: 'row', flexWrap: 'wrap', marginTop: 5 }, day: { width: '14.285%', height: 42, alignItems: 'center', justifyContent: 'center', borderRadius: 21 }, daySelected: { backgroundColor: colors.ink }, dayText: { fontFamily: fonts.bodyMedium, fontSize: 12, color: colors.ink }, dayOutside: { color: colors.muted }, dayTextSelected: { color: colors.paper }, dot: { position: 'absolute', bottom: 6, width: 4, height: 4, borderRadius: 2, backgroundColor: colors.accent }, dotSelected: { backgroundColor: colors.paper },
  form: { marginTop: 18, padding: 17, gap: 14, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.borderStrong, backgroundColor: colors.paper }, formHeader: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' }, formTitle: { fontFamily: fonts.bodyBold, fontSize: 19, color: colors.ink }, formHelp: { marginTop: 3, fontFamily: fonts.body, fontSize: 11, color: colors.secondary }, field: { gap: 7 }, fieldRow: { flexDirection: 'row', gap: 10 }, fieldGrow: { flex: 1 }, fieldNarrow: { width: 116 }, fieldLabel: { fontFamily: fonts.bodySemiBold, fontSize: 12, color: colors.ink }, input: { minHeight: 48, paddingHorizontal: 13, borderRadius: 9, borderWidth: 1, borderColor: colors.borderStrong, fontFamily: fonts.body, fontSize: 14, color: colors.ink }, multiline: { minHeight: 76, paddingTop: 12, textAlignVertical: 'top' }, repeatRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 }, repeatChoice: { minHeight: 40, paddingHorizontal: 13, alignItems: 'center', justifyContent: 'center', borderRadius: 20, borderWidth: 1, borderColor: colors.borderStrong }, repeatSelected: { borderColor: colors.ink, backgroundColor: colors.ink }, repeatText: { fontFamily: fonts.bodyMedium, fontSize: 12, color: colors.secondary }, repeatTextSelected: { color: colors.paper }, notifyRow: { minHeight: 60, flexDirection: 'row', alignItems: 'center', gap: 12 }, notifyTitle: { fontFamily: fonts.bodySemiBold, fontSize: 13, color: colors.ink }, notifyHelp: { marginTop: 3, fontFamily: fonts.body, fontSize: 11, lineHeight: 16, color: colors.secondary }, formActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 9 }, cancel: { minHeight: 46, paddingHorizontal: 16, alignItems: 'center', justifyContent: 'center' }, cancelText: { fontFamily: fonts.bodySemiBold, fontSize: 13, color: colors.secondary }, save: { minHeight: 46, paddingHorizontal: 18, alignItems: 'center', justifyContent: 'center', borderRadius: 10, backgroundColor: colors.ink }, saveText: { fontFamily: fonts.bodySemiBold, fontSize: 13, color: colors.paper }, disabled: { opacity: 0.5 },
  agendaHeader: { minHeight: 74, marginTop: 24, flexDirection: 'row', alignItems: 'center' }, agendaTitle: { fontFamily: fonts.bodySemiBold, fontSize: 17, color: colors.ink }, agendaDetail: { marginTop: 3, fontFamily: fonts.body, fontSize: 12, color: colors.secondary }, list: { borderTopWidth: 1, borderTopColor: colors.border }, row: { minHeight: 76, flexDirection: 'row', alignItems: 'center', gap: 9, borderBottomWidth: 1, borderBottomColor: colors.border }, bell: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.accentSoft }, bellPaused: { backgroundColor: colors.background }, rowMain: { flex: 1, minWidth: 0 }, rowTitle: { fontFamily: fonts.bodyMedium, fontSize: 14, lineHeight: 19, color: colors.ink }, rowMeta: { marginTop: 3, fontFamily: fonts.body, fontSize: 11, lineHeight: 15, color: colors.secondary }, rowAction: { width: 42, height: 42, alignItems: 'center', justifyContent: 'center' }, empty: { minHeight: 98, paddingRight: 52, flexDirection: 'row', alignItems: 'center', gap: 13, borderBottomWidth: 1, borderBottomColor: colors.border }, emptyIcon: { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.paper, borderWidth: 1, borderColor: colors.border }, emptyTitle: { fontFamily: fonts.bodySemiBold, fontSize: 14, color: colors.ink }, emptyText: { marginTop: 4, fontFamily: fonts.body, fontSize: 12, lineHeight: 17, color: colors.secondary },
});
