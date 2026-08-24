import 'dotenv/config';
import http from 'node:http';
import { timingSafeEqual } from 'node:crypto';
import { GoogleGenAI } from '@google/genai';
import { buildOrganizerPrompt, normalizeAudioMimeType, responseSchema, validateOrganizedDump } from './organizer.mjs';
import { loadTwelveDataQuotes } from './market.mjs';
import { assistantSystemInstruction, buildAssistantContents, validateAssistantRequest } from './personal-assistant.mjs';
import { loadTwelveDataExchangeRate, validateCurrencyPair } from './exchange-rate.mjs';
import { buildTranslationContents, parseTranslationResponse, translationResponseSchema, translationSystemInstruction, validateTranslationRequest } from './translator.mjs';

const port = Number(process.env.PORT || 8787);
const allowedOrigin = process.env.ALLOWED_ORIGIN || '*';
const model = process.env.GEMINI_MODEL || 'gemini-3.6-flash';
const maxBodyBytes = 28 * 1024 * 1024;
const requestsByAddress = new Map();
let marketCache;
const exchangeRateCache = new Map();

export async function handleRequest(request, response) {
  setCorsHeaders(response);
  const requestUrl = new URL(request.url || '/', 'http://localhost');
  if (request.method === 'OPTIONS') return sendJson(response, 204, null);
  if (request.method === 'GET' && requestUrl.pathname === '/health') {
    return sendJson(response, 200, { ok: true, configured: Boolean(process.env.GEMINI_API_KEY), marketConfigured: Boolean(process.env.TWELVE_DATA_API_KEY), model });
  }
  if (!isAuthorized(request)) return sendJson(response, 401, { error: 'Unauthorized.' });
  if (request.method === 'GET' && requestUrl.pathname === '/market-quotes') {
    if (!allowRequest(request.socket.remoteAddress || 'unknown')) return sendJson(response, 429, { error: 'Too many requests. Try again later.' });
    try {
      if (marketCache && Date.now() - marketCache.cachedAt < 15 * 60 * 1000) return sendJson(response, 200, marketCache.value);
      const value = await loadTwelveDataQuotes({ apiKey: process.env.TWELVE_DATA_API_KEY });
      marketCache = { value, cachedAt: Date.now() };
      return sendJson(response, 200, value);
    } catch (error) {
      return sendJson(response, 503, { error: error instanceof Error ? error.message : 'Market prices are unavailable.' });
    }
  }
  if (request.method === 'GET' && requestUrl.pathname === '/exchange-rate') {
    if (!allowRequest(request.socket.remoteAddress || 'unknown')) return sendJson(response, 429, { error: 'Too many requests. Try again later.' });
    let pair;
    try { pair = validateCurrencyPair(requestUrl.searchParams.get('from'), requestUrl.searchParams.get('to')); }
    catch (error) { return sendJson(response, 400, { error: error instanceof Error ? error.message : 'Invalid currency pair.' }); }
    try {
      const cacheKey = `${pair.from}/${pair.to}`;
      const cached = exchangeRateCache.get(cacheKey);
      if (cached && Date.now() - cached.cachedAt < 10 * 60 * 1000) return sendJson(response, 200, cached.value);
      const value = await loadTwelveDataExchangeRate({ apiKey: process.env.TWELVE_DATA_API_KEY, ...pair });
      exchangeRateCache.set(cacheKey, { value, cachedAt: Date.now() });
      exchangeRateCache.set(`${pair.to}/${pair.from}`, { value: { from: pair.to, to: pair.from, rate: 1 / value.rate, asOf: value.asOf, source: value.source }, cachedAt: Date.now() });
      return sendJson(response, 200, value);
    } catch (error) {
      console.error(`[exchange-rate] ${error instanceof Error ? error.message : 'Provider failure'}`);
      return sendJson(response, 503, { error: 'The live exchange rate is unavailable. Check the Twelve Data setup and try again.' });
    }
  }
  if (request.method === 'POST' && requestUrl.pathname === '/translate') {
    if (!process.env.GEMINI_API_KEY) return sendJson(response, 503, { error: 'The server is missing GEMINI_API_KEY.' });
    if (!allowRequest(request.socket.remoteAddress || 'unknown')) return sendJson(response, 429, { error: 'Too many requests. Try again later.' });
    let input;
    try { input = validateTranslationRequest(await readJson(request, 16 * 1024)); }
    catch (error) { return sendJson(response, 400, { error: error instanceof Error ? error.message : 'Invalid translation request.' }); }
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
      const result = await ai.models.generateContent({ model, contents: buildTranslationContents(input), config: { systemInstruction: translationSystemInstruction, temperature: 0, maxOutputTokens: 3_000, responseMimeType: 'application/json', responseSchema: translationResponseSchema } });
      if (!result.text) throw new Error('Gemini returned an empty translation.');
      return sendJson(response, 200, parseTranslationResponse(result.text));
    } catch (error) {
      console.error(`[translate] ${error instanceof Error ? error.message : 'Provider failure'}`);
      return sendJson(response, 502, { error: 'Gemini could not translate this text. Try again.' });
    }
  }
  if (request.method === 'POST' && requestUrl.pathname === '/chat') {
    if (!process.env.GEMINI_API_KEY) return sendJson(response, 503, { error: 'The server is missing GEMINI_API_KEY.' });
    if (!allowRequest(request.socket.remoteAddress || 'unknown')) return sendJson(response, 429, { error: 'Too many requests. Try again later.' });
    try {
      const input = validateAssistantRequest(await readJson(request, 512 * 1024));
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
      const result = await ai.models.generateContent({ model, contents: buildAssistantContents(input), config: { systemInstruction: assistantSystemInstruction, temperature: 0.1, maxOutputTokens: 500 } });
      const answer = result.text?.trim();
      if (!answer) throw new Error('Gemini returned an empty answer.');
      return sendJson(response, 200, { answer });
    } catch (error) {
      return sendJson(response, 500, { error: error instanceof Error ? error.message : 'The assistant could not answer.' });
    }
  }
  if (request.method !== 'POST' || requestUrl.pathname !== '/organize') return sendJson(response, 404, { error: 'Not found.' });
  if (!process.env.GEMINI_API_KEY) return sendJson(response, 503, { error: 'The server is missing GEMINI_API_KEY.' });
  if (!allowRequest(request.socket.remoteAddress || 'unknown')) return sendJson(response, 429, { error: 'Too many requests. Try again later.' });

  try {
    const body = await readJson(request, maxBodyBytes);
    const input = validateRequest(body);
    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
    const audio = new Blob([Buffer.from(input.audioBase64, 'base64')], { type: input.mimeType });
    let uploadedFile;

    try {
      uploadedFile = await ai.files.upload({
        file: audio,
        config: { mimeType: input.mimeType, displayName: `mewmo-${Date.now()}` },
      });
      if (!uploadedFile.uri) throw new Error('Gemini did not return an audio file URI.');

      const interaction = await ai.interactions.create({
        model,
        input: [
          { type: 'text', text: buildOrganizerPrompt(input) },
          { type: 'audio', uri: uploadedFile.uri, mime_type: input.mimeType },
        ],
        response_format: responseSchema,
      });
      const rawText = interaction.output_text;
      if (!rawText) throw new Error('Gemini returned an empty response.');
      const organized = validateOrganizedDump(JSON.parse(rawText));
      return sendJson(response, 200, organized);
    } finally {
      if (uploadedFile?.name) ai.files.delete({ name: uploadedFile.name }).catch(() => undefined);
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to organize this recording.';
    console.error(`[organize] ${message}`);
    return sendJson(response, message.includes('too large') ? 413 : 500, { error: message });
  }
}

