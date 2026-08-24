import { Feather } from '@expo/vector-icons';
import { Tabs, useRouter } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, fonts } from '@/constants/theme';

type TabIconName = keyof typeof Feather.glyphMap;

function TabIcon({ name, focused }: { name: TabIconName; focused: boolean }) {
  return (
    <View style={styles.iconWrap}>
      <Feather name={name} size={22} color={focused ? colors.ink : colors.muted} />
      {focused ? <View style={styles.activeDot} /> : null}
    </View>
  );
}

function CaptureButton() {
  const router = useRouter();
  return (
    <Pressable accessibilityLabel="Start a voice capture" accessibilityRole="button" onPress={() => router.push('/record')} style={({ pressed }) => [styles.captureSlot, pressed && styles.pressed]}>
      <View style={styles.captureButton}><Feather name="mic" size={27} color={colors.paper} /></View>
      <Text style={styles.captureLabel}>Capture</Text>
    </Pressable>
  );
}

export default function TabsLayout() {
  const router = useRouter();

  const rootTab = (href: '/' | '/wallet' | '/tasks' | '/tools') => ({
    tabPress: (event: { preventDefault: () => void }) => {
      event.preventDefault();
      router.replace(href);
    },
  });

  return (
    <Tabs
      backBehavior="history"
      screenOptions={{
        headerShown: false,
        sceneStyle: { backgroundColor: colors.background },
        tabBarActiveTintColor: colors.ink,
        tabBarInactiveTintColor: colors.muted,
        tabBarHideOnKeyboard: true,
        tabBarLabelStyle: styles.label,
        tabBarStyle: styles.bar,
      }}
    >
      <Tabs.Screen name="index" listeners={rootTab('/')} options={{ title: 'Home', tabBarIcon: ({ focused }) => <TabIcon name="home" focused={focused} /> }} />
      <Tabs.Screen name="wallet" listeners={rootTab('/wallet')} options={{ title: 'Wallet', tabBarIcon: ({ focused }) => <TabIcon name="credit-card" focused={focused} /> }} />
      <Tabs.Screen name="capture" options={{ title: 'Capture', tabBarButton: () => <CaptureButton /> }} />
      <Tabs.Screen name="tasks" listeners={rootTab('/tasks')} options={{ title: 'Tasks', tabBarIcon: ({ focused }) => <TabIcon name="check-square" focused={focused} /> }} />
      <Tabs.Screen name="tools" listeners={rootTab('/tools')} options={{ title: 'Tools', tabBarIcon: ({ focused }) => <TabIcon name="grid" focused={focused} /> }} />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  bar: { minHeight: 68, backgroundColor: colors.paper, borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 5, paddingBottom: 6 },
  label: { fontFamily: fonts.bodyMedium, fontSize: 10, lineHeight: 13 },
  iconWrap: { width: 34, height: 28, alignItems: 'center', justifyContent: 'center' },
  activeDot: { position: 'absolute', bottom: 0, width: 4, height: 4, borderRadius: 2, backgroundColor: colors.accent },
  captureSlot: { flex: 1, minHeight: 64, marginTop: -17, alignItems: 'center', justifyContent: 'flex-start' },
  captureButton: { width: 58, height: 58, borderRadius: 29, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.ink, borderWidth: 4, borderColor: colors.paper },
  captureLabel: { marginTop: 1, fontFamily: fonts.bodyMedium, fontSize: 10, lineHeight: 13, color: colors.ink },
  pressed: { opacity: 0.72, transform: [{ scale: 0.97 }] },
});
