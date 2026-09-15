import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SQLite from 'expo-sqlite';
import { Platform } from 'react-native';
import {
  ActivityEvent,
  AppDataSnapshot,
  FinancialOccurrence,
  FinancialTransaction,
  GoalContributionSuggestion,
  HomePreferences,
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
} from '@/types';
import { DEFAULT_HOME_PREFERENCES, normalizeHomePreferences } from '@/features/home/home-preferences';
import { BACKUP_VERSION } from '@/utils/backup-archive';
import { unitPriceMinorFromTotal } from '@/utils/money';
import { localDateKey, localNoonIso, scheduledDatesThrough } from '@/utils/recurrence';

const DATABASE_NAME = 'brain-dump.db';
const LEGACY_ITEMS_KEY = '@gather/items-v2';
const LEGACY_DUMPS_KEY = '@gather/dumps-v2';
const LEGACY_IMPORT_KEY = 'legacy_import_v2';
const WALLET_OPENING_BALANCE_KEY = 'wallet_opening_balance_minor';
const WALLET_TRACKING_START_KEY = 'wallet_tracking_starts_on';
const HOME_PREFERENCES_KEY = 'home_preferences_v1';

let databasePromise: Promise<SQLite.SQLiteDatabase> | undefined;

export function createId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export async function initializeDatabase() {
  databasePromise ??= openAndMigrate().catch((error) => {
    databasePromise = undefined;
    throw error;
  });
  return databasePromise;
}

async function openAndMigrate() {
  const db = await SQLite.openDatabaseAsync(DATABASE_NAME);
  await db.execAsync('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;');
  const row = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version');
  const version = row?.user_version ?? 0;

  if (version < 1) {
    await db.execAsync(`
      CREATE TABLE IF NOT EXISTS thought_items (
        id TEXT PRIMARY KEY NOT NULL,
        category TEXT NOT NULL,
        title TEXT NOT NULL,
        date_label TEXT NOT NULL,
        time_label TEXT,
        detail TEXT,
        due_at TEXT,
        created_at TEXT NOT NULL,
        source_dump_id TEXT,
        notification_id TEXT,
        completed INTEGER,
        favorite INTEGER NOT NULL DEFAULT 0,
        subtasks_json TEXT NOT NULL DEFAULT '[]'
      );
      CREATE INDEX IF NOT EXISTS thought_items_due_at ON thought_items(due_at);
      CREATE INDEX IF NOT EXISTS thought_items_source_dump ON thought_items(source_dump_id);

      CREATE TABLE IF NOT EXISTS voice_dumps (
        id TEXT PRIMARY KEY NOT NULL,
        title TEXT NOT NULL,
        created_at TEXT NOT NULL,
        duration_seconds INTEGER NOT NULL,
        uri TEXT NOT NULL,
        transcript TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS projects (
        id TEXT PRIMARY KEY NOT NULL,
        name TEXT NOT NULL,
        summary TEXT,
        status TEXT NOT NULL,
        current_focus TEXT,
        next_action TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        source_dump_id TEXT
      );

      CREATE TABLE IF NOT EXISTS project_sessions (
        id TEXT PRIMARY KEY NOT NULL,
        project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
        note TEXT NOT NULL,
        next_action TEXT,
        created_at TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS project_sessions_project ON project_sessions(project_id, created_at DESC);

      CREATE TABLE IF NOT EXISTS financial_transactions (
        id TEXT PRIMARY KEY NOT NULL,
        type TEXT NOT NULL,
        title TEXT NOT NULL,
        category TEXT NOT NULL,
        amount_minor INTEGER NOT NULL CHECK(amount_minor >= 0),
        occurred_at TEXT NOT NULL,
        source_dump_id TEXT,
        linked_investment_id TEXT UNIQUE
      );
      CREATE INDEX IF NOT EXISTS financial_transactions_date ON financial_transactions(occurred_at DESC);

      CREATE TABLE IF NOT EXISTS investment_transactions (
        id TEXT PRIMARY KEY NOT NULL,
        asset TEXT NOT NULL CHECK(asset IN ('BTC', 'VOO')),
        quantity TEXT NOT NULL,
        unit_price_minor INTEGER NOT NULL CHECK(unit_price_minor >= 0),
        amount_minor INTEGER NOT NULL CHECK(amount_minor >= 0),
        fees_minor INTEGER NOT NULL DEFAULT 0 CHECK(fees_minor >= 0),
        occurred_at TEXT NOT NULL,
        source_dump_id TEXT,
        cash_transaction_id TEXT UNIQUE REFERENCES financial_transactions(id)
      );
      CREATE INDEX IF NOT EXISTS investment_transactions_asset ON investment_transactions(asset, occurred_at DESC);

      CREATE TABLE IF NOT EXISTS market_quotes (
        asset TEXT PRIMARY KEY NOT NULL CHECK(asset IN ('BTC', 'VOO')),
        price_minor INTEGER NOT NULL CHECK(price_minor >= 0),
        as_of TEXT NOT NULL,
        source TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS activity_events (
        id TEXT PRIMARY KEY NOT NULL,
        kind TEXT NOT NULL,
        title TEXT NOT NULL,
        xp INTEGER NOT NULL CHECK(xp >= 0),
        created_at TEXT NOT NULL,
        source_id TEXT,
        UNIQUE(kind, source_id)
      );

      CREATE TABLE IF NOT EXISTS settings (
        key TEXT PRIMARY KEY NOT NULL,
        value TEXT NOT NULL
      );
      PRAGMA user_version = 1;
    `);
  }

  if (version < 2) {
    await db.execAsync(`
      CREATE TABLE IF NOT EXISTS recurring_rules (
        id TEXT PRIMARY KEY NOT NULL,
        kind TEXT NOT NULL CHECK(kind IN ('income', 'expense', 'investment')),
        title TEXT NOT NULL,
        category TEXT NOT NULL,
        amount_minor INTEGER NOT NULL CHECK(amount_minor > 0),
        days_json TEXT NOT NULL,
        asset TEXT CHECK(asset IN ('BTC', 'VOO')),
        quantity TEXT,
        active INTEGER NOT NULL DEFAULT 1,
        starts_on TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS recurring_occurrences (
        id TEXT PRIMARY KEY NOT NULL,
        rule_id TEXT NOT NULL REFERENCES recurring_rules(id) ON DELETE CASCADE,
        scheduled_date TEXT NOT NULL,
        transaction_id TEXT NOT NULL,
        investment_id TEXT,
        created_at TEXT NOT NULL,
        UNIQUE(rule_id, scheduled_date)
      );
      CREATE INDEX IF NOT EXISTS recurring_occurrences_rule ON recurring_occurrences(rule_id, scheduled_date DESC);
      CREATE TABLE IF NOT EXISTS monthly_budgets (
        id TEXT PRIMARY KEY NOT NULL,
        category TEXT NOT NULL COLLATE NOCASE UNIQUE,
        limit_minor INTEGER NOT NULL CHECK(limit_minor > 0),
        active INTEGER NOT NULL DEFAULT 1,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
      PRAGMA user_version = 2;
    `);
  }

  if (version < 3) {
    await db.execAsync(`
      ALTER TABLE market_quotes ADD COLUMN usd_price_minor INTEGER;
      ALTER TABLE market_quotes ADD COLUMN usd_php REAL;
      PRAGMA user_version = 3;
    `);
  }

  if (version < 4) {
    await db.execAsync(`
      ALTER TABLE thought_items ADD COLUMN recurrence_json TEXT;
      ALTER TABLE thought_items ADD COLUMN reminder_enabled INTEGER NOT NULL DEFAULT 1;
      PRAGMA user_version = 4;
    `);
  }

  if (version < 5) {
    await db.execAsync(`
      CREATE TABLE IF NOT EXISTS financial_occurrences (
        id TEXT PRIMARY KEY NOT NULL,
        rule_id TEXT NOT NULL,
        kind TEXT NOT NULL CHECK(kind IN ('income', 'expense', 'investment')),
        title TEXT NOT NULL,
        category TEXT NOT NULL,
        planned_amount_minor INTEGER NOT NULL CHECK(planned_amount_minor > 0),
        scheduled_date TEXT NOT NULL,
        due_date TEXT NOT NULL,
        asset TEXT CHECK(asset IN ('BTC', 'VOO')),
        status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending', 'confirmed', 'skipped')),
        actual_amount_minor INTEGER,
        actual_date TEXT,
        quantity TEXT,
        fees_minor INTEGER,
        note TEXT,
        transaction_id TEXT,
        investment_id TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        resolved_at TEXT,
        UNIQUE(rule_id, scheduled_date)
      );
      CREATE INDEX IF NOT EXISTS financial_occurrences_status_due ON financial_occurrences(status, due_date);

      CREATE TABLE IF NOT EXISTS savings_goals (
        id TEXT PRIMARY KEY NOT NULL,
        name TEXT NOT NULL,
        target_minor INTEGER NOT NULL CHECK(target_minor > 0),
        saved_minor INTEGER NOT NULL DEFAULT 0 CHECK(saved_minor >= 0),
        payday_contribution_minor INTEGER NOT NULL DEFAULT 0 CHECK(payday_contribution_minor >= 0),
        target_date TEXT,
        active INTEGER NOT NULL DEFAULT 1,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS goal_contribution_suggestions (
        id TEXT PRIMARY KEY NOT NULL,
        goal_id TEXT NOT NULL REFERENCES savings_goals(id) ON DELETE CASCADE,
        source_transaction_id TEXT NOT NULL,
        amount_minor INTEGER NOT NULL CHECK(amount_minor > 0),
        status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending', 'confirmed', 'skipped')),
        created_at TEXT NOT NULL,
        resolved_at TEXT,
        UNIQUE(goal_id, source_transaction_id)
      );

      CREATE TABLE IF NOT EXISTS review_proposals (
        id TEXT PRIMARY KEY NOT NULL,
        source TEXT NOT NULL CHECK(source IN ('voice', 'chat')),
        organized_json TEXT NOT NULL,
        recording_json TEXT,
        created_at TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS review_proposals_created ON review_proposals(created_at DESC);
      PRAGMA user_version = 5;
    `);
  }

  if (version < 6) {
    await db.execAsync(`
      ALTER TABLE financial_transactions ADD COLUMN note TEXT;
      PRAGMA user_version = 6;
    `);
  }

  await migrateLegacyStorage(db);
  return db;
}

