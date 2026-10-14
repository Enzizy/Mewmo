import { Feather } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';
import { AppScreen } from '@/components/AppScreen';
import { useAppDialog } from '@/components/AppDialog';
import { useAppToast } from '@/components/AppToast';
import { CardFace } from '@/components/CardFace';
import { ScreenHeader } from '@/components/ScreenHeader';
import { colors, fonts, radius, themedStyles } from '@/constants/theme';
import { CardForm } from '@/features/wallet/card-form';
import { availableCreditMinor, creditUtilization, daysUntil, expiryStatus, formatExpiry, networkLabel, nextDueDate } from '@/features/wallet/cards';
import { useItems } from '@/store/ItemsContext';
import { useTheme } from '@/store/ThemeContext';
import { confirmAction } from '@/utils/confirm-action';
import { updatedAgoLabel } from '@/utils/date';
import { formatPeso, parsePesoToMinor } from '@/utils/money';

export default function CardDetailScreen() {
  useTheme();
  const router = useRouter();
  const { showDialog } = useAppDialog();
  const { showToast } = useAppToast();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { cards, homePreferences, updateCardBalance, deleteCard } = useItems();
  const card = cards.find((candidate) => candidate.id === id);
  const [editing, setEditing] = useState(false);
  const [balance, setBalance] = useState(card ? (card.balanceMinor / 100).toFixed(2) : '');
  const [saving, setSaving] = useState(false);
  // Follow the stored balance when it changes from elsewhere, such as the edit form.
  useEffect(() => { if (card) setBalance((card.balanceMinor / 100).toFixed(2)); }, [card?.balanceMinor]);

  if (!card) return <AppScreen><ScreenHeader back /><View style={styles.missing}><Text style={styles.missingTitle}>Card not found</Text><Text style={styles.missingText}>It may have been deleted.</Text></View></AppScreen>;

  const credit = card.kind === 'credit';
  const hidden = !homePreferences.balancesVisible;
  const peso = (minor: number) => hidden ? '••••' : formatPeso(minor);
  const parsed = parsePesoToMinor(balance);
  const changed = parsed != null && parsed !== card.balanceMinor;
  const used = creditUtilization(card);
  const available = availableCreditMinor(card);
  const due = nextDueDate(card.dueDay);
  const statement = nextDueDate(card.statementDay);
  const expiry = formatExpiry(card.expiryMonth, card.expiryYear);
  const status = expiryStatus(card);

  const saveBalance = async () => {
    if (parsed == null) return showDialog({ title: 'Check the amount', message: 'Enter the balance in pesos, like 1250.50.', tone: 'warning' });
    setSaving(true);
    const previous = card.balanceMinor;
    try {
      await updateCardBalance(card.id, parsed);
      showToast({ message: `${card.name} balance updated`, icon: 'check', action: { label: 'Undo', onPress: () => updateCardBalance(card.id, previous).catch(() => undefined) } });
    } catch (error) {
      showDialog({ title: 'Could not update balance', message: error instanceof Error ? error.message : 'Try again.', tone: 'danger' });
    } finally { setSaving(false); }
  };
  const remove = () => showDialog(confirmAction({ title: `Delete ${card.name}?`, message: 'The card and its saved balance will be removed from LifeDesk. Your wallet records are not affected.', confirmLabel: 'Delete card', onConfirm: async () => {
    await deleteCard(card.id);
    router.canGoBack() ? router.back() : router.replace('/wallet/cards');
  } }));

  return (
    <AppScreen assistant={!editing}>
      <ScreenHeader back title={editing ? 'Edit card' : undefined} action={editing ? undefined : <Pressable accessibilityRole="button" accessibilityLabel="Edit card details" onPress={() => setEditing(true)} style={styles.headerButton}><Feather name="edit-3" size={19} color={colors.ink} /></Pressable>} />
      {editing ? <CardForm editing={card} onCancel={() => setEditing(false)} onDone={() => { setEditing(false); showToast({ message: 'Card saved', icon: 'check' }); }} /> : <>
        <CardFace card={card} balanceHidden={hidden} />

        <View style={styles.panel}>
          <Text style={styles.panelTitle}>{credit ? 'Update amount owed' : 'Update balance'}</Text>
          <Text style={styles.panelDetail}>Last updated {updatedAgoLabel(card.balanceUpdatedAt)}. Check your bank app, then enter the current amount.</Text>
          <View style={styles.balanceRow}>
            <View style={styles.inputShell}><Text style={styles.prefix}>₱</Text><TextInput accessibilityLabel={credit ? 'Amount owed in pesos' : 'Balance in pesos'} keyboardType="decimal-pad" value={balance} onChangeText={setBalance} onSubmitEditing={() => { if (changed) void saveBalance(); }} selectTextOnFocus placeholder="0.00" placeholderTextColor={colors.muted} style={styles.input} /></View>
            <Pressable accessibilityRole="button" accessibilityState={{ disabled: !changed || saving }} disabled={!changed || saving} onPress={saveBalance} style={({ pressed }) => [styles.save, (!changed || saving) && styles.saveIdle, pressed && styles.pressed]}><Text style={[styles.saveText, (!changed || saving) && styles.saveTextIdle]}>{saving ? 'Saving…' : 'Save'}</Text></Pressable>
          </View>
        </View>

        {credit ? <View style={styles.section}>
          <Text style={styles.sectionTitle}>Credit</Text>
          {used != null ? <View style={styles.usage}>
            <View style={styles.usageHead}><Text style={styles.usageLabel}>{Math.round(used * 100)}% of limit used</Text><Text style={[styles.usageLabel, available != null && available < 0 && styles.danger]}>{available == null ? '' : available < 0 ? `Over by ${peso(-available)}` : `${peso(available)} left`}</Text></View>
            <View style={styles.track}><View style={[styles.fill, { width: `${Math.min(used, 1) * 100}%` }, used > 0.9 ? styles.fillHigh : used > 0.6 ? styles.fillMedium : null]} /></View>
            {used > 0.3 && used <= 1 ? <Text style={styles.usageHint}>Keeping usage under 30% of your limit is generally better for your credit standing.</Text> : null}
          </View> : null}
          <View style={styles.rows}>
            <Row icon="trending-up" label="Credit limit" value={card.creditLimitMinor != null ? peso(card.creditLimitMinor) : 'Not set'} />
            <Row icon="calendar" label="Payment due" value={due ? `${new Intl.DateTimeFormat('en-PH', { month: 'short', day: 'numeric' }).format(due)} · ${daysUntil(due) === 0 ? 'today' : `in ${daysUntil(due)} ${daysUntil(due) === 1 ? 'day' : 'days'}`}` : 'Not set'} tone={due && card.balanceMinor > 0 && daysUntil(due) <= 3 ? 'danger' : undefined} />
            <Row icon="file-text" label="Statement closes" value={statement ? new Intl.DateTimeFormat('en-PH', { month: 'short', day: 'numeric' }).format(statement) : 'Not set'} />
          </View>
        </View> : null}

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Card details</Text>
          <View style={styles.rows}>
            <Row icon="briefcase" label="Bank" value={card.issuer ?? 'Not set'} />
            <Row icon="credit-card" label="Type" value={`${credit ? 'Credit' : 'Debit'}${networkLabel(card.network) ? ` · ${networkLabel(card.network)}` : ''}`} />
            <Row icon="hash" label="Card number" value={card.last4 ? `•••• •••• •••• ${card.last4}` : 'Not set'} />
            <Row icon="clock" label="Expires" value={expiry ? `${expiry}${status === 'expired' ? ' · Expired' : status === 'soon' ? ' · Expiring soon' : ''}` : 'Not set'} tone={status === 'expired' ? 'danger' : status === 'soon' ? 'warning' : undefined} />
            {card.note ? <Row icon="edit-2" label="Note" value={card.note} /> : null}
          </View>
        </View>

        <View style={styles.actions}>
          <Pressable accessibilityRole="button" onPress={() => setEditing(true)} style={({ pressed }) => [styles.action, pressed && styles.pressed]}><Feather name="edit-3" size={16} color={colors.ink} /><Text style={styles.actionText}>Edit details</Text></Pressable>
          <Pressable accessibilityRole="button" onPress={remove} style={({ pressed }) => [styles.action, pressed && styles.pressed]}><Feather name="trash-2" size={16} color={colors.danger} /><Text style={[styles.actionText, styles.danger]}>Delete card</Text></Pressable>
        </View>
      </>}
    </AppScreen>
  );
}

