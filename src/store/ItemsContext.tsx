import 'expo-sqlite/localStorage/install';
import * as FileSystem from 'expo-file-system/legacy';
import React, { createContext, PropsWithChildren, useCallback, useEffect, useMemo, useState } from 'react';
import {
  createId,
  exportAppData,
  loadAppData,
  removeThoughtItem,
  removeVoiceDump,
  removeMonthlyBudget,
  removeFinancialTransactionRecord,
  removeRecurringRule,
  saveActivity,
  saveConfirmedBundle,
  saveFinancialTransaction,
  saveInvestmentPurchase,
  saveMarketQuote,
  saveMonthlyBudget,
  saveProject,
  saveProjectSession,
  saveRecurringRule,
  updateThoughtItem,
} from '@/data/database';
import { cancelAllItemNotifications, cancelItemNotification, scheduleItemNotification } from '@/services/notifications';
import { fetchMarketQuotes } from '@/services/marketApi';
import {
  ActivityEvent,
  AppDataSnapshot,
  Category,
  FinancialTransaction,
  InvestmentAsset,
  InvestmentTransaction,
  MarketQuote,
  MonthlyBudget,
  OrganizedDump,
  PendingRecording,
  Project,
  ProjectSession,
  RecurringRule,
  RecurringRuleKind,
  ThoughtItem,
  VoiceDump,
} from '@/types';
import { dateLabelFor, timeLabelFor } from '@/utils/date';
import { unitPriceMinorFromTotal } from '@/utils/money';
import { localDateKey, normalizeMonthlyDays } from '@/utils/recurrence';

type ItemsContextValue = AppDataSnapshot & {
  hydrated: boolean;
  pendingRecording: PendingRecording | null;
  pendingOrganizedDump: OrganizedDump | null;
  latestItemIds: string[];
  processingError: string | null;
  notificationEnabled: boolean;
  rewardsEnabled: boolean;
  totalXp: number;
  level: number;
  setPendingRecording: (recording: PendingRecording | null) => void;
  setPendingOrganizedDump: (dump: OrganizedDump | null) => void;
  setProcessingError: (message: string | null) => void;
  setNotificationEnabled: (enabled: boolean) => void;
  setRewardsEnabled: (enabled: boolean) => void;
  confirmOrganizedDump: (organized: OrganizedDump) => Promise<void>;
  toggleComplete: (id: string) => void;
  toggleFavorite: (id: string) => void;
  deleteItem: (id: string) => void;
  deleteDump: (id: string) => void;
  changeCategory: (id: string, category: Category) => void;
  updateTitle: (id: string, title: string) => void;
  scheduleTomorrow: (id: string) => Promise<void>;
  addSubtask: (id: string, title: string) => void;
  toggleSubtask: (itemId: string, subtaskId: string) => void;
  addProject: (input: Pick<Project, 'name'> & Partial<Pick<Project, 'summary' | 'nextAction'>>) => Promise<Project>;
  addProjectHandoff: (projectId: string, note: string, nextAction?: string) => Promise<void>;
  addTransaction: (input: Pick<FinancialTransaction, 'type' | 'title' | 'category' | 'amountMinor'> & { occurredAt?: string }) => Promise<void>;
  deleteTransaction: (id: string) => Promise<void>;
  addInvestment: (input: { asset: InvestmentAsset; quantity: string; amountMinor: number; feesMinor?: number; occurredAt?: string }) => Promise<void>;
  updateQuote: (asset: InvestmentAsset, priceMinor: number, source?: string) => Promise<void>;
  refreshMarketQuotes: () => Promise<void>;
  addRecurringRule: (input: { kind: RecurringRuleKind; title: string; category: string; amountMinor: number; days: number[]; asset?: InvestmentAsset; quantity?: string; startsOn?: string }) => Promise<void>;
  updateRecurringRule: (id: string, input: { kind: RecurringRuleKind; title: string; category: string; amountMinor: number; days: number[]; asset?: InvestmentAsset; quantity?: string; startsOn?: string }) => Promise<void>;
  toggleRecurringRule: (id: string) => Promise<void>;
  deleteRecurringRule: (id: string) => Promise<void>;
  saveBudget: (category: string, limitMinor: number, id?: string) => Promise<void>;
  deleteBudget: (id: string) => Promise<void>;
  exportData: () => Promise<string>;
};

