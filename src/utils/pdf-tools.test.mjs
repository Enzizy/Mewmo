import assert from 'node:assert/strict';
import test from 'node:test';
import { parsePageSelection } from './pdf.ts';

test('parses ordered pages and ranges', () => assert.deepEqual(parsePageSelection('3, 1-2, 5', 5), [2, 0, 1, 4]));
test('rejects pages outside the document', () => assert.throws(() => parsePageSelection('1, 6', 5), /1 to 5/));
test('rejects duplicate pages', () => assert.throws(() => parsePageSelection('1-2, 2', 5), /only once/));
