import test from 'node:test';
import assert from 'node:assert/strict';
import { extractMetadata, stripPageMarkers } from './ocr.js';
import { extractDocumentFields } from './metadataSuggestions.js';

const fakeMultiPageText = `--- Page 1 ---
SOME LONG ALL CAPS TITLE
Juan Dela Cruz
Maria Santos
Notre Dame of Marbel University

--- Page 2 ---
This is the second page of the document.
`;

test('stripPageMarkers removes OCR page separators without changing the raw text for storage display', () => {
  const cleaned = stripPageMarkers(fakeMultiPageText);

  assert.equal(cleaned.includes('--- Page 1 ---'), false);
  assert.equal(cleaned.includes('--- Page 2 ---'), false);
  assert.ok(cleaned.includes('SOME LONG ALL CAPS TITLE'));
  assert.ok(cleaned.includes('Juan Dela Cruz'));
});

test('extractMetadata ignores OCR page markers and does not treat Page as title or author', async () => {
  const metadata = await extractMetadata(fakeMultiPageText);

  assert.equal(metadata.title.includes('Page'), false);
  assert.equal(metadata.title.includes('---'), false);
  assert.equal(metadata.authors.includes('Page'), false);
  assert.equal(metadata.authors.includes('---'), false);
});

test('extractDocumentFields does not use page-marker lines as title or author candidates', () => {
  const fields = extractDocumentFields(stripPageMarkers(fakeMultiPageText));

  assert.equal(fields.title.includes('Page'), false);
  assert.equal(fields.title.includes('---'), false);
  assert.equal(fields.authors.some((author) => author.includes('Page') || author.includes('---')), false);
});
