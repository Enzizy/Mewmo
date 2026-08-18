import 'react-native-gesture-handler';
import { useEffect } from 'react';
import { useRouter } from 'expo-router';
import { Stack } from 'expo-router/stack';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { DMSans_400Regular, DMSans_500Medium, DMSans_600SemiBold, DMSans_700Bold, useFonts } from '@expo-google-fonts/dm-sans';
import { Silkscreen_400Regular, Silkscreen_700Bold } from '@expo-google-fonts/silkscreen';
import { ItemsProvider } from '@/store/ItemsContext';
import { colors } from '@/constants/theme';
import { configureNotifications, subscribeToNotificationResponses } from '@/services/notifications';

SplashScreen.preventAutoHideAsync().catch(() => undefined);

export default function RootLayout() {
  const router = useRouter();
  const [loaded] = useFonts({ DMSans_400Regular, DMSans_500Medium, DMSans_600SemiBold, DMSans_700Bold, Silkscreen_400Regular, Silkscreen_700Bold });
  useEffect(() => { if (loaded) SplashScreen.hideAsync(); }, [loaded]);
  useEffect(() => { configureNotifications().catch(() => undefined); }, []);
  useEffect(() => {
    let unsubscribe: () => void = () => undefined;
    let mounted = true;
    subscribeToNotificationResponses((itemId) => {
      router.push({ pathname: '/item/[id]', params: { id: itemId } });
    }).then((cleanup) => {
      if (mounted) unsubscribe = cleanup;
      else cleanup();
    }).catch(() => undefined);
    return () => {
      mounted = false;
      unsubscribe();
    };
  }, [router]);
  if (!loaded) return null;

  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: colors.background }}>
      <SafeAreaProvider>
        <ItemsProvider>
          <StatusBar style="dark" />
          <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.background }, animation: 'none' }} />
        </ItemsProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
