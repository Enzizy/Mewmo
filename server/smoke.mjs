import dotenv from 'dotenv';

dotenv.config({ path: ['.env.development.local', '.env'] });

const apiUrl = process.env.EXPO_PUBLIC_MEWMO_API_URL?.trim().replace(/\/$/, '');
const token = process.env.EXPO_PUBLIC_MEWMO_CLIENT_TOKEN?.trim();

if (!apiUrl) throw new Error('EXPO_PUBLIC_MEWMO_API_URL is missing.');

const authorization = token ? { Authorization: `Bearer ${token}` } : {};

const health = await request('/health');
assert(health.ok === true, 'Health endpoint is not ready.');
assert(health.configured === true, 'Gemini is not configured on the deployed backend.');
assert(health.marketConfigured === true, 'Twelve Data is not configured on the deployed backend.');

const exchange = await request('/exchange-rate?from=USD&to=PHP', { headers: authorization });
assert(exchange.from === 'USD' && exchange.to === 'PHP' && positive(exchange.rate), 'USD/PHP exchange rate is invalid.');

const market = await request('/market-quotes', { headers: authorization });
for (const asset of ['BTC', 'VOO']) {
  const quote = market.quotes?.[asset];
  assert(positive(quote?.priceMinor) && positive(quote?.usdPriceMinor), `${asset} quote is invalid.`);
}

const chat = await request('/chat', {
  method: 'POST',
  headers: { ...authorization, 'Content-Type': 'application/json' },
  body: JSON.stringify({
    message: 'Do I have any recorded tasks?',
    history: [],
    context: {
      generatedAt: new Date().toISOString(),
      tasksAndNotes: [],
      projects: [],
      projectSessions: [],
      transactions: [],
      investments: [],
      marketQuotes: [],
      recurringSchedules: [],
      monthlyBudgets: [],
      wallet: { availableBalanceMinor: 0, recordedInvestmentCostMinor: 0, estimatedPortfolioValueMinor: 0, positions: [] },
      forecast: { safeToSpendMinor: 0, projectedBalanceMinor: 0, upcomingBillsMinor: 0, upcomingInvestmentsMinor: 0, remainingBudgetMinor: 0, commitments: [] },
      appCapabilities: { calendar: 'Tasks and reminders', finance: 'Wallet and forecast', capture: 'Voice capture proposals', tools: [] },
    },
  }),
});
assert(typeof chat.answer === 'string' && chat.answer.trim().length > 0, 'Gemini chat returned no answer.');

console.log('Backend smoke check passed: health, USD/PHP, BTC, VOO, and chat.');

async function request(path, options = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 60_000);
  try {
    const response = await fetch(`${apiUrl}${path}`, { ...options, signal: controller.signal });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(`${path} returned ${response.status}: ${body.error || 'Unknown error'}`);
    return body;
  } finally {
    clearTimeout(timeout);
  }
}

function positive(value) {
  return Number.isFinite(value) && value > 0;
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}
