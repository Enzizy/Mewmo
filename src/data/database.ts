import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SQLite from 'expo-sqlite';
import { Platform } from 'react-native';
import {
  ActivityEvent,
  AppDataSnapshot,
  FinancialTransaction,
  InvestmentTransaction,
  MarketQuote,
  MonthlyBudget,
  Project,
  ProjectSession,
  RecurringRule,
  ThoughtItem,
  VoiceDump,
  WalletSetup,
} from '@/types';
import { investmentPurchaseFromBudget } from '@/utils/market';
import { localDateKey, localNoonIso, scheduledDatesThrough } from '@/utils/recurrence';

const DATABASE_NAME = 'brain-dump.db';
const LEGACY_ITEMS_KEY = '@gather/items-v2';
const LEGACY_DUMPS_KEY = '@gather/dumps-v2';
const LEGACY_IMPORT_KEY = 'legacy_import_v2';
const WALLET_OPENING_BALANCE_KEY = 'wallet_opening_balance_minor';
const WALLET_TRACKING_START_KEY = 'wallet_tracking_starts_on';

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

export async function loadAppData(): Promise<AppDataSnapshot> {
  const db = await initializeDatabase();
  await postDueRecurringRules(db);
  const [itemRows, dumpRows, projects, sessions, transactions, investments, quotes, recurringRules, budgets, activity, walletSettings] = await Promise.all([
    db.getAllAsync<ThoughtItemRow>('SELECT * FROM thought_items ORDER BY created_at DESC'),
    db.getAllAsync<VoiceDumpRow>('SELECT * FROM voice_dumps ORDER BY created_at DESC'),
    db.getAllAsync<ProjectRow>('SELECT * FROM projects ORDER BY updated_at DESC'),
    db.getAllAsync<ProjectSessionRow>('SELECT * FROM project_sessions ORDER BY created_at DESC'),
    db.getAllAsync<FinancialTransactionRow>('SELECT * FROM financial_transactions ORDER BY occurred_at DESC'),
    db.getAllAsync<InvestmentTransactionRow>('SELECT * FROM investment_transactions ORDER BY occurred_at DESC'),
    db.getAllAsync<MarketQuote>('SELECT asset, price_minor AS priceMinor, usd_price_minor AS usdPriceMinor, usd_php AS usdPhp, as_of AS asOf, source FROM market_quotes'),
    db.getAllAsync<RecurringRuleRow>('SELECT * FROM recurring_rules ORDER BY active DESC, updated_at DESC'),
    db.getAllAsync<MonthlyBudgetRow>('SELECT * FROM monthly_budgets ORDER BY active DESC, category COLLATE NOCASE'),
    db.getAllAsync<ActivityEventRow>('SELECT * FROM activity_events ORDER BY created_at DESC'),
    db.getAllAsync<SettingRow>('SELECT key, value FROM settings WHERE key IN (?, ?)', WALLET_OPENING_BALANCE_KEY, WALLET_TRACKING_START_KEY),
  ]);

  const openingBalanceValue = walletSettings.find((row) => row.key === WALLET_OPENING_BALANCE_KEY)?.value;
  const startsOn = walletSettings.find((row) => row.key === WALLET_TRACKING_START_KEY)?.value;
  const openingBalanceMinor = openingBalanceValue == null ? null : Number(openingBalanceValue);
  const walletSetup = startsOn && Number.isSafeInteger(openingBalanceMinor) && openingBalanceMinor! >= 0
    ? { openingBalanceMinor: openingBalanceMinor!, startsOn }
    : undefined;

  return {
    items: itemRows.map(fromThoughtItemRow),
    dumps: dumpRows.map((row) => ({ id: row.id, title: row.title, createdAt: row.created_at, durationSeconds: row.duration_seconds, uri: row.uri, transcript: row.transcript })),
    projects: projects.map((row) => ({ id: row.id, name: row.name, summary: row.summary ?? undefined, status: row.status as Project['status'], currentFocus: row.current_focus ?? undefined, nextAction: row.next_action ?? undefined, createdAt: row.created_at, updatedAt: row.updated_at, sourceDumpId: row.source_dump_id ?? undefined })),
    projectSessions: sessions.map((row) => ({ id: row.id, projectId: row.project_id, note: row.note, nextAction: row.next_action ?? undefined, createdAt: row.created_at })),
    transactions: transactions.map((row) => ({ id: row.id, type: row.type as FinancialTransaction['type'], title: row.title, category: row.category, amountMinor: row.amount_minor, occurredAt: row.occurred_at, sourceDumpId: row.source_dump_id ?? undefined, linkedInvestmentId: row.linked_investment_id ?? undefined })),
    investments: investments.map((row) => ({ id: row.id, asset: row.asset as InvestmentTransaction['asset'], quantity: row.quantity, unitPriceMinor: row.unit_price_minor, amountMinor: row.amount_minor, feesMinor: row.fees_minor, occurredAt: row.occurred_at, sourceDumpId: row.source_dump_id ?? undefined, cashTransactionId: row.cash_transaction_id ?? undefined })),
    quotes,
    recurringRules: recurringRules.map((row) => ({ id: row.id, kind: row.kind as RecurringRule['kind'], title: row.title, category: row.category, amountMinor: row.amount_minor, days: safeArray<number>(row.days_json), asset: (row.asset as RecurringRule['asset']) ?? undefined, quantity: row.quantity ?? undefined, active: Boolean(row.active), startsOn: row.starts_on, createdAt: row.created_at, updatedAt: row.updated_at })),
    budgets: budgets.map((row) => ({ id: row.id, category: row.category, limitMinor: row.limit_minor, active: Boolean(row.active), createdAt: row.created_at, updatedAt: row.updated_at })),
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

export async function saveConfirmedBundle(bundle: {
  dump: VoiceDump;
  items: ThoughtItem[];
  projects: Project[];
  transactions: FinancialTransaction[];
  investments: InvestmentTransaction[];
  activity: ActivityEvent;
}) {
  const db = await initializeDatabase();
  await withWriteTransaction(db, async (txn) => {
    await insertVoiceDump(txn, bundle.dump);
    for (const item of bundle.items) await insertThoughtItem(txn, item);
    for (const project of bundle.projects) await insertProject(txn, project);
    for (const transaction of bundle.transactions) await insertFinancialTransaction(txn, transaction);
    for (const investment of bundle.investments) await insertInvestmentTransaction(txn, investment);
    await insertActivity(txn, bundle.activity);
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
  await insertFinancialTransaction(db, transaction);
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
  return JSON.stringify({ version: 1, exportedAt: new Date().toISOString(), data: await loadAppData() }, null, 2);
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
    (id, type, title, category, amount_minor, occurred_at, source_dump_id, linked_investment_id)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)`, transaction.id, transaction.type, transaction.title, transaction.category, transaction.amountMinor, transaction.occurredAt, transaction.sourceDumpId ?? null, transaction.linkedInvestmentId ?? null);
}

async function insertInvestmentTransaction(executor: SqlExecutor, investment: InvestmentTransaction) {
  await executor.runAsync(`INSERT OR REPLACE INTO investment_transactions
    (id, asset, quantity, unit_price_minor, amount_minor, fees_minor, occurred_at, source_dump_id, cash_transaction_id)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`, investment.id, investment.asset, investment.quantity, investment.unitPriceMinor, investment.amountMinor, investment.feesMinor, investment.occurredAt, investment.sourceDumpId ?? null, investment.cashTransactionId ?? null);
}

async function insertActivity(executor: SqlExecutor, activity: ActivityEvent) {
  await executor.runAsync('INSERT OR IGNORE INTO activity_events (id, kind, title, xp, created_at, source_id) VALUES (?, ?, ?, ?, ?, ?)', activity.id, activity.kind, activity.title, activity.xp, activity.createdAt, activity.sourceId ?? null);
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
type FinancialTransactionRow = { id: string; type: string; title: string; category: string; amount_minor: number; occurred_at: string; source_dump_id: string | null; linked_investment_id: string | null };
type InvestmentTransactionRow = { id: string; asset: string; quantity: string; unit_price_minor: number; amount_minor: number; fees_minor: number; occurred_at: string; source_dump_id: string | null; cash_transaction_id: string | null };
type ActivityEventRow = { id: string; kind: string; title: string; xp: number; created_at: string; source_id: string | null };
type RecurringRuleRow = { id: string; kind: string; title: string; category: string; amount_minor: number; days_json: string; asset: string | null; quantity: string | null; active: number; starts_on: string; created_at: string; updated_at: string };
type MonthlyBudgetRow = { id: string; category: string; limit_minor: number; active: number; created_at: string; updated_at: string };
type SettingRow = { key: string; value: string };

async function postDueRecurringRules(db: SQLite.SQLiteDatabase) {
  const rules = await db.getAllAsync<RecurringRuleRow>('SELECT * FROM recurring_rules WHERE active = 1');
  const through = localDateKey(new Date());
  for (const row of rules) {
    const dates = scheduledDatesThrough({ days: safeArray<number>(row.days_json), startsOn: row.starts_on }, through);
    for (const scheduledDate of dates) {
      const existing = await db.getFirstAsync<{ id: string }>('SELECT id FROM recurring_occurrences WHERE rule_id = ? AND scheduled_date = ?', row.id, scheduledDate);
      if (existing) continue;
      const occurrenceId = `occurrence-${row.id}-${scheduledDate}`;
      const transactionId = `money-${row.id}-${scheduledDate}`;
      const occurredAt = localNoonIso(scheduledDate);
      const investmentId = row.kind === 'investment' ? `investment-${row.id}-${scheduledDate}` : null;

      if (row.kind === 'investment') {
        if (!row.asset) continue;
        const quote = await db.getFirstAsync<{ priceMinor: number; asOf: string }>(
          'SELECT price_minor AS priceMinor, as_of AS asOf FROM market_quotes WHERE asset = ?',
          row.asset,
        );
        const purchase = investmentPurchaseFromBudget(row.amount_minor, quote);
        if (!purchase) continue;
        await db.runAsync(`INSERT OR IGNORE INTO financial_transactions
          (id, type, title, category, amount_minor, occurred_at, source_dump_id, linked_investment_id)
          VALUES (?, 'investment', ?, ?, ?, ?, NULL, ?)`, transactionId, row.title, row.category, row.amount_minor, occurredAt, investmentId);
        await db.runAsync(`INSERT OR IGNORE INTO investment_transactions
          (id, asset, quantity, unit_price_minor, amount_minor, fees_minor, occurred_at, source_dump_id, cash_transaction_id)
          VALUES (?, ?, ?, ?, ?, 0, ?, NULL, ?)`, investmentId, row.asset, purchase.quantity, purchase.unitPriceMinor, row.amount_minor, occurredAt, transactionId);
      } else {
        await db.runAsync(`INSERT OR IGNORE INTO financial_transactions
          (id, type, title, category, amount_minor, occurred_at, source_dump_id, linked_investment_id)
          VALUES (?, ?, ?, ?, ?, ?, NULL, NULL)`, transactionId, row.kind, row.title, row.category, row.amount_minor, occurredAt);
      }
      await db.runAsync('INSERT OR IGNORE INTO recurring_occurrences (id, rule_id, scheduled_date, transaction_id, investment_id, created_at) VALUES (?, ?, ?, ?, ?, ?)', occurrenceId, row.id, scheduledDate, transactionId, investmentId, new Date().toISOString());
    }
  }
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