async function migrateLegacyStorage(db: SQLite.SQLiteDatabase) {
  const imported = await db.getFirstAsync<{ value: string }>('SELECT value FROM settings WHERE key = ?', LEGACY_IMPORT_KEY);
  if (imported?.value === 'complete') return;

  const entries = await AsyncStorage.multiGet([LEGACY_ITEMS_KEY, LEGACY_DUMPS_KEY]);
  const legacyItems = safeArray<ThoughtItem>(entries.find(([key]) => key === LEGACY_ITEMS_KEY)?.[1]);
  const legacyDumps = safeArray<VoiceDump>(entries.find(([key]) => key === LEGACY_DUMPS_KEY)?.[1]);

  await withWriteTransaction(db, async (txn) => {
    for (const item of legacyItems) await insertThoughtItem(txn, item);
    for (const dump of legacyDumps) await insertVoiceDump(txn, dump);
    await txn.runAsync('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)', LEGACY_IMPORT_KEY, 'complete');
  });
}

function safeArray<T>(value?: string | null): T[] {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed as T[] : [];
  } catch {
    return [];
  }
}

/**
 * Posts any recurring rule occurrences that have come due. This scans every
 * active rule, so it belongs on app start and foreground rather than on the
 * read that follows each edit.
 */
export async function generateDueOccurrences() {
  const db = await initializeDatabase();
  await createDueRecurringOccurrences(db);
}

