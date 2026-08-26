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
  if (Number.isNaN(date.getTime()) || (!item.recurrence && date.getTime() <= Date.now())) return undefined;
  const existing = await notifications.getPermissionsAsync();
  const permission = existing.granted ? existing : await notifications.requestPermissionsAsync();
  if (!permission.granted) return undefined;

  const trigger = item.recurrence ? recurrenceTrigger(notifications, item.recurrence) : {
    type: notifications.SchedulableTriggerInputTypes.DATE,
    date,
    channelId,
  };
  return notifications.scheduleNotificationAsync({
    content: {
      title: item.category === 'reminder' ? 'Reminder' : 'A thought needs your attention',
      body: item.title,
      data: { itemId: item.id },
      sound: true,
    },
    trigger,
  });
}

function recurrenceTrigger(notifications: NotificationsModule, recurrence: NonNullable<ThoughtItem['recurrence']>) {
  const shared = { channelId, hour: recurrence.hour, minute: recurrence.minute };
  if (recurrence.frequency === 'daily') return { type: notifications.SchedulableTriggerInputTypes.DAILY, ...shared };
  if (recurrence.frequency === 'weekly') return { type: notifications.SchedulableTriggerInputTypes.WEEKLY, ...shared, weekday: recurrence.weekday ?? 1 };
  if (recurrence.frequency === 'monthly') return { type: notifications.SchedulableTriggerInputTypes.MONTHLY, ...shared, day: recurrence.day ?? 1 };
  return { type: notifications.SchedulableTriggerInputTypes.YEARLY, ...shared, month: recurrence.month ?? 0, day: recurrence.day ?? 1 };
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
