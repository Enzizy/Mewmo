import { getOrganizerApiHeaders, getOrganizerApiUrl } from './organizerApi';

export type LanguageCode = 'auto' | 'en' | 'fil' | 'es' | 'ja';
export type TranslationResult = { translation: string; detectedLanguage: string };

export async function translateText(text: string, from: LanguageCode, to: Exclude<LanguageCode, 'auto'>): Promise<TranslationResult> {
  const apiUrl = getOrganizerApiUrl();
  if (!apiUrl) throw new Error('Add EXPO_PUBLIC_MEWMO_API_URL before translating text.');
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 45_000);
  try {
    const response = await fetch(`${apiUrl}/translate`, { method: 'POST', headers: getOrganizerApiHeaders({ 'Content-Type': 'application/json' }), body: JSON.stringify({ text, from, to }), signal: controller.signal });
    const body = await response.json() as Partial<TranslationResult> & { error?: string };
    if (!response.ok) throw new Error(body.error || 'Translation failed.');
    if (typeof body.translation !== 'string' || !body.translation.trim() || typeof body.detectedLanguage !== 'string') throw new Error('The server returned an invalid translation.');
    return { translation: body.translation.trim(), detectedLanguage: body.detectedLanguage };
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') throw new Error('Translation took too long. Check your connection and try again.');
    if (error instanceof TypeError) throw new Error('Could not reach the Mewmo server. Check that it is running and that the app API address is correct.');
    throw error;
  } finally { clearTimeout(timeout); }
}
