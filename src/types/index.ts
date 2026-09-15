export type Category = 'task' | 'reminder' | 'idea' | 'note';
export type SuggestionKind = Category | 'project' | 'income' | 'expense' | 'investment';
export type ReminderFrequency = 'daily' | 'weekly' | 'monthly' | 'yearly';

export type ReminderRecurrence = {
  frequency: ReminderFrequency;
  hour: number;
  minute: number;
  weekday?: number;
  day?: number;
  month?: number;
};

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
  reminderEnabled?: boolean;
  recurrence?: ReminderRecurrence;
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
  recurrence?: ReminderFrequency | null;
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
  note?: string;
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
  /** Retained only for backward-compatible loading of older recurring rules. */
  quantity?: string;
  active: boolean;
  startsOn: string;
  createdAt: string;
  updatedAt: string;
};

export type FinancialOccurrenceStatus = 'pending' | 'confirmed' | 'skipped';

export type FinancialOccurrence = {
  id: string;
  ruleId: string;
  kind: RecurringRuleKind;
  title: string;
  category: string;
  plannedAmountMinor: number;
  scheduledDate: string;
  dueDate: string;
  asset?: InvestmentAsset;
  status: FinancialOccurrenceStatus;
  actualAmountMinor?: number;
  actualDate?: string;
  quantity?: string;
  feesMinor?: number;
  note?: string;
  transactionId?: string;
  investmentId?: string;
  createdAt: string;
  updatedAt: string;
  resolvedAt?: string;
};

export type SavingsGoal = {
  id: string;
  name: string;
  targetMinor: number;
  savedMinor: number;
  paydayContributionMinor: number;
  targetDate?: string;
  active: boolean;
  createdAt: string;
  updatedAt: string;
};

export type GoalContributionSuggestion = {
  id: string;
  goalId: string;
  sourceTransactionId: string;
  amountMinor: number;
  status: 'pending' | 'confirmed' | 'skipped';
  createdAt: string;
  resolvedAt?: string;
};

export type ReviewProposalSource = 'voice' | 'chat';

export type ReviewProposal = {
  id: string;
  source: ReviewProposalSource;
  organized: OrganizedDump;
  recording?: PendingRecording;
  createdAt: string;
};

export type HomeWidgetId = 'review' | 'weather' | 'money' | 'goals' | 'schedule' | 'attention' | 'coming-up' | 'shortcuts';
export type HomeShortcutId = 'add-income' | 'add-expense' | 'add-investment' | 'add-reminder' | 'currency' | 'image-tools' | 'pdf-tools' | 'weather';

export type HomePreferences = {
  order: HomeWidgetId[];
  hidden: HomeWidgetId[];
  compact: HomeWidgetId[];
  balancesVisible: boolean;
  widgetBalancesVisible: boolean;
  shortcuts: HomeShortcutId[];
};

export type MonthlyBudget = {
  id: string;
  category: string;
  limitMinor: number;
  active: boolean;
  createdAt: string;
  updatedAt: string;
};

export type WalletSetup = {
  openingBalanceMinor: number;
  startsOn: string;
};

export type ActivityKind = 'dump_confirmed' | 'proposal_confirmed' | 'item_completed' | 'project_handoff' | 'weekly_review';

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
  financialOccurrences: FinancialOccurrence[];
  budgets: MonthlyBudget[];
  savingsGoals: SavingsGoal[];
  goalSuggestions: GoalContributionSuggestion[];
  reviewProposals: ReviewProposal[];
  homePreferences: HomePreferences;
  walletSetup?: WalletSetup;
  activity: ActivityEvent[];
};
