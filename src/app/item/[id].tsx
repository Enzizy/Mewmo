import { Feather } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { AppScreen } from '@/components/AppScreen';
import { useAppDialog } from '@/components/AppDialog';
import { categoryMeta } from '@/components/CategoryIcon';
import { ScreenHeader } from '@/components/ScreenHeader';
import { colors, fonts } from '@/constants/theme';
import { useItems } from '@/store/ItemsContext';
import { confirmAction } from '@/utils/confirm-action';

export default function ItemDetailScreen() {
  const { showDialog } = useAppDialog();
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { items, toggleComplete, deleteItem, updateTitle, scheduleTomorrow, addSubtask, toggleSubtask } = useItems();
  const item = items.find((candidate) => candidate.id === id);
  const [editing, setEditing] = useState(false);
  const [draftTitle, setDraftTitle] = useState(item?.title ?? '');
  const [newSubtask, setNewSubtask] = useState('');

  if (!item) return <AppScreen><ScreenHeader back /><View style={styles.notFound}><Text style={styles.notFoundTitle}>Item not found</Text><Text style={styles.notFoundText}>It may have been deleted.</Text></View></AppScreen>;
  const meta = categoryMeta[item.category];
  const saveTitle = () => { if (draftTitle.trim()) updateTitle(item.id, draftTitle.trim()); setEditing(false); };
  const add = () => { if (!newSubtask.trim()) return; addSubtask(item.id, newSubtask.trim()); setNewSubtask(''); };
  const remove = () => showDialog(confirmAction({ title: 'Delete item?', message: 'This removes the item from your collection.', confirmLabel: 'Delete', onConfirm: () => { deleteItem(item.id); router.canGoBack() ? router.back() : router.replace('/'); } }));

  return (
    <AppScreen background={colors.paper}>
      <ScreenHeader back action={<Pressable onPress={() => setEditing(true)}><Feather name="edit-3" size={20} color={colors.ink} /></Pressable>} />
      <Text style={[styles.kicker, { color: meta.color }]}>{meta.label.toUpperCase()}</Text>
      {editing ? <View style={styles.editRow}><TextInput autoFocus value={draftTitle} onChangeText={setDraftTitle} style={styles.titleInput} onSubmitEditing={saveTitle} /><Pressable onPress={saveTitle} style={styles.save}><Feather name="check" size={20} color={colors.surface} /></Pressable></View> : <Text style={[styles.title, item.completed && styles.done]}>{item.title}</Text>}
      <View style={styles.metadata}><View style={styles.metaItem}><Feather name="calendar" size={15} color={colors.secondary} /><Text style={styles.metaText}>{item.dateLabel}{item.time ? `, ${item.time}` : ''}</Text></View><View style={styles.metaItem}><Feather name="folder" size={15} color={colors.secondary} /><Text style={styles.metaText}>Personal</Text></View></View>

      {item.category === 'task' && <View style={styles.section}>
        <Text style={styles.sectionTitle}>Checklist</Text>
        {(item.subtasks ?? []).map((subtask) => <Pressable accessibilityRole="checkbox" accessibilityState={{ checked: subtask.completed }} key={subtask.id} onPress={() => toggleSubtask(item.id, subtask.id)} style={styles.subtask}><View style={[styles.check, subtask.completed && styles.checkDone]}>{subtask.completed && <Feather name="check" size={13} color={colors.surface} />}</View><Text style={[styles.subtaskText, subtask.completed && styles.subtaskDone]}>{subtask.title}</Text></Pressable>)}
        <View style={styles.addRow}><TextInput value={newSubtask} onChangeText={setNewSubtask} onSubmitEditing={add} placeholder="Add an item" placeholderTextColor={colors.muted} style={styles.addInput} /><Pressable accessibilityLabel="Add checklist item" onPress={add} style={styles.addButton}><Feather name="plus" size={19} color={colors.terracotta} /></Pressable></View>
      </View>}

      <View style={styles.section}><Text style={styles.sectionTitle}>Notes</Text><Text style={styles.notes}>{item.detail ?? 'No notes added yet.'}</Text></View>
      <View style={styles.actionBar}>
        {item.category === 'task' && <Pressable accessibilityRole="button" onPress={() => toggleComplete(item.id)} style={styles.primaryAction}><Feather name={item.completed ? 'rotate-ccw' : 'check'} size={18} color={colors.surface} /><Text style={styles.primaryText}>{item.completed ? 'Mark open' : 'Mark as done'}</Text></Pressable>}
        <View style={styles.secondaryActions}><Action icon="edit-3" label="Edit" onPress={() => setEditing(true)} /><Action icon="calendar" label={item.dueAt ? 'Reschedule' : 'Tomorrow'} onPress={() => scheduleTomorrow(item.id)} /><Action icon="trash-2" label="Delete" danger onPress={remove} /></View>
      </View>
    </AppScreen>
  );
}

