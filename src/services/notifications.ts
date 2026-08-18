import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { ThoughtItem } from '@/types';

const channelId = 'gather-reminders';
type NotificationsModule = typeof import('expo-notifications');

let notificationsModulePromise: Promise<NotificationsModule> | undefined;

export function isNotificationRuntimeAvailable() {
  return Platform.OS !== 'web' && Constants.expoGoConfig == null;
}

async function getNotifications() {
  if (!isNotificationRuntimeAvailable()) return undefined;
  notificationsModulePromise ??= import('expo-notifications');
  return notificationsModulePromise;
}

export async function configureNotifications() {
  const notifications = await getNotifications();
  if (!notifications) return;

  notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    }),
  });

  if (Platform.OS === 'android') {
    await notifications.setNotificationChannelAsync(channelId, {
      name: 'Thought reminders',
      importance: notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 250, 150, 250],
    });
  }
}

export async function subscribeToNotificationResponses(onItemPress: (itemId: string) => void) {
  const notifications = await getNotifications();
  if (!notifications) return () => undefined;

  const subscription = notifications.addNotificationResponseReceivedListener((response) => {
    const itemId = response.notification.request.content.data?.itemId;
    if (typeof itemId === 'string') onItemPress(itemId);
  });

  return () => subscription.remove();
}

export async function scheduleItemNotification(item: ThoughtItem) {
  if (!item.dueAt) return undefined;
  const notifications = await getNotifications();
  if (!notifications) return undefined;
  const date = new Date(item.dueAt);
  if (Number.isNaN(date.getTime()) || date.getTime() <= Date.now()) return undefined;
  const existing = await notifications.getPermissionsAsync();
  const permission = existing.granted ? existing : await notifications.requestPermissionsAsync();
  if (!permission.granted) return undefined;

  return notifications.scheduleNotificationAsync({
    content: {
      title: item.category === 'reminder' ? 'Reminder' : 'A thought needs your attention',
      body: item.title,
      data: { itemId: item.id },
      sound: true,
    },
    trigger: {
      type: notifications.SchedulableTriggerInputTypes.DATE,
      date,
      channelId,
    },
  });
}

export async function cancelItemNotification(identifier?: string) {
  if (!identifier) return;
  const notifications = await getNotifications();
  if (!notifications) return;
  await notifications.cancelScheduledNotificationAsync(identifier).catch(() => undefined);
}

export async function cancelAllItemNotifications() {
  const notifications = await getNotifications();
  if (!notifications) return;
  await notifications.cancelAllScheduledNotificationsAsync().catch(() => undefined);
}
