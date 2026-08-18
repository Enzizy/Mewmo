import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Pressable, StyleSheet } from 'react-native';
import Animated, { ZoomIn, useReducedMotion } from 'react-native-reanimated';
import { colors, motion } from '@/constants/theme';

export function AssistantFab() {
  const router = useRouter();
  const reduceMotion = useReducedMotion();
  return <Animated.View entering={reduceMotion ? undefined : ZoomIn.duration(motion.base)} style={styles.wrapper}><Pressable accessibilityLabel="Ask your personal assistant" accessibilityRole="button" onPress={() => router.push('/chat')} style={({ pressed }) => [styles.button, pressed && styles.pressed]}><Feather name="message-circle" size={24} color={colors.surface} /></Pressable></Animated.View>;
}

const styles = StyleSheet.create({
  wrapper: { position: 'absolute', right: 18, bottom: 86 },
  button: { width: 52, height: 52, borderRadius: 26, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.ink, borderWidth: 2, borderColor: colors.surface },
  pressed: { opacity: 0.72 },
});
