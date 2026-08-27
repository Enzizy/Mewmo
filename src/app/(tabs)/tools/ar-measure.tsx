import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Linking, PermissionsAndroid, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { AppScreen } from '@/components/AppScreen';
import { ScreenHeader } from '@/components/ScreenHeader';
import { colors, fonts, radius } from '@/constants/theme';
import {
  ArMeasureView,
  ArMeasureViewRef,
  isArMeasureAvailable,
  MeasurementState,
} from '../../../../modules/ar-measure';

type PermissionState = 'checking' | 'prompt' | 'requesting' | 'granted' | 'denied';
type DisplayUnit = 'cm' | 'in' | 'm';

const initialMeasurement: MeasurementState = {
  status: 'initializing',
  message: 'Starting AR measurement…',
  canPlace: false,
  pointCount: 0,
};

export default function ArMeasureScreen() {
  const router = useRouter();
  const measureRef = useRef<ArMeasureViewRef>(null);
  const [permission, setPermission] = useState<PermissionState>('checking');
  const [measurement, setMeasurement] = useState<MeasurementState>(initialMeasurement);
  const [unit, setUnit] = useState<DisplayUnit>('cm');

  useEffect(() => {
    if (Platform.OS !== 'android' || !isArMeasureAvailable) {
      setPermission('prompt');
      return;
    }
    PermissionsAndroid.check(PermissionsAndroid.PERMISSIONS.CAMERA)
      .then((granted) => setPermission(granted ? 'granted' : 'prompt'))
      .catch(() => setPermission('prompt'));
  }, []);

  const requestCamera = async () => {
    if (Platform.OS !== 'android') return;
    setPermission('requesting');
    const result = await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.CAMERA, {
      title: 'Use camera for AR Measure',
      message: 'LifeDesk uses the camera locally to detect surfaces and estimate the distance between two points.',
      buttonPositive: 'Allow camera',
      buttonNegative: 'Not now',
    });
    setPermission(result === PermissionsAndroid.RESULTS.GRANTED ? 'granted' : 'denied');
  };

  const reset = () => {
    void measureRef.current?.reset();
    setMeasurement(initialMeasurement);
  };

  const placePoint = () => {
    void measureRef.current?.placePoint();
  };

  if (!isArMeasureAvailable) {
    return <UnavailableScreen />;
  }

  if (permission !== 'granted') {
    return <PermissionScreen permission={permission} onRequest={requestCamera} />;
  }

  const complete = measurement.status === 'complete' && measurement.distanceMeters !== undefined;
  const fatal = measurement.status === 'error' || measurement.status === 'unsupported';
  const placeLabel = measurement.pointCount === 0 ? 'Set point A' : 'Set point B';

  return <AppScreen scroll={false} tabbed background={colors.ink}>
    <View style={styles.liveHeader}>
      <Pressable accessibilityRole="button" accessibilityLabel="Go back" onPress={() => router.canGoBack() ? router.back() : router.replace('/tools')} style={styles.liveBack}><Feather name="arrow-left" size={22} color={colors.paper} /></Pressable>
      <Text style={styles.liveTitle}>AR Measure</Text>
      <View style={styles.liveSpacer} />
    </View>
    <View style={styles.cameraCard}>
      <ArMeasureView
        ref={measureRef}
        accessibilityLabel="AR camera measurement view"
        onMeasurementStateChange={({ nativeEvent }) => setMeasurement(nativeEvent)}
        style={StyleSheet.absoluteFill}
      />
      <View pointerEvents="none" style={styles.scrimTop} />
      <View pointerEvents="none" style={styles.statusPill}>
        <View style={[styles.statusDot, measurement.canPlace && styles.statusDotReady]} />
        <Text numberOfLines={2} style={styles.statusText}>{measurement.message}</Text>
      </View>
      {!complete && !fatal ? <View pointerEvents="none" style={[styles.reticle, measurement.canPlace && styles.reticleReady]}><View style={styles.reticleDot} /></View> : null}
      {complete ? <View pointerEvents="none" accessibilityLiveRegion="polite" style={styles.resultFloat}>
        <Text style={styles.resultEyebrow}>DISTANCE</Text>
        <Text adjustsFontSizeToFit numberOfLines={1} style={styles.resultValue}>{formatDistance(measurement.distanceMeters!, unit)}</Text>
      </View> : null}
      {fatal ? <View style={styles.fatalCard}><Feather name="alert-circle" size={24} color={colors.danger} /><Text style={styles.fatalTitle}>AR is unavailable</Text><Text style={styles.fatalText}>{measurement.message}</Text></View> : null}
    </View>

    <View style={styles.controlPanel}>
      <View style={styles.unitStrip}>
        {(['cm', 'in', 'm'] as DisplayUnit[]).map((value) => <Pressable accessibilityRole="radio" accessibilityState={{ checked: unit === value }} key={value} onPress={() => setUnit(value)} style={[styles.unitButton, unit === value && styles.unitButtonActive]}><Text style={[styles.unitText, unit === value && styles.unitTextActive]}>{value}</Text></Pressable>)}
      </View>
      <View style={styles.actions}>
        <Pressable accessibilityRole="button" accessibilityLabel="Reset measurement" onPress={reset} style={({ pressed }) => [styles.resetButton, pressed && styles.pressed]}><Feather name="rotate-ccw" size={20} color={colors.ink} /></Pressable>
        <Pressable accessibilityRole="button" accessibilityState={{ disabled: !measurement.canPlace || complete || fatal }} disabled={!measurement.canPlace || complete || fatal} onPress={placePoint} style={({ pressed }) => [styles.placeButton, (!measurement.canPlace || complete || fatal) && styles.placeButtonDisabled, pressed && measurement.canPlace && styles.pressed]}><View style={styles.placeButtonDot} /><Text style={styles.placeButtonText}>{complete ? 'Measurement complete' : placeLabel}</Text></Pressable>
      </View>
      <Text style={styles.accuracyNote}>For plain or light surfaces, add a small piece of contrasting tape near each endpoint.</Text>
    </View>
  </AppScreen>;
}

