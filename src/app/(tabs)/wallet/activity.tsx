import { Feather } from '@expo/vector-icons';
import { StyleSheet, Text, View } from 'react-native';
import { AppScreen } from '@/components/AppScreen';
import { ScreenHeader } from '@/components/ScreenHeader';
import { PageHeader } from '@/components/page-header';
import { colors, fonts } from '@/constants/theme';
import { useItems } from '@/store/ItemsContext';
import { formatPeso } from '@/utils/money';

export default function WalletActivityScreen() {
  const { transactions } = useItems();
  return <AppScreen assistant><ScreenHeader back /><PageHeader title="Activity" supporting="Every confirmed income, expense, transfer, and investment contribution." /><View style={styles.list}>{transactions.map((item) => <View key={item.id} style={styles.row}><View style={styles.icon}><Feather name={item.type === 'income' ? 'arrow-down-left' : item.type === 'investment' ? 'trending-up' : 'arrow-up-right'} size={17} color={colors.ink} /></View><View style={styles.main}><Text style={styles.title}>{item.title}</Text><Text style={styles.meta}>{item.category} · {new Intl.DateTimeFormat('en-PH', { month: 'short', day: 'numeric', year: 'numeric' }).format(new Date(item.occurredAt))}</Text></View><Text style={[styles.value, item.type === 'income' && styles.positive]}>{item.type === 'income' ? '+' : '−'}{formatPeso(item.amountMinor)}</Text></View>)}{!transactions.length ? <View style={styles.empty}><Text style={styles.emptyTitle}>No activity yet</Text><Text style={styles.emptyText}>Your confirmed money records will appear here.</Text></View> : null}</View></AppScreen>;
}

const styles = StyleSheet.create({ list: { marginTop: 24, borderTopWidth: 1, borderTopColor: colors.border }, row: { minHeight: 72, flexDirection: 'row', alignItems: 'center', gap: 12, borderBottomWidth: 1, borderBottomColor: colors.border }, icon: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.paper, borderWidth: 1, borderColor: colors.border }, main: { flex: 1, minWidth: 0 }, title: { fontFamily: fonts.bodyMedium, fontSize: 14, color: colors.ink }, meta: { marginTop: 4, fontFamily: fonts.body, fontSize: 12, color: colors.secondary }, value: { maxWidth: '35%', fontFamily: fonts.bodySemiBold, fontSize: 13, fontVariant: ['tabular-nums'], color: colors.ink }, positive: { color: colors.green }, empty: { paddingVertical: 40 }, emptyTitle: { fontFamily: fonts.bodySemiBold, fontSize: 15, color: colors.ink }, emptyText: { marginTop: 6, fontFamily: fonts.body, fontSize: 13, color: colors.secondary } });
