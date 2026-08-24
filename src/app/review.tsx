import { Feather } from '@expo/vector-icons';
import * as FileSystem from 'expo-file-system/legacy';
import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { AppScreen } from '@/components/AppScreen';
import { PixelCat } from '@/components/PixelCat';
import { ScreenHeader } from '@/components/ScreenHeader';
import { colors, fonts } from '@/constants/theme';
import { useItems } from '@/store/ItemsContext';
import { OrganizedItemInput, SuggestionKind } from '@/types';
import { confirmAction } from '@/utils/confirm-action';
import { formatPeso, parsePesoToMinor } from '@/utils/money';

const kinds: SuggestionKind[] = ['task', 'reminder', 'project', 'expense', 'income', 'investment', 'idea', 'note'];
const labels: Record<SuggestionKind, string> = { task: 'TASK', reminder: 'REMINDER', project: 'PROJECT', expense: 'EXPENSE', income: 'INCOME', investment: 'INVESTMENT', idea: 'IDEA', note: 'NOTE' };

export default function ReviewScreen() {
  const router = useRouter();
  const { pendingOrganizedDump, pendingRecording, confirmOrganizedDump, setPendingOrganizedDump, setPendingRecording } = useItems();
  const [items, setItems] = useState<OrganizedItemInput[]>(pendingOrganizedDump?.items ?? []);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const invalidCount = useMemo(() => items.filter((item) => {
    if (!item.title.trim()) return true;
    if (item.category === 'income' || item.category === 'expense') return (item.amountMinor ?? 0) <= 0;
    if (item.category === 'investment') return !item.asset || (item.amountMinor ?? 0) <= 0 || !item.quantity || Number(item.quantity) <= 0;
    return false;
  }).length, [items]);

  if (!pendingOrganizedDump || !pendingRecording) return <AppScreen><ScreenHeader back /><Text style={styles.empty}>There is no recording waiting for review.</Text></AppScreen>;

  const update = (index: number, next: Partial<OrganizedItemInput>) => setItems((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, ...next } : item));
  const cycleKind = (index: number) => {
    const current = items[index];
    update(index, { category: kinds[(kinds.indexOf(current.category) + 1) % kinds.length] });
  };
  const discard = () => confirmAction({ title: 'Discard this recording?', message: 'The original audio and all suggestions will be removed.', confirmLabel: 'Discard', cancelLabel: 'Keep reviewing', onConfirm: async () => {
      await FileSystem.deleteAsync(pendingRecording.uri, { idempotent: true }).catch(() => undefined);
      setPendingRecording(null);
      setPendingOrganizedDump(null);
      router.replace('/');
    } });
  const confirm = async () => {
    if (invalidCount) return setError('Complete the highlighted money or investment details before confirming.');
    setSaving(true);
    setError(null);
    try {
      await confirmOrganizedDump({ ...pendingOrganizedDump, items });
      router.replace('/results');
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'These suggestions could not be saved.');
      setSaving(false);
    }
  };

  return (
    <AppScreen background={colors.paper}>
      <ScreenHeader back onBack={discard} />
      <View style={styles.hero}><View style={styles.heroCopy}><Text style={styles.title}>CAT SORTED {items.length} THOUGHTS</Text><Text style={styles.support}>Check each destination before anything is saved.</Text></View><PixelCat pose="sorting" size={82} /></View>
      <View style={styles.transcript}><Text style={styles.micro}>TRANSCRIPT</Text><Text selectable style={styles.transcriptText}>{pendingOrganizedDump.transcript}</Text></View>
      <View style={styles.list}>
        {items.map((item, index) => {
          const invalid = !item.title.trim() || ((item.category === 'income' || item.category === 'expense' || item.category === 'investment') && (item.amountMinor ?? 0) <= 0) || (item.category === 'investment' && (!item.asset || !item.quantity || Number(item.quantity) <= 0));
          return (
            <View key={`${index}-${item.category}`} style={[styles.card, invalid && styles.cardInvalid]}>
              <View style={styles.cardHead}>
                <Pressable accessibilityRole="button" onPress={() => cycleKind(index)} style={styles.kind}><Text style={styles.kindText}>{labels[item.category]}</Text><Feather name="repeat" size={13} color={colors.accent} /></Pressable>
                <Pressable accessibilityLabel={`Remove ${item.title}`} onPress={() => setItems((current) => current.filter((_, itemIndex) => itemIndex !== index))} style={styles.remove}><Feather name="x" size={18} color={colors.secondary} /></Pressable>
              </View>
              <TextInput accessibilityLabel={`${labels[item.category]} title`} value={item.title} onChangeText={(title) => update(index, { title })} style={styles.input} />
              {(item.category === 'income' || item.category === 'expense' || item.category === 'investment') ? <View style={styles.moneyRow}>
                <Text style={styles.currency}>₱</Text><TextInput accessibilityLabel="Amount in Philippine pesos" keyboardType="decimal-pad" defaultValue={item.amountMinor ? (item.amountMinor / 100).toFixed(2) : ''} onChangeText={(value) => update(index, { amountMinor: parsePesoToMinor(value) })} placeholder="0.00" placeholderTextColor={colors.muted} style={styles.moneyInput} />
                {item.amountMinor ? <Text style={styles.amountPreview}>{formatPeso(item.amountMinor)}</Text> : null}
              </View> : null}
              {item.category === 'investment' ? <View style={styles.investmentRow}>
                <Pressable onPress={() => update(index, { asset: item.asset === 'BTC' ? 'VOO' : 'BTC' })} style={styles.asset}><Text style={styles.assetText}>{item.asset ?? 'CHOOSE ASSET'}</Text></Pressable>
                <TextInput accessibilityLabel="Asset quantity" keyboardType="decimal-pad" value={item.quantity ?? ''} onChangeText={(quantity) => update(index, { quantity })} placeholder="Quantity" placeholderTextColor={colors.muted} style={styles.quantity} />
              </View> : null}
            </View>
          );
        })}
      </View>
      {error ? <Text selectable style={styles.error}>{error}</Text> : null}
      <Pressable accessibilityRole="button" disabled={saving || !items.length} onPress={confirm} style={({ pressed }) => [styles.confirm, (saving || !items.length) && styles.disabled, pressed && styles.pressed]}><Text style={styles.confirmText}>{saving ? 'SAVING...' : `CONFIRM ${items.length}`}</Text></Pressable>
      <Pressable accessibilityRole="button" onPress={discard} style={styles.discard}><Text style={styles.discardText}>DISCARD RECORDING</Text></Pressable>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  empty: { paddingTop: 80, textAlign: 'center', fontFamily: fonts.body, color: colors.secondary },
  hero: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  heroCopy: { flex: 1 },
  title: { fontFamily: fonts.pixelBold, fontSize: 26, lineHeight: 29, color: colors.ink },
  support: { marginTop: 7, fontFamily: fonts.body, fontSize: 13, lineHeight: 19, color: colors.secondary },
  transcript: { marginTop: 18, padding: 15, borderWidth: 1, borderColor: colors.borderStrong, borderRadius: 6, backgroundColor: colors.background },
  micro: { fontFamily: fonts.pixelSemiBold, fontSize: 11, letterSpacing: 0.8, color: colors.secondary },
  transcriptText: { marginTop: 8, fontFamily: fonts.body, fontSize: 13, lineHeight: 19, color: colors.ink },
  list: { marginTop: 12, gap: 8 },
  card: { padding: 12, borderWidth: 1, borderColor: colors.border, borderRadius: 6, backgroundColor: colors.surface },
  cardInvalid: { borderColor: colors.danger },
  cardHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  kind: { minHeight: 32, flexDirection: 'row', alignItems: 'center', gap: 6 },
  kindText: { fontFamily: fonts.pixelSemiBold, fontSize: 12, color: colors.accent },
  remove: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  input: { height: 44, borderBottomWidth: 1, borderBottomColor: colors.borderStrong, fontFamily: fonts.bodyMedium, fontSize: 15, color: colors.ink },
  moneyRow: { minHeight: 46, flexDirection: 'row', alignItems: 'center', gap: 6 },
  currency: { fontFamily: fonts.bodyBold, fontSize: 16, color: colors.ink },
  moneyInput: { minWidth: 100, height: 44, fontFamily: fonts.bodyMedium, fontSize: 15, color: colors.ink },
  amountPreview: { marginLeft: 'auto', fontFamily: fonts.body, fontSize: 12, color: colors.secondary },
  investmentRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  asset: { minWidth: 82, minHeight: 42, borderWidth: 1, borderColor: colors.ink, alignItems: 'center', justifyContent: 'center' },
  assetText: { fontFamily: fonts.pixelSemiBold, fontSize: 11, color: colors.ink },
  quantity: { flex: 1, height: 44, borderBottomWidth: 1, borderBottomColor: colors.borderStrong, fontFamily: fonts.body, color: colors.ink },
  error: { marginTop: 12, fontFamily: fonts.bodyMedium, fontSize: 12, lineHeight: 18, color: colors.danger },
  confirm: { height: 56, marginTop: 20, alignItems: 'center', justifyContent: 'center', borderRadius: 4, backgroundColor: colors.ink },
  confirmText: { fontFamily: fonts.pixelSemiBold, fontSize: 16, color: colors.surface },
  discard: { minHeight: 48, alignItems: 'center', justifyContent: 'center' },
  discardText: { fontFamily: fonts.pixelSemiBold, fontSize: 11, color: colors.secondary },
  disabled: { opacity: 0.45 },
  pressed: { transform: [{ scale: 0.985 }] },
});
