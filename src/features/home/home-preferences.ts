import type { HomePreferences, HomeShortcutId, HomeWidgetId } from '@/types';

export const HOME_WIDGETS: { id: HomeWidgetId; title: string; detail: string }[] = [
  { id: 'review', title: 'Review inbox', detail: 'Pending money and AI proposals' },
  { id: 'weather', title: 'Weather', detail: 'Current conditions and forecast' },
  { id: 'money', title: 'Money overview', detail: 'Wallet and investments' },
  { id: 'goals', title: 'Savings goals', detail: 'Reserved progress toward goals' },
  { id: 'schedule', title: 'Schedule', detail: 'Upcoming reminders and events' },
  { id: 'attention', title: 'Needs attention', detail: 'Urgent tasks' },
  { id: 'coming-up', title: 'Coming up', detail: 'Money plans and project work' },
  { id: 'shortcuts', title: 'Pinned actions', detail: 'Your frequent actions and tools' },
];

export const HOME_SHORTCUTS: { id: HomeShortcutId; title: string }[] = [
  { id: 'add-income', title: 'Add money' },
  { id: 'add-expense', title: 'Add expense' },
  { id: 'add-investment', title: 'Add investment' },
  { id: 'add-reminder', title: 'Add reminder' },
  { id: 'currency', title: 'Currency converter' },
  { id: 'image-tools', title: 'Image tools' },
  { id: 'pdf-tools', title: 'PDF tools' },
  { id: 'weather', title: 'Weather' },
];

export const DEFAULT_HOME_PREFERENCES: HomePreferences = {
  order: HOME_WIDGETS.map((widget) => widget.id),
  hidden: [],
  compact: ['weather', 'schedule', 'attention', 'coming-up'],
  balancesVisible: true,
  widgetBalancesVisible: false,
  shortcuts: ['add-expense', 'add-reminder', 'currency', 'image-tools'],
};

export function normalizeHomePreferences(value?: Partial<HomePreferences> | null): HomePreferences {
  const validWidgets = new Set(HOME_WIDGETS.map((widget) => widget.id));
  const suppliedOrder = (value?.order ?? []).filter((id): id is HomeWidgetId => validWidgets.has(id));
  const missing = DEFAULT_HOME_PREFERENCES.order.filter((id) => !suppliedOrder.includes(id));
  const validShortcuts = new Set(HOME_SHORTCUTS.map((shortcut) => shortcut.id));
  return {
    order: [...suppliedOrder, ...missing],
    hidden: [...new Set((value?.hidden ?? []).filter((id): id is HomeWidgetId => validWidgets.has(id)))],
    compact: [...new Set((value?.compact ?? []).filter((id): id is HomeWidgetId => validWidgets.has(id)))],
    balancesVisible: value?.balancesVisible !== false,
    widgetBalancesVisible: value?.widgetBalancesVisible === true,
    shortcuts: [...new Set((value?.shortcuts ?? []).filter((id): id is HomeShortcutId => validShortcuts.has(id)))].slice(0, 4),
  };
}
