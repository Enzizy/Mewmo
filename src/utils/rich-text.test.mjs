import assert from 'node:assert/strict';
import test from 'node:test';
import { parseInline, parseRichText, richTextToPlain } from './rich-text.ts';

test('keeps plain prose as one paragraph per blank-line group', () => {
  assert.deepEqual(parseRichText('Hello there.\nSecond line.\n\nNew paragraph.'), [
    { type: 'paragraph', spans: [{ text: 'Hello there.\nSecond line.' }] },
    { type: 'paragraph', spans: [{ text: 'New paragraph.' }] },
  ]);
});

test('reads bold, italic, and inline code', () => {
  assert.deepEqual(parseInline('You have **₱1,250.00** left, *roughly*, see `Wallet`.'), [
    { text: 'You have ' },
    { text: '₱1,250.00', bold: true },
    { text: ' left, ' },
    { text: 'roughly', italic: true },
    { text: ', see ' },
    { text: 'Wallet', code: true },
    { text: '.' },
  ]);
});

test('leaves arithmetic and lone asterisks literal', () => {
  assert.deepEqual(parseInline('5 * 3 = 15 and a*b'), [{ text: '5 * 3 = 15 and a*b' }]);
  assert.deepEqual(parseInline('**not closed'), [{ text: '**not closed' }]);
});

test('reads bullets, numbered steps, and headings', () => {
  const blocks = parseRichText('## Today\n- Pay rent\n  - via GCash\n* Call **Mom**\n1. Wake up\n2) Stretch');
  assert.deepEqual(blocks, [
    { type: 'heading', spans: [{ text: 'Today' }] },
    { type: 'bullet', spans: [{ text: 'Pay rent' }], depth: 0 },
    { type: 'bullet', spans: [{ text: 'via GCash' }], depth: 1 },
    { type: 'bullet', spans: [{ text: 'Call ' }, { text: 'Mom', bold: true }], depth: 0 },
    { type: 'numbered', marker: '1.', spans: [{ text: 'Wake up' }], depth: 0 },
    { type: 'numbered', marker: '2.', spans: [{ text: 'Stretch' }], depth: 0 },
  ]);
});

test('drops horizontal rules and flattens to plain text', () => {
  assert.equal(richTextToPlain('**Plan**\n---\n- One\n1. Two'), 'Plan\n• One\n1. Two');
});