if (!process.env.VERCEL) {
  http.createServer(handleRequest).listen(port, '0.0.0.0', () => {
    console.log(`Mewmo AI server listening on http://0.0.0.0:${port}`);
    console.log(process.env.GEMINI_API_KEY ? `Gemini model: ${model}` : 'GEMINI_API_KEY is not configured yet.');
  });
}

function validateRequest(body) {
  if (!body || typeof body !== 'object') throw new Error('Request body is required.');
  if (typeof body.audioBase64 !== 'string' || body.audioBase64.length < 20) throw new Error('A valid audio recording is required.');
  if (body.audioBase64.length > 27 * 1024 * 1024) throw new Error('The recording is too large. Keep it under 15 minutes.');
  const mimeType = normalizeAudioMimeType(body.mimeType);
  return {
    audioBase64: body.audioBase64,
    mimeType,
    now: typeof body.now === 'string' ? body.now : new Date().toISOString(),
    timeZone: typeof body.timeZone === 'string' ? body.timeZone.slice(0, 100) : 'UTC',
    locale: typeof body.locale === 'string' ? body.locale.slice(0, 40) : 'en',
  };
}

async function readJson(request, limit) {
  const chunks = [];
  let size = 0;
  for await (const chunk of request) {
    size += chunk.length;
    if (size > limit) throw new Error('Request is too large.');
    chunks.push(chunk);
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8'));
  } catch {
    throw new Error('Request body must be valid JSON.');
  }
}

function allowRequest(address) {
  const now = Date.now();
  const recent = (requestsByAddress.get(address) || []).filter((timestamp) => now - timestamp < 60 * 60 * 1000);
  if (recent.length >= 30) return false;
  recent.push(now);
  requestsByAddress.set(address, recent);
  return true;
}

function setCorsHeaders(response) {
  response.setHeader('Access-Control-Allow-Origin', allowedOrigin);
  response.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  response.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
}

function isAuthorized(request) {
  const expected = process.env.MEWMO_CLIENT_TOKEN;
  if (!expected) return true;
  const authorization = request.headers.authorization || '';
  const supplied = authorization.startsWith('Bearer ') ? authorization.slice(7) : '';
  const expectedBytes = Buffer.from(expected);
  const suppliedBytes = Buffer.from(supplied);
  return expectedBytes.length === suppliedBytes.length && timingSafeEqual(expectedBytes, suppliedBytes);
}

function sendJson(response, status, body) {
  response.statusCode = status;
  if (body === null) return response.end();
  response.setHeader('Content-Type', 'application/json; charset=utf-8');
  response.end(JSON.stringify(body));
}
