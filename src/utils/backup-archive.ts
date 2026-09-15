import type {
  ActivityEvent,
  AppDataSnapshot,
  FinancialOccurrence,
  FinancialTransaction,
  GoalContributionSuggestion,
  InvestmentTransaction,
  MarketQuote,
  MonthlyBudget,
  Project,
  ProjectSession,
  RecurringRule,
  ReviewProposal,
  SavingsGoal,
  ThoughtItem,
  VoiceDump,
  WalletSetup,
} from '../types/index.ts';
import { normalizeHomePreferences } from '../features/home/home-preferences.ts';

export const BACKUP_VERSION = 1;

/** Every collection the importer restores, in the order it is safe to insert. */
export type BackupArchive = {
  version: number;
  exportedAt: string;
  data: AppDataSnapshot;
};

/** Records that failed validation, so a restore can tell you what it could not read. */
export type BackupIssues = Partial<Record<keyof AppDataSnapshot, number>>;

export type ParsedBackup = { archive: BackupArchive; issues: BackupIssues; total: number };

export function parseBackupArchive(text: string): ParsedBackup {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new Error('That file is not valid JSON. Choose a LifeDesk export file.');
  }
  if (!isRecord(raw)) throw new Error('That file does not contain a LifeDesk backup.');
  const version = Number(raw.version);
  if (!Number.isInteger(version) || version < 1) throw new Error('That file does not contain a LifeDesk backup.');
  if (version > BACKUP_VERSION) throw new Error(`This backup was written by a newer LifeDesk (format ${version}). Update the app before restoring it.`);
  if (!isRecord(raw.data)) throw new Error('That backup is missing its data section.');

  const source = raw.data;
  const issues: BackupIssues = {};
  const collect = <T>(key: keyof AppDataSnapshot, validate: (value: unknown) => T | null) => {
    const input = Array.isArray(source[key]) ? source[key] as unknown[] : [];
    const kept: T[] = [];
    let dropped = 0;
    for (const entry of input) {
      const value = validate(entry);
      if (value) kept.push(value);
      else dropped += 1;
    }
    if (dropped) issues[key] = dropped;
    return kept;
  };

  const data: AppDataSnapshot = {
    items: collect('items', thoughtItem),
    dumps: collect('dumps', voiceDump),
    projects: collect('projects', project),
    projectSessions: collect('projectSessions', projectSession),
    transactions: collect('transactions', financialTransaction),
    investments: collect('investments', investmentTransaction),
    quotes: collect('quotes', marketQuote),
    recurringRules: collect('recurringRules', recurringRule),
    financialOccurrences: collect('financialOccurrences', financialOccurrence),
    budgets: collect('budgets', monthlyBudget),
    savingsGoals: collect('savingsGoals', savingsGoal),
    goalSuggestions: collect('goalSuggestions', goalSuggestion),
    reviewProposals: collect('reviewProposals', reviewProposal),
    homePreferences: normalizeHomePreferences(isRecord(source.homePreferences) ? source.homePreferences : {}),
    walletSetup: walletSetup(source.walletSetup) ?? undefined,
    activity: collect('activity', activityEvent),
  };

  const total = countRecords(data);
  if (!total) throw new Error('That backup contains no records to restore.');

  return {
    archive: { version, exportedAt: typeof raw.exportedAt === 'string' ? raw.exportedAt : new Date().toISOString(), data },
    issues,
    total,
  };
}

export function countRecords(data: AppDataSnapshot) {
  return data.items.length + data.dumps.length + data.projects.length + data.projectSessions.length
    + data.transactions.length + data.investments.length + data.quotes.length + data.recurringRules.length
    + data.financialOccurrences.length + data.budgets.length + data.savingsGoals.length
    + data.goalSuggestions.length + data.reviewProposals.length + data.activity.length;
}

/** A one-line human summary such as "412 records · 96 money, 38 tasks". */
export function describeBackup(data: AppDataSnapshot) {
  const parts = [
    [data.transactions.length, 'money'],
    [data.investments.length, 'investment'],
    [data.items.length, 'task and reminder'],
    [data.savingsGoals.length, 'savings goal'],
    [data.projects.length, 'project'],
  ] as const;
  const described = parts.filter(([count]) => count > 0).map(([count, label]) => `${count} ${label}`);
  return described.length ? described.join(', ') : 'no records';
}

