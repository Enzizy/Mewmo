import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { Easing, SharedValue, useAnimatedStyle, useSharedValue, withRepeat, withTiming } from 'react-native-reanimated';
import { colors } from '@/constants/theme';

const bars = [10, 18, 28, 42, 24, 36, 18, 46, 32, 16, 26, 12];

export function Waveform({ active = false, light = false, compact = false }: { active?: boolean; light?: boolean; compact?: boolean }) {
  const motion = useSharedValue(0);
  useEffect(() => {
    motion.value = active ? withRepeat(withTiming(1, { duration: 760, easing: Easing.inOut(Easing.ease) }), -1, true) : withTiming(0);
  }, [active, motion]);

  return (
    <View style={[styles.row, compact && styles.compact]} accessibilityLabel={active ? 'Animated recording waveform' : 'Audio waveform'}>
      {bars.map((height, index) => <WaveBar key={index} height={compact ? height * 0.45 : height} index={index} motion={motion} light={light} />)}
    </View>
  );
}

function WaveBar({ height, index, motion, light }: { height: number; index: number; motion: SharedValue<number>; light: boolean }) {
  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scaleY: 0.65 + motion.value * (index % 3 === 0 ? 0.7 : index % 2 === 0 ? 0.35 : 0.5) }],
  }));
  return <Animated.View style={[styles.bar, { height, backgroundColor: light ? colors.surface : colors.dark }, animatedStyle]} />;
}

const styles = StyleSheet.create({
  row: { height: 52, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5 },
  compact: { height: 28, gap: 3 },
  bar: { width: 3, borderRadius: 2 },
});