export async function loadAppData(): Promise<AppDataSnapshot> {
  const db = await initializeDatabase();
  const [itemRows, dumpRows, projects, sessions, transactions, investments, quotes, recurringRules, occurrences, budgets, savingsGoals, goalSuggestions, reviewProposals, activity, walletSettings] = await Promise.all([
    db.getAllAsync<ThoughtItemRow>('SELECT * FROM thought_items ORDER BY created_at DESC'),
    db.getAllAsync<VoiceDumpRow>('SELECT * FROM voice_dumps ORDER BY created_at DESC'),
    db.getAllAsync<ProjectRow>('SELECT * FROM projects ORDER BY updated_at DESC'),
    db.getAllAsync<ProjectSessionRow>('SELECT * FROM project_sessions ORDER BY created_at DESC'),
    db.getAllAsync<FinancialTransactionRow>('SELECT * FROM financial_transactions ORDER BY occurred_at DESC'),
    db.getAllAsync<InvestmentTransactionRow>('SELECT * FROM investment_transactions ORDER BY occurred_at DESC'),
    db.getAllAsync<MarketQuote>('SELECT asset, price_minor AS priceMinor, usd_price_minor AS usdPriceMinor, usd_php AS usdPhp, as_of AS asOf, source FROM market_quotes'),
    db.getAllAsync<RecurringRuleRow>('SELECT * FROM recurring_rules ORDER BY active DESC, updated_at DESC'),
    db.getAllAsync<FinancialOccurrenceRow>('SELECT * FROM financial_occurrences ORDER BY status = \'pending\' DESC, due_date, created_at DESC'),
    db.getAllAsync<MonthlyBudgetRow>('SELECT * FROM monthly_budgets ORDER BY active DESC, category COLLATE NOCASE'),
    db.getAllAsync<SavingsGoalRow>('SELECT * FROM savings_goals ORDER BY active DESC, updated_at DESC'),
    db.getAllAsync<GoalSuggestionRow>('SELECT * FROM goal_contribution_suggestions ORDER BY status = \'pending\' DESC, created_at DESC'),
    db.getAllAsync<ReviewProposalRow>('SELECT * FROM review_proposals ORDER BY created_at DESC'),
    db.getAllAsync<ActivityEventRow>('SELECT * FROM activity_events ORDER BY created_at DESC'),
    db.getAllAsync<SettingRow>('SELECT key, value FROM settings WHERE key IN (?, ?, ?)', WALLET_OPENING_BALANCE_KEY, WALLET_TRACKING_START_KEY, HOME_PREFERENCES_KEY),
  ]);

  const openingBalanceValue = walletSettings.find((row) => row.key === WALLET_OPENING_BALANCE_KEY)?.value;
  const startsOn = walletSettings.find((row) => row.key === WALLET_TRACKING_START_KEY)?.value;
  const homePreferencesValue = walletSettings.find((row) => row.key === HOME_PREFERENCES_KEY)?.value;
  const openingBalanceMinor = openingBalanceValue == null ? null : Number(openingBalanceValue);
  const walletSetup = startsOn && Number.isSafeInteger(openingBalanceMinor) && openingBalanceMinor! >= 0
    ? { openingBalanceMinor: openingBalanceMinor!, startsOn }
    : undefined;

  return {
    items: itemRows.map(fromThoughtItemRow),
    dumps: dumpRows.map((row) => ({ id: row.id, title: row.title, createdAt: row.created_at, durationSeconds: row.duration_seconds, uri: row.uri, transcript: row.transcript })),
    projects: projects.map((row) => ({ id: row.id, name: row.name, summary: row.summary ?? undefined, status: row.status as Project['status'], currentFocus: row.current_focus ?? undefined, nextAction: row.next_action ?? undefined, createdAt: row.created_at, updatedAt: row.updated_at, sourceDumpId: row.source_dump_id ?? undefined })),
    projectSessions: sessions.map((row) => ({ id: row.id, projectId: row.project_id, note: row.note, nextAction: row.next_action ?? undefined, createdAt: row.created_at })),
    transactions: transactions.map(fromFinancialTransactionRow),
    investments: investments.map((row) => ({ id: row.id, asset: row.asset as InvestmentTransaction['asset'], quantity: row.quantity, unitPriceMinor: row.unit_price_minor, amountMinor: row.amount_minor, feesMinor: row.fees_minor, occurredAt: row.occurred_at, sourceDumpId: row.source_dump_id ?? undefined, cashTransactionId: row.cash_transaction_id ?? undefined })),
    quotes,
    recurringRules: recurringRules.map((row) => ({ id: row.id, kind: row.kind as RecurringRule['kind'], title: row.title, category: row.category, amountMinor: row.amount_minor, days: safeArray<number>(row.days_json), asset: (row.asset as RecurringRule['asset']) ?? undefined, quantity: row.quantity ?? undefined, active: Boolean(row.active), startsOn: row.starts_on, createdAt: row.created_at, updatedAt: row.updated_at })),
    financialOccurrences: occurrences.map(fromFinancialOccurrenceRow),
    budgets: budgets.map((row) => ({ id: row.id, category: row.category, limitMinor: row.limit_minor, active: Boolean(row.active), createdAt: row.created_at, updatedAt: row.updated_at })),
    savingsGoals: savingsGoals.map((row) => ({ id: row.id, name: row.name, targetMinor: row.target_minor, savedMinor: row.saved_minor, paydayContributionMinor: row.payday_contribution_minor, targetDate: row.target_date ?? undefined, active: Boolean(row.active), createdAt: row.created_at, updatedAt: row.updated_at })),
    goalSuggestions: goalSuggestions.map((row) => ({ id: row.id, goalId: row.goal_id, sourceTransactionId: row.source_transaction_id, amountMinor: row.amount_minor, status: row.status as GoalContributionSuggestion['status'], createdAt: row.created_at, resolvedAt: row.resolved_at ?? undefined })),
    reviewProposals: reviewProposals.flatMap((row) => {
      const organized = safeObject<ReviewProposal['organized']>(row.organized_json);
      if (!organized) return [];
      return [{ id: row.id, source: row.source as ReviewProposal['source'], organized, recording: row.recording_json ? safeObject<NonNullable<ReviewProposal['recording']>>(row.recording_json) : undefined, createdAt: row.created_at }];
    }),
    homePreferences: normalizeHomePreferences(homePreferencesValue ? safeObject<Partial<HomePreferences>>(homePreferencesValue) : DEFAULT_HOME_PREFERENCES),
    walletSetup,
    activity: activity.map((row) => ({ id: row.id, kind: row.kind as ActivityEvent['kind'], title: row.title, xp: row.xp, createdAt: row.created_at, sourceId: row.source_id ?? undefined })),
  };
}

export async function saveWalletSetup(setup: WalletSetup) {
  const db = await initializeDatabase();
  await withWriteTransaction(db, async (txn) => {
    await txn.runAsync('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)', WALLET_OPENING_BALANCE_KEY, String(setup.openingBalanceMinor));
    await txn.runAsync('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)', WALLET_TRACKING_START_KEY, setup.startsOn);
  });
}

export async function saveHomePreferences(preferences: HomePreferences) {
  const db = await initializeDatabase();
  const normalized = normalizeHomePreferences(preferences);
  await db.runAsync('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)', HOME_PREFERENCES_KEY, JSON.stringify(normalized));
}

export async function saveReviewProposal(proposal: ReviewProposal) {
  const db = await initializeDatabase();
  await db.runAsync(
    'INSERT OR REPLACE INTO review_proposals (id, source, organized_json, recording_json, created_at) VALUES (?, ?, ?, ?, ?)',
    proposal.id,
    proposal.source,
    JSON.stringify(proposal.organized),
    proposal.recording ? JSON.stringify(proposal.recording) : null,
    proposal.createdAt,
  );
}

export async function removeReviewProposal(id: string) {
  const db = await initializeDatabase();
  await db.runAsync('DELETE FROM review_proposals WHERE id = ?', id);
}

