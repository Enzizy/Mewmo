import { Feather } from '@expo/vector-icons';
import { useAudioPlayer, useAudioPlayerStatus } from 'expo-audio';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { colors, fonts } from '@/constants/theme';
import { VoiceDump } from '@/types';
import { formatDuration, relativeDateTimeLabel } from '@/utils/date';

export function RecordingRow({ dump }: { dump: VoiceDump }) {
  const router = useRouter();
  const player = useAudioPlayer(dump.uri, { updateInterval: 250 });
  const status = useAudioPlayerStatus(player);
  const toggle = () => {
    if (status.playing) player.pause();
    else {
      if (status.didJustFinish) player.seekTo(0);
      player.play();
    }
  };

  return (
    <View style={styles.row}>
      <Pressable accessibilityRole="button" accessibilityLabel={`${status.playing ? 'Pause' : 'Play'} ${dump.title}`} onPress={toggle} style={styles.play}>
        <Feather name={status.playing ? 'pause' : 'play'} size={15} color={colors.ink} />
      </Pressable>
      <Pressable accessibilityRole="button" onPress={() => router.push({ pathname: '/dump/[id]', params: { id: dump.id } })} style={styles.main}><Text numberOfLines={1} style={styles.title}>{dump.title}</Text><Text style={styles.meta}>{relativeDateTimeLabel(dump.createdAt)}</Text></Pressable>
      <Text style={styles.duration}>{status.playing ? formatDuration(status.currentTime) : formatDuration(dump.durationSeconds)}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { minHeight: 72, flexDirection: 'row', alignItems: 'center', borderBottomWidth: 1, borderBottomColor: colors.border },
  play: { width: 36, height: 36, borderRadius: 18, borderWidth: 1, borderColor: colors.borderStrong, alignItems: 'center', justifyContent: 'center' },
  main: { flex: 1, marginLeft: 13 },
  title: { fontFamily: fonts.bodyMedium, fontSize: 15, color: colors.ink },
  meta: { marginTop: 4, fontFamily: fonts.body, fontSize: 12, color: colors.secondary },
  duration: { fontFamily: fonts.bodyMedium, fontSize: 11, color: colors.muted },
});
