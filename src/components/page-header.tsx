import { PropsWithChildren, ReactNode } from 'react';
import { Text, View } from 'react-native';
import { colors, fonts, themedStyles } from '@/constants/theme';
import { useTheme } from '@/store/ThemeContext';

type PageHeaderProps = PropsWithChildren<{
  title: string;
  eyebrow?: string;
  supporting?: string;
  action?: ReactNode;
  layout?: 'inline' | 'stacked';
}>;

export function PageHeader({ title, eyebrow, supporting, action, children, layout = 'inline' }: PageHeaderProps) {
  useTheme();
  if (layout === 'stacked') {
    return (
      <View style={styles.stackedHeader}>
        <View style={styles.topRow}>
          {eyebrow ? <Text style={[styles.eyebrow, styles.stackedEyebrow]}>{eyebrow}</Text> : <View />}
          {action ? <View style={styles.action}>{action}</View> : null}
        </View>
        <Text accessibilityRole="header" style={styles.title}>{title}</Text>
        {supporting ? <Text style={styles.supporting}>{supporting}</Text> : null}
        {children}
      </View>
    );
  }

  return (
    <View style={styles.header}>
      <View style={styles.copy}>
        {eyebrow ? <Text style={styles.eyebrow}>{eyebrow}</Text> : null}
        <Text accessibilityRole="header" style={styles.title}>{title}</Text>
        {supporting ? <Text style={styles.supporting}>{supporting}</Text> : null}
        {children}
      </View>
      {action ? <View style={styles.action}>{action}</View> : null}
    </View>
  );
}

const styles = themedStyles(() => ({
  header: { minHeight: 72, flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16 },
  stackedHeader: { minHeight: 72 },
  topRow: { minHeight: 48, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 16 },
  copy: { flex: 1 },
  eyebrow: { marginBottom: 5, fontFamily: fonts.bodySemiBold, fontSize: 11, lineHeight: 15, letterSpacing: 0.7, textTransform: 'uppercase', color: colors.muted },
  stackedEyebrow: { flex: 1, marginBottom: 0 },
  title: { fontFamily: fonts.bodyBold, fontSize: 30, lineHeight: 36, letterSpacing: -0.8, color: colors.ink },
  supporting: { marginTop: 5, maxWidth: 430, fontFamily: fonts.body, fontSize: 14, lineHeight: 20, color: colors.secondary },
  action: { minHeight: 48, alignItems: 'flex-end', justifyContent: 'center' },
}));