export async function saveSavingsGoal(goal: SavingsGoal) {
  const db = await initializeDatabase();
  await db.runAsync(`INSERT INTO savings_goals
    (id, name, target_minor, saved_minor, payday_contribution_minor, target_date, active, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET name = excluded.name, target_minor = excluded.target_minor,
      saved_minor = excluded.saved_minor, payday_contribution_minor = excluded.payday_contribution_minor,
      target_date = excluded.target_date, active = excluded.active, updated_at = excluded.updated_at`,
  goal.id, goal.name, goal.targetMinor, goal.savedMinor, goal.paydayContributionMinor, goal.targetDate ?? null, Number(goal.active), goal.createdAt, goal.updatedAt);
}

export async function removeSavingsGoal(id: string) {
  const db = await initializeDatabase();
  await withWriteTransaction(db, async (txn) => {
    await txn.runAsync('DELETE FROM goal_contribution_suggestions WHERE goal_id = ?', id);
    await txn.runAsync('DELETE FROM savings_goals WHERE id = ?', id);
  });
}

export async function resolveGoalContributionSuggestion(id: string, status: 'confirmed' | 'skipped') {
  const db = await initializeDatabase();
  await withWriteTransaction(db, async (txn) => {
    const suggestion = await txn.getFirstAsync<GoalSuggestionRow>('SELECT * FROM goal_contribution_suggestions WHERE id = ?', id);
    if (!suggestion || suggestion.status !== 'pending') throw new Error('This goal suggestion is no longer pending.');
    const resolvedAt = new Date().toISOString();
    if (status === 'confirmed') {
      await txn.runAsync('UPDATE savings_goals SET saved_minor = MIN(target_minor, saved_minor + ?), updated_at = ? WHERE id = ?', suggestion.amount_minor, resolvedAt, suggestion.goal_id);
    }
    await txn.runAsync('UPDATE goal_contribution_suggestions SET status = ?, resolved_at = ? WHERE id = ?', status, resolvedAt, id);
  });
}

export type ConfirmOccurrenceInput = {
  amountMinor: number;
  actualDate: string;
  quantity?: string;
  feesMinor?: number;
  note?: string;
  updateFutureAmount?: boolean;
};

export async function confirmFinancialOccurrence(id: string, input: ConfirmOccurrenceInput) {
  if (!Number.isSafeInteger(input.amountMinor) || input.amountMinor <= 0) throw new Error('Enter the amount that actually happened.');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.actualDate)) throw new Error('Use a valid actual date in YYYY-MM-DD format.');
  const occurredAt = localNoonIso(input.actualDate);
  if (localDateKey(new Date(occurredAt)) !== input.actualDate) throw new Error('Use a valid actual date.');
  const feesMinor = input.feesMinor ?? 0;
  if (!Number.isSafeInteger(feesMinor) || feesMinor < 0) throw new Error('Enter valid fees.');

  const db = await initializeDatabase();
  await withWriteTransaction(db, async (txn) => {
    const row = await txn.getFirstAsync<FinancialOccurrenceRow>('SELECT * FROM financial_occurrences WHERE id = ?', id);
    if (!row || row.status !== 'pending') throw new Error('This scheduled entry is no longer pending.');
    const transactionId = `money-${row.id}`;
    const investmentId = row.kind === 'investment' ? `investment-${row.id}` : null;

    if (row.kind === 'investment') {
      if (!row.asset) throw new Error('This investment is missing its asset.');
      const quantity = input.quantity?.trim() ?? '';
      const unitPriceMinor = unitPriceMinorFromTotal(quantity, input.amountMinor);
      if (unitPriceMinor == null) throw new Error('Enter the exact fractional quantity you received, with no more than 8 decimal places.');
      await txn.runAsync(`INSERT INTO financial_transactions
        (id, type, title, category, amount_minor, occurred_at, source_dump_id, linked_investment_id)
        VALUES (?, 'investment', ?, ?, ?, ?, NULL, ?)`, transactionId, row.title, row.category, input.amountMinor + feesMinor, occurredAt, investmentId);
      await txn.runAsync(`INSERT INTO investment_transactions
        (id, asset, quantity, unit_price_minor, amount_minor, fees_minor, occurred_at, source_dump_id, cash_transaction_id)
        VALUES (?, ?, ?, ?, ?, ?, ?, NULL, ?)`, investmentId, row.asset, quantity, unitPriceMinor, input.amountMinor, feesMinor, occurredAt, transactionId);
    } else {
      await txn.runAsync(`INSERT INTO financial_transactions
        (id, type, title, category, amount_minor, occurred_at, source_dump_id, linked_investment_id)
        VALUES (?, ?, ?, ?, ?, ?, NULL, NULL)`, transactionId, row.kind, row.title, row.category, input.amountMinor, occurredAt);
      if (row.kind === 'income') await insertGoalSuggestionsForIncome(txn, transactionId, input.amountMinor);
    }

    const resolvedAt = new Date().toISOString();
    await txn.runAsync(`UPDATE financial_occurrences SET status = 'confirmed', actual_amount_minor = ?, actual_date = ?,
      quantity = ?, fees_minor = ?, note = ?, transaction_id = ?, investment_id = ?, updated_at = ?, resolved_at = ? WHERE id = ?`,
    input.amountMinor, input.actualDate, input.quantity?.trim() || null, feesMinor, input.note?.trim() || null, transactionId, investmentId, resolvedAt, resolvedAt, id);
    if (input.updateFutureAmount) await txn.runAsync('UPDATE recurring_rules SET amount_minor = ?, updated_at = ? WHERE id = ?', input.amountMinor, resolvedAt, row.rule_id);
  });
}

export async function matchFinancialOccurrence(id: string, transactionId: string) {
  const db = await initializeDatabase();
  await withWriteTransaction(db, async (txn) => {
    const occurrence = await txn.getFirstAsync<FinancialOccurrenceRow>('SELECT * FROM financial_occurrences WHERE id = ?', id);
    if (!occurrence || occurrence.status !== 'pending') throw new Error('This scheduled entry is no longer pending.');
    const transaction = await txn.getFirstAsync<FinancialTransactionRow>('SELECT * FROM financial_transactions WHERE id = ?', transactionId);
    if (!transaction || transaction.type !== occurrence.kind) throw new Error('That wallet record cannot be matched to this scheduled entry.');

    let actualAmountMinor = transaction.amount_minor;
    let quantity: string | null = null;
    let feesMinor = 0;
    let investmentId: string | null = null;
    if (occurrence.kind === 'investment') {
      const investment = await txn.getFirstAsync<InvestmentTransactionRow>('SELECT * FROM investment_transactions WHERE cash_transaction_id = ?', transaction.id);
      if (!investment || investment.asset !== occurrence.asset) throw new Error('The matching investment purchase could not be found.');
      actualAmountMinor = investment.amount_minor;
      quantity = investment.quantity;
      feesMinor = investment.fees_minor;
      investmentId = investment.id;
    }

    if (occurrence.kind === 'income') await insertGoalSuggestionsForIncome(txn, transaction.id, transaction.amount_minor);
    const now = new Date().toISOString();
    const actualDate = localDateKey(new Date(transaction.occurred_at));
    const result = await txn.runAsync(`UPDATE financial_occurrences SET status = 'confirmed', actual_amount_minor = ?, actual_date = ?,
      quantity = ?, fees_minor = ?, note = ?, transaction_id = ?, investment_id = ?, updated_at = ?, resolved_at = ?
      WHERE id = ? AND status = 'pending'`, actualAmountMinor, actualDate, quantity, feesMinor, 'Matched to an existing wallet record.', transaction.id, investmentId, now, now, id);
    if (!result.changes) throw new Error('This scheduled entry is no longer pending.');
  });
}

