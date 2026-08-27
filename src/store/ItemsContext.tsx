import 'expo-sqlite/localStorage/install';
import * as FileSystem from 'expo-file-system/legacy';
import React, { createContext, PropsWithChildren, useCallback, useEffect, useMemo, useState } from 'react';
import {
  createId,
  confirmFinancialOccurrence,
  exportAppData,
  loadAppData,
  matchFinancialOccurrence,
  postponeFinancialOccurrence,
  removeReviewProposal,
  removeSavingsGoal,
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
  saveHomePreferences,
  saveProject,
  saveProjectSession,
  saveRecurringRule,
  saveReviewProposal,
  saveSavingsGoal,
  resolveGoalContributionSuggestion,
  skipFinancialOccurrence,
  saveWalletSetup,
  updateThoughtItem,
} from '@/data/database';
import {
  cancelAllItemNotifications,
  cancelItemNotification,
  hasNotificationPermission,
  NotificationPermissionError,
  requestNotificationPermission,
  scheduleItemNotification,
} from '@/services/notifications';
import { fetchMarketQuotes } from '@/services/marketApi';
import {
  ActivityEvent,
  AppDataSnapshot,
  Category,
  FinancialTransaction,
  HomePreferences,
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
  ReviewProposal,
  ReviewProposalSource,
  ReminderFrequency,
  ThoughtItem,
  VoiceDump,
  WalletSetup,
  SavingsGoal,
} from '@/types';
import { dateLabelFor, timeLabelFor } from '@/utils/date';
import { unitPriceMinorFromTotal } from '@/utils/money';
import { marketQuotesNeedRefresh } from '@/utils/market';
import { localDateKey, localNoonIso, normalizeMonthlyDays } from '@/utils/recurrence';
import { recurrenceForDate } from '@/utils/reminders';

type ReminderInput = { title: string; detail?: string; dueAt: string; recurrence?: ReminderFrequency | null; enabled?: boolean };
type TaskInput = { title: string; detail?: string };
type RecurringRuleInput = { kind: RecurringRuleKind; title: string; category: string; amountMinor: number; days: number[]; asset?: InvestmentAsset; startsOn?: string };
type SavingsGoalInput = { name: string; targetMinor: number; savedMinor: number; paydayContributionMinor: number; targetDate?: string; active?: boolean };
type OccurrenceConfirmationInput = { amountMinor: number; actualDate: string; quantity?: string; feesMinor?: number; note?: string; updateFutureAmount?: boolean };