function UnavailableScreen() {
  const web = Platform.OS === 'web';
  return <AppScreen tabbed>
    <ScreenHeader back />
    <View style={styles.introIcon}><Feather name="maximize-2" size={26} color={colors.ink} /></View>
    <Text style={styles.pageTitle}>Measure with your camera</Text>
    <Text style={styles.pageSupport}>Pin a start and end point to estimate a real-world length in centimeters, inches, or meters.</Text>
    <View style={styles.noticeCard}><Feather name={web ? 'smartphone' : 'download'} size={19} color={colors.accent} /><View style={styles.noticeCopy}><Text style={styles.noticeTitle}>{web ? 'Open this on Android' : 'Installed build required'}</Text><Text style={styles.noticeText}>{web ? 'AR measurement uses Android camera hardware and cannot run in a browser.' : 'Expo Go cannot load LifeDesk’s custom ARCore module. Install your next LifeDesk APK to use this tool.'}</Text></View></View>
    <HowItWorks />
    <View style={styles.freeCard}><Feather name="shield" size={18} color={colors.green} /><Text style={styles.freeText}>Runs locally. No account, card, subscription, upload, or paid API is required.</Text></View>
  </AppScreen>;
}

function PermissionScreen({ permission, onRequest }: { permission: PermissionState; onRequest: () => void }) {
  const denied = permission === 'denied';
  return <AppScreen tabbed>
    <ScreenHeader back />
    <View style={styles.introIcon}><Feather name="camera" size={26} color={colors.ink} /></View>
    <Text style={styles.pageTitle}>Camera access, only while measuring</Text>
    <Text style={styles.pageSupport}>LifeDesk needs the camera to find surfaces. Frames stay on your phone and are never uploaded.</Text>
    <HowItWorks />
    <Pressable accessibilityRole="button" disabled={permission === 'requesting'} onPress={denied ? () => void Linking.openSettings() : onRequest} style={({ pressed }) => [styles.permissionButton, pressed && styles.pressed]}><Feather name={denied ? 'settings' : 'camera'} size={19} color={colors.paper} /><Text style={styles.permissionButtonText}>{permission === 'requesting' ? 'Requesting permission…' : denied ? 'Open Android settings' : 'Enable camera'}</Text></Pressable>
    <Text style={styles.permissionFootnote}>You can revoke camera access anytime in Android settings.</Text>
  </AppScreen>;
}

