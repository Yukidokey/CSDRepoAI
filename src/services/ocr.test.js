import test from 'node:test';
import assert from 'node:assert/strict';
import { extractMetadata, stripPageMarkers } from './ocr.js';
import {
  extractDocumentFields,
  normalizeThesisBoilerplate,
  splitConcatenatedNames,
} from './metadataSuggestions.js';

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

test('extractDocumentFields separates a DOCX-style title page from authors and institution', () => {
  const fields = extractDocumentFields(`
    DESIGN AND DEVELOPMENT OF A CAMPUS RESEARCH REPOSITORY
    Juan Dela Cruz
    Maria Santos
    Notre Dame of Marbel University
    Bachelor of Science in Information Technology
    Abstract
    This study presents a research repository for organizing academic papers.
  `);

  assert.equal(fields.title, 'DESIGN AND DEVELOPMENT OF A CAMPUS RESEARCH REPOSITORY');
  assert.deepEqual(fields.authors, ['Juan Dela Cruz', 'Maria Santos']);
});

test('extractDocumentFields supports labeled title and authors', () => {
  const fields = extractDocumentFields(`
    Title: A Smart Campus Research System
    Authors: Juan Dela Cruz; Maria Santos
    Abstract: This study presents a smart campus research system.
  `);

  assert.equal(fields.title, 'A Smart Campus Research System');
  assert.deepEqual(fields.authors, ['Juan Dela Cruz', 'Maria Santos']);
});

test('extractDocumentFields prioritizes the bold first-page title and reads up to four following authors', () => {
  const fields = extractDocumentFields(`
    __DOCX_BOLD__SMART CAMPUS RESEARCH REPOSITORY
    JUAN DELA CRUZ
    MARIA SANTOS
    PEDRO REYES
    ANA GARCIA
    Notre Dame of Marbel University
    Bachelor of Science in Computer Science
    __DOCX_BOLD__Vince Marc B. Sabado, MSIT
    __DOCX_BOLD__Thesis Adviser
  `);

  assert.equal(fields.title, 'SMART CAMPUS RESEARCH REPOSITORY');
  assert.deepEqual(fields.authors, ['JUAN DELA CRUZ', 'MARIA SANTOS', 'PEDRO REYES', 'ANA GARCIA']);
  assert.equal(fields.adviser, 'Vince Marc B. Sabado, MSIT');
});

test('extractDocumentFields uses PDF bold markers for multi-line titles', () => {
  const fields = extractDocumentFields(`
    __PDF_BOLD__DESIGN AND DEVELOPMENT OF A
    __PDF_BOLD__CAMPUS RESEARCH REPOSITORY
    Juan Dela Cruz
    Maria Santos
    Notre Dame of Marbel University
  `);

  assert.equal(fields.title, 'DESIGN AND DEVELOPMENT OF A CAMPUS RESEARCH REPOSITORY');
  assert.deepEqual(fields.authors, ['Juan Dela Cruz', 'Maria Santos']);
});

test('extractDocumentFields reads keywords from the Keywords line at the end of the abstract', () => {
  const fields = extractDocumentFields(`
    Abstract
    This study presents a smart campus research system for organizing academic papers.
    Keywords: smart campus; research repository; academic papers
    Introduction
    Keywords: this later line must not be selected
  `);

  assert.equal(fields.keywords, 'smart campus; research repository; academic papers');
});

test('extractDocumentFields supports italic-style Keywords labels', () => {
  const fields = extractDocumentFields(`
    Abstract
    This study presents a smart campus research system for organizing academic papers.
    __DOCX_ITALIC__Keywords: smart campus, research repository, academic papers
  `);

  assert.equal(fields.keywords, 'smart campus, research repository, academic papers');
});

test('normalizeThesisBoilerplate separates merged institution, degree, and adviser fields', () => {
  const normalized = normalizeThesisBoilerplate(
    'Notre Dame of Marbel University Bachelor of Science in Information Technology Vince Marc B. Sabado Thesis Adviser'
  );

  assert.equal(
    normalized,
    'Notre Dame of Marbel University\nBachelor of Science in Information Technology Vince Marc B. Sabado\nThesis Adviser'
  );
});

test('splitConcatenatedNames separates merged author names', () => {
  const split = splitConcatenatedNames('Chrissandra Marchelle L. Bautista Crislyn Joy D. Delgado');

  assert.equal(split, 'Chrissandra Marchelle L. Bautista\nCrislyn Joy D. Delgado');
});
