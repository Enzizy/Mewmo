import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, fonts } from '@/constants/theme';
import { Waveform } from './Waveform';

export function VoiceCapture() {
  const router = useRouter();
  return (
    <Pressable accessibilityRole="button" accessibilityLabel="Tell Mewmo what is on your mind" onPress={() => router.push('/record')} style={({ pressed }) => [styles.card, pressed && styles.pressed]}>
      <View style={styles.topRow}>
        <View style={styles.mic}><Feather name="mic" size={24} color={colors.terracottaDark} /></View>
        <Waveform light compact />
      </View>
      <Text style={styles.title}>Tell Mewmo</Text>
      <Text style={styles.support}>or hold to talk</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: { minHeight: 190, padding: 22, borderRadius: 22, backgroundColor: colors.terracotta, justifyContent: 'space-between' },
  pressed: { transform: [{ scale: 0.985 }], backgroundColor: colors.terracottaDark },
  topRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  mic: { width: 48, height: 48, borderRadius: 24, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center' },
  title: { marginTop: 26, fontFamily: fonts.editorialSemiBold, fontSize: 28, color: colors.surface },
  support: { marginTop: 3, fontFamily: fonts.body, fontSize: 13, color: '#F7E8E1' },
});