function Row({ icon, label, value, tone }: { icon: keyof typeof Feather.glyphMap; label: string; value: string; tone?: 'danger' | 'warning' }) {
  return <View style={styles.row}><Feather name={icon} size={16} color={colors.secondary} /><Text style={styles.rowLabel}>{label}</Text><Text style={[styles.rowValue, tone === 'danger' && styles.danger, tone === 'warning' && styles.warning]}>{value}</Text></View>;
}

const styles = themedStyles(() => ({
  headerButton: { width: 44, height: 44, marginRight: -8, alignItems: 'center', justifyContent: 'center' },
  missing: { alignItems: 'center', paddingTop: 80 },
  missingTitle: { fontFamily: fonts.bodyBold, fontSize: 22, color: colors.ink },
  missingText: { marginTop: 6, fontFamily: fonts.body, fontSize: 14, color: colors.secondary },
  panel: { marginTop: 22, padding: 16, gap: 6, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.paper },
  panelTitle: { fontFamily: fonts.bodySemiBold, fontSize: 15, color: colors.ink },
  panelDetail: { fontFamily: fonts.body, fontSize: 12, lineHeight: 18, color: colors.secondary },
  balanceRow: { marginTop: 8, flexDirection: 'row', gap: 8 },
  inputShell: { flex: 1, minHeight: 50, paddingHorizontal: 13, flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: radius.sm, borderWidth: 1, borderColor: colors.borderStrong },
  prefix: { fontFamily: fonts.bodySemiBold, fontSize: 16, color: colors.secondary },
  input: { flex: 1, minWidth: 0, minHeight: 48, fontFamily: fonts.bodySemiBold, fontSize: 17, fontVariant: ['tabular-nums'], color: colors.ink, outlineStyle: 'none' } as never,
  save: { minWidth: 84, minHeight: 50, paddingHorizontal: 16, alignItems: 'center', justifyContent: 'center', borderRadius: radius.sm, backgroundColor: colors.ink },
  saveIdle: { backgroundColor: colors.border },
  saveText: { fontFamily: fonts.bodySemiBold, fontSize: 14, color: colors.paper },
  saveTextIdle: { color: colors.muted },
  section: { marginTop: 28 },
  sectionTitle: { marginBottom: 10, fontFamily: fonts.bodySemiBold, fontSize: 17, color: colors.ink },
  usage: { marginBottom: 6, gap: 8 },
  usageHead: { flexDirection: 'row', justifyContent: 'space-between', gap: 10 },
  usageLabel: { fontFamily: fonts.bodyMedium, fontSize: 13, fontVariant: ['tabular-nums'], color: colors.ink },
  usageHint: { fontFamily: fonts.body, fontSize: 11, lineHeight: 16, color: colors.secondary },
  track: { height: 8, overflow: 'hidden', borderRadius: 4, backgroundColor: colors.border },
  fill: { height: '100%', borderRadius: 4, backgroundColor: colors.green },
  fillMedium: { backgroundColor: colors.mustard },
  fillHigh: { backgroundColor: colors.danger },
  rows: { borderTopWidth: 1, borderTopColor: colors.border },
  row: { minHeight: 52, flexDirection: 'row', alignItems: 'center', gap: 12, borderBottomWidth: 1, borderBottomColor: colors.border },
  rowLabel: { width: 118, fontFamily: fonts.body, fontSize: 13, color: colors.secondary },
  rowValue: { flex: 1, textAlign: 'right', fontFamily: fonts.bodyMedium, fontSize: 13, fontVariant: ['tabular-nums'], color: colors.ink },
  danger: { color: colors.danger },
  warning: { color: colors.mustard },
  actions: { marginTop: 24, flexDirection: 'row', gap: 10 },
  action: { flex: 1, minHeight: 48, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.paper },
  actionText: { fontFamily: fonts.bodySemiBold, fontSize: 13, color: colors.ink },
  pressed: { opacity: 0.72 },
}));
