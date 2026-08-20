import { PropsWithChildren, ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { colors, fonts } from '@/constants/theme';

export function PageHeader({ title, eyebrow, supporting, action, children }: PropsWithChildren<{ title: string; eyebrow?: string; supporting?: string; action?: ReactNode }>) {
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

const styles = StyleSheet.create({
  header: { minHeight: 72, flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16 },
  copy: { flex: 1 },
  eyebrow: { marginBottom: 5, fontFamily: fonts.bodySemiBold, fontSize: 11, lineHeight: 15, letterSpacing: 0.7, textTransform: 'uppercase', color: colors.muted },
  title: { fontFamily: fonts.bodyBold, fontSize: 30, lineHeight: 36, letterSpacing: -0.8, color: colors.ink },
  supporting: { marginTop: 5, maxWidth: 430, fontFamily: fonts.body, fontSize: 14, lineHeight: 20, color: colors.secondary },
  action: { minHeight: 48, alignItems: 'flex-end', justifyContent: 'center' },
});