function thoughtItem(value: unknown): ThoughtItem | null {
  if (!isRecord(value)) return null;
  const id = text(value.id);
  const title = text(value.title);
  const category = oneOf(value.category, ['task', 'reminder', 'idea', 'note'] as const);
  if (!id || !title || !category) return null;
  const createdAt = isoDate(value.createdAt) ?? new Date().toISOString();
  return {
    id,
    category,
    title,
    dateLabel: text(value.dateLabel) ?? '',
    time: text(value.time) ?? undefined,
    detail: text(value.detail) ?? undefined,
    dueAt: isoDate(value.dueAt),
    createdAt,
    sourceDumpId: text(value.sourceDumpId) ?? undefined,
    // A restored notification id refers to a schedule that no longer exists.
    notificationId: undefined,
    reminderEnabled: value.reminderEnabled !== false,
    recurrence: recurrence(value.recurrence),
    completed: value.completed == null ? undefined : Boolean(value.completed),
    favorite: Boolean(value.favorite),
    subtasks: Array.isArray(value.subtasks)
      ? value.subtasks.flatMap((entry) => {
        if (!isRecord(entry)) return [];
        const subtaskId = text(entry.id);
        const subtaskTitle = text(entry.title);
        return subtaskId && subtaskTitle ? [{ id: subtaskId, title: subtaskTitle, completed: Boolean(entry.completed) }] : [];
      })
      : [],
  };
}

function recurrence(value: unknown): ThoughtItem['recurrence'] {
  if (!isRecord(value)) return undefined;
  const frequency = oneOf(value.frequency, ['daily', 'weekly', 'monthly', 'yearly'] as const);
  const hour = wholeNumber(value.hour);
  const minute = wholeNumber(value.minute);
  if (!frequency || hour == null || hour > 23 || minute == null || minute > 59) return undefined;
  return {
    frequency,
    hour,
    minute,
    weekday: wholeNumber(value.weekday) ?? undefined,
    day: wholeNumber(value.day) ?? undefined,
    month: wholeNumber(value.month) ?? undefined,
  };
}

function voiceDump(value: unknown): VoiceDump | null {
  if (!isRecord(value)) return null;
  const id = text(value.id);
  const createdAt = isoDate(value.createdAt);
  if (!id || !createdAt) return null;
  return {
    id,
    title: text(value.title) ?? 'Voice note',
    createdAt,
    durationSeconds: wholeNumber(value.durationSeconds) ?? 0,
    // The audio file itself is not inside the archive; the transcript is what survives.
    uri: text(value.uri) ?? '',
    transcript: text(value.transcript) ?? '',
  };
}

function project(value: unknown): Project | null {
  if (!isRecord(value)) return null;
  const id = text(value.id);
  const name = text(value.name);
  const status = oneOf(value.status, ['active', 'paused', 'complete', 'archived'] as const);
  if (!id || !name || !status) return null;
  const createdAt = isoDate(value.createdAt) ?? new Date().toISOString();
  return {
    id,
    name,
    summary: text(value.summary) ?? undefined,
    status,
    currentFocus: text(value.currentFocus) ?? undefined,
    nextAction: text(value.nextAction) ?? undefined,
    createdAt,
    updatedAt: isoDate(value.updatedAt) ?? createdAt,
    sourceDumpId: text(value.sourceDumpId) ?? undefined,
  };
}

function projectSession(value: unknown): ProjectSession | null {
  if (!isRecord(value)) return null;
  const id = text(value.id);
  const projectId = text(value.projectId);
  const note = text(value.note);
  if (!id || !projectId || !note) return null;
  return {
    id,
    projectId,
    note,
    nextAction: text(value.nextAction) ?? undefined,
    createdAt: isoDate(value.createdAt) ?? new Date().toISOString(),
  };
}

function financialTransaction(value: unknown): FinancialTransaction | null {
  if (!isRecord(value)) return null;
  const id = text(value.id);
  const title = text(value.title);
  const type = oneOf(value.type, ['income', 'expense', 'transfer', 'investment'] as const);
  const amountMinor = minorAmount(value.amountMinor);
  const occurredAt = isoDate(value.occurredAt);
  if (!id || !title || !type || amountMinor == null || !occurredAt) return null;
  return {
    id,
    type,
    title,
    category: text(value.category) ?? 'General',
    amountMinor,
    occurredAt,
    note: text(value.note) ?? undefined,
    sourceDumpId: text(value.sourceDumpId) ?? undefined,
    linkedInvestmentId: text(value.linkedInvestmentId) ?? undefined,
  };
}

function investmentTransaction(value: unknown): InvestmentTransaction | null {
  if (!isRecord(value)) return null;
  const id = text(value.id);
  const asset = oneOf(value.asset, ['BTC', 'VOO'] as const);
  const quantity = decimalText(value.quantity);
  const unitPriceMinor = minorAmount(value.unitPriceMinor);
  const amountMinor = minorAmount(value.amountMinor);
  const occurredAt = isoDate(value.occurredAt);
  if (!id || !asset || !quantity || unitPriceMinor == null || amountMinor == null || !occurredAt) return null;
  return {
    id,
    asset,
    quantity,
    unitPriceMinor,
    amountMinor,
    feesMinor: minorAmount(value.feesMinor) ?? 0,
    occurredAt,
    sourceDumpId: text(value.sourceDumpId) ?? undefined,
    cashTransactionId: text(value.cashTransactionId) ?? undefined,
  };
}

