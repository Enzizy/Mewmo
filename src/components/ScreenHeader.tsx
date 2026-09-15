import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Pressable, Text, View } from 'react-native';
import { colors, fonts, themedStyles } from '@/constants/theme';
import { useTheme } from '@/store/ThemeContext';

export function ScreenHeader({ title, back = false, action, onBack }: { title?: string; back?: boolean; action?: React.ReactNode; onBack?: () => void }) {
  useTheme();
  const router = useRouter();
  const goBack = onBack ?? (() => router.canGoBack() ? router.back() : router.replace('/'));
  return (
    <View style={styles.row}>
      {back ? <Pressable accessibilityRole="button" accessibilityLabel="Go back" onPress={goBack} style={styles.iconButton}><Feather name="arrow-left" size={22} color={colors.ink} /></Pressable> : <View style={styles.iconSpacer} />}
      {title ? <Text accessibilityRole="header" numberOfLines={2} style={styles.title}>{title}</Text> : <View style={styles.grow} />}
      <View style={styles.action}>{action}</View>
    </View>
  );
}

const styles = themedStyles(() => ({
  row: { minHeight: 44, flexDirection: 'row', alignItems: 'center', marginBottom: 20 },
  iconButton: { width: 44, height: 44, marginLeft: -10, alignItems: 'center', justifyContent: 'center' },
  iconSpacer: { width: 34 },
  grow: { flex: 1 },
  title: { flex: 1, textAlign: 'center', fontFamily: fonts.bodySemiBold, fontSize: 16, color: colors.ink },
  action: { minWidth: 44, alignItems: 'flex-end', marginLeft: 8 },
}));
