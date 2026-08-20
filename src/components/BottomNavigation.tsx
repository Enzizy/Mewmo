import { Feather } from '@expo/vector-icons';
import { Href, usePathname, useRouter } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { ZoomIn, useReducedMotion } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, fonts, motion } from '@/constants/theme';

const tabs: { label: string; icon: keyof typeof Feather.glyphMap; href: Href }[] = [
  { label: 'Home', icon: 'home', href: '/' },
  { label: 'Wallet', icon: 'credit-card', href: '/wallet' as Href },
  { label: 'Tasks', icon: 'check-square', href: '/tasks' as Href },
  { label: 'Tools', icon: 'grid', href: '/tools' as Href },
];

export function BottomNavigation() {
  const router = useRouter();
  const pathname = usePathname();
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.shell, { paddingBottom: Math.max(insets.bottom, 10) }]}>
      <View style={styles.bar}>
        {tabs.slice(0, 2).map((tab) => <Tab key={tab.label} {...tab} active={isActive(pathname, tab.label, tab.href)} onPress={() => router.replace(tab.href)} />)}
        <Pressable accessibilityLabel="Start a voice recording" accessibilityRole="button" onPress={() => router.push('/record')} style={({ pressed }) => [styles.record, pressed && styles.pressed]}>
          <Feather name="mic" size={25} color={colors.surface} />
        </Pressable>
        {tabs.slice(2).map((tab) => <Tab key={tab.label} {...tab} active={isActive(pathname, tab.label, tab.href)} onPress={() => router.replace(tab.href)} />)}
      </View>
    </View>
  );
}

function isActive(pathname: string, label: string, href: Href) {
  if (pathname === String(href)) return true;
  if (label === 'Wallet') return pathname === '/life';
  if (label === 'Tasks') return pathname === '/items' || pathname === '/projects';
  return false;
}

function Tab({ label, icon, active, onPress }: { label: string; icon: keyof typeof Feather.glyphMap; active: boolean; onPress: () => void }) {
  const reduceMotion = useReducedMotion();
  return (
    <Pressable accessibilityRole="tab" accessibilityState={{ selected: active }} onPress={onPress} style={({ pressed }) => [styles.tab, pressed && styles.pressed]}>
      {active ? <Animated.View entering={reduceMotion ? undefined : ZoomIn.duration(motion.fast)} style={styles.activeMark} /> : null}
      <Feather name={icon} size={20} color={active ? colors.ink : colors.muted} />
      <Text style={[styles.tabLabel, active && styles.tabLabelActive]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  shell: { position: 'absolute', bottom: 0, left: 0, right: 0, alignItems: 'center', backgroundColor: colors.surface, borderTopWidth: 1, borderTopColor: colors.border },
  bar: { width: '100%', maxWidth: 560, height: 64, paddingHorizontal: 9, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-around' },
  tab: { width: 62, minHeight: 52, alignItems: 'center', justifyContent: 'center', gap: 4 },
  activeMark: { position: 'absolute', top: 1, width: 18, height: 3, backgroundColor: colors.accent },
  tabLabel: { fontFamily: fonts.bodyMedium, fontSize: 10, color: colors.muted },
  tabLabelActive: { fontFamily: fonts.bodySemiBold, color: colors.ink },
  record: { width: 56, height: 56, marginTop: -24, borderRadius: 28, backgroundColor: colors.dark, alignItems: 'center', justifyContent: 'center', borderWidth: 4, borderColor: colors.surface },
  pressed: { transform: [{ scale: 0.95 }] },
});