function marketQuote(value: unknown): MarketQuote | null {
  if (!isRecord(value)) return null;
  const asset = oneOf(value.asset, ['BTC', 'VOO'] as const);
  const priceMinor = minorAmount(value.priceMinor);
  const asOf = isoDate(value.asOf);
  if (!asset || priceMinor == null || !asOf) return null;
  const usdPhp = positiveNumber(value.usdPhp);
  return {
    asset,
    priceMinor,
    usdPriceMinor: minorAmount(value.usdPriceMinor) ?? undefined,
    usdPhp: usdPhp ?? undefined,
    asOf,
    source: text(value.source) ?? 'Restored backup',
  };
}

function recurringRule(value: unknown): RecurringRule | null {
  if (!isRecord(value)) return null;
  const id = text(value.id);
  const title = text(value.title);
  const kind = oneOf(value.kind, ['income', 'expense', 'investment'] as const);
  const amountMinor = minorAmount(value.amountMinor);
  const startsOn = dateKey(value.startsOn);
  if (!id || !title || !kind || !amountMinor || !startsOn) return null;
  const days = Array.isArray(value.days)
    ? [...new Set(value.days.map((day) => wholeNumber(day)).filter((day): day is number => day != null && day >= 1 && day <= 31))].sort((a, b) => a - b)
    : [];
  if (!days.length) return null;
  const createdAt = isoDate(value.createdAt) ?? new Date().toISOString();
  return {
    id,
    kind,
    title,
    category: text(value.category) ?? 'General',
    amountMinor,
    days,
    asset: oneOf(value.asset, ['BTC', 'VOO'] as const) ?? undefined,
    quantity: decimalText(value.quantity) ?? undefined,
    active: value.active !== false,
    startsOn,
    createdAt,
    updatedAt: isoDate(value.updatedAt) ?? createdAt,
  };
}

function financialOccurrence(value: unknown): FinancialOccurrence | null {
  if (!isRecord(value)) return null;
  const id = text(value.id);
  const ruleId = text(value.ruleId);
  const title = text(value.title);
  const kind = oneOf(value.kind, ['income', 'expense', 'investment'] as const);
  const plannedAmountMinor = minorAmount(value.plannedAmountMinor);
  const scheduledDate = dateKey(value.scheduledDate);
  const status = oneOf(value.status, ['pending', 'confirmed', 'skipped'] as const);
  if (!id || !ruleId || !title || !kind || !plannedAmountMinor || !scheduledDate || !status) return null;
  const createdAt = isoDate(value.createdAt) ?? new Date().toISOString();
  return {
    id,
    ruleId,
    kind,
    title,
    category: text(value.category) ?? 'General',
    plannedAmountMinor,
    scheduledDate,
    dueDate: dateKey(value.dueDate) ?? scheduledDate,
    asset: oneOf(value.asset, ['BTC', 'VOO'] as const) ?? undefined,
    status,
    actualAmountMinor: minorAmount(value.actualAmountMinor) ?? undefined,
    actualDate: dateKey(value.actualDate) ?? undefined,
    quantity: decimalText(value.quantity) ?? undefined,
    feesMinor: minorAmount(value.feesMinor) ?? undefined,
    note: text(value.note) ?? undefined,
    transactionId: text(value.transactionId) ?? undefined,
    investmentId: text(value.investmentId) ?? undefined,
    createdAt,
    updatedAt: isoDate(value.updatedAt) ?? createdAt,
    resolvedAt: isoDate(value.resolvedAt) ?? undefined,
  };
}

function monthlyBudget(value: unknown): MonthlyBudget | null {
  if (!isRecord(value)) return null;
  const id = text(value.id);
  const category = text(value.category);
  const limitMinor = minorAmount(value.limitMinor);
  if (!id || !category || !limitMinor) return null;
  const createdAt = isoDate(value.createdAt) ?? new Date().toISOString();
  return { id, category, limitMinor, active: value.active !== false, createdAt, updatedAt: isoDate(value.updatedAt) ?? createdAt };
}

function savingsGoal(value: unknown): SavingsGoal | null {
  if (!isRecord(value)) return null;
  const id = text(value.id);
  const name = text(value.name);
  const targetMinor = minorAmount(value.targetMinor);
  if (!id || !name || !targetMinor) return null;
  const createdAt = isoDate(value.createdAt) ?? new Date().toISOString();
  return {
    id,
    name,
    targetMinor,
    savedMinor: Math.min(minorAmount(value.savedMinor) ?? 0, targetMinor),
    paydayContributionMinor: minorAmount(value.paydayContributionMinor) ?? 0,
    targetDate: dateKey(value.targetDate) ?? undefined,
    active: value.active !== false,
    createdAt,
    updatedAt: isoDate(value.updatedAt) ?? createdAt,
  };
}

