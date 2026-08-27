import 'react-native-gesture-handler';
import { useEffect, useRef } from 'react';
import { useRouter } from 'expo-router';
import { Stack } from 'expo-router/stack';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import {
  InstrumentSans_400Regular,
  InstrumentSans_500Medium,
  InstrumentSans_600SemiBold,
  InstrumentSans_700Bold,
  useFonts,
} from '@expo-google-fonts/instrument-sans';
import { ItemsProvider, useItems } from '@/store/ItemsContext';
import { AppDialogProvider } from '@/components/AppDialog';
import { LifeDeskNativeSync } from '@/components/LifeDeskNativeSync';
import { colors } from '@/constants/theme';
import { configureNotifications, scheduleSnoozeNotification, subscribeToNotificationResponses } from '@/services/notifications';

SplashScreen.preventAutoHideAsync().catch(() => undefined);

export default function RootLayout() {
  const [loaded] = useFonts({ InstrumentSans_400Regular, InstrumentSans_500Medium, InstrumentSans_600SemiBold, InstrumentSans_700Bold });
  useEffect(() => { if (loaded) SplashScreen.hideAsync(); }, [loaded]);
  useEffect(() => { configureNotifications().catch(() => undefined); }, []);
  if (!loaded) return null;

  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: colors.background }}>
      <SafeAreaProvider>
        <ItemsProvider>
          <LifeDeskNativeSync />
          <NotificationBridge />
          <AppDialogProvider>
            <StatusBar style="dark" />
            <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.background }, animation: 'fade' }}>
              <Stack.Screen name="(tabs)" options={{ animation: 'none' }} />
              <Stack.Screen name="record" options={{ animation: 'fade_from_bottom', gestureEnabled: false }} />
              <Stack.Screen name="processing" options={{ animation: 'fade', gestureEnabled: false }} />
              <Stack.Screen name="review" options={{ animation: 'fade_from_bottom' }} />
              <Stack.Screen name="home-customize" options={{ animation: 'slide_from_right' }} />
              <Stack.Screen name="results" options={{ animation: 'fade' }} />
              <Stack.Screen name="chat" options={{ animation: 'fade_from_bottom' }} />
            </Stack>
          </AppDialogProvider>
        </ItemsProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

function NotificationBridge() {
  const router = useRouter();
  const { items, toggleComplete } = useItems();
  const itemsRef = useRef(items);
  const toggleCompleteRef = useRef(toggleComplete);
  useEffect(() => { itemsRef.current = items; }, [items]);
  useEffect(() => { toggleCompleteRef.current = toggleComplete; }, [toggleComplete]);

  useEffect(() => {
    let unsubscribe: () => void = () => undefined;
    let mounted = true;
    subscribeToNotificationResponses((itemId, action) => {
      const item = itemsRef.current.find((candidate) => candidate.id === itemId);
      if (action === 'complete' && item && !item.completed) {
        void toggleCompleteRef.current(itemId).catch(() => undefined);
        return;
      }
      if (action === 'snooze' && item) {
        void scheduleSnoozeNotification(item).catch(() => undefined);
        return;
      }
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

  return null;
}