type ItemsContextValue = AppDataSnapshot & {
  hydrated: boolean;
  pendingRecording: PendingRecording | null;
  pendingOrganizedDump: OrganizedDump | null;
  latestItemIds: string[];
  processingError: string | null;
  marketRefreshError: string | null;
  notificationEnabled: boolean;
  rewardsEnabled: boolean;
  totalXp: number;
  level: number;
  setPendingRecording: (recording: PendingRecording | null) => void;
  setPendingOrganizedDump: (dump: OrganizedDump | null) => void;
  setProcessingError: (message: string | null) => void;
  setNotificationEnabled: (enabled: boolean) => Promise<void>;
  setRewardsEnabled: (enabled: boolean) => void;
  confirmOrganizedDump: (organized: OrganizedDump) => Promise<void>;
  queueReviewProposal: (source: ReviewProposalSource, organized: OrganizedDump, recording?: PendingRecording) => Promise<ReviewProposal>;
  confirmReviewProposal: (id: string, organized: OrganizedDump) => Promise<void>;
  discardReviewProposal: (id: string) => Promise<void>;
  toggleComplete: (id: string) => Promise<void>;
  toggleFavorite: (id: string) => void;
  deleteItem: (id: string) => void;
  deleteDump: (id: string) => void;
  changeCategory: (id: string, category: Category) => Promise<void>;
  updateTitle: (id: string, title: string) => Promise<void>;
  scheduleTomorrow: (id: string) => Promise<void>;
  addTask: (input: TaskInput) => Promise<ThoughtItem>;
  addReminder: (input: ReminderInput) => Promise<ThoughtItem>;
  updateReminder: (id: string, input: ReminderInput) => Promise<void>;
  toggleReminderEnabled: (id: string) => Promise<void>;
  addSubtask: (id: string, title: string) => void;
  toggleSubtask: (itemId: string, subtaskId: string) => void;
  addProject: (input: Pick<Project, 'name'> & Partial<Pick<Project, 'summary' | 'nextAction'>>) => Promise<Project>;
  addProjectHandoff: (projectId: string, note: string, nextAction?: string) => Promise<void>;
  addTransaction: (input: Pick<FinancialTransaction, 'type' | 'title' | 'category' | 'amountMinor'> & { occurredAt?: string }) => Promise<void>;
  deleteTransaction: (id: string) => Promise<void>;
  addInvestment: (input: { asset: InvestmentAsset; quantity: string; amountMinor: number; feesMinor?: number; occurredAt?: string }) => Promise<void>;
  updateQuote: (asset: InvestmentAsset, priceMinor: number, source?: string) => Promise<void>;
  refreshMarketQuotes: () => Promise<void>;
  addRecurringRule: (input: RecurringRuleInput) => Promise<void>;
  updateRecurringRule: (id: string, input: RecurringRuleInput) => Promise<void>;
  toggleRecurringRule: (id: string) => Promise<void>;
  deleteRecurringRule: (id: string) => Promise<void>;
  confirmOccurrence: (id: string, input: OccurrenceConfirmationInput) => Promise<void>;
  matchOccurrence: (id: string, transactionId: string) => Promise<void>;
  skipOccurrence: (id: string, note?: string) => Promise<void>;
  postponeOccurrence: (id: string, dueDate: string) => Promise<void>;
  saveBudget: (category: string, limitMinor: number, id?: string) => Promise<void>;
  deleteBudget: (id: string) => Promise<void>;
  saveGoal: (input: SavingsGoalInput, id?: string) => Promise<void>;
  deleteGoal: (id: string) => Promise<void>;
  resolveGoalSuggestion: (id: string, status: 'confirmed' | 'skipped') => Promise<void>;
  updateHomePreferences: (preferences: HomePreferences) => Promise<void>;
  setWalletSetup: (setup: WalletSetup) => Promise<void>;
  exportData: () => Promise<string>;
};

const EMPTY_DATA: AppDataSnapshot = { items: [], dumps: [], projects: [], projectSessions: [], transactions: [], investments: [], quotes: [], recurringRules: [], financialOccurrences: [], budgets: [], savingsGoals: [], goalSuggestions: [], reviewProposals: [], homePreferences: { order: ['review', 'weather', 'money', 'goals', 'schedule', 'attention', 'coming-up', 'shortcuts'], hidden: [], compact: ['weather', 'schedule', 'attention', 'coming-up'], balancesVisible: true, widgetBalancesVisible: false, shortcuts: ['add-expense', 'add-reminder', 'currency', 'image-tools'] }, activity: [] };
const NOTIFICATIONS_KEY = 'mewmo.notifications';
const REWARDS_KEY = 'mewmo.rewards';
const LEGACY_NOTIFICATIONS_KEY = 'brain-dump.notifications';
const LEGACY_REWARDS_KEY = 'brain-dump.rewards';
const ItemsContext = createContext<ItemsContextValue | null>(null);

function readMigratedPreference(key: string, legacyKey: string, defaultValue: boolean) {
  const current = localStorage.getItem(key);
  if (current != null) return current !== 'false';
  const legacy = localStorage.getItem(legacyKey);
  if (legacy != null) {
    localStorage.setItem(key, legacy);
    localStorage.removeItem(legacyKey);
  }
  return legacy == null ? defaultValue : legacy !== 'false';
}