function Action({ icon, label, danger, onPress }: { icon: keyof typeof Feather.glyphMap; label: string; danger?: boolean; onPress: () => void }) {
  return <Pressable accessibilityRole="button" onPress={onPress} style={styles.secondaryAction}><Feather name={icon} size={18} color={danger ? colors.danger : colors.secondary} /><Text style={[styles.secondaryText, danger && styles.dangerText]}>{label}</Text></Pressable>;
}

const styles = StyleSheet.create({
  kicker: { marginTop: 6, fontFamily: fonts.bodyBold, fontSize: 11, letterSpacing: 1.5 },
  title: { marginTop: 10, fontFamily: fonts.editorialSemiBold, fontSize: 38, lineHeight: 43, color: colors.ink },
  done: { color: colors.muted, textDecorationLine: 'line-through' },
  editRow: { marginTop: 8, flexDirection: 'row', gap: 8 },
  titleInput: { flex: 1, paddingVertical: 7, borderBottomWidth: 1, borderBottomColor: colors.ink, fontFamily: fonts.editorialSemiBold, fontSize: 30, color: colors.ink },
  save: { width: 44, height: 44, borderRadius: 10, backgroundColor: colors.dark, alignItems: 'center', justifyContent: 'center' },
  metadata: { flexDirection: 'row', gap: 22, marginTop: 20, paddingBottom: 24, borderBottomWidth: 1, borderBottomColor: colors.border },
  metaItem: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  metaText: { fontFamily: fonts.body, fontSize: 13, color: colors.secondary },
  section: { paddingVertical: 25, borderBottomWidth: 1, borderBottomColor: colors.border },
  sectionTitle: { marginBottom: 14, fontFamily: fonts.bodySemiBold, fontSize: 16, color: colors.ink },
  subtask: { minHeight: 43, flexDirection: 'row', alignItems: 'center', gap: 12 },
  check: { width: 21, height: 21, borderRadius: 5, borderWidth: 1, borderColor: colors.borderStrong, alignItems: 'center', justifyContent: 'center' },
  checkDone: { backgroundColor: colors.green, borderColor: colors.green },
  subtaskText: { fontFamily: fonts.body, fontSize: 15, color: colors.ink },
  subtaskDone: { color: colors.muted, textDecorationLine: 'line-through' },
  addRow: { minHeight: 48, marginTop: 6, flexDirection: 'row', alignItems: 'center', borderBottomWidth: 1, borderBottomColor: colors.border },
  addInput: { flex: 1, fontFamily: fonts.body, fontSize: 14, color: colors.ink },
  addButton: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  notes: { fontFamily: fonts.body, fontSize: 15, lineHeight: 24, color: colors.secondary },
  actionBar: { marginTop: 28 },
  primaryAction: { height: 54, borderRadius: 12, backgroundColor: colors.dark, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 9 },
  primaryText: { fontFamily: fonts.bodySemiBold, fontSize: 14, color: colors.surface },
  secondaryActions: { flexDirection: 'row', marginTop: 10 },
  secondaryAction: { flex: 1, minHeight: 56, alignItems: 'center', justifyContent: 'center', gap: 4 },
  secondaryText: { fontFamily: fonts.bodyMedium, fontSize: 11, color: colors.secondary },
  dangerText: { color: colors.danger },
  notFound: { alignItems: 'center', paddingTop: 100 },
  notFoundTitle: { fontFamily: fonts.editorialSemiBold, fontSize: 28, color: colors.ink },
  notFoundText: { marginTop: 8, fontFamily: fonts.body, fontSize: 14, color: colors.secondary },
});
