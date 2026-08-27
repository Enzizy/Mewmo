import { Feather } from '@expo/vector-icons';
import { ReactNode } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { colors, fonts, radius } from '@/constants/theme';

export function ToolNotice({ icon = 'info', children }: { icon?: React.ComponentProps<typeof Feather>['name']; children: ReactNode }) {
  return <View style={styles.notice}><Feather name={icon} size={17} color={colors.accent} /><Text style={styles.noticeText}>{children}</Text></View>;
}

export function OptionStrip({ label, values, selected, onSelect }: { label: string; values: readonly string[]; selected: string; onSelect: (value: string) => void }) {
  return <View style={styles.optionGroup}><Text style={styles.label}>{label}</Text><ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.options}>{values.map((value) => <Pressable accessibilityRole="radio" accessibilityState={{ checked: value === selected }} key={value} onPress={() => onSelect(value)} style={[styles.option, value === selected && styles.optionActive]}><Text style={[styles.optionText, value === selected && styles.optionTextActive]}>{value}</Text></Pressable>)}</ScrollView></View>;
}

export function ValueField({ label, value, onChangeText, placeholder = 'Enter a value', suffix, multiline = false, maxLength }: { label: string; value: string; onChangeText: (value: string) => void; placeholder?: string; suffix?: string; multiline?: boolean; maxLength?: number }) {
  return <View style={styles.fieldGroup}><Text style={styles.label}>{label}</Text><View style={[styles.field, multiline && styles.multilineField]}><TextInput accessibilityLabel={label} value={value} onChangeText={onChangeText} placeholder={placeholder} placeholderTextColor={colors.muted} keyboardType={multiline ? 'default' : 'decimal-pad'} multiline={multiline} textAlignVertical={multiline ? 'top' : 'center'} maxLength={maxLength} style={[styles.input, multiline && styles.multilineInput]} />{suffix ? <Text style={styles.suffix}>{suffix}</Text> : null}</View></View>;
}

export function SwapButton({ onPress, label = 'Swap values', disabled = false }: { onPress: () => void; label?: string; disabled?: boolean }) {
  return <View style={styles.swapRow}><View style={styles.rule} /><Pressable accessibilityLabel={label} accessibilityState={{ disabled }} disabled={disabled} onPress={onPress} style={({ pressed }) => [styles.swap, disabled && styles.swapDisabled, pressed && styles.pressed]}><Feather name="repeat" size={18} color={disabled ? colors.muted : colors.ink} /></Pressable><View style={styles.rule} /></View>;
}

export function PendingResult({ title, detail }: { title: string; detail: string }) {
  return <View style={styles.result}><View style={styles.resultIcon}><Feather name="clock" size={18} color={colors.secondary} /></View><View style={styles.resultCopy}><Text style={styles.resultTitle}>{title}</Text><Text style={styles.resultDetail}>{detail}</Text></View></View>;
}

export function ToolAction({ label, onPress, loading = false, icon }: { label: string; onPress: () => void; loading?: boolean; icon?: React.ComponentProps<typeof Feather>['name'] }) {
  return <Pressable accessibilityRole="button" accessibilityState={{ busy: loading, disabled: loading }} disabled={loading} onPress={onPress} style={({ pressed }) => [styles.action, pressed && styles.actionPressed]}>{loading ? <ActivityIndicator size="small" color={colors.paper} /> : icon ? <Feather name={icon} size={17} color={colors.paper} /> : null}<Text style={styles.actionText}>{loading ? `${label}…` : label}</Text></Pressable>;
}

export function InlineError({ message }: { message: string }) {
  return <View accessibilityLiveRegion="polite" style={styles.error}><Feather name="alert-circle" size={17} color={colors.danger} /><Text style={styles.errorText}>{message}</Text></View>;
}

export function ResultPanel({ eyebrow, value, detail, children }: { eyebrow: string; value: string; detail: string; children?: ReactNode }) {
  return <View accessibilityLiveRegion="polite" style={styles.resultPanel}><Text style={styles.resultEyebrow}>{eyebrow}</Text><Text selectable style={styles.resultValue}>{value}</Text><Text style={styles.resultPanelDetail}>{detail}</Text>{children ? <View style={styles.resultActions}>{children}</View> : null}</View>;
}

