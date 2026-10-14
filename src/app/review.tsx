import { Feather } from '@expo/vector-icons';
import * as FileSystem from 'expo-file-system/legacy';
import { Href, useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';
import { useAppDialog } from '@/components/AppDialog';
import { AppScreen } from '@/components/AppScreen';
import { ScreenHeader } from '@/components/ScreenHeader';
import { colors, fonts, radius, themedStyles } from '@/constants/theme';
import { SUGGESTION_KINDS, suggestionKindMeta } from '@/features/assistant/suggestion-kinds';
import { useItems } from '@/store/ItemsContext';
import { InvestmentAsset, OrganizedItemInput } from '@/types';
import { confirmAction } from '@/utils/confirm-action';
import { formatPeso, normalizeDecimalQuantityInput, parsePesoToMinor } from '@/utils/money';
import { useTheme } from '@/store/ThemeContext';

const TRANSCRIPT_PREVIEW_LINES = 4;

/** What still has to be filled in before this suggestion can be saved, if anything. */
function missingDetail(item: OrganizedItemInput) {
  if (!item.title.trim()) return 'Add a title.';
  if (item.category === 'income' || item.category === 'expense') return (item.amountMinor ?? 0) > 0 ? null : 'Add the amount.';
  if (item.category === 'investment') {
    if ((item.amountMinor ?? 0) <= 0) return 'Add the amount paid.';
    if (!item.asset) return 'Choose BTC or VOO.';
    if (!item.quantity || Number(item.quantity) <= 0) return 'Add the exact quantity from your broker.';
  }
  return null;
}

export default function ReviewScreen() {
  useTheme();
  const { showDialog } = useAppDialog();
  const router = useRouter();
  const params = useLocalSearchParams<{ id?: string }>();
  const { reviewProposals, pendingOrganizedDump, pendingRecording, confirmOrganizedDump, confirmReviewProposal, discardReviewProposal, setPendingOrganizedDump, setPendingRecording } = useItems();
  const savedProposal = reviewProposals.find((proposal) => proposal.id === params.id);
  const organizedDump = savedProposal?.organized ?? pendingOrganizedDump;
  const recording = savedProposal?.recording ?? pendingRecording;
  const fromChat = savedProposal?.source === 'chat';
  const [items, setItems] = useState<OrganizedItemInput[]>(organizedDump?.items ?? []);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [categoryPicker, setCategoryPicker] = useState<number | null>(null);
  const [transcriptOpen, setTranscriptOpen] = useState(false);

  useEffect(() => {
    if (organizedDump) setItems(organizedDump.items);
  }, [organizedDump?.title, savedProposal?.id]);

  const invalidCount = useMemo(() => items.filter((item) => missingDetail(item)).length, [items]);
  const kindSummary = useMemo(() => {
    const counts = new Map<string, number>();
    for (const item of items) counts.set(item.category, (counts.get(item.category) ?? 0) + 1);
    return [...counts].map(([kind, count]) => `${count} ${suggestionKindMeta(kind as OrganizedItemInput['category']).label.toLowerCase()}${count === 1 ? '' : 's'}`).join(' · ');
  }, [items]);

  if (!organizedDump) return <AppScreen><ScreenHeader back /><View style={styles.gone}><View style={styles.goneIcon}><Feather name="check" size={22} color={colors.green} /></View><Text style={styles.goneTitle}>Already reviewed</Text><Text style={styles.goneText}>This proposal was confirmed or discarded, so there is nothing left to review.</Text></View></AppScreen>;

  const update = (index: number, next: Partial<OrganizedItemInput>) => setItems((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, ...next } : item));
  const removeItem = (index: number) => { setItems((current) => current.filter((_, itemIndex) => itemIndex !== index)); setCategoryPicker(null); };
  const discard = () => showDialog(confirmAction({ title: `Discard this ${fromChat ? 'proposal' : 'recording'}?`, message: fromChat ? 'All suggested changes will be removed.' : 'The original audio and all suggestions will be removed.', confirmLabel: 'Discard', cancelLabel: 'Keep reviewing', onConfirm: async () => {
      if (savedProposal) await discardReviewProposal(savedProposal.id);
      else {
        if (recording?.uri) await FileSystem.deleteAsync(recording.uri, { idempotent: true }).catch(() => undefined);
        setPendingRecording(null);
        setPendingOrganizedDump(null);
      }
      if (fromChat) router.dismissTo('/chat');
      else router.replace((savedProposal ? '/wallet/inbox' : '/') as Href);
    } }));
  const confirm = async () => {
    if (invalidCount) return setError(`${invalidCount} ${invalidCount === 1 ? 'suggestion needs' : 'suggestions need'} more detail. Fill in the highlighted fields, or remove ${invalidCount === 1 ? 'it' : 'them'}.`);
    setSaving(true);
    setError(null);
    try {
      if (savedProposal) await confirmReviewProposal(savedProposal.id, { ...organizedDump, items });
      else await confirmOrganizedDump({ ...organizedDump, items });
      if (fromChat) {
        showDialog({ title: 'Changes saved', message: 'Your confirmed items have been added. You can keep talking to your assistant.', tone: 'success' });
        router.dismissTo('/chat');
      } else router.replace('/results');
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'These suggestions could not be saved.');
      setSaving(false);
    }
  };

  const longTranscript = organizedDump.transcript.length > 220;

  return (
    <AppScreen background={colors.paper}>
      <ScreenHeader back onBack={discard} />
      <View style={styles.hero}>
        <View style={styles.eyebrowRow}><Feather name={fromChat ? 'message-circle' : 'mic'} size={13} color={colors.accent} /><Text style={styles.eyebrow}>{fromChat ? 'From your chat' : 'From your voice note'}</Text></View>
        <Text accessibilityRole="header" style={styles.title}>Review before saving</Text>
        <Text style={styles.support}>Edit, retype, or remove anything. Nothing is saved until you confirm.</Text>
      </View>

      <Pressable accessibilityRole="button" accessibilityState={{ expanded: transcriptOpen }} disabled={!longTranscript} onPress={() => setTranscriptOpen((open) => !open)} style={styles.transcript}>
        <View style={styles.transcriptHead}><Text style={styles.micro}>{fromChat ? 'You asked' : 'You said'}</Text>{longTranscript ? <Feather name={transcriptOpen ? 'chevron-up' : 'chevron-down'} size={15} color={colors.secondary} /> : null}</View>
        <Text selectable numberOfLines={longTranscript && !transcriptOpen ? TRANSCRIPT_PREVIEW_LINES : undefined} style={styles.transcriptText}>{organizedDump.transcript}</Text>
      </Pressable>

      <View style={styles.listHead}><Text style={styles.listTitle}>{items.length} {items.length === 1 ? 'suggestion' : 'suggestions'}</Text>{items.length ? <Text numberOfLines={1} style={styles.listSummary}>{kindSummary}</Text> : null}</View>

      <View style={styles.list}>
        {items.map((item, index) => {
          const issue = missingDetail(item);
          const kind = suggestionKindMeta(item.category);
          const money = item.category === 'income' || item.category === 'expense' || item.category === 'investment';
          return (
            <View key={`${index}-${item.category}`} style={[styles.card, issue && styles.cardInvalid]}>
              <View style={styles.cardHead}>
                <Pressable accessibilityRole="button" accessibilityLabel={`${kind.label}. Change type`} accessibilityState={{ expanded: categoryPicker === index }} onPress={() => setCategoryPicker((current) => current === index ? null : index)} style={({ pressed }) => [styles.kind, { backgroundColor: kind.soft }, pressed && styles.pressed]}>
                  <Feather name={kind.icon} size={13} color={kind.color} /><Text style={[styles.kindText, { color: kind.color }]}>{kind.label}</Text><Feather name={categoryPicker === index ? 'chevron-up' : 'chevron-down'} size={13} color={kind.color} />
                </Pressable>
                <Pressable accessibilityRole="button" accessibilityLabel={`Remove ${item.title || 'this suggestion'}`} hitSlop={6} onPress={() => removeItem(index)} style={({ pressed }) => [styles.remove, pressed && styles.pressed]}><Feather name="trash-2" size={16} color={colors.muted} /></Pressable>
              </View>
              {categoryPicker === index ? <View style={styles.typeChoices}>{SUGGESTION_KINDS.map((choice) => { const meta = suggestionKindMeta(choice); const active = item.category === choice; return <Pressable accessibilityRole="radio" accessibilityState={{ checked: active }} key={choice} onPress={() => { update(index, { category: choice }); setCategoryPicker(null); }} style={[styles.typeChoice, active && styles.typeChoiceActive]}><Feather name={meta.icon} size={13} color={active ? colors.paper : meta.color} /><Text style={[styles.typeChoiceText, active && styles.typeChoiceTextActive]}>{meta.label}</Text></Pressable>; })}</View> : null}

              <TextInput accessibilityLabel={`${kind.label} title`} value={item.title} onChangeText={(title) => update(index, { title })} placeholder="Title" placeholderTextColor={colors.muted} style={styles.titleInput} />
              <TextInput accessibilityLabel={`${kind.label} note`} value={item.detail ?? ''} onChangeText={(detail) => update(index, { detail: detail || null })} placeholder="Add a note (optional)" placeholderTextColor={colors.muted} multiline style={styles.detailInput} />

              {item.dueAt ? <View style={styles.meta}><Feather name={item.category === 'reminder' ? 'bell' : 'calendar'} size={13} color={colors.secondary} /><Text style={styles.metaText}>{new Intl.DateTimeFormat('en-PH', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(item.dueAt))}{item.recurrence ? ` · Repeats ${item.recurrence}` : ''}</Text></View> : null}
              {item.projectName ? <View style={styles.meta}><Feather name="folder" size={13} color={colors.secondary} /><Text style={styles.metaText}>{item.projectName}</Text></View> : null}

              {money ? <View style={styles.field}><Text style={styles.fieldLabel}>{item.category === 'income' ? 'Amount received' : item.category === 'investment' ? 'Amount paid' : 'Amount spent'}</Text><View style={[styles.inputShell, (item.amountMinor ?? 0) <= 0 && styles.inputShellMissing]}>
                <Text style={styles.currency}>₱</Text><TextInput accessibilityLabel="Amount in Philippine pesos" keyboardType="decimal-pad" defaultValue={item.amountMinor ? (item.amountMinor / 100).toFixed(2) : ''} onChangeText={(value) => update(index, { amountMinor: parsePesoToMinor(value) })} placeholder="0.00" placeholderTextColor={colors.muted} style={styles.moneyInput} />
                {item.amountMinor ? <Text style={styles.amountPreview}>{formatPeso(item.amountMinor)}</Text> : null}
              </View></View> : null}
              {item.category === 'investment' ? <View style={styles.field}><Text style={styles.fieldLabel}>Asset and quantity received</Text><View style={styles.investmentRow}>
                <View accessibilityRole="radiogroup" style={styles.assetToggle}>{(['BTC', 'VOO'] as InvestmentAsset[]).map((asset) => <Pressable accessibilityRole="radio" accessibilityState={{ checked: item.asset === asset }} key={asset} onPress={() => update(index, { asset })} style={[styles.assetOption, item.asset === asset && styles.assetActive]}><Text style={[styles.assetText, item.asset === asset && styles.assetTextActive]}>{asset}</Text></Pressable>)}</View>
                <View style={[styles.inputShell, styles.quantityShell, (!item.quantity || Number(item.quantity) <= 0) && styles.inputShellMissing]}><TextInput accessibilityLabel="Asset quantity" autoCorrect={false} inputMode="decimal" keyboardType="decimal-pad" value={item.quantity ?? ''} onChangeText={(quantity) => update(index, { quantity: normalizeDecimalQuantityInput(quantity) })} placeholder={item.asset === 'VOO' ? '0.04' : '0.001472'} placeholderTextColor={colors.muted} style={styles.moneyInput} /></View>
              </View></View> : null}

              {issue ? <View style={styles.issue}><Feather name="alert-circle" size={13} color={colors.danger} /><Text style={styles.issueText}>{issue}</Text></View> : null}
            </View>
          );
        })}
        {!items.length ? <View style={styles.allRemoved}><Text style={styles.allRemovedTitle}>Every suggestion was removed</Text><Text style={styles.allRemovedText}>Discard this {fromChat ? 'proposal' : 'recording'} to finish, or go back to keep it in your Review inbox.</Text></View> : null}
      </View>
      {error ? <View accessibilityRole="alert" style={styles.error}><Feather name="alert-triangle" size={15} color={colors.danger} /><Text selectable style={styles.errorText}>{error}</Text></View> : null}
      <Pressable accessibilityRole="button" accessibilityState={{ disabled: saving || !items.length, busy: saving }} disabled={saving || !items.length} onPress={confirm} style={({ pressed }) => [styles.confirm, (saving || !items.length) && styles.disabled, pressed && styles.pressed]}><Feather name="check" size={18} color={colors.paper} /><Text style={styles.confirmText}>{saving ? 'Saving…' : `Confirm ${items.length} ${items.length === 1 ? 'change' : 'changes'}`}</Text></Pressable>
      <Pressable accessibilityRole="button" onPress={discard} style={styles.discard}><Text style={styles.discardText}>{fromChat ? 'Discard suggestions' : 'Discard recording'}</Text></Pressable>
    </AppScreen>
  );
}

