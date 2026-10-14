import { Feather } from '@expo/vector-icons';
import { createContext, PropsWithChildren, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { AppState, Pressable, Text, View } from 'react-native';
import { PixelCat } from '@/components/PixelCat';
import { colors, fonts, radius, themedStyles } from '@/constants/theme';
import { getBiometricSupport, isAppLockSupportedPlatform, unlockWithDevice } from '@/services/appLock';
import { useTheme } from '@/store/ThemeContext';

const APP_LOCK_KEY = 'lifedesk.appLock';
/** Short trips away, such as picking a photo or sharing a file, should not ask again. */
const RELOCK_AFTER_MS = 30_000;

type AppLockContextValue = {
  lockEnabled: boolean;
  /** Turning the lock on asks you to unlock once, so it can never be enabled on a phone that cannot unlock it. */
  setLockEnabled: (enabled: boolean) => Promise<{ ok: boolean; message?: string }>;
};

const AppLockContext = createContext<AppLockContextValue | null>(null);

function readLockPreference() {
  if (!isAppLockSupportedPlatform()) return false;
  try { return localStorage.getItem(APP_LOCK_KEY) === 'true'; } catch { return false; }
}

export function AppLockGate({ children }: PropsWithChildren) {
  useTheme();
  const [lockEnabled, setLockEnabledState] = useState(readLockPreference);
  const [locked, setLocked] = useState(lockEnabled);
  // Hides content while the app is in the background, so the app switcher preview shows no balances.
  const [covered, setCovered] = useState(false);
  const [method, setMethod] = useState('Screen lock');
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const authenticating = useRef(false);
  const backgroundedAt = useRef<number | null>(null);

  const persist = (enabled: boolean) => {
    setLockEnabledState(enabled);
    try { localStorage.setItem(APP_LOCK_KEY, String(enabled)); } catch { /* The preference stays in memory for this session. */ }
  };

  const unlock = useCallback(async () => {
    if (authenticating.current) return;
    authenticating.current = true;
    setBusy(true);
    setMessage(null);
    try {
      const result = await unlockWithDevice();
      if (result.ok) { setLocked(false); return; }
      if (result.disableLock) { persist(false); setLocked(false); }
      if (!result.cancelled || result.disableLock) setMessage(result.message);
    } catch {
      setMessage('That did not work. Try again.');
    } finally {
      authenticating.current = false;
      setBusy(false);
    }
  }, []);

  useEffect(() => { if (lockEnabled) getBiometricSupport().then((support) => setMethod(support.method)).catch(() => undefined); }, [lockEnabled]);

  // Ask straight away whenever the lock screen appears while the app is in front.
  useEffect(() => { if (locked && AppState.currentState === 'active') void unlock(); }, [locked, unlock]);

  useEffect(() => {
    if (!lockEnabled) { setCovered(false); return undefined; }
    const subscription = AppState.addEventListener('change', (state) => {
      // The system prompt itself moves the app out of the foreground; that is not leaving.
      if (authenticating.current) return;
      if (state === 'background' || state === 'inactive') {
        backgroundedAt.current ??= Date.now();
        setCovered(true);
        return;
      }
      if (state === 'active') {
        const away = backgroundedAt.current == null ? 0 : Date.now() - backgroundedAt.current;
        backgroundedAt.current = null;
        setCovered(false);
        if (away >= RELOCK_AFTER_MS) setLocked(true);
      }
    });
    return () => subscription.remove();
  }, [lockEnabled]);

  const setLockEnabled = useCallback(async (enabled: boolean) => {
    if (!enabled) { persist(false); return { ok: true }; }
    const support = await getBiometricSupport();
    if (!support.available) return { ok: false, message: support.reason };
    authenticating.current = true;
    try {
      const result = await unlockWithDevice('Confirm it is you to turn on app lock');
      if (!result.ok) return { ok: false, message: result.cancelled ? undefined : result.message };
      setMethod(support.method);
      persist(true);
      return { ok: true };
    } finally { authenticating.current = false; }
  }, []);

  const value = useMemo(() => ({ lockEnabled, setLockEnabled }), [lockEnabled, setLockEnabled]);
  const hidden = lockEnabled && (locked || covered);

  return (
    <AppLockContext.Provider value={value}>
      <View style={styles.fill} accessibilityElementsHidden={hidden} importantForAccessibility={hidden ? 'no-hide-descendants' : 'auto'}>{children}</View>
      {hidden ? (
        <View style={styles.lock} accessibilityViewIsModal>
          <PixelCat pose={locked ? 'sleep' : 'idle'} size={104} />
          <Text accessibilityRole="header" style={styles.title}>LifeDesk is locked</Text>
          <Text style={styles.detail}>Your money, cards, and plans stay private until you unlock.</Text>
          {locked ? <Pressable accessibilityRole="button" accessibilityState={{ busy }} disabled={busy} onPress={() => void unlock()} style={({ pressed }) => [styles.button, (busy || pressed) && styles.buttonDim]}>
            <Feather name={method === 'Fingerprint' ? 'unlock' : 'lock'} size={18} color={colors.paper} />
            <Text style={styles.buttonText}>{busy ? 'Waiting…' : `Unlock with ${method === 'Screen lock' ? 'your screen lock' : method.toLowerCase().replace('face id', 'Face ID')}`}</Text>
          </Pressable> : null}
          {message ? <Text accessibilityLiveRegion="polite" style={styles.message}>{message}</Text> : null}
        </View>
      ) : null}
    </AppLockContext.Provider>
  );
}

export function useAppLock() {
  const value = useContext(AppLockContext);
  if (!value) throw new Error('useAppLock must be used inside AppLockGate.');
  return value;
}

const styles = themedStyles(() => ({
  fill: { flex: 1 },
  lock: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, zIndex: 50, paddingHorizontal: 32, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background },
  title: { marginTop: 18, fontFamily: fonts.bodyBold, fontSize: 24, letterSpacing: -0.5, color: colors.ink },
  detail: { maxWidth: 300, marginTop: 6, textAlign: 'center', fontFamily: fonts.body, fontSize: 14, lineHeight: 20, color: colors.secondary },
  button: { minHeight: 52, marginTop: 28, paddingHorizontal: 22, flexDirection: 'row', alignItems: 'center', gap: 10, borderRadius: radius.md, backgroundColor: colors.ink },
  buttonDim: { opacity: 0.7 },
  buttonText: { fontFamily: fonts.bodySemiBold, fontSize: 15, color: colors.paper },
  message: { maxWidth: 300, marginTop: 14, textAlign: 'center', fontFamily: fonts.bodyMedium, fontSize: 13, lineHeight: 19, color: colors.danger },
}));
