import assert from 'node:assert/strict';
import test from 'node:test';
import { assistantSystemInstruction, buildAssistantContents, validateAssistantRequest } from './personal-assistant.mjs';

test('accepts a bounded personal question and recent conversation', () => {
  const input = validateAssistantRequest({ message: 'How much is my BTC worth?', context: { investments: [] }, history: [{ role: 'assistant', text: 'Hello' }] });
  const contents = buildAssistantContents(input);
  assert.equal(contents[0].role, 'model');
  assert.match(contents[1].parts[0].text, /CONFIRMED APP DATA/);
});

test('rejects missing and oversized assistant requests', () => {
  assert.throws(() => validateAssistantRequest({ context: {} }), /between 1 and 500/);
  assert.throws(() => validateAssistantRequest({ message: 'x', context: { value: 'a'.repeat(200_001) } }), /too large/);
});

test('defines current Mewmo finance and action boundaries', () => {
  assert.match(assistantSystemInstruction, /safeToSpendMinor/);
  assert.match(assistantSystemInstruction, /subscriptions or bills/);
  assert.match(assistantSystemInstruction, /chat is read-only/i);
  assert.match(assistantSystemInstruction, /PHP centavos/);
  assert.match(assistantSystemInstruction, /saved forecast/);
  assert.match(assistantSystemInstruction, /do not place brokerage orders/i);
});
