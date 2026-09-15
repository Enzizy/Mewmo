const CATEGORIES = new Set(['task', 'reminder', 'idea', 'note', 'project', 'income', 'expense', 'investment']);
const SUPPORTED_AUDIO_MIME_TYPES = new Set([
  'audio/wav',
  'audio/mp3',
  'audio/aiff',
  'audio/aac',
  'audio/ogg',
  'audio/flac',
  'audio/mpeg',
  'audio/m4a',
  'audio/l16',
  'audio/s16le',
  'audio/opus',
  'audio/alaw',
  'audio/mulaw',
]);

export function normalizeAudioMimeType(value) {
  if (typeof value !== 'string') return 'audio/m4a';
  const mimeType = value.trim().toLowerCase();
  if (mimeType === 'audio/mp4' || mimeType === 'audio/x-m4a') return 'audio/m4a';
  if (mimeType === 'audio/x-wav') return 'audio/wav';
  return SUPPORTED_AUDIO_MIME_TYPES.has(mimeType) ? mimeType : 'audio/m4a';
}

export function validateAudioRequest(body) {
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

export function buildTranscriptionPrompt({ now, timeZone, locale }) {
  return `Transcribe this private LifeDesk voice recording faithfully.

Current local datetime: ${now}
User timezone: ${timeZone}
User locale: ${locale}

Return only the spoken transcript as plain text. Preserve the language or languages spoken, including mixed English and Filipino/Tagalog. Do not summarize, classify, interpret, or extract tasks, reminders, financial records, or any other app actions. Do not add words that were not spoken.`;
}

export function validateTranscriptResponse(value) {
  if (typeof value !== 'string' || !value.trim()) throw new Error('Gemini did not return a transcript.');
  const transcript = value.trim();
  if (transcript.length > 4_000) throw new Error('The recording transcript is too long. Please record a shorter message of 4,000 characters or fewer.');
  return transcript;
}

export const responseSchema = {
  type: 'object',
  properties: {
    title: { type: 'string', description: 'A concise title for the full voice note, 60 characters or fewer.' },
    transcript: { type: 'string', description: 'A faithful transcript in the language or languages spoken.' },
    items: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          category: { type: 'string', enum: ['task', 'reminder', 'idea', 'note', 'project', 'income', 'expense', 'investment'] },
          title: { type: 'string' },
          detail: { type: ['string', 'null'] },
          dueAt: { type: ['string', 'null'], description: 'ISO 8601 timestamp with timezone offset, or null.' },
          recurrence: { type: ['string', 'null'], enum: ['daily', 'weekly', 'monthly', 'yearly', null], description: 'How an explicit repeating reminder recurs, or null.' },
          subtasks: { type: 'array', items: { type: 'string' } },
          projectName: { type: ['string', 'null'] },
          amountMinor: { type: ['integer', 'null'], description: 'Exact Philippine peso amount in centavos, or null. ₱2,000.00 is 200000.' },
          asset: { type: ['string', 'null'], enum: ['BTC', 'VOO', null] },
          quantity: { type: ['string', 'null'], description: 'Exact decimal asset quantity as spoken, or null.' },
          unitPriceMinor: { type: ['integer', 'null'], description: 'Per-unit Philippine peso price in centavos, or null.' },
        },
        required: ['category', 'title', 'detail', 'dueAt', 'recurrence', 'subtasks', 'projectName', 'amountMinor', 'asset', 'quantity', 'unitPriceMinor'],
      },
    },
  },
  required: ['title', 'transcript', 'items'],
};

