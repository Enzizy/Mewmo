import assert from 'node:assert/strict';
import test from 'node:test';
import { normalizeAudioMimeType, validateOrganizedDump } from './organizer.mjs';

test('normalizes Expo m4a MIME aliases for Gemini', () => {
  assert.equal(normalizeAudioMimeType('audio/mp4'), 'audio/m4a');
  assert.equal(normalizeAudioMimeType('audio/x-m4a'), 'audio/m4a');
  assert.equal(normalizeAudioMimeType('audio/m4a'), 'audio/m4a');
});

test('rejects unsupported audio MIME types', () => {
  assert.equal(normalizeAudioMimeType('audio/unsupported'), 'audio/m4a');
  assert.equal(normalizeAudioMimeType(undefined), 'audio/m4a');
});

test('normalizes a valid organized dump', () => {
  const result = validateOrganizedDump({
    title: 'Weekend plan',
    transcript: 'Buy rice tomorrow.',
    items: [{ category: 'task', title: 'Buy rice', detail: null, dueAt: '2026-08-18T09:00:00+08:00', subtasks: ['Check pantry'] }],
  });
  assert.equal(result.items[0].category, 'task');
  assert.equal(result.items[0].dueAt, '2026-08-18T01:00:00.000Z');
});

test('falls back to a note when no valid items are returned', () => {
  const result = validateOrganizedDump({ title: 'Thought', transcript: 'A quiet thought.', items: [] });
  assert.equal(result.items[0].category, 'note');
});

test('preserves an explicit recurring reminder', () => {
  const result = validateOrganizedDump({
    title: 'Payday', transcript: 'Remind me every 15th that it is payday.',
    items: [{ category: 'reminder', title: 'Payday', detail: null, dueAt: '2026-09-15T09:00:00+08:00', recurrence: 'monthly', subtasks: [] }],
  });
  assert.equal(result.items[0].recurrence, 'monthly');
});

test('rejects a missing transcript', () => {
  assert.throws(() => validateOrganizedDump({ title: 'No transcript', items: [] }), /transcript/);
});

test('preserves explicit BTC investment fields without inventing values', () => {
  const result = validateOrganizedDump({
    title: 'BTC purchase',
    transcript: 'I bought 0.01 BTC for 30000 pesos.',
    items: [{ category: 'investment', title: 'BTC purchase', detail: null, dueAt: null, subtasks: [], asset: 'BTC', quantity: '0.01', amountMinor: 3000000, unitPriceMinor: null }],
  });
  assert.equal(result.items[0].asset, 'BTC');
  assert.equal(result.items[0].quantity, '0.01');
  assert.equal(result.items[0].amountMinor, 3000000);
});

test('drops unsafe money values and unsupported investment assets', () => {
  const result = validateOrganizedDump({
    title: 'Unclear purchase',
    transcript: 'Maybe buy another stock.',
    items: [{ category: 'investment', title: 'Other asset', detail: null, dueAt: null, subtasks: [], asset: 'TSLA', quantity: '-2', amountMinor: 1.5, unitPriceMinor: -1 }],
  });
  assert.equal(result.items[0].asset, null);
  assert.equal(result.items[0].quantity, null);
  assert.equal(result.items[0].amountMinor, null);
  assert.equal(result.items[0].unitPriceMinor, null);
});