export async function skipFinancialOccurrence(id: string, note?: string) {
  const db = await initializeDatabase();
  const now = new Date().toISOString();
  const result = await db.runAsync(`UPDATE financial_occurrences SET status = 'skipped', note = ?, updated_at = ?, resolved_at = ? WHERE id = ? AND status = 'pending'`, note?.trim() || null, now, now, id);
  if (!result.changes) throw new Error('This scheduled entry is no longer pending.');
}

export async function postponeFinancialOccurrence(id: string, dueDate: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dueDate) || localDateKey(new Date(localNoonIso(dueDate))) !== dueDate) throw new Error('Use a valid review date.');
  const db = await initializeDatabase();
  const result = await db.runAsync(`UPDATE financial_occurrences SET due_date = ?, updated_at = ? WHERE id = ? AND status = 'pending'`, dueDate, new Date().toISOString(), id);
  if (!result.changes) throw new Error('This scheduled entry is no longer pending.');
}

export async function saveConfirmedBundle(bundle: {
  dump?: VoiceDump;
  items: ThoughtItem[];
  projects: Project[];
  transactions: FinancialTransaction[];
  investments: InvestmentTransaction[];
  activity: ActivityEvent;
  reviewProposalId?: string;
}) {
  const db = await initializeDatabase();
  await withWriteTransaction(db, async (txn) => {
    if (bundle.dump) await insertVoiceDump(txn, bundle.dump);
    for (const item of bundle.items) await insertThoughtItem(txn, item);
    for (const project of bundle.projects) await insertProject(txn, project);
    for (const transaction of bundle.transactions) {
      await insertFinancialTransaction(txn, transaction);
      if (transaction.type === 'income') await insertGoalSuggestionsForIncome(txn, transaction.id, transaction.amountMinor);
    }
    for (const investment of bundle.investments) await insertInvestmentTransaction(txn, investment);
    await insertActivity(txn, bundle.activity);
    if (bundle.reviewProposalId) await txn.runAsync('DELETE FROM review_proposals WHERE id = ?', bundle.reviewProposalId);
  });
}

export async function updateThoughtItem(item: ThoughtItem) {
  const db = await initializeDatabase();
  await insertThoughtItem(db, item);
}

export async function removeThoughtItem(id: string) {
  const db = await initializeDatabase();
  await db.runAsync('DELETE FROM thought_items WHERE id = ?', id);
}

export async function removeVoiceDump(id: string) {
  const db = await initializeDatabase();
  await db.runAsync('DELETE FROM voice_dumps WHERE id = ?', id);
}

export async function saveProject(project: Project) {
  const db = await initializeDatabase();
  await insertProject(db, project);
}

export async function saveProjectSession(session: ProjectSession, activity: ActivityEvent) {
  const db = await initializeDatabase();
  await withWriteTransaction(db, async (txn) => {
    await txn.runAsync('INSERT OR REPLACE INTO project_sessions (id, project_id, note, next_action, created_at) VALUES (?, ?, ?, ?, ?)', session.id, session.projectId, session.note, session.nextAction ?? null, session.createdAt);
    await txn.runAsync('UPDATE projects SET current_focus = ?, next_action = ?, updated_at = ? WHERE id = ?', session.note, session.nextAction ?? null, session.createdAt, session.projectId);
    await insertActivity(txn, activity);
  });
}

export async function saveFinancialTransaction(transaction: FinancialTransaction) {
  const db = await initializeDatabase();
  await withWriteTransaction(db, async (txn) => {
    await insertFinancialTransaction(txn, transaction);
    if (transaction.type === 'income') await insertGoalSuggestionsForIncome(txn, transaction.id, transaction.amountMinor);
  });
}

export async function removeFinancialTransactionRecord(id: string) {
  const db = await initializeDatabase();
  await withWriteTransaction(db, async (txn) => {
    const transaction = await txn.getFirstAsync<{ linked_investment_id: string | null }>(
      'SELECT linked_investment_id FROM financial_transactions WHERE id = ?',
      id,
    );
    const linkedInvestment = transaction?.linked_investment_id
      ?? (await txn.getFirstAsync<{ id: string }>('SELECT id FROM investment_transactions WHERE cash_transaction_id = ?', id))?.id;
    if (linkedInvestment) await txn.runAsync('DELETE FROM investment_transactions WHERE id = ?', linkedInvestment);
    await txn.runAsync('DELETE FROM financial_transactions WHERE id = ?', id);
  });
}

export async function saveInvestmentPurchase(investment: InvestmentTransaction, cash: FinancialTransaction) {
  const db = await initializeDatabase();
  await withWriteTransaction(db, async (txn) => {
    await insertFinancialTransaction(txn, cash);
    await insertInvestmentTransaction(txn, investment);
  });
}

export async function saveMarketQuote(quote: MarketQuote) {
  const db = await initializeDatabase();
  await db.runAsync('INSERT OR REPLACE INTO market_quotes (asset, price_minor, usd_price_minor, usd_php, as_of, source) VALUES (?, ?, ?, ?, ?, ?)', quote.asset, quote.priceMinor, quote.usdPriceMinor ?? null, quote.usdPhp ?? null, quote.asOf, quote.source);
}

export async function saveRecurringRule(rule: RecurringRule) {
  const db = await initializeDatabase();
  await db.runAsync(`INSERT INTO recurring_rules
    (id, kind, title, category, amount_minor, days_json, asset, quantity, active, starts_on, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET kind = excluded.kind, title = excluded.title, category = excluded.category,
      amount_minor = excluded.amount_minor, days_json = excluded.days_json, asset = excluded.asset,
      quantity = excluded.quantity, active = excluded.active, starts_on = excluded.starts_on, updated_at = excluded.updated_at`,
  rule.id, rule.kind, rule.title, rule.category, rule.amountMinor, JSON.stringify(rule.days), rule.asset ?? null, rule.quantity ?? null, Number(rule.active), rule.startsOn, rule.createdAt, rule.updatedAt);
}

