import { Feather } from '@expo/vector-icons';
import { Href, Tabs, usePathname, useRouter } from 'expo-router';
import { Platform, Pressable, Text, useWindowDimensions, View } from 'react-native';
import { colors, fonts, themedStyles } from '@/constants/theme';
import { APP_NAME } from '@/constants/brand';
import { useTheme } from '@/store/ThemeContext';

type TabIconName = keyof typeof Feather.glyphMap;

function TabIcon({ name, focused, desktop = false }: { name: TabIconName; focused: boolean; desktop?: boolean }) {
  return (
    <View style={[styles.iconWrap, desktop && styles.desktopIconWrap]}>
      <Feather name={name} size={desktop ? 17 : 22} color={focused ? colors.ink : colors.muted} />
      {focused && !desktop ? <View style={styles.activeDot} /> : null}
    </View>
  );
}

const desktopLinks: { label: string; icon: TabIconName; href: Href; matches: (path: string) => boolean }[] = [
  { label: 'Home', icon: 'home', href: '/', matches: (path) => path === '/' },
  { label: 'Wallet', icon: 'credit-card', href: '/wallet', matches: (path) => path.startsWith('/wallet') },
  { label: 'Assistant', icon: 'message-circle', href: '/capture', matches: (path) => path.startsWith('/capture') },
  { label: 'Tasks', icon: 'check-square', href: '/tasks', matches: (path) => path.startsWith('/tasks') },
  { label: 'Tools', icon: 'grid', href: '/tools', matches: (path) => path.startsWith('/tools') },
];

function DesktopTabBar() {
  const router = useRouter();
  const pathname = usePathname();
  return (
    <View style={styles.desktopNav}>
      <Pressable accessibilityRole="button" accessibilityLabel="Go to LifeDesk home" onPress={() => router.replace('/')} style={({ pressed }) => [styles.desktopBrand, pressed && styles.pressed]}>
        <View style={styles.brandMark}><Feather name="command" size={16} color={colors.paper} /></View>
        <Text style={styles.brandName}>{APP_NAME}</Text>
      </Pressable>
      <View accessibilityRole="tablist" style={styles.desktopLinks}>
        {desktopLinks.map((link) => {
          const active = link.matches(pathname);
          return <Pressable key={link.label} accessibilityRole="tab" accessibilityState={{ selected: active }} onPress={() => router.push(link.href)} style={({ pressed }) => [styles.desktopLink, active && styles.desktopLinkActive, pressed && styles.pressed]}><Feather name={link.icon} size={16} color={active ? colors.ink : colors.muted} /><Text style={[styles.desktopLinkLabel, active && styles.desktopLinkLabelActive]}>{link.label}</Text></Pressable>;
        })}
      </View>
      <View style={styles.desktopNavMeta}><View style={styles.onlineDot} /><Text style={styles.desktopNavMetaText}>Personal workspace</Text></View>
    </View>
  );
}

function CaptureButton() {
  const router = useRouter();
  return (
    <Pressable accessibilityLabel="Open your AI assistant" accessibilityRole="button" onPress={() => router.push('/chat')} style={({ pressed }) => [styles.captureSlot, pressed && styles.pressed]}>
      <View style={styles.captureButton}><Feather name="message-circle" size={27} color={colors.paper} /></View>
      <Text style={styles.captureLabel}>Chat</Text>
    </Pressable>
  );
}

export default function TabsLayout() {
  useTheme();
  const router = useRouter();
  const { width } = useWindowDimensions();
  const desktop = Platform.OS === 'web' && width >= 900;

  const rootTab = (href: '/' | '/wallet' | '/tasks' | '/tools') => ({
    tabPress: (event: { preventDefault: () => void }) => {
      event.preventDefault();
      router.replace(href);
    },
  });

  return (
    <Tabs
      backBehavior="history"
      tabBar={desktop ? () => <DesktopTabBar /> : undefined}
      screenOptions={{
        headerShown: false,
        sceneStyle: { backgroundColor: colors.background },
        tabBarActiveTintColor: colors.ink,
        tabBarInactiveTintColor: colors.muted,
        tabBarHideOnKeyboard: true,
        tabBarPosition: desktop ? 'top' : 'bottom',
        tabBarLabelStyle: styles.label,
        tabBarStyle: styles.bar,
      }}
    >
      <Tabs.Screen name="index" listeners={rootTab('/')} options={{ title: 'Home', tabBarIcon: ({ focused }) => <TabIcon name="home" focused={focused} desktop={desktop} /> }} />
      <Tabs.Screen name="wallet" listeners={rootTab('/wallet')} options={{ title: 'Wallet', tabBarIcon: ({ focused }) => <TabIcon name="credit-card" focused={focused} desktop={desktop} /> }} />
      <Tabs.Screen name="capture" options={{ title: desktop ? 'Assistant' : 'Chat', tabBarIcon: ({ focused }) => desktop ? <TabIcon name="message-circle" focused={focused} desktop /> : null, tabBarButton: desktop ? undefined : () => <CaptureButton /> }} />
      <Tabs.Screen name="tasks" listeners={rootTab('/tasks')} options={{ title: 'Tasks', tabBarIcon: ({ focused }) => <TabIcon name="check-square" focused={focused} desktop={desktop} /> }} />
      <Tabs.Screen name="tools" listeners={rootTab('/tools')} options={{ title: 'Tools', tabBarIcon: ({ focused }) => <TabIcon name="grid" focused={focused} desktop={desktop} /> }} />
    </Tabs>
  );
}

const styles = themedStyles(() => ({
  bar: { minHeight: 68, backgroundColor: colors.paper, borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 5, paddingBottom: 6 },
  label: { fontFamily: fonts.bodyMedium, fontSize: 10, lineHeight: 13 },
  iconWrap: { width: 34, height: 28, alignItems: 'center', justifyContent: 'center' },
  activeDot: { position: 'absolute', bottom: 0, width: 4, height: 4, borderRadius: 2, backgroundColor: colors.accent },
  captureSlot: { flex: 1, minHeight: 64, marginTop: -17, alignItems: 'center', justifyContent: 'flex-start' },
  captureButton: { width: 58, height: 58, borderRadius: 29, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.ink, borderWidth: 4, borderColor: colors.paper },
  captureLabel: { marginTop: 1, fontFamily: fonts.bodyMedium, fontSize: 10, lineHeight: 13, color: colors.ink },
  pressed: { opacity: 0.72, transform: [{ scale: 0.97 }] },
  desktopNav: { height: 72, paddingHorizontal: 32, flexDirection: 'row', alignItems: 'center', gap: 28, borderBottomWidth: 1, borderBottomColor: colors.border, backgroundColor: colors.paper },
  desktopBrand: { minWidth: 150, flexDirection: 'row', alignItems: 'center', gap: 10 },
  brandMark: { width: 32, height: 32, borderRadius: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.ink },
  brandName: { fontFamily: fonts.bodyBold, fontSize: 17, letterSpacing: -0.35, color: colors.ink },
  desktopLinks: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 6 },
  desktopLink: { minHeight: 42, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: 12 },
  desktopLinkActive: { backgroundColor: colors.accentSoft },
  desktopLinkLabel: { fontFamily: fonts.bodyMedium, fontSize: 12, lineHeight: 16, color: colors.muted },
  desktopLinkLabelActive: { fontFamily: fonts.bodySemiBold, color: colors.ink },
  desktopNavMeta: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  desktopNavMetaText: { fontFamily: fonts.bodyMedium, fontSize: 11, color: colors.secondary },
  onlineDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: colors.green },
  desktopIconWrap: { width: 22, height: 22 },
}));
