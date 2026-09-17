import test from "node:test";
import assert from "node:assert/strict";
import { buildMetadataContext } from "./extractMetadata.js";

const titlePage = `
END-TO-END TRANSFORMER-BASED SPEECH-TO-TEXT NEURAL MACHINE TRANSLATION
FOR THE LOW-RESOURCE TBOLI-ENGLISH LANGUAGE PAIR
Chrissandra Marchelle L. Bautista
Crislyn Joy D. Delgado
Notre Dame of Marbel University
`;

const approvalSheet = `
Approval Sheet
Vince Marc B. Sabado, MSIT
Thesis Adviser
`;

const abstract = `
Abstract
This study presents a Tboli-to-English speech translation Android application using automatic speech recognition and machine translation. The system supports a critically underrepresented indigenous language.
Key words: speech recognition; machine translation; Tboli-English
`;

test("buildMetadataContext preserves adviser and abstract sections after the old 12000-character limit", () => {
  const rawText = `${titlePage}${"\nMethodology body text. ".repeat(550)}${approvalSheet}${abstract}`;
  assert.ok(rawText.indexOf("Approval Sheet") > 12000);
  assert.ok(rawText.indexOf("Abstract") > 12000);

  const context = buildMetadataContext(rawText);

  assert.match(context, /\[DOCUMENT START\]/);
  assert.match(context, /\[APPROVAL SHEET SECTION\][\s\S]*Vince Marc B\. Sabado, MSIT[\s\S]*Thesis Adviser/);
  assert.match(context, /\[ABSTRACT \+ KEYWORDS SECTION\][\s\S]*This study presents a Tboli-to-English speech translation Android application/);
  assert.match(context, /Key words: speech recognition; machine translation; Tboli-English/);
});
