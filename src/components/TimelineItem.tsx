import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { colors, fonts } from '@/constants/theme';
import { ThoughtItem } from '@/types';
import { categoryMeta } from './CategoryIcon';

export function TimelineItem({ item, last = false }: { item: ThoughtItem; last?: boolean }) {
  const router = useRouter();
  const meta = categoryMeta[item.category];
  return (
    <Pressable onPress={() => router.push({ pathname: '/item/[id]', params: { id: item.id } })} style={styles.row}>
      <View style={styles.rail}>
        <View style={[styles.dot, { backgroundColor: meta.color }]} />
        {!last && <View style={styles.line} />}
      </View>
      <Text style={styles.time}>{item.time ?? '—'}</Text>
      <View style={styles.main}>
        <Text style={styles.title}>{item.title}</Text>
        <Text style={[styles.category, { color: meta.color }]}>{meta.label}</Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: { minHeight: 78, flexDirection: 'row' },
  rail: { width: 24, alignItems: 'center' },
  dot: { width: 8, height: 8, borderRadius: 4, marginTop: 7 },
  line: { width: 1, flex: 1, marginTop: 5, backgroundColor: colors.borderStrong },
  time: { width: 70, paddingTop: 2, fontFamily: fonts.bodyMedium, fontSize: 12, color: colors.secondary },
  main: { flex: 1, paddingBottom: 20 },
  title: { fontFamily: fonts.bodyMedium, fontSize: 15, lineHeight: 20, color: colors.ink },
  category: { marginTop: 4, fontFamily: fonts.bodyMedium, fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.7 },
});
