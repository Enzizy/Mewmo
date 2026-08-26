import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import * as FileSystem from 'expo-file-system/legacy';
import { AppScreen } from '@/components/AppScreen';
import { CategoryIcon, categoryMeta } from '@/components/CategoryIcon';
import { PixelCat } from '@/components/PixelCat';
import { colors, fonts } from '@/constants/theme';
import { organizeRecording } from '@/services/organizerApi';
import { useItems } from '@/store/ItemsContext';
import { Category } from '@/types';

const categories: Category[] = ['task', 'reminder', 'idea', 'note'];

export default function ProcessingScreen() {
  const router = useRouter();
  const { pendingRecording, processingError, setProcessingError, setPendingRecording, setPendingOrganizedDump, queueReviewProposal } = useItems();
  const [step, setStep] = useState(0);
  const [attempt, setAttempt] = useState(0);
  const running = useRef(false);

  const processRecording = useCallback(async () => {
    if (!pendingRecording || running.current) return;
    running.current = true;
    setProcessingError(null);
    setStep(1);
    try {
      const organized = await organizeRecording(pendingRecording);
      setStep(3);
      setPendingOrganizedDump(organized);
      const proposal = await queueReviewProposal('voice', organized, pendingRecording);
      setStep(4);
      setTimeout(() => router.replace({ pathname: '/review', params: { id: proposal.id } }), 350);
    } catch (error) {
      setProcessingError(error instanceof Error ? error.message : 'Something went wrong while organizing the recording.');
      running.current = false;
    }
  }, [pendingRecording, queueReviewProposal, router, setPendingOrganizedDump, setProcessingError]);

  useEffect(() => {
    if (!pendingRecording) {
      router.replace('/');
      return;
    }
    processRecording();
  }, [attempt, pendingRecording, processRecording, router]);

  if (processingError) {
    return (
      <AppScreen scroll={false} background={colors.paper}>
        <View style={styles.errorContent}>
          <View style={styles.errorIcon}><Feather name="wifi-off" size={28} color={colors.terracotta} /></View>
          <Text style={styles.errorTitle}>Your recording is still here.</Text>
          <Text style={styles.errorText}>{processingError}</Text>
          <Pressable accessibilityRole="button" onPress={() => setAttempt((value) => value + 1)} style={styles.retry}><Feather name="refresh-cw" size={17} color={colors.surface} /><Text style={styles.retryText}>Try processing again</Text></Pressable>
          <Pressable accessibilityRole="button" onPress={async () => {
            if (pendingRecording?.uri) await FileSystem.deleteAsync(pendingRecording.uri, { idempotent: true }).catch(() => undefined);
            setPendingRecording(null);
            router.replace('/');
          }} style={styles.homeButton}><Text style={styles.homeText}>Discard recording and return home</Text></Pressable>
        </View>
      </AppScreen>
    );
  }

  return (
    <AppScreen scroll={false} background={colors.paper}>
      <View style={styles.header}><Text style={styles.title}>SORTING...</Text><Text style={styles.support}>{step < 2 ? 'Your cat is securely sending the recording' : 'Your cat is organizing your thoughts'}</Text></View>
      <View style={styles.diagram}>
        <View style={styles.mascot}><PixelCat pose="sorting" size={116} speech="ON IT" /></View>
        {categories.map((category, index) => {
          const positions = [styles.topLeft, styles.topRight, styles.bottomLeft, styles.bottomRight];
          return <Animated.View entering={FadeIn.delay(index * 130)} key={category} style={[styles.node, positions[index]]}><CategoryIcon category={category} /><Text style={styles.nodeLabel}>{categoryMeta[category].label}s</Text></Animated.View>;
        })}
        <View style={[styles.connector, styles.lineOne]} /><View style={[styles.connector, styles.lineTwo]} />
      </View>
      <Animated.View entering={FadeInDown} style={styles.progress}>
        {categories.map((category, index) => (
          <View key={category} style={styles.progressRow}>
            <Text style={styles.progressLabel}>{categoryMeta[category].label}s</Text>
            <View style={styles.rule} />
            {index < step ? <View style={styles.complete}><Feather name="check" size={13} color={colors.surface} /></View> : <View style={styles.pending} />}
          </View>
        ))}
      </Animated.View>
      <Text style={styles.privacy}>The Gemini key stays on your server, never in the app.</Text>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  header: { marginTop: 48, alignItems: 'center' },
  title: { fontFamily: fonts.editorialSemiBold, fontSize: 34, color: colors.ink },
  support: { marginTop: 6, fontFamily: fonts.body, fontSize: 14, color: colors.secondary },
  diagram: { flex: 1, minHeight: 280, position: 'relative', alignItems: 'center', justifyContent: 'center' },
  mascot: { zIndex: 2, width: 116, height: 116, alignItems: 'center', justifyContent: 'center' },
  node: { zIndex: 2, position: 'absolute', flexDirection: 'row', alignItems: 'center', gap: 7 },
  nodeLabel: { fontFamily: fonts.bodyMedium, fontSize: 12, color: colors.secondary },
  topLeft: { top: '23%', left: '5%' },
  topRight: { top: '23%', right: '3%' },
  bottomLeft: { bottom: '22%', left: '8%' },
  bottomRight: { bottom: '22%', right: '5%' },
  connector: { position: 'absolute', width: '56%', height: 1, backgroundColor: colors.borderStrong, left: '22%', top: '50%' },
  lineOne: { transform: [{ rotate: '28deg' }] },
  lineTwo: { transform: [{ rotate: '-28deg' }] },
  progress: { paddingVertical: 10, borderTopWidth: 1, borderBottomWidth: 1, borderColor: colors.border },
  progressRow: { height: 43, flexDirection: 'row', alignItems: 'center' },
  progressLabel: { width: 92, fontFamily: fonts.bodyMedium, fontSize: 13, color: colors.ink },
  rule: { flex: 1, height: 1, marginHorizontal: 12, backgroundColor: colors.border },
  complete: { width: 20, height: 20, borderRadius: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.green },
  pending: { width: 20, height: 20, borderRadius: 10, borderWidth: 1, borderColor: colors.borderStrong },
  privacy: { marginVertical: 18, textAlign: 'center', fontFamily: fonts.body, fontSize: 11, color: colors.muted },
  errorContent: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingBottom: 40 },
  errorIcon: { width: 60, height: 60, borderRadius: 30, backgroundColor: colors.terracottaSoft, alignItems: 'center', justifyContent: 'center' },
  errorTitle: { marginTop: 22, fontFamily: fonts.editorialSemiBold, fontSize: 29, color: colors.ink },
  errorText: { maxWidth: 330, marginTop: 10, textAlign: 'center', fontFamily: fonts.body, fontSize: 14, lineHeight: 21, color: colors.secondary },
  retry: { width: '100%', height: 54, marginTop: 30, borderRadius: 12, backgroundColor: colors.dark, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 9 },
  retryText: { fontFamily: fonts.bodySemiBold, fontSize: 14, color: colors.surface },
  homeButton: { minHeight: 48, paddingHorizontal: 18, alignItems: 'center', justifyContent: 'center' },
  homeText: { fontFamily: fonts.bodyMedium, fontSize: 13, color: colors.secondary },
});
