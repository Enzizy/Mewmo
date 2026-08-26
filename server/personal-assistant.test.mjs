import assert from 'node:assert/strict';
import test from 'node:test';
import { assistantSystemInstruction, buildAssistantContents, validateAssistantRequest, validateAssistantResponse } from './personal-assistant.mjs';

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
  assert.match(assistantSystemInstruction, /never changes records directly/i);
  assert.match(assistantSystemInstruction, /Review inbox/);
  assert.match(assistantSystemInstruction, /PHP centavos/);
  assert.match(assistantSystemInstruction, /saved forecast/);
  assert.match(assistantSystemInstruction, /do not place brokerage orders/i);
});

test('keeps assistant actions as validated review proposals', () => {
  const proposal = { title: 'Payday reminder', transcript: 'Remind me on payday', items: [{ category: 'reminder' }] };
  const output = validateAssistantResponse({ answer: 'I prepared this for review.', proposal }, (value) => value);
  assert.equal(output.proposal, proposal);
  assert.throws(() => validateAssistantResponse({ answer: '', proposal: null }, (value) => value), /invalid assistant response/);
});