const styles = StyleSheet.create({
  notice: { marginTop: 22, padding: 14, flexDirection: 'row', alignItems: 'flex-start', gap: 10, borderRadius: radius.md, backgroundColor: colors.accentSoft },
  noticeText: { flex: 1, fontFamily: fonts.body, fontSize: 12, lineHeight: 18, color: colors.ink },
  optionGroup: { marginTop: 22 },
  label: { marginBottom: 9, fontFamily: fonts.bodySemiBold, fontSize: 12, lineHeight: 16, color: colors.secondary },
  options: { gap: 8, paddingRight: 22 },
  option: { minWidth: 58, minHeight: 44, paddingHorizontal: 15, alignItems: 'center', justifyContent: 'center', borderRadius: 11, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.paper },
  optionActive: { borderColor: colors.ink, backgroundColor: colors.ink },
  optionText: { fontFamily: fonts.bodyMedium, fontSize: 12, color: colors.secondary },
  optionTextActive: { fontFamily: fonts.bodySemiBold, color: colors.paper },
  fieldGroup: { marginTop: 22 },
  field: { minHeight: 64, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.paper },
  multilineField: { minHeight: 142, alignItems: 'flex-start', paddingVertical: 14 },
  input: { flex: 1, minHeight: 60, fontFamily: fonts.bodyMedium, fontSize: 22, color: colors.ink },
  multilineInput: { minHeight: 112, fontFamily: fonts.body, fontSize: 15, lineHeight: 22 },
  suffix: { marginLeft: 12, fontFamily: fonts.bodySemiBold, fontSize: 13, color: colors.secondary },
  swapRow: { minHeight: 64, flexDirection: 'row', alignItems: 'center', gap: 12 },
  rule: { flex: 1, height: 1, backgroundColor: colors.border },
  swap: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', borderRadius: 22, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.paper },
  swapDisabled: { backgroundColor: colors.background },
  pressed: { opacity: 0.65 },
  result: { marginTop: 24, paddingVertical: 18, flexDirection: 'row', alignItems: 'flex-start', gap: 13, borderTopWidth: 1, borderBottomWidth: 1, borderColor: colors.border },
  resultIcon: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.paper, borderWidth: 1, borderColor: colors.border },
  resultCopy: { flex: 1 },
  resultTitle: { fontFamily: fonts.bodySemiBold, fontSize: 13, color: colors.ink },
  resultDetail: { marginTop: 4, fontFamily: fonts.body, fontSize: 12, lineHeight: 18, color: colors.secondary },
  action: { minHeight: 52, marginTop: 22, paddingHorizontal: 18, flexDirection: 'row', gap: 9, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.ink },
  actionPressed: { opacity: 0.76 },
  actionText: { fontFamily: fonts.bodySemiBold, fontSize: 14, color: colors.paper },
  error: { marginTop: 16, padding: 13, flexDirection: 'row', alignItems: 'flex-start', gap: 9, borderRadius: radius.md, backgroundColor: colors.dangerSoft },
  errorText: { flex: 1, fontFamily: fonts.body, fontSize: 12, lineHeight: 18, color: colors.danger },
  resultPanel: { marginTop: 24, padding: 18, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.paper },
  resultEyebrow: { fontFamily: fonts.bodySemiBold, fontSize: 10, letterSpacing: 0.7, textTransform: 'uppercase', color: colors.muted },
  resultValue: { marginTop: 8, fontFamily: fonts.bodyBold, fontSize: 29, lineHeight: 35, letterSpacing: -0.6, color: colors.ink },
  resultPanelDetail: { marginTop: 8, fontFamily: fonts.body, fontSize: 12, lineHeight: 18, color: colors.secondary },
  resultActions: { marginTop: 16, paddingTop: 14, flexDirection: 'row', flexWrap: 'wrap', gap: 8, borderTopWidth: 1, borderTopColor: colors.border },
});
