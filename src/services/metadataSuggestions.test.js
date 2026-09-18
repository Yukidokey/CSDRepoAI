import test from 'node:test';
import assert from 'node:assert/strict';
import { extractDocumentFields, mergeExtractedMetadata, toMetadataEndpoint } from './metadataSuggestions.js';

test('toMetadataEndpoint supports bare backend origins and existing metadata paths', () => {
  assert.equal(toMetadataEndpoint('https://example.vercel.app', 'extract-metadata'), 'https://example.vercel.app/extract-metadata');
  assert.equal(toMetadataEndpoint('https://example.vercel.app/', 'metadata'), 'https://example.vercel.app/metadata');
  assert.equal(toMetadataEndpoint('https://example.vercel.app/metadata', 'extract-metadata'), 'https://example.vercel.app/extract-metadata');
  assert.equal(toMetadataEndpoint('https://example.vercel.app/extract-metadata', 'metadata'), 'https://example.vercel.app/metadata');
  assert.equal(toMetadataEndpoint('http://example.vercel.app', 'extract-metadata'), 'https://example.vercel.app/extract-metadata');
  assert.equal(toMetadataEndpoint('http://localhost:8787', 'extract-metadata'), 'http://localhost:8787/extract-metadata');
});

test('extractDocumentFields handles labeled metadata with multiple authors and capitalization variants', () => {
  const fields = extractDocumentFields(`
    TITLE: A SMART RESEARCH REPOSITORY FOR COMPUTER STUDIES
    AUTHORS:
    Juan Dela Cruz
    Maria Angelica D. Santos
    John Paul M. Reyes Jr.
    ABSTRACT
    This study presents a research repository that organizes academic papers and improves metadata discovery for students.
    KEYWORDS
    Artificial Intelligence
    Research Repository
    Metadata Extraction
    INTRODUCTION
    Chapter I
    Thesis Adviser
    Dr. Elena Cruz
  `);

  assert.equal(fields.title, 'A SMART RESEARCH REPOSITORY FOR COMPUTER STUDIES');
  assert.deepEqual(fields.authors, ['Juan Dela Cruz', 'Maria Angelica D. Santos', 'John Paul M. Reyes Jr.']);
  assert.equal(fields.keywords, 'Artificial Intelligence Research Repository Metadata Extraction');
  assert.match(fields.abstract, /research repository that organizes academic papers/);
});

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

test('mergeExtractedMetadata preserves stronger local fields when AI output is incomplete', () => {
  const local = extractDocumentFields(`
    END-TO-END TRANSFORMER-BASED SPEECH-TO-TEXT NEURAL MACHINE TRANSLATION
    FOR THE LOW-RESOURCE TBOLI-ENGLISH LANGUAGE PAIR
    Chrissandra Marchelle L. Bautista
    Crislyn Joy D. Delgado
    Notre Dame of Marbel University
    Thesis Adviser: Vince Marc B. Sabado, MSIT
    Abstract
    This study presents a complete research system for speech translation and evaluates its performance with a low-resource indigenous language.
    Keywords: speech recognition; machine translation
  `);
  const merged = mergeExtractedMetadata(
    local,
    local.abstract,
    {
      title: 'LANGUAGE PAIR',
      authors: ['Chrissandra Marchelle L. Bautista'],
      adviser: 'Maria Santos, Panel Chair',
      abstract: 'A short summary.',
      keywords: [],
    },
    { name: 'research-paper.pdf' }
  );

  assert.match(merged.title, /END-TO-END TRANSFORMER-BASED/);
  assert.deepEqual(merged.authors, local.authors);
  assert.equal(merged.adviser, local.adviser);
  assert.equal(merged.abstract, local.abstract);
  assert.equal(merged.keywords, 'speech recognition, machine translation');
});

test('extractDocumentFields excludes hardbound headers and stops keywords at acknowledgment', () => {
  const fields = extractDocumentFields(`
    HARDBOUND BAYAD
    BAYAD: A MOBILE-BASED SYSTEM TO PROMOTE TRANSPARENCY AND ACCOUNTABILITY IN STUDENT ORGANIZATION PAYMENTS AT NDMU
    Juan Dela Cruz
    Notre Dame of Marbel University
    Abstract
    This study presents a payment tracking system for student organization transactions.
    Keywords: financial transparency, accountability, payment tracking, student organizations, mobile application, usability evaluation
    Acknowledgment
    We, as researchers, would like to offer our great appreciation to everyone who helped in this research.
  `);

  assert.equal(fields.title, 'BAYAD: A MOBILE-BASED SYSTEM TO PROMOTE TRANSPARENCY AND ACCOUNTABILITY IN STUDENT ORGANIZATION PAYMENTS AT NDMU');
  assert.equal(fields.keywords, 'financial transparency, accountability, payment tracking, student organizations, mobile application, usability evaluation');
});

test('mergeExtractedMetadata rejects HARDBOUND headers returned as an AI title', () => {
  const local = {
    title: 'BAYAD: A MOBILE-BASED SYSTEM TO PROMOTE TRANSPARENCY AND ACCOUNTABILITY IN STUDENT ORGANIZATION PAYMENTS AT NDMU',
    authors: ['Juan Dela Cruz'],
    adviser: '',
    keywords: 'financial transparency, accountability, payment tracking, student organizations, mobile application, usability evaluation',
  };
  const merged = mergeExtractedMetadata(local, 'This study presents a payment tracking system for student organization transactions.', {
    title: 'HARDBOUND BAYAD',
    authors: ['Juan Dela Cruz'],
    adviser: '',
    abstract: '',
    keywords: [],
  }, { name: 'bayad.pdf' });

  assert.equal(merged.title, 'A MOBILE-BASED SYSTEM TO PROMOTE TRANSPARENCY AND ACCOUNTABILITY IN STUDENT ORGANIZATION PAYMENTS AT NDMU');
});

test('mergeExtractedMetadata normalizes a flattened hardbound BAYAD title', () => {
  const merged = mergeExtractedMetadata(
    {
      title: 'HARDBOUND BAYAD *bayad*: A Mobile-Based System to Promote Transparency and Accountability in Student Organization Payments at NDMU',
      authors: [],
      adviser: '',
      keywords: '',
    },
    '',
    { title: 'HARDBOUND BAYAD', authors: [], adviser: '', abstract: '', keywords: [] },
    { name: 'bayad.pdf' }
  );

  assert.equal(merged.title, 'A Mobile-Based System to Promote Transparency and Accountability in Student Organization Payments at NDMU');
});