export function ItemsProvider({ children }: PropsWithChildren) {
  const [data, setData] = useState<AppDataSnapshot>(EMPTY_DATA);
  const [hydrated, setHydrated] = useState(false);
  const [pendingRecording, setPendingRecording] = useState<PendingRecording | null>(null);
  const [pendingOrganizedDump, setPendingOrganizedDump] = useState<OrganizedDump | null>(null);
  const [latestItemIds, setLatestItemIds] = useState<string[]>([]);
  const [processingError, setProcessingError] = useState<string | null>(null);
  const [marketRefreshError, setMarketRefreshError] = useState<string | null>(null);
  const [notificationEnabled, setNotificationEnabledState] = useState(() => readMigratedPreference(NOTIFICATIONS_KEY, LEGACY_NOTIFICATIONS_KEY, false));
  const [rewardsEnabled, setRewardsEnabledState] = useState(() => readMigratedPreference(REWARDS_KEY, LEGACY_REWARDS_KEY, true));

  const refresh = useCallback(async () => setData(await loadAppData()), []);

  useEffect(() => {
    refresh().catch((error) => setProcessingError(error instanceof Error ? error.message : 'Could not open local storage.')).finally(() => setHydrated(true));
  }, [refresh]);

  useEffect(() => {
    if (!hydrated || !notificationEnabled) return;
    hasNotificationPermission().then((granted) => {
      if (granted) return;
      setNotificationEnabledState(false);
      localStorage.setItem(NOTIFICATIONS_KEY, 'false');
    }).catch(() => undefined);
  }, [hydrated, notificationEnabled]);

  useEffect(() => {
    const needsMarketPrices = data.investments.length > 0 || data.recurringRules.some((rule) => rule.active && rule.kind === 'investment');
    if (!hydrated || !needsMarketPrices || !marketQuotesNeedRefresh(data.quotes)) return;
    let active = true;
    const refreshStaleMarketQuotes = async () => {
      setMarketRefreshError(null);
      const quotes = await fetchMarketQuotes();
      await Promise.all(quotes.map(saveMarketQuote));
      if (active) await refresh();
    };
    refreshStaleMarketQuotes().catch((error) => {
      if (active) setMarketRefreshError(error instanceof Error ? error.message : 'Could not refresh market prices.');
    });
    return () => { active = false; };
  }, [data.investments.length, data.quotes, data.recurringRules, hydrated, refresh]);

  const scheduleNotificationForItem = useCallback(async (item: ThoughtItem) => {
    try {
      return await scheduleItemNotification(item);
    } catch (error) {
      if (error instanceof NotificationPermissionError) {
        setNotificationEnabledState(false);
        localStorage.setItem(NOTIFICATIONS_KEY, 'false');
      }
      throw error;
    }
  }, []);

  const setNotificationEnabled = useCallback(async (enabled: boolean) => {
    if (enabled && !await requestNotificationPermission()) throw new NotificationPermissionError();
    await cancelAllItemNotifications();

    try {
      const nextItems = await Promise.all(data.items.map(async (item) => {
        const next: ThoughtItem = { ...item, notificationId: undefined };
        if (enabled && shouldScheduleNotification(next)) next.notificationId = await scheduleNotificationForItem(next);
        await updateThoughtItem(next);
        return next;
      }));
      const byId = new Map(nextItems.map((item) => [item.id, item]));
      setData((current) => ({ ...current, items: current.items.map((item) => byId.get(item.id) ?? item) }));
      setNotificationEnabledState(enabled);
      localStorage.setItem(NOTIFICATIONS_KEY, String(enabled));
    } catch (error) {
      await cancelAllItemNotifications();
      const clearedItems = data.items.map((item) => ({ ...item, notificationId: undefined }));
      await Promise.all(clearedItems.map(updateThoughtItem)).catch(() => undefined);
      setData((current) => ({ ...current, items: current.items.map((item) => ({ ...item, notificationId: undefined })) }));
      setNotificationEnabledState(false);
      localStorage.setItem(NOTIFICATIONS_KEY, 'false');
      throw error;
    }
  }, [data.items, scheduleNotificationForItem]);

  const setRewardsEnabled = useCallback((enabled: boolean) => {
    setRewardsEnabledState(enabled);
    localStorage.setItem(REWARDS_KEY, String(enabled));
  }, []);

  const persistOrganizedProposal = useCallback(async (organized: OrganizedDump, recording: PendingRecording | undefined, source: ReviewProposalSource, proposalId?: string) => {
    const createdAt = new Date().toISOString();
    const dumpId = proposalId ?? (recording ? createId('dump') : createId('proposal'));
    const sourceId = recording ? dumpId : undefined;
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
          sourceDumpId: sourceId,
          dateLabel: dateLabelFor(dueAt ?? createdAt),
          time: timeLabelFor(dueAt ?? createdAt),
          recurrence: dueAt && suggestion.recurrence ? recurrenceForDate(suggestion.recurrence, dueAt) : undefined,
          reminderEnabled: suggestion.category === 'reminder',
          completed: suggestion.category === 'task' ? false : undefined,
          subtasks: suggestion.subtasks.map((title, subtaskIndex) => ({ id: `${dumpId}-${index}-${subtaskIndex}`, title, completed: false })),
        };
        item.notificationId = notificationEnabled ? await scheduleNotificationForItem(item) : undefined;
        items.push(item);
      } else if (suggestion.category === 'project') {
        projects.push({ id: `${dumpId}-project-${index}`, name: suggestion.projectName || suggestion.title, summary: suggestion.detail ?? undefined, status: 'active', currentFocus: suggestion.detail ?? undefined, nextAction: suggestion.title, createdAt, updatedAt: createdAt, sourceDumpId: sourceId });
      } else if (suggestion.category === 'income' || suggestion.category === 'expense') {
        if ((suggestion.amountMinor ?? 0) <= 0) continue;
        transactions.push({ id: `${dumpId}-money-${index}`, type: suggestion.category, title: suggestion.title, category: suggestion.category === 'income' ? 'Income' : 'General', amountMinor: suggestion.amountMinor!, occurredAt: dueAt ?? createdAt, sourceDumpId: sourceId });
      } else if (suggestion.category === 'investment' && suggestion.asset && (suggestion.amountMinor ?? 0) > 0) {
        const unitPriceMinor = suggestion.unitPriceMinor ?? unitPriceMinorFromTotal(suggestion.quantity ?? '', suggestion.amountMinor!);
        if (unitPriceMinor == null) continue;
        const investmentId = `${dumpId}-investment-${index}`;
        const cashId = `${investmentId}-cash`;
        investments.push({ id: investmentId, asset: suggestion.asset, quantity: suggestion.quantity!, unitPriceMinor, amountMinor: suggestion.amountMinor!, feesMinor: 0, occurredAt: dueAt ?? createdAt, sourceDumpId: sourceId, cashTransactionId: cashId });
        transactions.push({ id: cashId, type: 'investment', title: `${suggestion.asset} contribution`, category: 'Investment', amountMinor: suggestion.amountMinor!, occurredAt: dueAt ?? createdAt, sourceDumpId: sourceId, linkedInvestmentId: investmentId });
      }
    }

    const dump: VoiceDump | undefined = recording ? { id: dumpId, title: organized.title, createdAt, durationSeconds: recording.durationSeconds, uri: recording.uri, transcript: organized.transcript } : undefined;
    const activityEvent: ActivityEvent = { id: createId('activity'), kind: recording ? 'dump_confirmed' : 'proposal_confirmed', title: `Sorted “${organized.title}”`, xp: rewardsEnabled ? 10 : 0, createdAt, sourceId: dumpId };
    await saveConfirmedBundle({ dump, items, projects, transactions, investments, activity: activityEvent, reviewProposalId: proposalId });
    await refresh();
    setLatestItemIds(items.map((item) => item.id));
    setPendingRecording(null);
    setPendingOrganizedDump(null);
    setProcessingError(null);
  }, [notificationEnabled, refresh, rewardsEnabled, scheduleNotificationForItem]);

  const confirmOrganizedDump = useCallback(async (organized: OrganizedDump) => {
    if (!pendingRecording) throw new Error('The original recording is no longer available.');
    await persistOrganizedProposal(organized, pendingRecording, 'voice');
  }, [pendingRecording, persistOrganizedProposal]);

  const queueReviewProposal = useCallback(async (source: ReviewProposalSource, organized: OrganizedDump, recording?: PendingRecording) => {
    const proposal: ReviewProposal = { id: createId('review'), source, organized, recording, createdAt: new Date().toISOString() };
    await saveReviewProposal(proposal);
    await refresh();
    return proposal;
  }, [refresh]);

  const confirmReviewProposal = useCallback(async (id: string, organized: OrganizedDump) => {
    const proposal = data.reviewProposals.find((candidate) => candidate.id === id);
    if (!proposal) throw new Error('This proposal is no longer in the review inbox.');
    await persistOrganizedProposal(organized, proposal.recording, proposal.source, proposal.id);
  }, [data.reviewProposals, persistOrganizedProposal]);

  const discardReviewProposal = useCallback(async (id: string) => {
    const proposal = data.reviewProposals.find((candidate) => candidate.id === id);
    if (proposal?.recording?.uri) await FileSystem.deleteAsync(proposal.recording.uri, { idempotent: true }).catch(() => undefined);
    await removeReviewProposal(id);
    if (proposal?.recording?.uri === pendingRecording?.uri) {
      setPendingRecording(null);
      setPendingOrganizedDump(null);
    }
    await refresh();
  }, [data.reviewProposals, pendingRecording?.uri, refresh]);

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

  const updateNotificationAwareItem = useCallback(async (id: string, transform: (item: ThoughtItem) => ThoughtItem, reward?: boolean) => {
    const item = data.items.find((candidate) => candidate.id === id);
    if (!item) return;
    const next: ThoughtItem = { ...transform(item), notificationId: undefined };
    await cancelItemNotification(item.notificationId);

    try {
      if (notificationEnabled && shouldScheduleNotification(next)) next.notificationId = await scheduleNotificationForItem(next);
      await updateThoughtItem(next);
      if (reward && rewardsEnabled && !item.completed && next.completed) {
        await saveActivity({ id: createId('activity'), kind: 'item_completed', title: `Completed “${next.title}”`, xp: 5, createdAt: new Date().toISOString(), sourceId: next.id });
      }
      await refresh();
    } catch (error) {
      await updateThoughtItem({ ...item, notificationId: undefined }).catch(() => undefined);
      if (error instanceof NotificationPermissionError) {
        setNotificationEnabledState(false);
        localStorage.setItem(NOTIFICATIONS_KEY, 'false');
      }
      await refresh();
      throw error;
    }
  }, [data.items, notificationEnabled, refresh, rewardsEnabled, scheduleNotificationForItem]);

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
    next.notificationId = notificationEnabled ? await scheduleNotificationForItem(next) : undefined;
    updateItem(id, () => next);
  }, [data.items, notificationEnabled, scheduleNotificationForItem, updateItem]);

  const addTask = useCallback(async (input: TaskInput) => {
    const title = input.title.trim();
    if (!title) throw new Error('Add a task title.');
    const createdAt = new Date().toISOString();
    const item: ThoughtItem = {
      id: createId('task'),
      category: 'task',
      title,
      detail: input.detail?.trim() || undefined,
      dueAt: null,
      createdAt,
      dateLabel: dateLabelFor(createdAt),
      time: timeLabelFor(createdAt),
      completed: false,
      subtasks: [],
    };
    await updateThoughtItem(item);
    await refresh();
    return item;
  }, [refresh]);

  const saveReminder = useCallback(async (existing: ThoughtItem | undefined, input: ReminderInput) => {
    const title = input.title.trim();
    const dueDate = new Date(input.dueAt);
    if (!title) throw new Error('Add a reminder title.');
    if (Number.isNaN(dueDate.getTime())) throw new Error('Choose a valid reminder date and time.');
    if (!input.recurrence && dueDate.getTime() <= Date.now()) throw new Error('Choose a future time for a one-time reminder.');
    const enabled = input.enabled !== false;
    const item: ThoughtItem = {
      ...existing,
      id: existing?.id ?? createId('reminder'),
      category: 'reminder',
      title,
      detail: input.detail?.trim() || undefined,
      dueAt: dueDate.toISOString(),
      dateLabel: dateLabelFor(dueDate),
      time: timeLabelFor(dueDate),
      createdAt: existing?.createdAt ?? new Date().toISOString(),
      completed: false,
      reminderEnabled: enabled,
      recurrence: input.recurrence ? recurrenceForDate(input.recurrence, dueDate.toISOString()) : undefined,
    };
    await cancelItemNotification(existing?.notificationId);
    item.notificationId = enabled && notificationEnabled ? await scheduleNotificationForItem(item) : undefined;
    await updateThoughtItem(item);
    await refresh();
    return item;
  }, [notificationEnabled, refresh, scheduleNotificationForItem]);

  const addReminder = useCallback((input: ReminderInput) => saveReminder(undefined, input), [saveReminder]);
  const updateReminder = useCallback(async (id: string, input: ReminderInput) => {
    const existing = data.items.find((item) => item.id === id && item.category === 'reminder');
    if (!existing) throw new Error('This reminder no longer exists.');
    await saveReminder(existing, input);
  }, [data.items, saveReminder]);
  const toggleReminderEnabled = useCallback(async (id: string) => {
    const item = data.items.find((candidate) => candidate.id === id && candidate.category === 'reminder');
    if (!item) return;
    await cancelItemNotification(item.notificationId);
    const next: ThoughtItem = { ...item, reminderEnabled: item.reminderEnabled === false, notificationId: undefined };
    if (next.reminderEnabled && notificationEnabled) next.notificationId = await scheduleNotificationForItem(next);
    await updateThoughtItem(next);
    await refresh();
  }, [data.items, notificationEnabled, refresh, scheduleNotificationForItem]);

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
    setMarketRefreshError(null);
    try {
      const quotes = await fetchMarketQuotes();
      await Promise.all(quotes.map(saveMarketQuote));
      await refresh();
    } catch (error) {
      setMarketRefreshError(error instanceof Error ? error.message : 'Could not refresh market prices.');
      throw error;
    }
  }, [refresh]);

  const addRecurringRule = useCallback(async (input: RecurringRuleInput) => {
    const days = normalizeMonthlyDays(input.days);
    if (!input.title.trim() || !input.category.trim()) throw new Error('Add a title and category.');
    if (!Number.isSafeInteger(input.amountMinor) || input.amountMinor <= 0) throw new Error('Enter a valid recurring amount.');
    if (!days.length || days.length !== input.days.length) throw new Error('Use unique calendar days from 1 to 31.');
    if (input.kind === 'investment' && !input.asset) throw new Error('Choose BTC or VOO for this investment automation.');
    const now = new Date().toISOString();
    const rule: RecurringRule = { id: createId('recurring'), kind: input.kind, title: input.title.trim(), category: input.category.trim(), amountMinor: input.amountMinor, days, asset: input.kind === 'investment' ? input.asset : undefined, active: true, startsOn: input.startsOn ?? localDateKey(new Date()), createdAt: now, updatedAt: now };
    await saveRecurringRule(rule);
    await refresh();
  }, [refresh]);

  const updateRecurringRule = useCallback(async (id: string, input: RecurringRuleInput) => {
    const existing = data.recurringRules.find((candidate) => candidate.id === id);
    if (!existing) throw new Error('This automation no longer exists.');
    const days = normalizeMonthlyDays(input.days);
    if (!input.title.trim() || !input.category.trim()) throw new Error('Add a title and category.');
    if (!Number.isSafeInteger(input.amountMinor) || input.amountMinor <= 0) throw new Error('Enter a valid recurring amount.');
    if (!days.length || days.length !== input.days.length) throw new Error('Use unique calendar days from 1 to 31.');
    if (input.kind === 'investment' && !input.asset) throw new Error('Choose BTC or VOO for this investment automation.');
    await saveRecurringRule({
      ...existing,
      kind: input.kind,
      title: input.title.trim(),
      category: input.category.trim(),
      amountMinor: input.amountMinor,
      days,
      asset: input.kind === 'investment' ? input.asset : undefined,
      quantity: undefined,
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

  const confirmOccurrence = useCallback(async (id: string, input: OccurrenceConfirmationInput) => {
    await confirmFinancialOccurrence(id, input);
    await refresh();
  }, [refresh]);

  const matchOccurrence = useCallback(async (id: string, transactionId: string) => {
    await matchFinancialOccurrence(id, transactionId);
    await refresh();
  }, [refresh]);

  const skipOccurrence = useCallback(async (id: string, note?: string) => {
    await skipFinancialOccurrence(id, note);
    await refresh();
  }, [refresh]);

  const postponeOccurrence = useCallback(async (id: string, dueDate: string) => {
    await postponeFinancialOccurrence(id, dueDate);
    await refresh();
  }, [refresh]);

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

  const saveGoal = useCallback(async (input: SavingsGoalInput, id?: string) => {
    const name = input.name.trim();
    if (!name) throw new Error('Add a goal name.');
    if (!Number.isSafeInteger(input.targetMinor) || input.targetMinor <= 0) throw new Error('Enter a valid target amount.');
    if (!Number.isSafeInteger(input.savedMinor) || input.savedMinor < 0 || input.savedMinor > input.targetMinor) throw new Error('Reserved progress must be between zero and the target.');
    if (!Number.isSafeInteger(input.paydayContributionMinor) || input.paydayContributionMinor < 0) throw new Error('Enter a valid payday suggestion amount.');
    if (input.targetDate && (!/^\d{4}-\d{2}-\d{2}$/.test(input.targetDate) || localDateKey(new Date(localNoonIso(input.targetDate))) !== input.targetDate)) throw new Error('Use a valid target date.');
    const existing = data.savingsGoals.find((goal) => goal.id === id);
    const now = new Date().toISOString();
    const goal: SavingsGoal = { id: existing?.id ?? createId('goal'), name, targetMinor: input.targetMinor, savedMinor: input.savedMinor, paydayContributionMinor: input.paydayContributionMinor, targetDate: input.targetDate, active: input.active ?? existing?.active ?? true, createdAt: existing?.createdAt ?? now, updatedAt: now };
    await saveSavingsGoal(goal);
    await refresh();
  }, [data.savingsGoals, refresh]);

  const deleteGoal = useCallback(async (id: string) => { await removeSavingsGoal(id); await refresh(); }, [refresh]);

  const resolveGoalSuggestion = useCallback(async (id: string, status: 'confirmed' | 'skipped') => {
    await resolveGoalContributionSuggestion(id, status);
    await refresh();
  }, [refresh]);

  const updateHomePreferences = useCallback(async (preferences: HomePreferences) => {
    await saveHomePreferences(preferences);
    await refresh();
  }, [refresh]);

  const setWalletSetup = useCallback(async (setup: WalletSetup) => {
    if (!Number.isSafeInteger(setup.openingBalanceMinor) || setup.openingBalanceMinor < 0) throw new Error('Enter a valid starting wallet amount.');
    if (!/^\d{4}-\d{2}-\d{2}$/.test(setup.startsOn) || localDateKey(new Date(localNoonIso(setup.startsOn))) !== setup.startsOn) throw new Error('Use a valid tracking date in YYYY-MM-DD format.');
    await saveWalletSetup(setup);
    await refresh();
  }, [refresh]);

  const totalXp = useMemo(() => data.activity.reduce((sum, event) => sum + event.xp, 0), [data.activity]);
  const level = Math.floor(totalXp / 50) + 1;

  const value = useMemo<ItemsContextValue>(() => ({
    ...data, hydrated, pendingRecording, pendingOrganizedDump, latestItemIds, processingError, marketRefreshError, notificationEnabled, rewardsEnabled, totalXp, level,
    setPendingRecording, setPendingOrganizedDump, setProcessingError, setNotificationEnabled, setRewardsEnabled, confirmOrganizedDump, queueReviewProposal, confirmReviewProposal, discardReviewProposal,
    toggleComplete: (id) => updateNotificationAwareItem(id, (item) => ({ ...item, completed: !item.completed }), true),
    toggleFavorite: (id) => updateItem(id, (item) => ({ ...item, favorite: !item.favorite })),
    deleteItem, deleteDump,
    changeCategory: (id, category) => updateNotificationAwareItem(id, (item) => ({ ...item, category, completed: category === 'task' ? item.completed ?? false : undefined })),
    updateTitle: (id, title) => updateNotificationAwareItem(id, (item) => ({ ...item, title })),
    scheduleTomorrow, addTask, addReminder, updateReminder, toggleReminderEnabled,
    addSubtask: (id, title) => updateItem(id, (item) => ({ ...item, subtasks: [...(item.subtasks ?? []), { id: createId('subtask'), title, completed: false }] })),
    toggleSubtask: (itemId, subtaskId) => updateItem(itemId, (item) => ({ ...item, subtasks: item.subtasks?.map((subtask) => subtask.id === subtaskId ? { ...subtask, completed: !subtask.completed } : subtask) })),
    addProject, addProjectHandoff, addTransaction, deleteTransaction, addInvestment, updateQuote, refreshMarketQuotes,
    addRecurringRule, updateRecurringRule, toggleRecurringRule, deleteRecurringRule, confirmOccurrence, matchOccurrence, skipOccurrence, postponeOccurrence,
    saveBudget, deleteBudget, saveGoal, deleteGoal, resolveGoalSuggestion, updateHomePreferences, setWalletSetup, exportData: exportAppData,
  }), [addInvestment, addProject, addProjectHandoff, addRecurringRule, addReminder, addTask, addTransaction, confirmOrganizedDump, confirmOccurrence, confirmReviewProposal, data, deleteBudget, deleteDump, deleteGoal, deleteItem, deleteRecurringRule, deleteTransaction, discardReviewProposal, hydrated, latestItemIds, level, marketRefreshError, matchOccurrence, notificationEnabled, pendingOrganizedDump, pendingRecording, postponeOccurrence, processingError, queueReviewProposal, refreshMarketQuotes, resolveGoalSuggestion, rewardsEnabled, saveBudget, saveGoal, scheduleTomorrow, setNotificationEnabled, setRewardsEnabled, setWalletSetup, skipOccurrence, toggleRecurringRule, toggleReminderEnabled, totalXp, updateHomePreferences, updateItem, updateNotificationAwareItem, updateQuote, updateRecurringRule, updateReminder]);

  return <ItemsContext.Provider value={value}>{children}</ItemsContext.Provider>;
}

export function useItems() {
  const context = React.use(ItemsContext);
  if (!context) throw new Error('useItems must be used within ItemsProvider');
  return context;
}

function shouldScheduleNotification(item: ThoughtItem) {
  return Boolean(
    item.dueAt
    && (item.category === 'task' || item.category === 'reminder')
    && item.reminderEnabled !== false
    && !item.completed,
  );
}
