import { Feather } from '@expo/vector-icons';
import { useAudioPlayer, useAudioPlayerStatus } from 'expo-audio';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { AppScreen } from '@/components/AppScreen';
import { useAppDialog } from '@/components/AppDialog';
import { ItemRow } from '@/components/ItemRow';
import { ScreenHeader } from '@/components/ScreenHeader';
import { colors, fonts } from '@/constants/theme';
import { useItems } from '@/store/ItemsContext';
import { formatDuration, relativeDateTimeLabel } from '@/utils/date';
import { confirmAction } from '@/utils/confirm-action';

export default function DumpDetailScreen() {
  const { showDialog } = useAppDialog();
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { dumps, items, deleteDump } = useItems();
  const dump = dumps.find((candidate) => candidate.id === id);
  const player = useAudioPlayer(dump?.uri ?? null, { updateInterval: 250 });
  const status = useAudioPlayerStatus(player);

  if (!dump) return <AppScreen><ScreenHeader back /><View style={styles.missing}><Text style={styles.title}>Recording not found</Text></View></AppScreen>;
  const extracted = items.filter((item) => item.sourceDumpId === dump.id);
  const remove = () => showDialog(confirmAction({ title: 'Delete recording?', message: 'The organized records will remain in LifeDesk.', confirmLabel: 'Delete recording', onConfirm: () => { deleteDump(dump.id); router.canGoBack() ? router.back() : router.replace('/'); } }));
  const toggle = () => status.playing ? player.pause() : player.play();

  return (
    <AppScreen background={colors.paper}>
      <ScreenHeader back action={<Pressable accessibilityLabel="Delete recording" onPress={remove}><Feather name="trash-2" size={20} color={colors.danger} /></Pressable>} />
      <Text style={styles.kicker}>VOICE NOTE</Text>
      <Text style={styles.title}>{dump.title}</Text>
      <Text style={styles.date}>{relativeDateTimeLabel(dump.createdAt)}</Text>
      <Pressable accessibilityRole="button" onPress={toggle} style={styles.player}>
        <View style={styles.playIcon}><Feather name={status.playing ? 'pause' : 'play'} size={20} color={colors.surface} /></View>
        <View style={styles.playerMain}><Text style={styles.playerLabel}>{status.playing ? 'Playing recording' : 'Play original recording'}</Text><View style={styles.track}><View style={[styles.progress, { width: status.duration ? `${Math.min(100, status.currentTime / status.duration * 100)}%` : '0%' }]} /></View></View>
        <Text style={styles.duration}>{formatDuration(status.playing ? status.currentTime : dump.durationSeconds)}</Text>
      </Pressable>
      <View style={styles.section}><Text style={styles.sectionTitle}>Transcript</Text><Text selectable style={styles.transcript}>{dump.transcript}</Text></View>
      <View style={styles.section}><Text style={styles.sectionTitle}>Extracted items</Text>{extracted.length ? extracted.map((item) => <ItemRow key={item.id} item={item} />) : <Text style={styles.empty}>No extracted items remain.</Text>}</View>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  kicker: { marginTop: 4, fontFamily: fonts.bodyBold, fontSize: 11, letterSpacing: 1.4, color: colors.terracotta },
  title: { marginTop: 10, fontFamily: fonts.editorialSemiBold, fontSize: 36, lineHeight: 41, color: colors.ink },
  date: { marginTop: 8, fontFamily: fonts.body, fontSize: 13, color: colors.secondary },
  player: { minHeight: 76, marginTop: 25, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', gap: 12, borderWidth: 1, borderColor: colors.borderStrong, borderRadius: 14, backgroundColor: colors.surface },
  playIcon: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.dark, alignItems: 'center', justifyContent: 'center' },
  playerMain: { flex: 1 },
  playerLabel: { fontFamily: fonts.bodyMedium, fontSize: 13, color: colors.ink },
  track: { height: 2, marginTop: 9, backgroundColor: colors.border },
  progress: { height: 2, backgroundColor: colors.terracotta },
  duration: { fontFamily: fonts.bodyMedium, fontSize: 11, color: colors.secondary },
  section: { paddingVertical: 26, borderBottomWidth: 1, borderBottomColor: colors.border },
  sectionTitle: { marginBottom: 14, fontFamily: fonts.bodySemiBold, fontSize: 17, color: colors.ink },
  transcript: { fontFamily: fonts.body, fontSize: 15, lineHeight: 24, color: colors.secondary },
  empty: { fontFamily: fonts.body, fontSize: 13, color: colors.muted },
  missing: { paddingTop: 80, alignItems: 'center' },
});