export function buildOrganizerPrompt({ now, timeZone, locale }) {
  return `You organize a private voice note into useful personal records.

Current local datetime: ${now}
User timezone: ${timeZone}
User locale: ${locale}

Return a faithful transcript and extract every distinct useful item. Preserve the speaker's language, including mixed English and Filipino/Tagalog. Do not invent facts, dates, names, or commitments.

Classification rules:
- task: an action the speaker intends to complete
- reminder: something explicitly tied to a time, date, deadline, or request to remember
- idea: a possibility, concept, or creative thought
- note: useful context that is not an action, reminder, or idea
- project: a named longer-running outcome or an update about ongoing project work
- income: money received; amountMinor is the exact PHP amount in centavos
- expense: money spent or a bill paid; amountMinor is the exact PHP amount in centavos
- investment: a recorded BTC or VOO purchase/contribution; include asset, exact decimal quantity when stated, amountMinor, and unitPriceMinor when stated

Never infer a money amount, asset quantity, price, or transaction that the speaker did not state. Investment intentions without a completed purchase are tasks or notes, not investment records. Only BTC and VOO are supported investment assets. Use projectName when the speaker identifies a project.

Resolve relative dates such as “tomorrow” using the supplied local datetime and timezone. Use an ISO 8601 timestamp with an explicit timezone offset for dueAt. For explicit repeating reminders, set recurrence to daily, weekly, monthly, or yearly and set dueAt to the next occurrence. If the speaker gives a recurring day but no time, use 09:00 local time. Never add recurrence unless the speaker explicitly asks for repetition. If no date or time is stated, use null. Keep titles concise and place supporting context in detail. Use subtasks only when the speaker clearly gives component steps or a checklist. If there is meaningful speech but nothing fits another category, create a note.`;
}

export function validateOrganizedDump(value) {
  if (!value || typeof value !== 'object') throw new Error('Gemini returned an invalid response.');
  const title = cleanString(value.title, 'Untitled voice note').slice(0, 80);
  const transcript = cleanString(value.transcript, '');
  if (!transcript) throw new Error('Gemini did not return a transcript.');
  if (!Array.isArray(value.items)) throw new Error('Gemini did not return an item list.');

  const items = value.items.slice(0, 100).flatMap((item) => {
    if (!item || typeof item !== 'object' || !CATEGORIES.has(item.category)) return [];
    const itemTitle = cleanString(item.title, '');
    if (!itemTitle) return [];
    const dueAt = typeof item.dueAt === 'string' && !Number.isNaN(Date.parse(item.dueAt)) ? new Date(item.dueAt).toISOString() : null;
    return [{
      category: item.category,
      title: itemTitle.slice(0, 180),
      detail: typeof item.detail === 'string' && item.detail.trim() ? item.detail.trim().slice(0, 4000) : null,
      dueAt,
      recurrence: ['daily', 'weekly', 'monthly', 'yearly'].includes(item.recurrence) ? item.recurrence : null,
      subtasks: Array.isArray(item.subtasks) ? item.subtasks.map((entry) => cleanString(entry, '')).filter(Boolean).slice(0, 30) : [],
      projectName: nullableString(item.projectName, 180),
      amountMinor: safeNonNegativeInteger(item.amountMinor),
      asset: item.asset === 'BTC' || item.asset === 'VOO' ? item.asset : null,
      quantity: validDecimal(item.quantity),
      unitPriceMinor: safeNonNegativeInteger(item.unitPriceMinor),
    }];
  });

  if (!items.length) items.push({ category: 'note', title, detail: transcript.slice(0, 4000), dueAt: null, recurrence: null, subtasks: [], projectName: null, amountMinor: null, asset: null, quantity: null, unitPriceMinor: null });
  return { title, transcript, items };
}

function cleanString(value, fallback) {
  return typeof value === 'string' && value.trim() ? value.trim() : fallback;
}

function nullableString(value, limit) {
  return typeof value === 'string' && value.trim() ? value.trim().slice(0, limit) : null;
}

function safeNonNegativeInteger(value) {
  return Number.isSafeInteger(value) && value >= 0 ? value : null;
}

function validDecimal(value) {
  return typeof value === 'string' && /^(?:0|[1-9]\d*)(?:\.\d+)?$/.test(value) ? value : null;
}
