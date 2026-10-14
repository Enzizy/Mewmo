import { Feather } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { AppScreen } from '@/components/AppScreen';
import { useAppToast } from '@/components/AppToast';
import { CardFace } from '@/components/CardFace';
import { PageHeader } from '@/components/page-header';
import { ScreenHeader } from '@/components/ScreenHeader';
import { SectionHeading } from '@/components/section-heading';
import { colors, fonts, radius, themedStyles } from '@/constants/theme';
import { CardForm } from '@/features/wallet/card-form';
import { availableCreditMinor, creditUtilization, daysUntil, nextDueDate, summarizeCards, upcomingCardPayments } from '@/features/wallet/cards';
import { useItems } from '@/store/ItemsContext';
import { useTheme } from '@/store/ThemeContext';
import { PaymentCard, PaymentCardKind } from '@/types';
import { formatPeso } from '@/utils/money';

export default function CardsScreen() {
  useTheme();
  const router = useRouter();
  const { showToast } = useAppToast();
  const params = useLocalSearchParams<{ action?: string; kind?: string }>();
  const { cards, homePreferences, hydrated, reload } = useItems();
  const [adding, setAdding] = useState<PaymentCardKind | null>(params.action === 'add' ? (params.kind === 'credit' ? 'credit' : 'debit') : null);
  useEffect(() => { if (params.action === 'add') setAdding(params.kind === 'credit' ? 'credit' : 'debit'); }, [params.action, params.kind]);
  const totals = useMemo(() => summarizeCards(cards), [cards]);
  const nextPayment = useMemo(() => upcomingCardPayments(cards).find((entry) => entry.due), [cards]);
  const debit = cards.filter((card) => card.kind === 'debit');
  const credit = cards.filter((card) => card.kind === 'credit');
  const hidden = !homePreferences.balancesVisible;
  const peso = (minor: number) => hidden ? '••••' : formatPeso(minor);
  const open = (card: PaymentCard) => router.push({ pathname: '/wallet/card/[id]', params: { id: card.id } });

  return (
    <AppScreen assistant={!adding} onRefresh={reload}>
      <ScreenHeader back />
      <PageHeader title="Cards" supporting="Balances and details for every card you carry." action={adding ? undefined : <Pressable accessibilityRole="button" accessibilityLabel="Add a card" onPress={() => setAdding('debit')} style={({ pressed }) => [styles.addButton, pressed && styles.pressed]}><Feather name="plus" size={17} color={colors.paper} /><Text style={styles.addButtonText}>Add card</Text></Pressable>} />

      {adding ? <View style={styles.form}><CardForm key={adding} initialKind={adding} onCancel={() => setAdding(null)} onDone={(card) => { setAdding(null); showToast({ message: `${card.name} added`, icon: 'credit-card' }); }} /></View> : null}

      {!hydrated ? <View style={styles.loading}><ActivityIndicator color={colors.ink} /><Text style={styles.loadingText}>Opening your cards…</Text></View> : cards.length ? <>
        <View style={styles.totals}>
          <Total icon="credit-card" tone="blue" label="On debit cards" value={peso(totals.debitBalanceMinor)} detail={`${totals.debitCount} ${totals.debitCount === 1 ? 'card' : 'cards'}`} />
          <Total icon="alert-circle" tone="red" label="Owed on credit" value={peso(totals.creditOwedMinor)} detail={totals.creditLimitMinor ? `${peso(totals.availableCreditMinor)} available` : `${totals.creditCount} ${totals.creditCount === 1 ? 'card' : 'cards'}`} />
        </View>

        {nextPayment?.due ? <Pressable accessibilityRole="button" onPress={() => open(nextPayment.card)} style={({ pressed }) => [styles.dueBanner, daysUntil(nextPayment.due!) <= 3 && styles.dueBannerUrgent, pressed && styles.pressed]}>
          <View style={styles.dueIcon}><Feather name="calendar" size={18} color={colors.paper} /></View>
          <View style={styles.main}><Text style={styles.dueTitle}>{dueText(nextPayment.due)}: {nextPayment.card.name}</Text><Text style={styles.dueDetail}>{peso(nextPayment.card.balanceMinor)} owed · {new Intl.DateTimeFormat('en-PH', { month: 'long', day: 'numeric' }).format(nextPayment.due)}</Text></View>
          <Feather name="chevron-right" size={18} color={colors.muted} />
        </Pressable> : null}

        <CardGroup title="Debit cards" detail={debit.length ? 'Money you can spend' : 'None added yet'} cards={debit} hidden={hidden} onOpen={open} onAdd={() => setAdding('debit')} addLabel="Add a debit card" />
        <CardGroup title="Credit cards" detail={credit.length ? 'What you owe and your limits' : 'None added yet'} cards={credit} hidden={hidden} onOpen={open} onAdd={() => setAdding('credit')} addLabel="Add a credit card" />
        <Text style={styles.footnote}>Card balances are updated by you and are kept apart from your wallet cash, so nothing is counted twice.</Text>
      </> : !adding ? <View style={styles.empty}>
        <View style={styles.emptyCards}><View style={[styles.emptyCard, styles.emptyCardBack]} /><View style={styles.emptyCard}><Feather name="credit-card" size={26} color="#FFFFFF" /></View></View>
        <Text style={styles.emptyTitle}>Keep all your cards in one place</Text>
        <Text style={styles.emptyText}>Add your debit and credit cards to see every balance, what you owe, your limits, and when payments are due.</Text>
        <View style={styles.emptyActions}>
          <Pressable accessibilityRole="button" onPress={() => setAdding('debit')} style={({ pressed }) => [styles.emptyPrimary, pressed && styles.pressed]}><Text style={styles.emptyPrimaryText}>Add debit card</Text></Pressable>
          <Pressable accessibilityRole="button" onPress={() => setAdding('credit')} style={({ pressed }) => [styles.emptySecondary, pressed && styles.pressed]}><Text style={styles.emptySecondaryText}>Add credit card</Text></Pressable>
        </View>
        <View style={styles.emptySecurity}><Feather name="lock" size={12} color={colors.muted} /><Text style={styles.emptySecurityText}>Stored only on this device. Only the last 4 digits are kept.</Text></View>
      </View> : null}
    </AppScreen>
  );
}

