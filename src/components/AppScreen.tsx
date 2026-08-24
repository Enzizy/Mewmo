import { PropsWithChildren } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View } from 'react-native';
import Animated, { FadeIn, useReducedMotion } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, motion } from '@/constants/theme';
import { AssistantFab } from './AssistantFab';

export function AppScreen({ children, scroll = true, assistant = false, tabbed = false, background = colors.background }: PropsWithChildren<{ scroll?: boolean; assistant?: boolean; tabbed?: boolean; background?: string }>) {
  const reduceMotion = useReducedMotion();
  const content = scroll ? (
    <ScrollView contentInsetAdjustmentBehavior="automatic" contentContainerStyle={[styles.content, (assistant || tabbed) && styles.withTabBar]} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">{children}</ScrollView>
  ) : <View style={[styles.content, styles.fill, (assistant || tabbed) && styles.withTabBar]}>{children}</View>;

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: background }]} edges={['top', 'left', 'right']}>
      <KeyboardAvoidingView style={styles.fill} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <Animated.View entering={reduceMotion ? undefined : FadeIn.duration(motion.base)} style={styles.frame}>{content}</Animated.View>
      </KeyboardAvoidingView>
      {assistant && <AssistantFab elevated />}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  fill: { flex: 1 },
  frame: { width: '100%', maxWidth: 640, flex: 1, alignSelf: 'center' },
  content: { paddingHorizontal: 22, paddingTop: 18, paddingBottom: 40 },
  withTabBar: { paddingBottom: 112 },
});
