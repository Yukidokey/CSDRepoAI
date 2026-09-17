import test from 'node:test';
import assert from 'node:assert/strict';
import { wrapReceiptValue } from './receiptFormatting.js';

test('wraps long receipt values onto multiple lines', () => {
  const lines = wrapReceiptValue(
    'A very long research title that should wrap cleanly across multiple lines in the confirmation receipt without overlapping the label text.',
    36,
  );

  assert.ok(lines.length > 1);
  assert.ok(lines.every((line) => line.length <= 36));
  assert.equal(lines.join(' ').trim(), 'A very long research title that should wrap cleanly across multiple lines in the confirmation receipt without overlapping the label text.');
});

test('falls back to a placeholder for empty receipt values', () => {
  assert.deepEqual(wrapReceiptValue('', 30), ['—']);
  assert.deepEqual(wrapReceiptValue(null, 30), ['—']);
});
