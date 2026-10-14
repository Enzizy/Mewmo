import { Text, View } from 'react-native';
import { fonts, themedStyles } from '@/constants/theme';
import { cardColor, expiryStatus, formatExpiry, networkLabel } from '@/features/wallet/cards';
import { useTheme } from '@/store/ThemeContext';
import { PaymentCard } from '@/types';
import { formatPeso } from '@/utils/money';

type CardFaceCard = Pick<PaymentCard, 'kind' | 'name' | 'issuer' | 'network' | 'last4' | 'expiryMonth' | 'expiryYear' | 'color' | 'balanceMinor'>;

// Card art sits on a fixed colored face, so its text colors are fixed too.
const onCard = { strong: '#FFFFFF', soft: 'rgba(255,255,255,0.74)', faint: 'rgba(255,255,255,0.12)', chip: 'rgba(255,255,255,0.18)' };

/** A card drawn like the physical one: bank, name, balance, last four digits, and expiry. */
export function CardFace({ card, compact = false, balanceHidden = false }: { card: CardFaceCard; compact?: boolean; balanceHidden?: boolean }) {
  useTheme();
  const expiry = formatExpiry(card.expiryMonth, card.expiryYear);
  const status = expiryStatus(card);
  const network = networkLabel(card.network);
  const balance = balanceHidden ? '••••••' : formatPeso(card.balanceMinor);
  const label = `${card.name}, ${card.kind} card${card.last4 ? ` ending in ${card.last4}` : ''}. ${card.kind === 'credit' ? 'Owed' : 'Balance'} ${balanceHidden ? 'hidden' : balance}.`;
  return (
    <View accessible accessibilityLabel={label} style={[styles.face, compact ? styles.compact : styles.full, { backgroundColor: cardColor(card) }]}>
      <View pointerEvents="none" style={[styles.ring, compact && styles.ringCompact]} />
      <View pointerEvents="none" style={[styles.ringInner, compact && styles.ringInnerCompact]} />
      <View style={styles.top}>
        <Text numberOfLines={1} style={[styles.issuer, compact && styles.issuerCompact]}>{card.issuer || 'Card'}</Text>
        <Text style={[styles.kind, compact && styles.kindCompact]}>{card.kind === 'credit' ? 'CREDIT' : 'DEBIT'}</Text>
      </View>
      <Text numberOfLines={1} style={[styles.name, compact && styles.nameCompact]}>{card.name}</Text>
      <View style={styles.spacer} />
      <Text style={[styles.balanceLabel, compact && styles.balanceLabelCompact]}>{card.kind === 'credit' ? 'Amount owed' : 'Available balance'}</Text>
      <Text numberOfLines={1} adjustsFontSizeToFit style={[styles.balance, compact && styles.balanceCompact]}>{balance}</Text>
      <View style={styles.bottom}>
        <Text style={[styles.digits, compact && styles.digitsCompact]}>{card.last4 ? `•••• ${card.last4}` : '•••• ••••'}</Text>
        {expiry && !compact ? <Text style={[styles.expiry, status === 'expired' && styles.expired]}>{status === 'expired' ? 'EXPIRED ' : ''}{expiry}</Text> : null}
        <View style={styles.grow} />
        {network ? <Text style={[styles.network, compact && styles.networkCompact]}>{network}</Text> : null}
      </View>
    </View>
  );
}

const styles = themedStyles(() => ({
  face: { overflow: 'hidden', borderRadius: 18, shadowColor: '#000000', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.16, shadowRadius: 20, elevation: 6 },
  full: { width: '100%', maxWidth: 440, aspectRatio: 1.586, padding: 20, alignSelf: 'center' },
  compact: { width: 232, height: 146, padding: 14, borderRadius: 14 },
  ring: { position: 'absolute', width: 300, height: 300, right: -120, top: -150, borderRadius: 150, borderWidth: 34, borderColor: onCard.faint },
  ringCompact: { width: 170, height: 170, right: -70, top: -88, borderRadius: 85, borderWidth: 20 },
  ringInner: { position: 'absolute', width: 180, height: 180, right: -40, bottom: -110, borderRadius: 90, backgroundColor: onCard.faint },
  ringInnerCompact: { width: 100, height: 100, right: -24, bottom: -64, borderRadius: 50 },
  top: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  issuer: { flex: 1, fontFamily: fonts.bodySemiBold, fontSize: 13, letterSpacing: 0.4, color: onCard.soft },
  issuerCompact: { fontSize: 11 },
  kind: { paddingHorizontal: 8, paddingVertical: 3, overflow: 'hidden', borderRadius: 6, fontFamily: fonts.bodyBold, fontSize: 10, letterSpacing: 1, color: onCard.strong, backgroundColor: onCard.chip },
  kindCompact: { fontSize: 8, paddingHorizontal: 6, paddingVertical: 2 },
  name: { marginTop: 4, fontFamily: fonts.bodyBold, fontSize: 19, letterSpacing: -0.3, color: onCard.strong },
  nameCompact: { marginTop: 2, fontSize: 14 },
  spacer: { flex: 1 },
  balanceLabel: { fontFamily: fonts.bodyMedium, fontSize: 11, color: onCard.soft },
  balanceLabelCompact: { fontSize: 9 },
  balance: { marginTop: 2, fontFamily: fonts.bodyBold, fontSize: 28, letterSpacing: -0.6, fontVariant: ['tabular-nums'], color: onCard.strong },
  balanceCompact: { marginTop: 1, fontSize: 18, letterSpacing: -0.3 },
  bottom: { marginTop: 10, flexDirection: 'row', alignItems: 'center', gap: 14 },
  digits: { fontFamily: fonts.bodySemiBold, fontSize: 14, letterSpacing: 1.6, fontVariant: ['tabular-nums'], color: onCard.strong },
  digitsCompact: { fontSize: 11, letterSpacing: 1.2 },
  expiry: { fontFamily: fonts.bodyMedium, fontSize: 12, fontVariant: ['tabular-nums'], color: onCard.soft },
  expired: { color: '#FFD6D1' },
  grow: { flex: 1 },
  network: { fontFamily: fonts.bodyBold, fontSize: 15, fontStyle: 'italic', letterSpacing: 0.2, color: onCard.strong },
  networkCompact: { fontSize: 12 },
}));
