import { Platform } from 'react-native';
import { ThoughtItem } from '@/types';

const channelId = 'gather-reminders';
type NotificationsModule = typeof import('expo-notifications');

let notificationsModulePromise: Promise<NotificationsModule> | undefined;

export class NotificationPermissionError extends Error {
  constructor() {
    super('Notifications are blocked on this device. Enable them in your phone settings and try again.');
    this.name = 'NotificationPermissionError';
  }
}

export function isNotificationRuntimeAvailable() {
  return Platform.OS !== 'web';
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

  await ensureAndroidChannel(notifications);
}

export async function hasNotificationPermission() {
  const notifications = await getNotifications();
  if (!notifications) return false;
  return (await notifications.getPermissionsAsync()).granted;
}

export async function requestNotificationPermission() {
  const notifications = await getNotifications();
  if (!notifications) return false;
  await ensureAndroidChannel(notifications);
  const existing = await notifications.getPermissionsAsync();
  if (existing.granted) return true;
  return (await notifications.requestPermissionsAsync()).granted;
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
  if (!await requestNotificationPermission()) throw new NotificationPermissionError();

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

async function ensureAndroidChannel(notifications: NotificationsModule) {
  if (Platform.OS !== 'android') return;
  await notifications.setNotificationChannelAsync(channelId, {
    name: 'Thought reminders',
    importance: notifications.AndroidImportance.HIGH,
    vibrationPattern: [0, 250, 150, 250],
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
