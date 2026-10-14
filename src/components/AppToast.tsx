import { Feather } from '@expo/vector-icons';
import { createContext, PropsWithChildren, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { AccessibilityInfo, Platform, Pressable, Text, useWindowDimensions, View } from 'react-native';
import Animated, { FadeInDown, FadeOutDown, useReducedMotion } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, fonts, motion, radius, themedStyles } from '@/constants/theme';
import { useTheme } from '@/store/ThemeContext';

export type AppToastOptions = {
  message: string;
  icon?: keyof typeof Feather.glyphMap;
  /** A single follow-up such as Undo. The toast closes when it is pressed. */
  action?: { label: string; onPress: () => void | Promise<void> };
  durationMs?: number;
};

type ToastState = AppToastOptions & { key: number };
type AppToastContextValue = { showToast: (options: AppToastOptions) => void };

const AppToastContext = createContext<AppToastContextValue | null>(null);

/**
 * Short, non-blocking confirmation for actions that already happened. Use the
 * dialog for anything that needs a decision first; use this to acknowledge and
 * offer an undo.
 */
export function AppToastProvider({ children }: PropsWithChildren) {
  useTheme();
  const reduceMotion = useReducedMotion();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const desktop = Platform.OS === 'web' && width >= 900;
  const [toast, setToast] = useState<ToastState | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const counter = useRef(0);

  const dismiss = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    setToast(null);
  }, []);

  const showToast = useCallback((options: AppToastOptions) => {
    if (timer.current) clearTimeout(timer.current);
    counter.current += 1;
    setToast({ ...options, key: counter.current });
    // An undo needs a little longer to reach than a plain acknowledgement.
    timer.current = setTimeout(() => setToast(null), options.durationMs ?? (options.action ? 5200 : 3200));
    if (Platform.OS !== 'web') AccessibilityInfo.announceForAccessibility(options.message);
  }, []);

  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  const value = useMemo(() => ({ showToast }), [showToast]);

  return (
    <AppToastContext.Provider value={value}>
      {children}
      <View pointerEvents="box-none" style={[styles.layer, { bottom: desktop ? 28 : insets.bottom + 84 }]}>
        {toast ? (
          <Animated.View
            key={toast.key}
            accessibilityLiveRegion="polite"
            accessibilityRole="alert"
            entering={reduceMotion ? undefined : FadeInDown.duration(motion.base)}
            exiting={reduceMotion ? undefined : FadeOutDown.duration(motion.fast)}
            style={styles.toast}
          >
            {toast.icon ? <Feather name={toast.icon} size={17} color={colors.paper} /> : null}
            <Text numberOfLines={2} style={styles.message}>{toast.message}</Text>
            {toast.action ? (
              <Pressable
                accessibilityRole="button"
                hitSlop={8}
                onPress={() => { const action = toast.action; dismiss(); void action?.onPress(); }}
                style={({ pressed }) => [styles.action, pressed && styles.pressed]}
              >
                <Text style={styles.actionLabel}>{toast.action.label}</Text>
              </Pressable>
            ) : (
              <Pressable accessibilityRole="button" accessibilityLabel="Dismiss message" hitSlop={8} onPress={dismiss} style={styles.close}>
                <Feather name="x" size={16} color={colors.onInkMuted} />
              </Pressable>
            )}
          </Animated.View>
        ) : null}
      </View>
    </AppToastContext.Provider>
  );
}

export function useAppToast() {
  const value = useContext(AppToastContext);
  if (!value) throw new Error('useAppToast must be used inside AppToastProvider.');
  return value;
}

const styles = themedStyles(() => ({
  layer: { position: 'absolute', left: 16, right: 16, alignItems: 'center' },
  toast: {
    width: '100%', maxWidth: 460, minHeight: 52, paddingLeft: 16, paddingRight: 6, flexDirection: 'row', alignItems: 'center', gap: 10,
    borderRadius: radius.md, backgroundColor: colors.ink,
    shadowColor: '#000000', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.18, shadowRadius: 24, elevation: 10,
  },
  message: { flex: 1, paddingVertical: 14, fontFamily: fonts.bodyMedium, fontSize: 13, lineHeight: 18, color: colors.paper },
  action: { minHeight: 36, paddingHorizontal: 14, alignItems: 'center', justifyContent: 'center', borderRadius: radius.sm, backgroundColor: colors.onInkBorder },
  actionLabel: { fontFamily: fonts.bodyBold, fontSize: 13, color: colors.paper },
  close: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  pressed: { opacity: 0.7 },
}));