export async function removeRecurringRule(id: string) {
  const db = await initializeDatabase();
  await db.runAsync('DELETE FROM recurring_rules WHERE id = ?', id);
}

export async function saveMonthlyBudget(budget: MonthlyBudget) {
  const db = await initializeDatabase();
  await db.runAsync(`INSERT INTO monthly_budgets (id, category, limit_minor, active, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET category = excluded.category, limit_minor = excluded.limit_minor,
      active = excluded.active, updated_at = excluded.updated_at`,
  budget.id, budget.category, budget.limitMinor, Number(budget.active), budget.createdAt, budget.updatedAt);
}

export async function removeMonthlyBudget(id: string) {
  const db = await initializeDatabase();
  await db.runAsync('DELETE FROM monthly_budgets WHERE id = ?', id);
}

export async function saveActivity(activity: ActivityEvent) {
  const db = await initializeDatabase();
  await insertActivity(db, activity);
}

export async function exportAppData() {
  return JSON.stringify({ version: BACKUP_VERSION, exportedAt: new Date().toISOString(), data: await loadAppData() }, null, 2);
}

/**
 * Replaces every local record with the contents of a validated backup.
 * Runs as one transaction: either the whole archive lands or nothing changes.
 */
export async function importAppData(data: AppDataSnapshot) {
  const db = await initializeDatabase();
  await withWriteTransaction(db, async (txn) => {
    // Children first so foreign keys stay satisfied while the tables empty.
    for (const table of [
      'goal_contribution_suggestions', 'savings_goals', 'financial_occurrences', 'recurring_occurrences',
      'recurring_rules', 'monthly_budgets', 'review_proposals', 'activity_events', 'market_quotes',
      'investment_transactions', 'financial_transactions', 'project_sessions', 'projects',
      'voice_dumps', 'thought_items',
    ]) {
      await txn.runAsync(`DELETE FROM ${table}`);
    }

    for (const item of data.items) await insertThoughtItem(txn, item);
    for (const dump of data.dumps) await insertVoiceDump(txn, dump);
    for (const project of data.projects) await insertProject(txn, project);
    for (const session of data.projectSessions) {
      await txn.runAsync('INSERT OR REPLACE INTO project_sessions (id, project_id, note, next_action, created_at) VALUES (?, ?, ?, ?, ?)', session.id, session.projectId, session.note, session.nextAction ?? null, session.createdAt);
    }
    for (const transaction of data.transactions) await insertFinancialTransaction(txn, transaction);
    for (const investment of data.investments) await insertInvestmentTransaction(txn, investment);
    for (const quote of data.quotes) {
      await txn.runAsync('INSERT OR REPLACE INTO market_quotes (asset, price_minor, usd_price_minor, usd_php, as_of, source) VALUES (?, ?, ?, ?, ?, ?)', quote.asset, quote.priceMinor, quote.usdPriceMinor ?? null, quote.usdPhp ?? null, quote.asOf, quote.source);
    }
    for (const rule of data.recurringRules) {
      await txn.runAsync(`INSERT OR REPLACE INTO recurring_rules
        (id, kind, title, category, amount_minor, days_json, asset, quantity, active, starts_on, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      rule.id, rule.kind, rule.title, rule.category, rule.amountMinor, JSON.stringify(rule.days), rule.asset ?? null, rule.quantity ?? null, Number(rule.active), rule.startsOn, rule.createdAt, rule.updatedAt);
    }
    for (const occurrence of data.financialOccurrences) {
      await txn.runAsync(`INSERT OR REPLACE INTO financial_occurrences
        (id, rule_id, kind, title, category, planned_amount_minor, scheduled_date, due_date, asset, status,
         actual_amount_minor, actual_date, quantity, fees_minor, note, transaction_id, investment_id, created_at, updated_at, resolved_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      occurrence.id, occurrence.ruleId, occurrence.kind, occurrence.title, occurrence.category, occurrence.plannedAmountMinor,
      occurrence.scheduledDate, occurrence.dueDate, occurrence.asset ?? null, occurrence.status,
      occurrence.actualAmountMinor ?? null, occurrence.actualDate ?? null, occurrence.quantity ?? null, occurrence.feesMinor ?? null,
      occurrence.note ?? null, occurrence.transactionId ?? null, occurrence.investmentId ?? null, occurrence.createdAt, occurrence.updatedAt, occurrence.resolvedAt ?? null);
    }
    for (const budget of data.budgets) {
      await txn.runAsync('INSERT OR REPLACE INTO monthly_budgets (id, category, limit_minor, active, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)', budget.id, budget.category, budget.limitMinor, Number(budget.active), budget.createdAt, budget.updatedAt);
    }
    for (const goal of data.savingsGoals) {
      await txn.runAsync(`INSERT OR REPLACE INTO savings_goals
        (id, name, target_minor, saved_minor, payday_contribution_minor, target_date, active, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      goal.id, goal.name, goal.targetMinor, goal.savedMinor, goal.paydayContributionMinor, goal.targetDate ?? null, Number(goal.active), goal.createdAt, goal.updatedAt);
    }
    for (const suggestion of data.goalSuggestions) {
      await txn.runAsync(`INSERT OR REPLACE INTO goal_contribution_suggestions
        (id, goal_id, source_transaction_id, amount_minor, status, created_at, resolved_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)`,
      suggestion.id, suggestion.goalId, suggestion.sourceTransactionId, suggestion.amountMinor, suggestion.status, suggestion.createdAt, suggestion.resolvedAt ?? null);
    }
    for (const proposal of data.reviewProposals) {
      await txn.runAsync('INSERT OR REPLACE INTO review_proposals (id, source, organized_json, recording_json, created_at) VALUES (?, ?, ?, ?, ?)', proposal.id, proposal.source, JSON.stringify(proposal.organized), proposal.recording ? JSON.stringify(proposal.recording) : null, proposal.createdAt);
    }
    for (const event of data.activity) await insertActivity(txn, event);

    await txn.runAsync('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)', HOME_PREFERENCES_KEY, JSON.stringify(normalizeHomePreferences(data.homePreferences)));
    if (data.walletSetup) {
      await txn.runAsync('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)', WALLET_OPENING_BALANCE_KEY, String(data.walletSetup.openingBalanceMinor));
      await txn.runAsync('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)', WALLET_TRACKING_START_KEY, data.walletSetup.startsOn);
    } else {
      await txn.runAsync('DELETE FROM settings WHERE key IN (?, ?)', WALLET_OPENING_BALANCE_KEY, WALLET_TRACKING_START_KEY);
    }
    // A restored database must not be overwritten by the one-time legacy AsyncStorage import.
    await txn.runAsync('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)', LEGACY_IMPORT_KEY, 'complete');
  });
}

export type TransactionEditInput = {
  title: string;
  category: string;
  amountMinor: number;
  occurredAt: string;
  note?: string;
};

/**
 * Edits a confirmed money record in place, keeping its id so scheduled-entry
 * matches and goal suggestions stay attached. Investment-linked cash movements
 * keep their amount, which belongs to the investment lot rather than this row.
 */
export async function updateFinancialTransactionRecord(id: string, input: TransactionEditInput) {
  const title = input.title.trim();
  if (!title) throw new Error('Add a title for this record.');
  if (!Number.isSafeInteger(input.amountMinor) || input.amountMinor <= 0) throw new Error('Enter a valid amount greater than zero.');
  if (Number.isNaN(Date.parse(input.occurredAt))) throw new Error('Choose a valid date for this record.');

  const db = await initializeDatabase();
  await withWriteTransaction(db, async (txn) => {
    const existing = await txn.getFirstAsync<FinancialTransactionRow>('SELECT * FROM financial_transactions WHERE id = ?', id);
    if (!existing) throw new Error('This money record no longer exists.');

    const linkedInvestmentId = existing.linked_investment_id
      ?? (await txn.getFirstAsync<{ id: string }>('SELECT id FROM investment_transactions WHERE cash_transaction_id = ?', id))?.id;
    const amountMinor = linkedInvestmentId ? existing.amount_minor : input.amountMinor;

    await txn.runAsync(
      'UPDATE financial_transactions SET title = ?, category = ?, amount_minor = ?, occurred_at = ?, note = ? WHERE id = ?',
      title, input.category.trim() || 'General', amountMinor, input.occurredAt, input.note?.trim() || null, id,
    );
    // The lot and its cash movement must keep telling the same story about when it happened.
    if (linkedInvestmentId) await txn.runAsync('UPDATE investment_transactions SET occurred_at = ? WHERE id = ?', input.occurredAt, linkedInvestmentId);

    if (existing.type === 'income' && amountMinor !== existing.amount_minor) {
      // Suggestions you already acted on moved real money; only unresolved ones are recalculated.
      await txn.runAsync(`DELETE FROM goal_contribution_suggestions WHERE source_transaction_id = ? AND status = 'pending'`, id);
      await insertGoalSuggestionsForIncome(txn, id, amountMinor);
    }
  });
}

async function insertThoughtItem(executor: SqlExecutor, item: ThoughtItem) {
  await executor.runAsync(`INSERT OR REPLACE INTO thought_items
    (id, category, title, date_label, time_label, detail, due_at, created_at, source_dump_id, notification_id, completed, favorite, subtasks_json, recurrence_json, reminder_enabled)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  item.id, item.category, item.title, item.dateLabel, item.time ?? null, item.detail ?? null, item.dueAt ?? null, item.createdAt ?? new Date().toISOString(), item.sourceDumpId ?? null, item.notificationId ?? null, item.completed == null ? null : Number(item.completed), Number(Boolean(item.favorite)), JSON.stringify(item.subtasks ?? []), item.recurrence ? JSON.stringify(item.recurrence) : null, Number(item.reminderEnabled !== false));
}

async function insertVoiceDump(executor: SqlExecutor, dump: VoiceDump) {
  await executor.runAsync('INSERT OR REPLACE INTO voice_dumps (id, title, created_at, duration_seconds, uri, transcript) VALUES (?, ?, ?, ?, ?, ?)', dump.id, dump.title, dump.createdAt, dump.durationSeconds, dump.uri, dump.transcript);
}

async function insertProject(executor: SqlExecutor, project: Project) {
  await executor.runAsync(`INSERT OR REPLACE INTO projects
    (id, name, summary, status, current_focus, next_action, created_at, updated_at, source_dump_id)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`, project.id, project.name, project.summary ?? null, project.status, project.currentFocus ?? null, project.nextAction ?? null, project.createdAt, project.updatedAt, project.sourceDumpId ?? null);
}

async function insertFinancialTransaction(executor: SqlExecutor, transaction: FinancialTransaction) {
  await executor.runAsync(`INSERT OR REPLACE INTO financial_transactions
    (id, type, title, category, amount_minor, occurred_at, note, source_dump_id, linked_investment_id)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`, transaction.id, transaction.type, transaction.title, transaction.category, transaction.amountMinor, transaction.occurredAt, transaction.note ?? null, transaction.sourceDumpId ?? null, transaction.linkedInvestmentId ?? null);
}

function fromFinancialTransactionRow(row: FinancialTransactionRow): FinancialTransaction {
  return {
    id: row.id,
    type: row.type as FinancialTransaction['type'],
    title: row.title,
    category: row.category,
    amountMinor: row.amount_minor,
    occurredAt: row.occurred_at,
    note: row.note ?? undefined,
    sourceDumpId: row.source_dump_id ?? undefined,
    linkedInvestmentId: row.linked_investment_id ?? undefined,
  };
}

async function insertInvestmentTransaction(executor: SqlExecutor, investment: InvestmentTransaction) {
  await executor.runAsync(`INSERT OR REPLACE INTO investment_transactions
    (id, asset, quantity, unit_price_minor, amount_minor, fees_minor, occurred_at, source_dump_id, cash_transaction_id)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`, investment.id, investment.asset, investment.quantity, investment.unitPriceMinor, investment.amountMinor, investment.feesMinor, investment.occurredAt, investment.sourceDumpId ?? null, investment.cashTransactionId ?? null);
}

async function insertActivity(executor: SqlExecutor, activity: ActivityEvent) {
  await executor.runAsync('INSERT OR IGNORE INTO activity_events (id, kind, title, xp, created_at, source_id) VALUES (?, ?, ?, ?, ?, ?)', activity.id, activity.kind, activity.title, activity.xp, activity.createdAt, activity.sourceId ?? null);
}

async function insertGoalSuggestionsForIncome(executor: SQLite.SQLiteDatabase, transactionId: string, incomeMinor: number) {
  const goals = await executor.getAllAsync<SavingsGoalRow>('SELECT * FROM savings_goals WHERE active = 1 AND payday_contribution_minor > 0 AND saved_minor < target_minor');
  const createdAt = new Date().toISOString();
  let availableIncomeMinor = incomeMinor;
  for (const goal of goals) {
    if (availableIncomeMinor <= 0) break;
    const remaining = goal.target_minor - goal.saved_minor;
    const amountMinor = Math.min(goal.payday_contribution_minor, remaining, availableIncomeMinor);
    if (amountMinor <= 0) continue;
    await executor.runAsync(`INSERT OR IGNORE INTO goal_contribution_suggestions
      (id, goal_id, source_transaction_id, amount_minor, status, created_at)
      VALUES (?, ?, ?, ?, 'pending', ?)`, `goal-suggestion-${goal.id}-${transactionId}`, goal.id, transactionId, amountMinor, createdAt);
    availableIncomeMinor -= amountMinor;
  }
}

type SqlExecutor = Pick<SQLite.SQLiteDatabase, 'runAsync'>;

async function withWriteTransaction(db: SQLite.SQLiteDatabase, task: (txn: SQLite.SQLiteDatabase) => Promise<void>) {
  if (Platform.OS === 'web') {
    await db.withTransactionAsync(() => task(db));
    return;
  }
  await db.withExclusiveTransactionAsync(task);
}

type ThoughtItemRow = { id: string; category: string; title: string; date_label: string; time_label: string | null; detail: string | null; due_at: string | null; created_at: string; source_dump_id: string | null; notification_id: string | null; completed: number | null; favorite: number; subtasks_json: string; recurrence_json: string | null; reminder_enabled: number };
type VoiceDumpRow = { id: string; title: string; created_at: string; duration_seconds: number; uri: string; transcript: string };
type ProjectRow = { id: string; name: string; summary: string | null; status: string; current_focus: string | null; next_action: string | null; created_at: string; updated_at: string; source_dump_id: string | null };
type ProjectSessionRow = { id: string; project_id: string; note: string; next_action: string | null; created_at: string };
type FinancialTransactionRow = { id: string; type: string; title: string; category: string; amount_minor: number; occurred_at: string; note: string | null; source_dump_id: string | null; linked_investment_id: string | null };
type InvestmentTransactionRow = { id: string; asset: string; quantity: string; unit_price_minor: number; amount_minor: number; fees_minor: number; occurred_at: string; source_dump_id: string | null; cash_transaction_id: string | null };
type ActivityEventRow = { id: string; kind: string; title: string; xp: number; created_at: string; source_id: string | null };
type RecurringRuleRow = { id: string; kind: string; title: string; category: string; amount_minor: number; days_json: string; asset: string | null; quantity: string | null; active: number; starts_on: string; created_at: string; updated_at: string };
type MonthlyBudgetRow = { id: string; category: string; limit_minor: number; active: number; created_at: string; updated_at: string };
type SettingRow = { key: string; value: string };
type FinancialOccurrenceRow = { id: string; rule_id: string; kind: string; title: string; category: string; planned_amount_minor: number; scheduled_date: string; due_date: string; asset: string | null; status: string; actual_amount_minor: number | null; actual_date: string | null; quantity: string | null; fees_minor: number | null; note: string | null; transaction_id: string | null; investment_id: string | null; created_at: string; updated_at: string; resolved_at: string | null };
type SavingsGoalRow = { id: string; name: string; target_minor: number; saved_minor: number; payday_contribution_minor: number; target_date: string | null; active: number; created_at: string; updated_at: string };
type GoalSuggestionRow = { id: string; goal_id: string; source_transaction_id: string; amount_minor: number; status: string; created_at: string; resolved_at: string | null };
type ReviewProposalRow = { id: string; source: string; organized_json: string; recording_json: string | null; created_at: string };

async function createDueRecurringOccurrences(db: SQLite.SQLiteDatabase) {
  const rules = await db.getAllAsync<RecurringRuleRow>('SELECT * FROM recurring_rules WHERE active = 1');
  if (!rules.length) return;

  const through = localDateKey(new Date());
  const [legacyRows, existingRows] = await Promise.all([
    db.getAllAsync<{ rule_id: string; scheduled_date: string }>('SELECT rule_id, scheduled_date FROM recurring_occurrences'),
    db.getAllAsync<{ rule_id: string; scheduled_date: string }>('SELECT rule_id, scheduled_date FROM financial_occurrences'),
  ]);
  const known = new Set([...legacyRows, ...existingRows].map((row) => `${row.rule_id}\u0000${row.scheduled_date}`));

  const pending: { row: RecurringRuleRow; scheduledDate: string }[] = [];
  for (const row of rules) {
    for (const scheduledDate of scheduledDatesThrough({ days: safeArray<number>(row.days_json), startsOn: row.starts_on }, through)) {
      if (known.has(`${row.id}\u0000${scheduledDate}`)) continue;
      pending.push({ row, scheduledDate });
    }
  }
  if (!pending.length) return;

  const now = new Date().toISOString();
  await withWriteTransaction(db, async (txn) => {
    for (const { row, scheduledDate } of pending) {
      await txn.runAsync(`INSERT OR IGNORE INTO financial_occurrences
        (id, rule_id, kind, title, category, planned_amount_minor, scheduled_date, due_date, asset, status, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?)`,
      `occurrence-${row.id}-${scheduledDate}`, row.id, row.kind, row.title, row.category, row.amount_minor, scheduledDate, scheduledDate, row.asset, now, now);
    }
  });
}

function fromFinancialOccurrenceRow(row: FinancialOccurrenceRow): FinancialOccurrence {
  return {
    id: row.id,
    ruleId: row.rule_id,
    kind: row.kind as FinancialOccurrence['kind'],
    title: row.title,
    category: row.category,
    plannedAmountMinor: row.planned_amount_minor,
    scheduledDate: row.scheduled_date,
    dueDate: row.due_date,
    asset: (row.asset as FinancialOccurrence['asset']) ?? undefined,
    status: row.status as FinancialOccurrence['status'],
    actualAmountMinor: row.actual_amount_minor ?? undefined,
    actualDate: row.actual_date ?? undefined,
    quantity: row.quantity ?? undefined,
    feesMinor: row.fees_minor ?? undefined,
    note: row.note ?? undefined,
    transactionId: row.transaction_id ?? undefined,
    investmentId: row.investment_id ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    resolvedAt: row.resolved_at ?? undefined,
  };
}

function fromThoughtItemRow(row: ThoughtItemRow): ThoughtItem {
  return {
    id: row.id,
    category: row.category as ThoughtItem['category'],
    title: row.title,
    dateLabel: row.date_label,
    time: row.time_label ?? undefined,
    detail: row.detail ?? undefined,
    dueAt: row.due_at,
    createdAt: row.created_at,
    sourceDumpId: row.source_dump_id ?? undefined,
    notificationId: row.notification_id ?? undefined,
    reminderEnabled: Boolean(row.reminder_enabled),
    recurrence: row.recurrence_json ? safeObject<NonNullable<ThoughtItem['recurrence']>>(row.recurrence_json) : undefined,
    completed: row.completed == null ? undefined : Boolean(row.completed),
    favorite: Boolean(row.favorite),
    subtasks: safeArray<NonNullable<ThoughtItem['subtasks']>[number]>(row.subtasks_json),
  };
}

function safeObject<T>(value: string): T | undefined {
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed as T : undefined;
  } catch {
    return undefined;
  }
}
