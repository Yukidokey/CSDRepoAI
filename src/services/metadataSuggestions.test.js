import test from 'node:test';
import assert from 'node:assert/strict';
import { extractDocumentFields } from './metadataSuggestions.js';

test('extractDocumentFields handles wrapped titles and marked abstract metadata', () => {
  const fields = extractDocumentFields(`
    __DOCX_BOLD__DESIGN AND DEVELOPMENT OF A CAMPUS
    __DOCX_BOLD__RESEARCH REPOSITORY
    Jane Doe
    Notre Dame of Marbel University
    __DOCX_BOLD__Dr. Maria Santos
    __DOCX_BOLD__Thesis Adviser
    __DOCX_BOLD__Abstract
    This study presents a research repository for organizing academic papers.
    __DOCX_ITALIC__Keywords: a; b; c
    Abstract 3
    Table of contents entry
  `);

  assert.equal(fields.authors.includes('RESEARCH REPOSITORY'), false);
  assert.equal(fields.abstract, 'This study presents a research repository for organizing academic papers.');
  assert.equal(fields.keywords, 'a; b; c');
});

test('extractDocumentFields keeps complete wrapped titles for DOCX and PDF markers', () => {
  const docxFields = extractDocumentFields(`
    __DOCX_BOLD__A COMPLETE THESIS TITLE ABOUT
    __DOCX_BOLD__RESEARCH AND DEVELOPMENT
    Jane Doe
    Notre Dame of Marbel University
  `);
  const pdfFields = extractDocumentFields(`
    __PDF_BOLD__A COMPLETE THESIS TITLE ABOUT
    __PDF_BOLD__RESEARCH AND DEVELOPMENT
    Jane Doe
    Notre Dame of Marbel University
  `);

  assert.equal(docxFields.title, 'A COMPLETE THESIS TITLE ABOUT RESEARCH AND DEVELOPMENT');
  assert.equal(pdfFields.title, 'A COMPLETE THESIS TITLE ABOUT RESEARCH AND DEVELOPMENT');
});