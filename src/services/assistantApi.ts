import { AppDataSnapshot } from '@/types';
import { getOrganizerApiUrl } from './organizerApi';

export type AssistantMessage = { role: 'user' | 'assistant'; text: string };

export async function askPersonalAssistant(message: string, history: AssistantMessage[], data: AppDataSnapshot) {
  const apiUrl = getOrganizerApiUrl();
  if (!apiUrl) throw new Error('Add EXPO_PUBLIC_MEWMO_API_URL before using the assistant.');
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 45_000);
  try {
    const response = await fetch(`${apiUrl}/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message, history: history.slice(-8), context: assistantContext(data) }),
      signal: controller.signal,
    });
    const body = await response.json() as { answer?: string; error?: string };
    if (!response.ok || !body.answer) throw new Error(body.error || 'The assistant could not answer.');
    return body.answer;
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') throw new Error('The assistant took too long to answer. Try again.');
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

function assistantContext(data: AppDataSnapshot) {
  return {
    generatedAt: new Date().toISOString(),
    tasksAndNotes: data.items.slice(0, 150).map(({ id, category, title, detail, dueAt, completed }) => ({ id, category, title, detail, dueAt, completed })),
    projects: data.projects.slice(0, 100),
    projectSessions: data.projectSessions.slice(0, 100),
    transactions: data.transactions.slice(0, 300),
    investments: data.investments.slice(0, 300),
    marketQuotes: data.quotes,
    recurringSchedules: data.recurringRules,
    monthlyBudgets: data.budgets,
  };
}