const EMPTY_DATA: AppDataSnapshot = { items: [], dumps: [], projects: [], projectSessions: [], transactions: [], investments: [], quotes: [], recurringRules: [], budgets: [], activity: [] };
const NOTIFICATIONS_KEY = 'mewmo.notifications';
const REWARDS_KEY = 'mewmo.rewards';
const LEGACY_NOTIFICATIONS_KEY = 'brain-dump.notifications';
const LEGACY_REWARDS_KEY = 'brain-dump.rewards';
const ItemsContext = createContext<ItemsContextValue | null>(null);

function readMigratedPreference(key: string, legacyKey: string) {
  const current = localStorage.getItem(key);
  if (current != null) return current !== 'false';
  const legacy = localStorage.getItem(legacyKey);
  if (legacy != null) {
    localStorage.setItem(key, legacy);
    localStorage.removeItem(legacyKey);
  }
  return legacy !== 'false';
}

export function ItemsProvider({ children }: PropsWithChildren) {
  const [data, setData] = useState<AppDataSnapshot>(EMPTY_DATA);
  const [hydrated, setHydrated] = useState(false);
  const [pendingRecording, setPendingRecording] = useState<PendingRecording | null>(null);
  const [pendingOrganizedDump, setPendingOrganizedDump] = useState<OrganizedDump | null>(null);
  const [latestItemIds, setLatestItemIds] = useState<string[]>([]);
  const [processingError, setProcessingError] = useState<string | null>(null);
  const [notificationEnabled, setNotificationEnabledState] = useState(() => readMigratedPreference(NOTIFICATIONS_KEY, LEGACY_NOTIFICATIONS_KEY));
  const [rewardsEnabled, setRewardsEnabledState] = useState(() => readMigratedPreference(REWARDS_KEY, LEGACY_REWARDS_KEY));

  const refresh = useCallback(async () => setData(await loadAppData()), []);

  useEffect(() => {
    refresh().catch((error) => setProcessingError(error instanceof Error ? error.message : 'Could not open local storage.')).finally(() => setHydrated(true));
  }, [refresh]);

  const setNotificationEnabled = useCallback((enabled: boolean) => {
    setNotificationEnabledState(enabled);
    localStorage.setItem(NOTIFICATIONS_KEY, String(enabled));
    if (!enabled) {
      cancelAllItemNotifications().catch(() => undefined);
      setData((current) => ({ ...current, items: current.items.map((item) => ({ ...item, notificationId: undefined })) }));
    }
  }, []);

  const setRewardsEnabled = useCallback((enabled: boolean) => {
    setRewardsEnabledState(enabled);
    localStorage.setItem(REWARDS_KEY, String(enabled));
  }, []);

  const confirmOrganizedDump = useCallback(async (organized: OrganizedDump) => {
    if (!pendingRecording) throw new Error('The original recording is no longer available.');
    const createdAt = new Date().toISOString();
    const dumpId = createId('dump');
    const items: ThoughtItem[] = [];
    const projects: Project[] = [];
    const transactions: FinancialTransaction[] = [];
    const investments: InvestmentTransaction[] = [];

    for (const [index, suggestion] of organized.items.entries()) {
      const dueAt = suggestion.dueAt && !Number.isNaN(Date.parse(suggestion.dueAt)) ? new Date(suggestion.dueAt).toISOString() : null;
      if (['task', 'reminder', 'idea', 'note'].includes(suggestion.category)) {
        const item: ThoughtItem = {
          id: `${dumpId}-item-${index}`,
          category: suggestion.category as Category,
          title: suggestion.title,
          detail: suggestion.detail ?? undefined,
          dueAt,
          createdAt,
          sourceDumpId: dumpId,
          dateLabel: dateLabelFor(dueAt ?? createdAt),
          time: timeLabelFor(dueAt ?? createdAt),
          completed: suggestion.category === 'task' ? false : undefined,
          subtasks: suggestion.subtasks.map((title, subtaskIndex) => ({ id: `${dumpId}-${index}-${subtaskIndex}`, title, completed: false })),
        };
        item.notificationId = notificationEnabled ? await scheduleItemNotification(item) : undefined;
        items.push(item);
      } else if (suggestion.category === 'project') {
        projects.push({ id: `${dumpId}-project-${index}`, name: suggestion.projectName || suggestion.title, summary: suggestion.detail ?? undefined, status: 'active', currentFocus: suggestion.detail ?? undefined, nextAction: suggestion.title, createdAt, updatedAt: createdAt, sourceDumpId: dumpId });
      } else if (suggestion.category === 'income' || suggestion.category === 'expense') {
        if ((suggestion.amountMinor ?? 0) <= 0) continue;
        transactions.push({ id: `${dumpId}-money-${index}`, type: suggestion.category, title: suggestion.title, category: suggestion.category === 'income' ? 'Income' : 'General', amountMinor: suggestion.amountMinor!, occurredAt: dueAt ?? createdAt, sourceDumpId: dumpId });
      } else if (suggestion.category === 'investment' && suggestion.asset && (suggestion.amountMinor ?? 0) > 0) {
        const unitPriceMinor = suggestion.unitPriceMinor ?? unitPriceMinorFromTotal(suggestion.quantity ?? '', suggestion.amountMinor!);
        if (unitPriceMinor == null) continue;
        const investmentId = `${dumpId}-investment-${index}`;
        const cashId = `${investmentId}-cash`;
        investments.push({ id: investmentId, asset: suggestion.asset, quantity: suggestion.quantity!, unitPriceMinor, amountMinor: suggestion.amountMinor!, feesMinor: 0, occurredAt: dueAt ?? createdAt, sourceDumpId: dumpId, cashTransactionId: cashId });
        transactions.push({ id: cashId, type: 'investment', title: `${suggestion.asset} contribution`, category: 'Investment', amountMinor: suggestion.amountMinor!, occurredAt: dueAt ?? createdAt, sourceDumpId: dumpId, linkedInvestmentId: investmentId });
      }
    }

    const dump: VoiceDump = { id: dumpId, title: organized.title, createdAt, durationSeconds: pendingRecording.durationSeconds, uri: pendingRecording.uri, transcript: organized.transcript };
    const activityEvent: ActivityEvent = { id: createId('activity'), kind: 'dump_confirmed', title: `Sorted “${organized.title}”`, xp: rewardsEnabled ? 10 : 0, createdAt, sourceId: dumpId };
    await saveConfirmedBundle({ dump, items, projects, transactions, investments, activity: activityEvent });
    await refresh();
    setLatestItemIds(items.map((item) => item.id));
    setPendingRecording(null);
    setPendingOrganizedDump(null);
    setProcessingError(null);
  }, [notificationEnabled, pendingRecording, refresh, rewardsEnabled]);

  const updateItem = useCallback((id: string, transform: (item: ThoughtItem) => ThoughtItem, reward?: boolean) => {
    setData((current) => {
      const item = current.items.find((candidate) => candidate.id === id);
      if (!item) return current;
      const next = transform(item);
      updateThoughtItem(next).catch(() => refresh());
      if (reward && rewardsEnabled && !item.completed && next.completed) {
        const activity: ActivityEvent = { id: createId('activity'), kind: 'item_completed', title: `Completed “${next.title}”`, xp: 5, createdAt: new Date().toISOString(), sourceId: next.id };
        saveActivity(activity).then(refresh).catch(() => undefined);
      }
      return { ...current, items: current.items.map((candidate) => candidate.id === id ? next : candidate) };
    });
  }, [refresh, rewardsEnabled]);

  const deleteItem = useCallback((id: string) => {
    setData((current) => {
      const item = current.items.find((candidate) => candidate.id === id);
      cancelItemNotification(item?.notificationId).catch(() => undefined);
      removeThoughtItem(id).catch(() => refresh());
      return { ...current, items: current.items.filter((candidate) => candidate.id !== id) };
    });
  }, [refresh]);

  const deleteDump = useCallback((id: string) => {
    setData((current) => {
      const dump = current.dumps.find((candidate) => candidate.id === id);
      if (dump?.uri) FileSystem.deleteAsync(dump.uri, { idempotent: true }).catch(() => undefined);
      removeVoiceDump(id).catch(() => refresh());
      return { ...current, dumps: current.dumps.filter((candidate) => candidate.id !== id) };
    });
  }, [refresh]);

  const scheduleTomorrow = useCallback(async (id: string) => {
    const item = data.items.find((candidate) => candidate.id === id);
    if (!item) return;
    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + 1);
    dueDate.setHours(9, 0, 0, 0);
    await cancelItemNotification(item.notificationId);
    const next = { ...item, dueAt: dueDate.toISOString(), dateLabel: 'Tomorrow', time: timeLabelFor(dueDate) };
    next.notificationId = notificationEnabled ? await scheduleItemNotification(next) : undefined;
    updateItem(id, () => next);
  }, [data.items, notificationEnabled, updateItem]);

  const addProject = useCallback(async (input: Pick<Project, 'name'> & Partial<Pick<Project, 'summary' | 'nextAction'>>) => {
    const now = new Date().toISOString();
    const project: Project = { id: createId('project'), name: input.name.trim(), summary: input.summary?.trim(), status: 'active', nextAction: input.nextAction?.trim(), createdAt: now, updatedAt: now };
    await saveProject(project);
    await refresh();
    return project;
  }, [refresh]);

  const addProjectHandoff = useCallback(async (projectId: string, note: string, nextAction?: string) => {
    const createdAt = new Date().toISOString();
    const session: ProjectSession = { id: createId('session'), projectId, note: note.trim(), nextAction: nextAction?.trim(), createdAt };
    const activityEvent: ActivityEvent = { id: createId('activity'), kind: 'project_handoff', title: 'Saved a project handoff', xp: rewardsEnabled ? 8 : 0, createdAt, sourceId: session.id };
    await saveProjectSession(session, activityEvent);
    await refresh();
  }, [refresh, rewardsEnabled]);

  const addTransaction = useCallback(async (input: Pick<FinancialTransaction, 'type' | 'title' | 'category' | 'amountMinor'> & { occurredAt?: string }) => {
    if (!Number.isSafeInteger(input.amountMinor) || input.amountMinor <= 0) throw new Error('Enter a valid amount greater than zero.');
    await saveFinancialTransaction({ id: createId('money'), type: input.type, title: input.title.trim(), category: input.category.trim() || 'General', amountMinor: input.amountMinor, occurredAt: input.occurredAt ?? new Date().toISOString() });
    await refresh();
  }, [refresh]);

  const deleteTransaction = useCallback(async (id: string) => {
    await removeFinancialTransactionRecord(id);
    await refresh();
  }, [refresh]);

  const addInvestment = useCallback(async (input: { asset: InvestmentAsset; quantity: string; amountMinor: number; feesMinor?: number; occurredAt?: string }) => {
    if (!Number.isSafeInteger(input.amountMinor) || input.amountMinor <= 0) throw new Error('Enter a valid invested amount.');
    const occurredAt = input.occurredAt ?? new Date().toISOString();
    const investmentId = createId('investment');
    const cashId = `${investmentId}-cash`;
    const unitPriceMinor = unitPriceMinorFromTotal(input.quantity, input.amountMinor);
    if (unitPriceMinor == null) throw new Error('Enter a valid asset quantity with no more than 8 decimal places.');
    const investment: InvestmentTransaction = { id: investmentId, asset: input.asset, quantity: input.quantity, unitPriceMinor, amountMinor: input.amountMinor, feesMinor: input.feesMinor ?? 0, occurredAt, cashTransactionId: cashId };
    const cash: FinancialTransaction = { id: cashId, type: 'investment', title: `${input.asset} contribution`, category: 'Investment', amountMinor: input.amountMinor + (input.feesMinor ?? 0), occurredAt, linkedInvestmentId: investmentId };
    await saveInvestmentPurchase(investment, cash);
    await refresh();
  }, [refresh]);

  const updateQuote = useCallback(async (asset: InvestmentAsset, priceMinor: number, source = 'Manual entry') => {
    if (!Number.isSafeInteger(priceMinor) || priceMinor <= 0) throw new Error('Enter a valid market price.');
    const quote: MarketQuote = { asset, priceMinor, asOf: new Date().toISOString(), source };
    await saveMarketQuote(quote);
    await refresh();
  }, [refresh]);

  const refreshMarketQuotes = useCallback(async () => {
    const quotes = await fetchMarketQuotes();
    await Promise.all(quotes.map(saveMarketQuote));
    await refresh();
  }, [refresh]);

  const addRecurringRule = useCallback(async (input: { kind: RecurringRuleKind; title: string; category: string; amountMinor: number; days: number[]; asset?: InvestmentAsset; quantity?: string; startsOn?: string }) => {
    const days = normalizeMonthlyDays(input.days);
    if (!input.title.trim() || !input.category.trim()) throw new Error('Add a title and category.');
    if (!Number.isSafeInteger(input.amountMinor) || input.amountMinor <= 0) throw new Error('Enter a valid recurring amount.');
    if (!days.length || days.length !== input.days.length) throw new Error('Use unique calendar days from 1 to 31.');
    if (input.kind === 'investment' && (!input.asset || unitPriceMinorFromTotal(input.quantity ?? '', input.amountMinor) == null)) throw new Error('Investments require an asset and an actual quantity with up to 8 decimal places.');
    const now = new Date().toISOString();
    const rule: RecurringRule = { id: createId('recurring'), kind: input.kind, title: input.title.trim(), category: input.category.trim(), amountMinor: input.amountMinor, days, asset: input.kind === 'investment' ? input.asset : undefined, quantity: input.kind === 'investment' ? input.quantity : undefined, active: true, startsOn: input.startsOn ?? localDateKey(new Date()), createdAt: now, updatedAt: now };
    await saveRecurringRule(rule);
    await refresh();
  }, [refresh]);

  const updateRecurringRule = useCallback(async (id: string, input: { kind: RecurringRuleKind; title: string; category: string; amountMinor: number; days: number[]; asset?: InvestmentAsset; quantity?: string; startsOn?: string }) => {
    const existing = data.recurringRules.find((candidate) => candidate.id === id);
    if (!existing) throw new Error('This automation no longer exists.');
    const days = normalizeMonthlyDays(input.days);
    if (!input.title.trim() || !input.category.trim()) throw new Error('Add a title and category.');
    if (!Number.isSafeInteger(input.amountMinor) || input.amountMinor <= 0) throw new Error('Enter a valid recurring amount.');
    if (!days.length || days.length !== input.days.length) throw new Error('Use unique calendar days from 1 to 31.');
    if (input.kind === 'investment' && (!input.asset || unitPriceMinorFromTotal(input.quantity ?? '', input.amountMinor) == null)) throw new Error('Investments require an asset and an actual quantity with up to 8 decimal places.');
    await saveRecurringRule({
      ...existing,
      kind: input.kind,
      title: input.title.trim(),
      category: input.category.trim(),
      amountMinor: input.amountMinor,
      days,
      asset: input.kind === 'investment' ? input.asset : undefined,
      quantity: input.kind === 'investment' ? input.quantity : undefined,
      startsOn: input.startsOn ?? existing.startsOn,
      updatedAt: new Date().toISOString(),
    });
    await refresh();
  }, [data.recurringRules, refresh]);

  const toggleRecurringRule = useCallback(async (id: string) => {
    const rule = data.recurringRules.find((candidate) => candidate.id === id);
    if (!rule) return;
    await saveRecurringRule({ ...rule, active: !rule.active, updatedAt: new Date().toISOString() });
    await refresh();
  }, [data.recurringRules, refresh]);

  const deleteRecurringRule = useCallback(async (id: string) => { await removeRecurringRule(id); await refresh(); }, [refresh]);

  const saveBudget = useCallback(async (category: string, limitMinor: number, id?: string) => {
    if (!category.trim() || !Number.isSafeInteger(limitMinor) || limitMinor <= 0) throw new Error('Add a category and valid monthly limit.');
    const normalizedCategory = category.trim().toLocaleLowerCase();
    const duplicate = data.budgets.find((budget) => budget.id !== id && budget.category.toLocaleLowerCase() === normalizedCategory);
    if (duplicate) throw new Error('A budget for this category already exists.');
    const existing = data.budgets.find((budget) => budget.id === id)
      ?? data.budgets.find((budget) => budget.category.toLocaleLowerCase() === normalizedCategory);
    const now = new Date().toISOString();
    const budget: MonthlyBudget = { id: existing?.id ?? createId('budget'), category: category.trim(), limitMinor, active: true, createdAt: existing?.createdAt ?? now, updatedAt: now };
    await saveMonthlyBudget(budget);
    await refresh();
  }, [data.budgets, refresh]);

  const deleteBudget = useCallback(async (id: string) => { await removeMonthlyBudget(id); await refresh(); }, [refresh]);

  const totalXp = useMemo(() => data.activity.reduce((sum, event) => sum + event.xp, 0), [data.activity]);
  const level = Math.floor(totalXp / 50) + 1;

  const value = useMemo<ItemsContextValue>(() => ({
    ...data, hydrated, pendingRecording, pendingOrganizedDump, latestItemIds, processingError, notificationEnabled, rewardsEnabled, totalXp, level,
    setPendingRecording, setPendingOrganizedDump, setProcessingError, setNotificationEnabled, setRewardsEnabled, confirmOrganizedDump,
    toggleComplete: (id) => updateItem(id, (item) => ({ ...item, completed: !item.completed }), true),
    toggleFavorite: (id) => updateItem(id, (item) => ({ ...item, favorite: !item.favorite })),
    deleteItem, deleteDump,
    changeCategory: (id, category) => updateItem(id, (item) => ({ ...item, category, completed: category === 'task' ? item.completed ?? false : undefined })),
    updateTitle: (id, title) => updateItem(id, (item) => ({ ...item, title })),
    scheduleTomorrow,
    addSubtask: (id, title) => updateItem(id, (item) => ({ ...item, subtasks: [...(item.subtasks ?? []), { id: createId('subtask'), title, completed: false }] })),
    toggleSubtask: (itemId, subtaskId) => updateItem(itemId, (item) => ({ ...item, subtasks: item.subtasks?.map((subtask) => subtask.id === subtaskId ? { ...subtask, completed: !subtask.completed } : subtask) })),
    addProject, addProjectHandoff, addTransaction, deleteTransaction, addInvestment, updateQuote, refreshMarketQuotes,
    addRecurringRule, updateRecurringRule, toggleRecurringRule, deleteRecurringRule, saveBudget, deleteBudget, exportData: exportAppData,
  }), [addInvestment, addProject, addProjectHandoff, addRecurringRule, addTransaction, confirmOrganizedDump, data, deleteBudget, deleteDump, deleteItem, deleteRecurringRule, deleteTransaction, hydrated, latestItemIds, level, notificationEnabled, pendingOrganizedDump, pendingRecording, processingError, refreshMarketQuotes, rewardsEnabled, saveBudget, scheduleTomorrow, setNotificationEnabled, setRewardsEnabled, toggleRecurringRule, totalXp, updateItem, updateQuote, updateRecurringRule]);

  return <ItemsContext.Provider value={value}>{children}</ItemsContext.Provider>;
}

export function useItems() {
  const context = React.use(ItemsContext);
  if (!context) throw new Error('useItems must be used within ItemsProvider');
  return context;
}