function CardGroup({ title, detail, cards, hidden, onOpen, onAdd, addLabel }: { title: string; detail: string; cards: PaymentCard[]; hidden: boolean; onOpen: (card: PaymentCard) => void; onAdd: () => void; addLabel: string }) {
  return <View style={styles.section}>
    <SectionHeading title={title} detail={detail} action={<Pressable accessibilityRole="button" accessibilityLabel={addLabel} onPress={onAdd} style={styles.textButton}><Feather name="plus" size={15} color={colors.accent} /><Text style={styles.textButtonLabel}>Add</Text></Pressable>} />
    <View style={styles.cardList}>{cards.map((card) => <Pressable accessibilityRole="button" accessibilityHint="Opens card details" key={card.id} onPress={() => onOpen(card)} style={({ pressed }) => [styles.cardItem, pressed && styles.cardPressed]}>
      <CardFace card={card} balanceHidden={hidden} />
      {card.kind === 'credit' ? <CreditMeta card={card} hidden={hidden} /> : null}
    </Pressable>)}</View>
  </View>;
}

function CreditMeta({ card, hidden }: { card: PaymentCard; hidden: boolean }) {
  const used = creditUtilization(card);
  const available = availableCreditMinor(card);
  const due = nextDueDate(card.dueDay);
  return <View style={styles.creditMeta}>
    {used != null ? <View style={styles.track}><View style={[styles.fill, { width: `${Math.min(used, 1) * 100}%` }, used > 0.9 ? styles.fillHigh : used > 0.6 ? styles.fillMedium : null]} /></View> : null}
    <View style={styles.creditRow}>
      <Text style={styles.creditText}>{available == null ? 'No limit set' : available < 0 ? `Over limit by ${hidden ? '••••' : formatPeso(-available)}` : `${hidden ? '••••' : formatPeso(available)} available`}</Text>
      {due && card.balanceMinor > 0 ? <Text style={[styles.creditText, daysUntil(due) <= 3 && styles.urgent]}>{dueText(due)}</Text> : null}
    </View>
  </View>;
}

function Total({ icon, tone, label, value, detail }: { icon: keyof typeof Feather.glyphMap; tone: 'blue' | 'red'; label: string; value: string; detail: string }) {
  return <View style={styles.total}><View style={[styles.totalIcon, tone === 'red' && styles.totalIconRed]}><Feather name={icon} size={16} color={tone === 'red' ? colors.danger : colors.accent} /></View><Text style={styles.totalLabel}>{label}</Text><Text numberOfLines={1} adjustsFontSizeToFit style={styles.totalValue}>{value}</Text><Text numberOfLines={1} style={styles.totalDetail}>{detail}</Text></View>;
}

function dueText(due: Date) {
  const days = daysUntil(due);
  return days === 0 ? 'Due today' : days === 1 ? 'Due tomorrow' : `Due in ${days} days`;
}

