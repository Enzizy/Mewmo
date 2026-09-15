import { useEffect, useMemo, useState } from 'react';
import { Image, Text, View } from 'react-native';
import { useReducedMotion } from 'react-native-reanimated';
import { colors, fonts, themedStyles } from '@/constants/theme';
import { useTheme } from '@/store/ThemeContext';

export type CatPose = 'idle' | 'curious' | 'listen' | 'sorting' | 'sleep' | 'celebrate';

const atlas = require('../../assets/black-cat-atlas-v2.png');
const handsUp = require('../../assets/cat-hands-up.png');

const sequences: Record<Exclude<CatPose, 'celebrate'>, { row: number; frames: number[]; duration: number }> = {
  idle: { row: 3, frames: [0, 1, 2, 1], duration: 440 },
  curious: { row: 3, frames: [1, 2, 3, 4, 3, 2], duration: 380 },
  listen: { row: 3, frames: [0, 1, 2, 1], duration: 360 },
  sorting: { row: 6, frames: [0, 1, 2, 3, 4, 5, 6, 7], duration: 330 },
  sleep: { row: 4, frames: [0, 1, 2, 3, 2, 1], duration: 820 },
};

export function PixelCat({ pose = 'idle', size = 96, speech }: { pose?: CatPose; size?: number; speech?: string }) {
  useTheme();
  const reduceMotion = useReducedMotion();
  const sequence = pose === 'celebrate' ? null : sequences[pose];
  const [tick, setTick] = useState(0);
  const frame = sequence?.frames[tick % sequence.frames.length] ?? 0;

  useEffect(() => {
    setTick(0);
    if (!sequence || reduceMotion) return undefined;
    const timer = setInterval(() => setTick((value) => value + 1), sequence.duration);
    return () => clearInterval(timer);
  }, [reduceMotion, sequence]);

  const atlasStyle = useMemo(() => sequence ? {
    width: size * 8,
    height: size * 8,
    left: -frame * size,
    top: -sequence.row * size,
  } : undefined, [frame, sequence, size]);
  // Keep texture filtering away from the adjacent atlas row. Without this
  // inset Android can sample its first dark pixel as a dot below the cat.
  const atlasClipHeight = size - Math.max(2, Math.round(size * 0.025));

  return (
    <View style={styles.wrapper}>
      {speech ? <View style={styles.speech}><Text style={styles.speechText}>{speech}</Text><View style={styles.speechTail} /></View> : null}
      <View accessibilityLabel={`Black pixel cat, ${pose}`} accessibilityRole="image" style={{ width: size, height: size }}>
        {pose === 'celebrate'
          ? <Image source={handsUp} resizeMode="contain" style={{ width: size, height: size }} />
          : <View style={{ width: size, height: atlasClipHeight, overflow: 'hidden' }}>
              <Image source={atlas} resizeMethod="resize" resizeMode="stretch" style={[styles.atlas, atlasStyle]} />
            </View>}
      </View>
    </View>
  );
}

const styles = themedStyles(() => ({
  wrapper: { position: 'relative', alignItems: 'center', justifyContent: 'flex-end' },
  atlas: { position: 'absolute' },
  speech: { position: 'absolute', zIndex: 2, top: -5, right: -25, minWidth: 58, paddingHorizontal: 9, paddingVertical: 6, borderWidth: 1, borderColor: colors.ink, borderRadius: 4, backgroundColor: colors.surface },
  speechText: { fontFamily: fonts.bodySemiBold, fontSize: 11, color: colors.ink, textAlign: 'center' },
  speechTail: { position: 'absolute', left: 9, bottom: -4, width: 7, height: 7, borderLeftWidth: 1, borderBottomWidth: 1, borderColor: colors.ink, backgroundColor: colors.surface, transform: [{ rotate: '-45deg' }] },
}));
