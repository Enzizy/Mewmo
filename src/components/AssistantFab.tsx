import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Pressable, StyleSheet } from 'react-native';
import Animated, { ZoomIn, useReducedMotion } from 'react-native-reanimated';
import { colors, motion } from '@/constants/theme';

export function AssistantFab({ elevated = false }: { elevated?: boolean }) {
  const router = useRouter();
  const reduceMotion = useReducedMotion();
  return <Animated.View entering={reduceMotion ? undefined : ZoomIn.duration(motion.base)} style={[styles.wrapper, elevated && styles.elevated]}><Pressable accessibilityLabel="Ask your personal assistant" accessibilityRole="button" onPress={() => router.push('/chat')} style={({ pressed }) => [styles.button, pressed && styles.pressed]}><Feather name="message-circle" size={22} color={colors.surface} /></Pressable></Animated.View>;
}

const styles = StyleSheet.create({
  wrapper: { position: 'absolute', right: 20, bottom: 18 },
  elevated: { bottom: 24 },
  button: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.ink, borderWidth: 2, borderColor: colors.surface },
  pressed: { opacity: 0.72 },
});
