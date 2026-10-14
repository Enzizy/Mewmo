import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { CARD_REMINDER_PREFIX, CardReminder } from '@/features/wallet/card-reminders';
import { ThoughtItem } from '@/types';

const channelId = 'gather-reminders';
const taskCategoryId = 'lifedesk-task-actions';
const reminderCategoryId = 'lifedesk-reminder-actions';
export const COMPLETE_NOTIFICATION_ACTION = 'lifedesk-complete';
export const SNOOZE_NOTIFICATION_ACTION = 'lifedesk-snooze';
type NotificationsModule = typeof import('expo-notifications');
export type LifeDeskNotificationAction = 'open' | 'complete' | 'snooze';

let notificationsModulePromise: Promise<NotificationsModule> | undefined;

export class NotificationPermissionError extends Error {
  constructor() {
    super('Notifications are blocked on this device. Enable them in your phone settings and try again.');
    this.name = 'NotificationPermissionError';
  }
}

export function isNotificationRuntimeAvailable() {
  return Platform.OS !== 'web' && Constants.appOwnership !== 'expo';
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
  await ensureNotificationCategories(notifications);
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

export type NotificationTarget = { itemId: string } | { cardId: string } | { route: 'weekly-review' };

export async function subscribeToNotificationResponses(onResponse: (target: NotificationTarget, action: LifeDeskNotificationAction) => void) {
  const notifications = await getNotifications();
  if (!notifications) return () => undefined;

  const handled = new Set<string>();
  const handle = (response: Awaited<ReturnType<NotificationsModule['getLastNotificationResponseAsync']>>) => {
    if (!response) return;
    const data = response.notification.request.content.data;
    const target: NotificationTarget | null = typeof data?.itemId === 'string' ? { itemId: data.itemId }
      : typeof data?.cardId === 'string' ? { cardId: data.cardId }
        : data?.route === 'weekly-review' ? { route: 'weekly-review' } : null;
    if (!target) return;
    const key = `${response.notification.request.identifier}:${response.actionIdentifier}`;
    if (handled.has(key)) return;
    handled.add(key);
    const action: LifeDeskNotificationAction = response.actionIdentifier === COMPLETE_NOTIFICATION_ACTION
      ? 'complete'
      : response.actionIdentifier === SNOOZE_NOTIFICATION_ACTION ? 'snooze' : 'open';
    onResponse(target, action);
    void notifications.clearLastNotificationResponseAsync();
  };

  handle(await notifications.getLastNotificationResponseAsync());
  const subscription = notifications.addNotificationResponseReceivedListener(handle);

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
      categoryIdentifier: item.category === 'task' ? taskCategoryId : reminderCategoryId,
    },
    trigger,
  });
}

export async function scheduleSnoozeNotification(item: ThoughtItem, minutes = 10) {
  const notifications = await getNotifications();
  if (!notifications) return undefined;
  const date = new Date(Date.now() + Math.max(1, minutes) * 60_000);
  return notifications.scheduleNotificationAsync({
    content: {
      title: item.category === 'reminder' ? 'Reminder' : 'A task still needs your attention',
      body: item.title,
      data: { itemId: item.id },
      sound: true,
      categoryIdentifier: item.category === 'task' ? taskCategoryId : reminderCategoryId,
    },
    trigger: { type: notifications.SchedulableTriggerInputTypes.DATE, date, channelId },
  });
}

async function ensureAndroidChannel(notifications: NotificationsModule) {
  if (Platform.OS !== 'android') return;
  await notifications.setNotificationChannelAsync(channelId, {
    name: 'LifeDesk reminders',
    importance: notifications.AndroidImportance.HIGH,
    vibrationPattern: [0, 250, 150, 250],
  });
}

async function ensureNotificationCategories(notifications: NotificationsModule) {
  await notifications.setNotificationCategoryAsync(taskCategoryId, [
    { identifier: COMPLETE_NOTIFICATION_ACTION, buttonTitle: 'Complete', options: { opensAppToForeground: true } },
    { identifier: SNOOZE_NOTIFICATION_ACTION, buttonTitle: 'Snooze 10 min', options: { opensAppToForeground: true } },
  ]);
  await notifications.setNotificationCategoryAsync(reminderCategoryId, [
    { identifier: SNOOZE_NOTIFICATION_ACTION, buttonTitle: 'Snooze 10 min', options: { opensAppToForeground: true } },
  ]);
}

function recurrenceTrigger(notifications: NotificationsModule, recurrence: NonNullable<ThoughtItem['recurrence']>) {
  const shared = { channelId, hour: recurrence.hour, minute: recurrence.minute };
  if (recurrence.frequency === 'daily') return { type: notifications.SchedulableTriggerInputTypes.DAILY, ...shared };
  if (recurrence.frequency === 'weekly') return { type: notifications.SchedulableTriggerInputTypes.WEEKLY, ...shared, weekday: recurrence.weekday ?? 1 };
  if (recurrence.frequency === 'monthly') return { type: notifications.SchedulableTriggerInputTypes.MONTHLY, ...shared, day: recurrence.day ?? 1 };
  return { type: notifications.SchedulableTriggerInputTypes.YEARLY, ...shared, month: recurrence.month ?? 0, day: recurrence.day ?? 1 };
}

/**
 * Replaces every scheduled card payment reminder with the given plan. Reminders
 * use fixed identifiers, so this is safe to run each time cards change.
 * Never prompts for permission: it only runs once notifications are allowed.
 */
export async function syncCardReminders(plan: CardReminder[]) {
  const notifications = await getNotifications();
  if (!notifications || !(await notifications.getPermissionsAsync()).granted) return;
  const scheduled = await notifications.getAllScheduledNotificationsAsync();
  await Promise.all(scheduled
    .filter((request) => request.identifier.startsWith(CARD_REMINDER_PREFIX))
    .map((request) => notifications.cancelScheduledNotificationAsync(request.identifier).catch(() => undefined)));
  for (const reminder of plan) {
    await notifications.scheduleNotificationAsync({
      identifier: reminder.identifier,
      content: { title: reminder.title, body: reminder.body, data: { cardId: reminder.cardId }, sound: true },
      trigger: { type: notifications.SchedulableTriggerInputTypes.DATE, date: reminder.date, channelId },
    });
  }
}

const WEEKLY_REVIEW_IDENTIFIER = 'lifedesk-weekly-review';

/** Sunday at 6 PM, every week, while enabled. A fixed identifier keeps it to one schedule. */
export async function syncWeeklyReviewReminder(enabled: boolean) {
  const notifications = await getNotifications();
  if (!notifications || !(await notifications.getPermissionsAsync()).granted) return;
  await notifications.cancelScheduledNotificationAsync(WEEKLY_REVIEW_IDENTIFIER).catch(() => undefined);
  if (!enabled) return;
  await notifications.scheduleNotificationAsync({
    identifier: WEEKLY_REVIEW_IDENTIFIER,
    content: { title: 'Your week in review is ready', body: 'Five calm minutes: what got done, where money went, and what is coming up.', data: { route: 'weekly-review' }, sound: true },
    // Expo numbers weekdays from 1 = Sunday.
    trigger: { type: notifications.SchedulableTriggerInputTypes.WEEKLY, weekday: 1, hour: 18, minute: 0, channelId },
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
