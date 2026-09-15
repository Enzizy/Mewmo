import { ReactNode } from 'react';
import { Text, View } from 'react-native';
import { colors, fonts, themedStyles } from '@/constants/theme';
import { useTheme } from '@/store/ThemeContext';

export function SectionHeading({ title, detail, action }: { title: string; detail?: string; action?: ReactNode }) {
  useTheme();
  return (
    <View style={styles.row}>
      <View style={styles.copy}>
        <Text accessibilityRole="header" style={styles.title}>{title}</Text>
        {detail ? <Text style={styles.detail}>{detail}</Text> : null}
      </View>
      {action}
    </View>
  );
}

const styles = themedStyles(() => ({
  row: { minHeight: 32, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 16 },
  copy: { flex: 1 },
  title: { fontFamily: fonts.bodySemiBold, fontSize: 17, lineHeight: 22, letterSpacing: -0.15, color: colors.ink },
  detail: { marginTop: 3, fontFamily: fonts.body, fontSize: 12, lineHeight: 17, color: colors.secondary },
}));
