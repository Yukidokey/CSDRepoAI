import test from 'node:test';
import assert from 'node:assert/strict';
import { extractDocumentFields } from './metadataSuggestions.js';

test('extractDocumentFields handles noisy unformatted OCR metadata', () => {
  const fields = extractDocumentFields(`
    --- Page 1 ---
    END-TO-END TRANSFORMER-BASED SPEECH-TO-TEXT NEURAL MACHINE TRANSLATION
    FOR THE LOW-RESOURCE TBOLI-ENGLISH LANGUAGE PAIR
    Chrissandra Marchelle L. Bautista
    Crislyn Joy D. Delgado
    Notre Dame of Marbel University
    Bachelor of Science in Computer Science
    --- Page 2 ---
    Vince Marc B. Sabado, MSIT, Thesis Adviscr
    Maria Santos Panel Chair
    --- Page 3 ---
    Abstrac This study presents a Tboli-to-English speech translation Android application using automatic speech recognition and machine translation for a low-resource indigenous language.
    *Key words:* speech recognition; machine translation; Tboli-English
  `);

  assert.equal(fields.title, 'END-TO-END TRANSFORMER-BASED SPEECH-TO-TEXT NEURAL MACHINE TRANSLATION FOR THE LOW-RESOURCE TBOLI-ENGLISH LANGUAGE PAIR');
  assert.deepEqual(fields.authors, ['Chrissandra Marchelle L. Bautista', 'Crislyn Joy D. Delgado']);
  assert.equal(fields.adviser, 'Vince Marc B. Sabado, MSIT');
  assert.match(fields.abstract, /This study presents a Tboli-to-English speech translation Android application/);
  assert.equal(fields.keywords, 'speech recognition; machine translation; Tboli-English');
});

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

test('extractDocumentFields keeps institutional lines out of wrapped title candidates', () => {
  const fields = extractDocumentFields(`
    __DOCX_BOLD__A REAL RESEARCH TITLE ABOUT STUDENT SERVICES
    Jane Doe
    Notre Dame of Marbel University
    Bachelor of Science in Information Technology
    __DOCX_BOLD__Brenda M. Balala, MIT
    __DOCX_BOLD__Thesis Adviser
  `);

  assert.equal(fields.title, 'A REAL RESEARCH TITLE ABOUT STUDENT SERVICES');
  assert.deepEqual(fields.authors, ['Jane Doe']);
});

test('extractDocumentFields separates same-line abstract and keyword OCR text', () => {
  const fields = extractDocumentFields(`
    A PLAIN OCR THESIS TITLE ABOUT SPEECH TRANSLATION
    Jane Doe
    Notre Dame of Marbel University
    Thesis Adviser: Maria Santos
    Abstract This study presents a speech translation system for a low-resource language. Key words: speech recognition; machine translation
  `);

  assert.match(fields.abstract, /This study presents a speech translation system/);
  assert.equal(fields.keywords, 'speech recognition; machine translation');
  assert.equal(fields.adviser, 'Maria Santos');
});