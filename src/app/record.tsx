import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useAppDialog } from '@/components/AppDialog';
import { RecordingPresets, requestRecordingPermissionsAsync, setAudioModeAsync, useAudioRecorder, useAudioRecorderState } from 'expo-audio';
import { AppScreen } from '@/components/AppScreen';
import { ScreenHeader } from '@/components/ScreenHeader';
import { Waveform } from '@/components/Waveform';
import { colors, fonts } from '@/constants/theme';
import { useItems } from '@/store/ItemsContext';
import { confirmAction } from '@/utils/confirm-action';

const recordingOptions = { ...RecordingPresets.HIGH_QUALITY, directory: 'document' as const, isMeteringEnabled: true };

function formatTime(milliseconds: number) {
  const seconds = Math.floor(milliseconds / 1000);
  return `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;
}

export default function RecordScreen() {
  const { showDialog } = useAppDialog();
  const router = useRouter();
  const { setPendingRecording } = useItems();
  const recorder = useAudioRecorder(recordingOptions);
  const recorderState = useAudioRecorderState(recorder, 100);
  const started = useRef(false);
  const [paused, setPaused] = useState(false);
  const [starting, setStarting] = useState(true);
  const [stopping, setStopping] = useState(false);
  const leave = useCallback(() => router.canGoBack() ? router.back() : router.replace('/'), [router]);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    const start = async () => {
      const permission = await requestRecordingPermissionsAsync();
      if (!permission.granted) {
        showDialog({ title: 'Microphone access needed', message: 'Mewmo needs microphone permission to record. You can enable it in Android settings.', tone: 'warning' });
        leave();
        return;
      }
      await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
      await recorder.prepareToRecordAsync();
      recorder.record({});
      setStarting(false);
    };
    start().catch((error) => {
      showDialog({ title: 'Recording unavailable', message: error instanceof Error ? error.message : 'The microphone could not be started.', tone: 'danger' });
      leave();
    });
  }, [leave, recorder, showDialog]);

  const togglePause = () => {
    if (starting || stopping) return;
    if (paused) recorder.record({});
    else recorder.pause();
    setPaused((value) => !value);
  };

  const stopRecording = async () => {
    if (starting || stopping) return;
    setStopping(true);
    try {
      await recorder.stop();
      await setAudioModeAsync({ allowsRecording: false, playsInSilentMode: true });
      if (!recorder.uri) throw new Error('The recording file was not created.');
      setPendingRecording({
        uri: recorder.uri,
        durationSeconds: Math.max(1, Math.round(recorderState.durationMillis / 1000)),
        mimeType: 'audio/m4a',
      });
      router.replace('/processing');
    } catch (error) {
      setStopping(false);
      showDialog({ title: 'Could not save recording', message: error instanceof Error ? error.message : 'Please try again.', tone: 'danger' });
    }
  };

  const discardRecording = () => {
    showDialog(confirmAction({ title: 'Discard recording?', message: 'This voice note has not been saved yet.', confirmLabel: 'Discard', cancelLabel: 'Keep recording', onConfirm: async () => {
        await recorder.stop().catch(() => undefined);
        await setAudioModeAsync({ allowsRecording: false }).catch(() => undefined);
        leave();
      } }));
  };

  return (
    <AppScreen scroll={false} background={colors.paper}>
      <ScreenHeader back onBack={discardRecording} />
      <View style={styles.heading}>
        <View style={styles.liveRow}><View style={[styles.liveDot, paused && styles.pausedDot]} /><Text style={styles.kicker}>{starting ? 'Preparing...' : paused ? 'Paused' : 'Listening...'}</Text></View>
        <Text style={styles.title}>Speak naturally.</Text>
        <Text style={styles.support}>I’ll organize it for you.</Text>
      </View>
      <Pressable accessibilityRole="button" accessibilityLabel={paused ? 'Resume recording' : 'Pause recording'} onPress={togglePause} style={styles.visual}>
        <View style={styles.outerCircle}><View style={styles.innerCircle}><Waveform active={!starting && !paused} /></View></View>
      </Pressable>
      <Text style={styles.duration}>{formatTime(recorderState.durationMillis)}</Text>
      <View style={styles.actions}>
        <Pressable accessibilityRole="button" disabled={starting || stopping} onPress={stopRecording} style={({ pressed }) => [styles.stop, (starting || stopping) && styles.disabled, pressed && styles.pressed]}>
          <Feather name="square" size={17} color={colors.surface} fill={colors.surface} /><Text style={styles.stopText}>{stopping ? 'Saving...' : 'Stop recording'}</Text>
        </Pressable>
        <Pressable accessibilityRole="button" onPress={togglePause} style={styles.pause}><Text style={styles.pauseText}>Tap to {paused ? 'resume' : 'pause'}</Text></Pressable>
      </View>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  heading: { alignItems: 'center', marginTop: 8 },
  liveRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  liveDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: colors.terracotta },
  pausedDot: { backgroundColor: colors.mustard },
  kicker: { fontFamily: fonts.bodySemiBold, fontSize: 13, color: colors.secondary, letterSpacing: 0.4 },
  title: { marginTop: 12, fontFamily: fonts.editorialSemiBold, fontSize: 32, color: colors.ink },
  support: { marginTop: 5, fontFamily: fonts.body, fontSize: 15, color: colors.secondary },
  visual: { flex: 1, minHeight: 260, alignItems: 'center', justifyContent: 'center' },
  outerCircle: { width: 228, height: 228, borderRadius: 114, borderWidth: 1, borderColor: colors.terracotta, padding: 15 },
  innerCircle: { flex: 1, borderRadius: 100, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.background, alignItems: 'center', justifyContent: 'center' },
  duration: { alignSelf: 'center', fontFamily: fonts.bodyMedium, fontSize: 22, fontVariant: ['tabular-nums'], letterSpacing: 1.5, color: colors.ink },
  actions: { alignItems: 'center', paddingBottom: 12, marginTop: 32 },
  stop: { minWidth: 210, height: 54, borderRadius: 12, flexDirection: 'row', gap: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.dark },
  stopText: { fontFamily: fonts.bodySemiBold, fontSize: 15, color: colors.surface },
  pause: { minHeight: 44, paddingHorizontal: 16, alignItems: 'center', justifyContent: 'center' },
  pauseText: { fontFamily: fonts.body, fontSize: 12, color: colors.secondary },
  disabled: { opacity: 0.55 },
  pressed: { transform: [{ scale: 0.97 }] },
});
