import { Feather } from '@expo/vector-icons';
import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { useAppDialog } from '@/components/AppDialog';
import { CardFace } from '@/components/CardFace';
import { colors, fonts, radius, themedStyles } from '@/constants/theme';
import { CARD_COLORS, CARD_NETWORKS, CardColor, formatExpiry, normalizeLast4, parseExpiry } from '@/features/wallet/cards';
import { ChoiceGroup, Field, FormCard, SubmitButton } from '@/features/wallet/finance-forms';
import { useItems } from '@/store/ItemsContext';
import { useTheme } from '@/store/ThemeContext';
import { PaymentCard, PaymentCardKind, PaymentCardNetwork } from '@/types';
import { parsePesoToMinor } from '@/utils/money';

type NetworkChoice = PaymentCardNetwork | 'none';

export function CardForm({ editing, initialKind = 'debit', onDone, onCancel }: { editing?: PaymentCard; initialKind?: PaymentCardKind; onDone: (card: PaymentCard) => void; onCancel: () => void }) {
  useTheme();
  const { saveCard } = useItems();
  const { showDialog } = useAppDialog();
  const [kind, setKind] = useState<PaymentCardKind>(editing?.kind ?? initialKind);
  const [name, setName] = useState(editing?.name ?? '');
  const [issuer, setIssuer] = useState(editing?.issuer ?? '');
  const [network, setNetwork] = useState<NetworkChoice>(editing?.network ?? 'none');
  const [last4, setLast4] = useState(editing?.last4 ?? '');
  const [expiry, setExpiry] = useState(formatExpiry(editing?.expiryMonth, editing?.expiryYear) ?? '');
  const [color, setColor] = useState<CardColor>((editing?.color as CardColor) ?? (initialKind === 'credit' ? 'midnight' : 'ocean'));
  const [balance, setBalance] = useState(editing ? String(editing.balanceMinor / 100) : '');
  const [limit, setLimit] = useState(editing?.creditLimitMinor != null ? String(editing.creditLimitMinor / 100) : '');
  const [dueDay, setDueDay] = useState(editing?.dueDay ? String(editing.dueDay) : '');
  const [statementDay, setStatementDay] = useState(editing?.statementDay ? String(editing.statementDay) : '');
  const [note, setNote] = useState(editing?.note ?? '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const credit = kind === 'credit';
  const parsedExpiry = parseExpiry(expiry);

  const save = async () => {
    const balanceMinor = balance.trim() ? parsePesoToMinor(balance) : 0;
    const creditLimitMinor = credit && limit.trim() ? parsePesoToMinor(limit) : undefined;
    const due = dayOfMonth(dueDay);
    const statement = dayOfMonth(statementDay);
    const problems = [
      !name.trim() && 'Give the card a name.',
      balanceMinor == null && `Enter the ${credit ? 'amount owed' : 'balance'} in pesos, like 1250.50.`,
      creditLimitMinor === null && 'Enter the credit limit in pesos, or leave it blank.',
      last4 && last4.length !== 4 && 'Enter exactly the last 4 digits, or leave them blank.',
      expiry.trim() && !parsedExpiry && 'Enter the expiry as MM/YY, like 08/29.',
      credit && due === null && 'The payment due day must be between 1 and 31.',
      credit && statement === null && 'The statement day must be between 1 and 31.',
    ].filter((problem): problem is string => Boolean(problem));
    if (problems.length) {
      setError(problems[0]);
      return;
    }
    setError(null);
    setSaving(true);
    try {
      const card = await saveCard({
        kind,
        name,
        issuer,
        network: network === 'none' ? undefined : network,
        last4: last4 || undefined,
        expiryMonth: parsedExpiry?.month,
        expiryYear: parsedExpiry?.year,
        color,
        balanceMinor: balanceMinor!,
        creditLimitMinor: creditLimitMinor ?? undefined,
        dueDay: due ?? undefined,
        statementDay: statement ?? undefined,
        note,
      }, editing?.id);
      onDone(card);
    } catch (caught) {
      setSaving(false);
      showDialog({ title: 'Could not save card', message: caught instanceof Error ? caught.message : 'Try again.', tone: 'danger' });
    }
  };

  return (
    <FormCard title={editing ? 'Edit card' : 'Add a card'} description="Track the balance and details of a card you own. This never connects to your bank." onClose={onCancel}>
      <CardFace card={{ kind, name: name.trim() || (credit ? 'Credit card' : 'Debit card'), issuer: issuer.trim() || undefined, network: network === 'none' ? undefined : network, last4: last4 || undefined, expiryMonth: parsedExpiry?.month, expiryYear: parsedExpiry?.year, color, balanceMinor: parsePesoToMinor(balance) ?? 0 }} />
      <ChoiceGroup label="Card type" value={kind} onChange={setKind} options={[{ value: 'debit', label: 'Debit' }, { value: 'credit', label: 'Credit' }]} />
      <Field label="Card name" value={name} onChangeText={setName} placeholder={credit ? 'Gold Rewards' : 'Payroll savings'} />
      <Field label="Bank or issuer" hint="Optional" value={issuer} onChangeText={setIssuer} placeholder="BPI, BDO, GCash…" />
      <View>
        <Text style={styles.label}>Network</Text>
        <View accessibilityRole="radiogroup" style={styles.chips}>{[{ value: 'none' as const, label: 'None' }, ...CARD_NETWORKS].map((option) => <Pressable accessibilityRole="radio" accessibilityState={{ checked: network === option.value }} key={option.value} onPress={() => setNetwork(option.value)} style={[styles.chip, network === option.value && styles.chipActive]}><Text style={[styles.chipText, network === option.value && styles.chipTextActive]}>{option.label}</Text></Pressable>)}</View>
      </View>
      <View style={styles.row}>
        <View style={styles.cell}><Field label="Last 4 digits" hint="Optional" value={last4} onChangeText={(value) => setLast4(normalizeLast4(value))} keyboardType="number-pad" maxLength={4} placeholder="4821" /></View>
        <View style={styles.cell}><Field label="Expires" hint="MM/YY" value={expiry} onChangeText={(value) => setExpiry(formatExpiryInput(value))} keyboardType="number-pad" maxLength={5} placeholder="08/29" /></View>
      </View>
      <View style={styles.security}><Feather name="lock" size={14} color={colors.green} /><Text style={styles.securityText}>Only the last 4 digits are stored. Never enter your full card number or security code (CVV).</Text></View>
      <Field label={credit ? 'Amount owed' : 'Available balance'} hint={credit ? 'Your current outstanding balance' : 'Money on this card right now'} value={balance} onChangeText={setBalance} keyboardType="decimal-pad" placeholder="0.00" prefix="₱" />
      {credit ? <>
        <Field label="Credit limit" hint="Optional" value={limit} onChangeText={setLimit} keyboardType="decimal-pad" placeholder="50000.00" prefix="₱" />
        <View style={styles.row}>
          <View style={styles.cell}><Field label="Payment due" hint="Day 1–31" value={dueDay} onChangeText={(value) => setDueDay(value.replace(/\D/g, '').slice(0, 2))} keyboardType="number-pad" maxLength={2} placeholder="28" /></View>
          <View style={styles.cell}><Field label="Statement closes" hint="Day 1–31" value={statementDay} onChangeText={(value) => setStatementDay(value.replace(/\D/g, '').slice(0, 2))} keyboardType="number-pad" maxLength={2} placeholder="5" /></View>
        </View>
      </> : null}
      <View>
        <Text style={styles.label}>Card color</Text>
        <View accessibilityRole="radiogroup" style={styles.swatches}>{(Object.keys(CARD_COLORS) as CardColor[]).map((key) => <Pressable accessibilityRole="radio" accessibilityLabel={`${key} color`} accessibilityState={{ checked: color === key }} key={key} onPress={() => setColor(key)} style={[styles.swatch, { backgroundColor: CARD_COLORS[key] }, color === key && styles.swatchActive]}>{color === key ? <Feather name="check" size={16} color="#FFFFFF" /> : null}</Pressable>)}</View>
      </View>
      <Field label="Note" hint="Optional" value={note} onChangeText={setNote} placeholder="Annual fee waived, used for groceries…" />
      {error ? <View accessibilityRole="alert" style={styles.error}><Feather name="alert-circle" size={16} color={colors.danger} /><Text style={styles.errorText}>{error}</Text></View> : null}
      <SubmitButton label={saving ? 'Saving…' : editing ? 'Save card' : 'Add card'} disabled={saving} onPress={save} />
    </FormCard>
  );
}

/** Blank is allowed (undefined); anything else must be a real day of the month or it is invalid (null). */
function dayOfMonth(value: string) {
  if (!value.trim()) return undefined;
  const day = Number(value);
  return Number.isInteger(day) && day >= 1 && day <= 31 ? day : null;
}

/** Adds the slash as you type "0829" so the field reads 08/29. */
function formatExpiryInput(value: string) {
  const digits = value.replace(/\D/g, '').slice(0, 4);
  return digits.length > 2 ? `${digits.slice(0, 2)}/${digits.slice(2)}` : digits;
}

const styles = themedStyles(() => ({
  row: { flexDirection: 'row', gap: 10 },
  cell: { flex: 1, minWidth: 0 },
  label: { marginBottom: 8, fontFamily: fonts.bodySemiBold, fontSize: 12, color: colors.ink },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 },
  chip: { minHeight: 38, paddingHorizontal: 13, alignItems: 'center', justifyContent: 'center', borderRadius: radius.full, borderWidth: 1, borderColor: colors.borderStrong },
  chipActive: { borderColor: colors.ink, backgroundColor: colors.ink },
  chipText: { fontFamily: fonts.bodyMedium, fontSize: 12, color: colors.secondary },
  chipTextActive: { color: colors.paper },
  swatches: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  swatch: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center', borderWidth: 3, borderColor: 'transparent' },
  swatchActive: { borderColor: colors.accent },
  security: { padding: 11, flexDirection: 'row', alignItems: 'flex-start', gap: 8, borderRadius: radius.sm, backgroundColor: colors.greenSoft },
  securityText: { flex: 1, fontFamily: fonts.body, fontSize: 12, lineHeight: 17, color: colors.ink },
  error: { padding: 11, flexDirection: 'row', alignItems: 'flex-start', gap: 8, borderRadius: radius.sm, backgroundColor: colors.dangerSoft },
  errorText: { flex: 1, fontFamily: fonts.bodyMedium, fontSize: 12, lineHeight: 17, color: colors.ink },
}));