const styles = themedStyles(() => ({
  gone: { alignItems: 'center', paddingTop: 72, paddingHorizontal: 12 },
  goneIcon: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.greenSoft },
  goneTitle: { marginTop: 14, fontFamily: fonts.bodyBold, fontSize: 20, color: colors.ink },
  goneText: { maxWidth: 320, marginTop: 6, textAlign: 'center', fontFamily: fonts.body, fontSize: 14, lineHeight: 21, color: colors.secondary },
  hero: { gap: 6 },
  eyebrowRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  eyebrow: { fontFamily: fonts.bodySemiBold, fontSize: 12, color: colors.accent },
  title: { fontFamily: fonts.bodyBold, fontSize: 27, lineHeight: 33, letterSpacing: -0.6, color: colors.ink },
  support: { fontFamily: fonts.body, fontSize: 14, lineHeight: 20, color: colors.secondary },
  transcript: { marginTop: 20, padding: 14, borderRadius: radius.md, backgroundColor: colors.background },
  transcriptHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  micro: { fontFamily: fonts.bodySemiBold, fontSize: 12, color: colors.secondary },
  transcriptText: { marginTop: 6, fontFamily: fonts.body, fontSize: 14, lineHeight: 21, color: colors.ink },
  listHead: { marginTop: 24, flexDirection: 'row', alignItems: 'baseline', gap: 10 },
  listTitle: { fontFamily: fonts.bodySemiBold, fontSize: 17, color: colors.ink },
  listSummary: { flex: 1, textAlign: 'right', fontFamily: fonts.body, fontSize: 12, color: colors.secondary },
  list: { marginTop: 12, gap: 10 },
  card: { padding: 14, gap: 10, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
  cardInvalid: { borderColor: colors.danger },
  cardHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  kind: { minHeight: 32, paddingHorizontal: 10, flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: radius.full },
  kindText: { fontFamily: fonts.bodySemiBold, fontSize: 12 },
  remove: { width: 40, height: 40, marginRight: -8, alignItems: 'center', justifyContent: 'center' },
  typeChoices: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 },
  typeChoice: { minHeight: 36, paddingHorizontal: 11, flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: radius.full, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.paper },
  typeChoiceActive: { backgroundColor: colors.ink, borderColor: colors.ink },
  typeChoiceText: { fontFamily: fonts.bodyMedium, fontSize: 12, color: colors.ink },
  typeChoiceTextActive: { color: colors.paper },
  titleInput: { minHeight: 44, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: colors.border, fontFamily: fonts.bodySemiBold, fontSize: 16, color: colors.ink },
  detailInput: { minHeight: 36, paddingVertical: 6, fontFamily: fonts.body, fontSize: 13, lineHeight: 19, color: colors.secondary, textAlignVertical: 'top' },
  meta: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  metaText: { flex: 1, fontFamily: fonts.body, fontSize: 12, lineHeight: 17, color: colors.secondary },
  field: { gap: 6 },
  fieldLabel: { fontFamily: fonts.bodySemiBold, fontSize: 12, color: colors.ink },
  inputShell: { minHeight: 46, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: radius.sm, borderWidth: 1, borderColor: colors.borderStrong },
  inputShellMissing: { borderColor: colors.danger },
  currency: { fontFamily: fonts.bodyBold, fontSize: 15, color: colors.secondary },
  moneyInput: { flex: 1, minWidth: 0, minHeight: 44, fontFamily: fonts.bodyMedium, fontSize: 15, fontVariant: ['tabular-nums'], color: colors.ink },
  amountPreview: { fontFamily: fonts.body, fontSize: 12, fontVariant: ['tabular-nums'], color: colors.secondary },
  investmentRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  assetToggle: { padding: 3, flexDirection: 'row', borderRadius: radius.sm, backgroundColor: colors.border },
  assetOption: { minWidth: 50, minHeight: 40, alignItems: 'center', justifyContent: 'center', borderRadius: 6 },
  assetActive: { backgroundColor: colors.paper },
  assetText: { fontFamily: fonts.bodySemiBold, fontSize: 12, color: colors.secondary },
  assetTextActive: { color: colors.ink },
  quantityShell: { flex: 1 },
  issue: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  issueText: { flex: 1, fontFamily: fonts.bodyMedium, fontSize: 12, color: colors.danger },
  allRemoved: { padding: 18, alignItems: 'center', borderRadius: radius.lg, borderWidth: 1, borderStyle: 'dashed', borderColor: colors.borderStrong },
  allRemovedTitle: { fontFamily: fonts.bodySemiBold, fontSize: 14, color: colors.ink },
  allRemovedText: { marginTop: 4, textAlign: 'center', fontFamily: fonts.body, fontSize: 12, lineHeight: 18, color: colors.secondary },
  error: { marginTop: 14, padding: 12, flexDirection: 'row', alignItems: 'flex-start', gap: 8, borderRadius: radius.md, backgroundColor: colors.dangerSoft },
  errorText: { flex: 1, fontFamily: fonts.bodyMedium, fontSize: 12, lineHeight: 18, color: colors.ink },
  confirm: { minHeight: 54, marginTop: 20, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderRadius: radius.md, backgroundColor: colors.ink },
  confirmText: { fontFamily: fonts.bodySemiBold, fontSize: 15, color: colors.paper },
  discard: { minHeight: 48, alignItems: 'center', justifyContent: 'center' },
  discardText: { fontFamily: fonts.bodySemiBold, fontSize: 13, color: colors.danger },
  disabled: { opacity: 0.45 },
  pressed: { opacity: 0.72 },
}));