const styles = themedStyles(() => ({
  loading: { minHeight: 220, alignItems: 'center', justifyContent: 'center', gap: 12 },
  loadingText: { fontFamily: fonts.body, fontSize: 13, color: colors.secondary },
  addButton: { minHeight: 44, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', gap: 7, borderRadius: 22, backgroundColor: colors.ink },
  addButtonText: { fontFamily: fonts.bodySemiBold, fontSize: 12, color: colors.paper },
  form: { marginTop: 18 },
  totals: { marginTop: 20, flexDirection: 'row', gap: 10 },
  total: { flex: 1, minWidth: 0, padding: 14, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.paper },
  totalIcon: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.accentSoft },
  totalIconRed: { backgroundColor: colors.dangerSoft },
  totalLabel: { marginTop: 10, fontFamily: fonts.bodyMedium, fontSize: 12, color: colors.secondary },
  totalValue: { marginTop: 3, fontFamily: fonts.bodyBold, fontSize: 20, letterSpacing: -0.4, fontVariant: ['tabular-nums'], color: colors.ink },
  totalDetail: { marginTop: 2, fontFamily: fonts.body, fontSize: 11, color: colors.secondary },
  dueBanner: { marginTop: 12, padding: 14, flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: radius.md, backgroundColor: colors.accentSoft },
  dueBannerUrgent: { backgroundColor: colors.dangerSoft },
  dueIcon: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.ink },
  main: { flex: 1, minWidth: 0 },
  dueTitle: { fontFamily: fonts.bodySemiBold, fontSize: 14, color: colors.ink },
  dueDetail: { marginTop: 3, fontFamily: fonts.body, fontSize: 12, fontVariant: ['tabular-nums'], color: colors.secondary },
  section: { marginTop: 32 },
  textButton: { minHeight: 44, paddingHorizontal: 4, flexDirection: 'row', alignItems: 'center', gap: 4 },
  textButtonLabel: { fontFamily: fonts.bodySemiBold, fontSize: 13, color: colors.accent },
  cardList: { marginTop: 14, gap: 18 },
  cardItem: { gap: 10 },
  cardPressed: { opacity: 0.86, transform: [{ scale: 0.99 }] },
  creditMeta: { width: '100%', maxWidth: 440, alignSelf: 'center', gap: 7, paddingHorizontal: 2 },
  track: { height: 6, overflow: 'hidden', borderRadius: 3, backgroundColor: colors.border },
  fill: { height: '100%', borderRadius: 3, backgroundColor: colors.green },
  fillMedium: { backgroundColor: colors.mustard },
  fillHigh: { backgroundColor: colors.danger },
  creditRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 10 },
  creditText: { fontFamily: fonts.bodyMedium, fontSize: 12, fontVariant: ['tabular-nums'], color: colors.secondary },
  urgent: { fontFamily: fonts.bodySemiBold, color: colors.danger },
  footnote: { marginTop: 28, textAlign: 'center', fontFamily: fonts.body, fontSize: 11, lineHeight: 16, color: colors.muted },
  empty: { marginTop: 28, padding: 24, alignItems: 'center', borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.paper },
  emptyCards: { width: 150, height: 104, alignItems: 'center', justifyContent: 'center' },
  emptyCard: { position: 'absolute', width: 132, height: 84, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: '#1D4ED8', transform: [{ rotate: '-6deg' }] },
  emptyCardBack: { backgroundColor: '#17181C', transform: [{ rotate: '8deg' }, { translateX: 14 }, { translateY: -6 }] },
  emptyTitle: { marginTop: 16, textAlign: 'center', fontFamily: fonts.bodyBold, fontSize: 19, color: colors.ink },
  emptyText: { maxWidth: 340, marginTop: 6, textAlign: 'center', fontFamily: fonts.body, fontSize: 13, lineHeight: 19, color: colors.secondary },
  emptyActions: { marginTop: 18, flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 8 },
  emptyPrimary: { minHeight: 46, paddingHorizontal: 18, alignItems: 'center', justifyContent: 'center', borderRadius: radius.md, backgroundColor: colors.ink },
  emptyPrimaryText: { fontFamily: fonts.bodySemiBold, fontSize: 13, color: colors.paper },
  emptySecondary: { minHeight: 46, paddingHorizontal: 18, alignItems: 'center', justifyContent: 'center', borderRadius: radius.md, borderWidth: 1, borderColor: colors.borderStrong },
  emptySecondaryText: { fontFamily: fonts.bodySemiBold, fontSize: 13, color: colors.ink },
  emptySecurity: { marginTop: 16, flexDirection: 'row', alignItems: 'center', gap: 6 },
  emptySecurityText: { fontFamily: fonts.body, fontSize: 11, color: colors.muted },
  pressed: { opacity: 0.72 },
}));
