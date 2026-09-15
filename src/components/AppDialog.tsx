import { Feather } from '@expo/vector-icons';
import {
  AccessibilityInfo,
  Animated,
  findNodeHandle,
  Keyboard,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { createContext, PropsWithChildren, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, fonts, motion, radius, spacing, themedStyles } from '@/constants/theme';
import { useTheme } from '@/store/ThemeContext';

export type AppDialogTone = 'info' | 'warning' | 'danger' | 'success';

export type AppDialogAction = {
  label: string;
  variant?: 'primary' | 'secondary' | 'danger';
  onPress?: () => void | Promise<void>;
};

export type AppDialogOptions = {
  title: string;
  message: string;
  tone?: AppDialogTone;
  actions?: AppDialogAction[];
  dismissible?: boolean;
};

type AppDialogContextValue = {
  showDialog: (options: AppDialogOptions) => void;
};

const AppDialogContext = createContext<AppDialogContextValue | null>(null);

export function AppDialogProvider({ children }: PropsWithChildren) {
  useTheme();
  const [dialog, setDialog] = useState<AppDialogOptions | null>(null);
  const [reduceMotion, setReduceMotion] = useState(false);
  const progress = useRef(new Animated.Value(0)).current;
  const closing = useRef(false);
  const titleRef = useRef<Text>(null);
  const initialActionRef = useRef<View>(null);
  const safeArea = useSafeAreaInsets();

  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled().then(setReduceMotion).catch(() => undefined);
    const subscription = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduceMotion);
    return () => subscription.remove();
  }, []);

  const showDialog = useCallback((options: AppDialogOptions) => {
    Keyboard.dismiss();
    closing.current = false;
    setDialog(options);
  }, []);

  const finishClose = useCallback((action?: AppDialogAction) => {
    if (closing.current) return;
    closing.current = true;
    const complete = () => {
      setDialog(null);
      closing.current = false;
      if (action?.onPress) void action.onPress();
    };
    if (reduceMotion) {
      complete();
      return;
    }
    Animated.timing(progress, {
      toValue: 0,
      duration: motion.fast,
      useNativeDriver: true,
    }).start(complete);
  }, [progress, reduceMotion]);

  useEffect(() => {
    if (!dialog) return;
    progress.setValue(reduceMotion ? 1 : 0);
    if (!reduceMotion) {
      Animated.timing(progress, {
        toValue: 1,
        duration: motion.base,
        useNativeDriver: true,
      }).start();
    }
  }, [dialog, progress, reduceMotion]);

  const contextValue = useMemo(() => ({ showDialog }), [showDialog]);
  const actions = dialog?.actions?.length ? dialog.actions.slice(0, 2) : [{ label: 'Got it', variant: 'primary' as const }];
  const canDismiss = dialog?.dismissible ?? actions.length === 1;
  const tone = dialog?.tone ?? 'info';
  const toneStyle = toneStyles[tone];

  const focusDialog = () => {
    if (Platform.OS === 'web') {
      const focusable = initialActionRef.current as unknown as { focus?: () => void };
      setTimeout(() => focusable.focus?.(), 80);
      return;
    }
    const handle = findNodeHandle(initialActionRef.current ?? titleRef.current);
    if (handle) setTimeout(() => AccessibilityInfo.setAccessibilityFocus(handle), 80);
  };

  return (
    <AppDialogContext.Provider value={contextValue}>
      <View
        accessibilityElementsHidden={Boolean(dialog)}
        aria-hidden={Boolean(dialog)}
        importantForAccessibility={dialog ? 'no-hide-descendants' : 'auto'}
        pointerEvents={dialog ? 'none' : 'auto'}
        style={styles.content}
      >
        {children}
      </View>
      <Modal
        accessibilityViewIsModal
        animationType="none"
        onRequestClose={() => { if (canDismiss) finishClose(); }}
        onShow={focusDialog}
        statusBarTranslucent
        transparent
        visible={Boolean(dialog)}
      >
        <View style={[styles.layer, { paddingTop: safeArea.top + spacing.xl, paddingBottom: safeArea.bottom + spacing.xl }]}>
          <Animated.View pointerEvents="none" style={[styles.scrim, { opacity: progress.interpolate({ inputRange: [0, 1], outputRange: [0, 0.48] }) }]} />
          {canDismiss ? <Pressable accessibilityLabel="Close dialog" accessibilityRole="button" onPress={() => finishClose()} style={StyleSheet.absoluteFill} /> : null}
          {dialog ? (
            <Animated.View
              accessibilityLabel={`${dialog.title}. ${dialog.message}`}
              accessibilityRole="alert"
              style={[
                styles.dialog,
                {
                  opacity: progress,
                  transform: [
                    { translateY: progress.interpolate({ inputRange: [0, 1], outputRange: [14, 0] }) },
                    { scale: progress.interpolate({ inputRange: [0, 1], outputRange: [0.98, 1] }) },
                  ],
                },
              ]}
            >
              <View style={[styles.icon, { backgroundColor: toneStyle.soft }]}>
                <Feather accessibilityElementsHidden importantForAccessibility="no-hide-descendants" name={toneStyle.icon} size={20} color={toneStyle.strong} />
              </View>
              <Text ref={titleRef} accessibilityRole="header" style={styles.title}>{dialog.title}</Text>
              <Text style={styles.message}>{dialog.message}</Text>
              <View style={[styles.actions, actions.length === 1 && styles.singleAction]}>
                {actions.map((action, index) => (
                  <Pressable
                    accessibilityRole="button"
                    key={action.label}
                    onPress={() => finishClose(action)}
                    ref={index === 0 ? initialActionRef : undefined}
                    style={({ pressed }) => [
                      styles.action,
                      action.variant === 'secondary' ? styles.secondaryAction : styles.primaryAction,
                      action.variant === 'danger' && styles.dangerAction,
                      pressed && styles.pressed,
                    ]}
                  >
                    <Text style={[styles.actionLabel, action.variant === 'secondary' ? styles.secondaryLabel : styles.primaryLabel]}>{action.label}</Text>
                  </Pressable>
                ))}
              </View>
            </Animated.View>
          ) : null}
        </View>
      </Modal>
    </AppDialogContext.Provider>
  );
}

