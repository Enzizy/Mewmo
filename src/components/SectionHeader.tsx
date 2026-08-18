import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { colors, fonts } from '@/constants/theme';

export function SectionHeader({ title, action, onPress }: { title: string; action?: string; onPress?: () => void }) {
  return (
    <View style={styles.row}>
      <Text style={styles.title}>{title}</Text>
      {action && <Pressable accessibilityRole="button" onPress={onPress} style={styles.action}>
        <Text style={styles.actionText}>{action}</Text><Feather name="arrow-right" size={15} color={colors.secondary} />
      </Pressable>}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 },
  title: { fontFamily: fonts.bodySemiBold, fontSize: 18, color: colors.ink },
  action: { minHeight: 32, flexDirection: 'row', alignItems: 'center', gap: 5 },
  actionText: { fontFamily: fonts.bodyMedium, fontSize: 13, color: colors.secondary },
});
