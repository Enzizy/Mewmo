import * as FileSystem from 'expo-file-system/legacy';
import { OrganizedDump, PendingRecording } from '@/types';

const requestTimeoutMs = 120_000;

export function getOrganizerApiUrl() {
  return (process.env.EXPO_PUBLIC_LIFEDESK_API_URL ?? process.env.EXPO_PUBLIC_MEWMO_API_URL ?? process.env.EXPO_PUBLIC_BRAIN_DUMP_API_URL ?? process.env.EXPO_PUBLIC_GATHER_API_URL)?.trim().replace(/\/$/, '') ?? '';
}

export function getOrganizerApiHeaders(additionalHeaders: Record<string, string> = {}) {
  const token = (process.env.EXPO_PUBLIC_LIFEDESK_CLIENT_TOKEN ?? process.env.EXPO_PUBLIC_MEWMO_CLIENT_TOKEN)?.trim();
  return token ? { ...additionalHeaders, Authorization: `Bearer ${token}` } : additionalHeaders;
}

export async function checkOrganizerHealth() {
  const apiUrl = getOrganizerApiUrl();
  if (!apiUrl) return { ok: false, configured: false, message: 'API address is not configured.' };
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10_000);
  try {
    const response = await fetch(`${apiUrl}/health`, { headers: getOrganizerApiHeaders(), signal: controller.signal });
    const body = await response.json() as { ok?: boolean; configured?: boolean; authConfigured?: boolean };
    if (!response.ok || body.ok !== true) return { ok: false, configured: true, message: 'The AI server health check failed.' };
    if (!body.configured) return { ok: false, configured: false, message: 'Server found, but its Gemini key is missing.' };
    if (!body.authConfigured) return { ok: false, configured: true, message: 'Server found, but API access protection is missing.' };

    const ready = await fetch(`${apiUrl}/ready`, { headers: getOrganizerApiHeaders(), signal: controller.signal });
    if (ready.status === 401) return { ok: false, configured: true, message: 'The app access token does not match the server.' };
    if (!ready.ok) return { ok: false, configured: true, message: 'The protected AI connection is not ready.' };
    return { ok: true, configured: true, message: 'Gemini and protected API access are ready.' };
  } catch (error) {
    return { ok: false, configured: true, message: error instanceof Error && error.name === 'AbortError' ? 'AI server check timed out.' : 'Cannot reach the AI server.' };
  } finally {
    clearTimeout(timeout);
  }
}

export async function organizeRecording(recording: PendingRecording): Promise<OrganizedDump> {
  const apiUrl = getOrganizerApiUrl();
  if (!apiUrl) throw new Error('AI server address is missing. Add EXPO_PUBLIC_LIFEDESK_API_URL to .env and restart Expo.');
  const audioBase64 = await FileSystem.readAsStringAsync(recording.uri, { encoding: FileSystem.EncodingType.Base64 });
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), requestTimeoutMs);

  try {
    const response = await fetch(`${apiUrl}/organize`, {
      method: 'POST',
      headers: getOrganizerApiHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({
        audioBase64,
        mimeType: recording.mimeType,
        now: new Date().toISOString(),
        timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
        locale: Intl.DateTimeFormat().resolvedOptions().locale || 'en',
      }),
      signal: controller.signal,
    });
    const body = await response.json() as OrganizedDump & { error?: string };
    if (!response.ok) throw new Error(body.error || 'The recording could not be organized.');
    if (!body.transcript || !Array.isArray(body.items)) throw new Error('The AI server returned an invalid response.');
    return body;
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') throw new Error('Processing took too long. Check your connection and try again.');
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}