export function useAppDialog() {
  const value = useContext(AppDialogContext);
  if (!value) throw new Error('useAppDialog must be used inside AppDialogProvider.');
  return value;
}

const toneStyles: Record<AppDialogTone, { icon: keyof typeof Feather.glyphMap; soft: string; strong: string }> = {
  info: { icon: 'info', soft: colors.accentSoft, strong: colors.accent },
  warning: { icon: 'alert-triangle', soft: colors.mustardSoft, strong: colors.mustard },
  danger: { icon: 'alert-octagon', soft: colors.dangerSoft, strong: colors.danger },
  success: { icon: 'check', soft: colors.greenSoft, strong: colors.green },
};

const styles = themedStyles(() => ({
  content: { flex: 1 },
  layer: { flex: 1, paddingHorizontal: spacing.xl, alignItems: 'center', justifyContent: 'center' },
  scrim: { position: 'absolute', inset: 0, backgroundColor: colors.scrim },
  dialog: {
    width: '100%', maxWidth: 420, padding: spacing.xl, borderRadius: radius.lg,
    borderWidth: 1, borderColor: colors.border, backgroundColor: colors.paper,
    shadowColor: colors.ink, shadowOffset: { width: 0, height: 16 }, shadowOpacity: 0.16, shadowRadius: 32,
    elevation: 12,
  },
  icon: { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center' },
  title: { marginTop: spacing.lg, fontFamily: fonts.bodyBold, fontSize: 20, lineHeight: 26, letterSpacing: -0.25, color: colors.ink },
  message: { marginTop: spacing.sm, fontFamily: fonts.body, fontSize: 14, lineHeight: 21, color: colors.secondary },
  actions: { marginTop: spacing.xl, flexDirection: 'row', gap: spacing.sm },
  singleAction: { justifyContent: 'flex-end' },
  action: { minHeight: 48, minWidth: 112, flex: 1, paddingHorizontal: spacing.lg, alignItems: 'center', justifyContent: 'center', borderRadius: radius.md },
  primaryAction: { backgroundColor: colors.ink },
  dangerAction: { backgroundColor: colors.danger },
  secondaryAction: { borderWidth: 1, borderColor: colors.borderStrong, backgroundColor: colors.paper },
  actionLabel: { textAlign: 'center', fontFamily: fonts.bodySemiBold, fontSize: 14, lineHeight: 19 },
  primaryLabel: { color: colors.paper },
  secondaryLabel: { color: colors.ink },
  pressed: { opacity: 0.74, transform: [{ scale: 0.99 }] },
}));