function HowItWorks() {
  return <View style={styles.steps}><Text style={styles.stepsTitle}>How it works</Text>{[
    ['1', 'Scan', 'Move slowly, then pause until the surface locks.'],
    ['2', 'Pin', 'Align the center marker and set point A.'],
    ['3', 'Measure', 'Move to point B and lock the result.'],
  ].map(([number, title, detail]) => <View key={number} style={styles.step}><View style={styles.stepNumber}><Text style={styles.stepNumberText}>{number}</Text></View><View style={styles.stepCopy}><Text style={styles.stepTitle}>{title}</Text><Text style={styles.stepText}>{detail}</Text></View></View>)}</View>;
}

function formatDistance(meters: number, unit: DisplayUnit) {
  if (unit === 'm') return `${meters < 10 ? meters.toFixed(3) : meters.toFixed(2)} m`;
  if (unit === 'in') return `${(meters * 39.3700787).toFixed(2)} in`;
  return `${(meters * 100).toFixed(1)} cm`;
}

const styles = StyleSheet.create({
  liveHeader: { minHeight: 44, marginBottom: 12, flexDirection: 'row', alignItems: 'center' },
  liveBack: { width: 44, height: 44, marginLeft: -10, alignItems: 'center', justifyContent: 'center' },
  liveTitle: { flex: 1, textAlign: 'center', fontFamily: fonts.bodySemiBold, fontSize: 16, color: colors.paper },
  liveSpacer: { width: 34 },
  cameraCard: { flex: 1, minHeight: 300, overflow: 'hidden', borderRadius: radius.lg, backgroundColor: '#050505' },
  scrimTop: { position: 'absolute', top: 0, left: 0, right: 0, bottom: '65%', backgroundColor: 'rgba(0,0,0,0.2)' },
  statusPill: { position: 'absolute', top: 16, left: 16, right: 16, minHeight: 44, paddingHorizontal: 14, paddingVertical: 10, flexDirection: 'row', alignItems: 'center', gap: 9, borderRadius: radius.full, backgroundColor: 'rgba(17,17,17,0.78)' },
  statusDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.mustard },
  statusDotReady: { backgroundColor: '#4ADE80' },
  statusText: { flex: 1, fontFamily: fonts.bodyMedium, fontSize: 12, lineHeight: 16, color: colors.paper },
  reticle: { position: 'absolute', left: '50%', top: '50%', width: 42, height: 42, marginLeft: -21, marginTop: -21, alignItems: 'center', justifyContent: 'center', borderRadius: 21, borderWidth: 2, borderColor: 'rgba(255,255,255,0.7)' },
  reticleReady: { borderColor: colors.paper, backgroundColor: 'rgba(37,99,235,0.22)' },
  reticleDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: colors.paper },
  resultFloat: { position: 'absolute', left: 20, right: 20, top: '42%', paddingHorizontal: 18, paddingVertical: 14, alignItems: 'center', borderRadius: radius.md, backgroundColor: 'rgba(255,255,255,0.94)' },
  resultEyebrow: { fontFamily: fonts.bodySemiBold, fontSize: 10, letterSpacing: 1.1, color: colors.secondary },
  resultValue: { marginTop: 3, fontFamily: fonts.bodyBold, fontSize: 34, letterSpacing: -1, color: colors.ink },
  fatalCard: { position: 'absolute', left: 20, right: 20, top: '32%', padding: 20, alignItems: 'center', borderRadius: radius.md, backgroundColor: 'rgba(255,255,255,0.96)' },
  fatalTitle: { marginTop: 8, fontFamily: fonts.bodySemiBold, fontSize: 16, color: colors.ink },
  fatalText: { marginTop: 5, textAlign: 'center', fontFamily: fonts.body, fontSize: 12, lineHeight: 18, color: colors.secondary },
  controlPanel: { paddingTop: 16 },
  unitStrip: { alignSelf: 'center', padding: 3, flexDirection: 'row', borderRadius: radius.full, backgroundColor: '#292929' },
  unitButton: { minWidth: 54, minHeight: 38, paddingHorizontal: 14, alignItems: 'center', justifyContent: 'center', borderRadius: radius.full },
  unitButtonActive: { backgroundColor: colors.paper },
  unitText: { fontFamily: fonts.bodySemiBold, fontSize: 12, color: '#B8B8B8' },
  unitTextActive: { color: colors.ink },
  actions: { marginTop: 13, flexDirection: 'row', gap: 10 },
  resetButton: { width: 54, minHeight: 54, alignItems: 'center', justifyContent: 'center', borderRadius: radius.md, backgroundColor: colors.paper },
  placeButton: { flex: 1, minHeight: 54, paddingHorizontal: 18, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, borderRadius: radius.md, backgroundColor: colors.paper },
  placeButtonDisabled: { opacity: 0.48 },
  placeButtonDot: { width: 13, height: 13, borderRadius: 7, borderWidth: 3, borderColor: colors.accent },
  placeButtonText: { fontFamily: fonts.bodySemiBold, fontSize: 14, color: colors.ink },
  accuracyNote: { marginTop: 9, textAlign: 'center', fontFamily: fonts.body, fontSize: 10, color: '#A8A8A8' },
  introIcon: { width: 58, height: 58, marginTop: 8, alignItems: 'center', justifyContent: 'center', borderRadius: 18, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.paper },
  pageTitle: { marginTop: 22, maxWidth: 420, fontFamily: fonts.bodyBold, fontSize: 30, lineHeight: 36, letterSpacing: -0.8, color: colors.ink },
  pageSupport: { marginTop: 10, maxWidth: 510, fontFamily: fonts.body, fontSize: 15, lineHeight: 23, color: colors.secondary },
  noticeCard: { marginTop: 24, padding: 16, flexDirection: 'row', alignItems: 'flex-start', gap: 12, borderRadius: radius.md, backgroundColor: colors.accentSoft },
  noticeCopy: { flex: 1 },
  noticeTitle: { fontFamily: fonts.bodySemiBold, fontSize: 14, color: colors.ink },
  noticeText: { marginTop: 4, fontFamily: fonts.body, fontSize: 12, lineHeight: 18, color: colors.secondary },
  steps: { marginTop: 28, paddingVertical: 4, borderTopWidth: 1, borderTopColor: colors.border },
  stepsTitle: { paddingVertical: 16, fontFamily: fonts.bodySemiBold, fontSize: 14, color: colors.ink },
  step: { minHeight: 68, paddingVertical: 11, flexDirection: 'row', alignItems: 'center', gap: 13, borderTopWidth: 1, borderTopColor: colors.border },
  stepNumber: { width: 34, height: 34, alignItems: 'center', justifyContent: 'center', borderRadius: 17, backgroundColor: colors.ink },
  stepNumberText: { fontFamily: fonts.bodySemiBold, fontSize: 12, color: colors.paper },
  stepCopy: { flex: 1 },
  stepTitle: { fontFamily: fonts.bodySemiBold, fontSize: 13, color: colors.ink },
  stepText: { marginTop: 3, fontFamily: fonts.body, fontSize: 12, lineHeight: 17, color: colors.secondary },
  freeCard: { marginTop: 24, padding: 15, flexDirection: 'row', alignItems: 'flex-start', gap: 10, borderRadius: radius.md, backgroundColor: colors.greenSoft },
  freeText: { flex: 1, fontFamily: fonts.body, fontSize: 12, lineHeight: 18, color: colors.green },
  permissionButton: { minHeight: 54, marginTop: 28, paddingHorizontal: 18, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 9, borderRadius: radius.md, backgroundColor: colors.ink },
  permissionButtonText: { fontFamily: fonts.bodySemiBold, fontSize: 14, color: colors.paper },
  permissionFootnote: { marginTop: 10, textAlign: 'center', fontFamily: fonts.body, fontSize: 11, color: colors.muted },
  pressed: { opacity: 0.7, transform: [{ scale: 0.99 }] },
});