function goalSuggestion(value: unknown): GoalContributionSuggestion | null {
  if (!isRecord(value)) return null;
  const id = text(value.id);
  const goalId = text(value.goalId);
  const sourceTransactionId = text(value.sourceTransactionId);
  const amountMinor = minorAmount(value.amountMinor);
  const status = oneOf(value.status, ['pending', 'confirmed', 'skipped'] as const);
  if (!id || !goalId || !sourceTransactionId || !amountMinor || !status) return null;
  return {
    id,
    goalId,
    sourceTransactionId,
    amountMinor,
    status,
    createdAt: isoDate(value.createdAt) ?? new Date().toISOString(),
    resolvedAt: isoDate(value.resolvedAt) ?? undefined,
  };
}

function reviewProposal(value: unknown): ReviewProposal | null {
  if (!isRecord(value)) return null;
  const id = text(value.id);
  const source = oneOf(value.source, ['voice', 'chat'] as const);
  if (!id || !source || !isRecord(value.organized) || !Array.isArray(value.organized.items)) return null;
  const organized = value.organized;
  const organizedItems = organized.items as unknown[];
  return {
    id,
    source,
    organized: {
      title: text(organized.title) ?? 'Saved proposal',
      transcript: text(organized.transcript) ?? '',
      items: organizedItems.filter(isRecord).flatMap((entry) => {
        const category = oneOf(entry.category, ['task', 'reminder', 'idea', 'note', 'project', 'income', 'expense', 'investment'] as const);
        const title = text(entry.title);
        if (!category || !title) return [];
        return [{
          category,
          title,
          detail: text(entry.detail),
          dueAt: isoDate(entry.dueAt),
          recurrence: oneOf(entry.recurrence, ['daily', 'weekly', 'monthly', 'yearly'] as const),
          subtasks: Array.isArray(entry.subtasks) ? (entry.subtasks as unknown[]).flatMap((subtask) => { const value = text(subtask); return value ? [value] : []; }) : [],
          projectName: text(entry.projectName),
          amountMinor: minorAmount(entry.amountMinor),
          asset: oneOf(entry.asset, ['BTC', 'VOO'] as const),
          quantity: decimalText(entry.quantity),
          unitPriceMinor: minorAmount(entry.unitPriceMinor),
        }];
      }),
    },
    // The recording file is outside the archive, so a restored proposal is text only.
    recording: undefined,
    createdAt: isoDate(value.createdAt) ?? new Date().toISOString(),
  };
}

function activityEvent(value: unknown): ActivityEvent | null {
  if (!isRecord(value)) return null;
  const id = text(value.id);
  const title = text(value.title);
  const kind = oneOf(value.kind, ['dump_confirmed', 'proposal_confirmed', 'item_completed', 'project_handoff', 'weekly_review'] as const);
  if (!id || !title || !kind) return null;
  return {
    id,
    kind,
    title,
    xp: wholeNumber(value.xp) ?? 0,
    createdAt: isoDate(value.createdAt) ?? new Date().toISOString(),
    sourceId: text(value.sourceId) ?? undefined,
  };
}

function walletSetup(value: unknown): WalletSetup | null {
  if (!isRecord(value)) return null;
  const openingBalanceMinor = minorAmount(value.openingBalanceMinor);
  const startsOn = dateKey(value.startsOn);
  return openingBalanceMinor == null || !startsOn ? null : { openingBalanceMinor, startsOn };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function text(value: unknown) {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function oneOf<T extends readonly string[]>(value: unknown, allowed: T): T[number] | null {
  return typeof value === 'string' && allowed.includes(value) ? value as T[number] : null;
}

/** Centavo amounts must be non-negative safe integers or the ledger arithmetic breaks. */
function minorAmount(value: unknown) {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0 ? value : null;
}

function wholeNumber(value: unknown) {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0 ? value : null;
}

function positiveNumber(value: unknown) {
  return typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : null;
}

function decimalText(value: unknown) {
  const raw = text(value);
  return raw && /^(?:0|[1-9]\d*)(?:\.\d{1,8})?$/.test(raw) ? raw : null;
}

function isoDate(value: unknown) {
  const raw = text(value);
  if (!raw) return null;
  const parsed = Date.parse(raw);
  return Number.isNaN(parsed) ? null : new Date(parsed).toISOString();
}

function dateKey(value: unknown) {
  const raw = text(value);
  return raw && /^\d{4}-\d{2}-\d{2}$/.test(raw) && !Number.isNaN(Date.parse(`${raw}T12:00:00`)) ? raw : null;
}
