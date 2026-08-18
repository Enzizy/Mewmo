export type Category = 'task' | 'reminder' | 'idea' | 'note';
export type SuggestionKind = Category | 'project' | 'income' | 'expense' | 'investment';

export type ThoughtItem = {
  id: string;
  category: Category;
  title: string;
  dateLabel: string;
  time?: string;
  detail?: string;
  dueAt?: string | null;
  createdAt?: string;
  sourceDumpId?: string;
  notificationId?: string;
  completed?: boolean;
  favorite?: boolean;
  subtasks?: { id: string; title: string; completed: boolean }[];
};

export type VoiceDump = {
  id: string;
  title: string;
  createdAt: string;
  durationSeconds: number;
  uri: string;
  transcript: string;
};

export type PendingRecording = {
  uri: string;
  durationSeconds: number;
  mimeType: string;
};

export type OrganizedItemInput = {
  category: SuggestionKind;
  title: string;
  detail: string | null;
  dueAt: string | null;
  subtasks: string[];
  projectName?: string | null;
  amountMinor?: number | null;
  asset?: InvestmentAsset | null;
  quantity?: string | null;
  unitPriceMinor?: number | null;
};

export type OrganizedDump = {
  title: string;
  transcript: string;
  items: OrganizedItemInput[];
};

export type ProjectStatus = 'active' | 'paused' | 'complete' | 'archived';

export type Project = {
  id: string;
  name: string;
  summary?: string;
  status: ProjectStatus;
  currentFocus?: string;
  nextAction?: string;
  createdAt: string;
  updatedAt: string;
  sourceDumpId?: string;
};

export type ProjectSession = {
  id: string;
  projectId: string;
  note: string;
  nextAction?: string;
  createdAt: string;
};

export type MoneyTransactionType = 'income' | 'expense' | 'transfer' | 'investment';

export type FinancialTransaction = {
  id: string;
  type: MoneyTransactionType;
  title: string;
  category: string;
  amountMinor: number;
  occurredAt: string;
  sourceDumpId?: string;
  linkedInvestmentId?: string;
};

export type InvestmentAsset = 'BTC' | 'VOO';

export type InvestmentTransaction = {
  id: string;
  asset: InvestmentAsset;
  quantity: string;
  unitPriceMinor: number;
  amountMinor: number;
  feesMinor: number;
  occurredAt: string;
  sourceDumpId?: string;
  cashTransactionId?: string;
};

export type MarketQuote = {
  asset: InvestmentAsset;
  priceMinor: number;
  usdPriceMinor?: number;
  usdPhp?: number;
  asOf: string;
  source: string;
};

export type RecurringRuleKind = 'income' | 'expense' | 'investment';

export type RecurringRule = {
  id: string;
  kind: RecurringRuleKind;
  title: string;
  category: string;
  amountMinor: number;
  days: number[];
  asset?: InvestmentAsset;
  quantity?: string;
  active: boolean;
  startsOn: string;
  createdAt: string;
  updatedAt: string;
};

export type MonthlyBudget = {
  id: string;
  category: string;
  limitMinor: number;
  active: boolean;
  createdAt: string;
  updatedAt: string;
};

export type ActivityKind = 'dump_confirmed' | 'item_completed' | 'project_handoff' | 'weekly_review';

export type ActivityEvent = {
  id: string;
  kind: ActivityKind;
  title: string;
  xp: number;
  createdAt: string;
  sourceId?: string;
};

export type AppDataSnapshot = {
  items: ThoughtItem[];
  dumps: VoiceDump[];
  projects: Project[];
  projectSessions: ProjectSession[];
  transactions: FinancialTransaction[];
  investments: InvestmentTransaction[];
  quotes: MarketQuote[];
  recurringRules: RecurringRule[];
  budgets: MonthlyBudget[];
  activity: ActivityEvent[];
};
