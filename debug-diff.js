import * as diff from 'diff';

// Test the Hebrew text scenario
const originalText = 'אנשים צועקים כל העת שהם רוצים ליצור עתיד טוב יותר. העתיד הוא תהום חסרת עניין. העבר לעומתו מלא חיים, מתגרה בנו בלי די, מאתגר ומעליב. בה בעת, מפתה אותנו לשנות או להרוס אותו. הסיבה היחידה שאנשים רוצים להיות אדוני העתיד היא על מנת לשנות את העבר. - מילן קונדרה פרולוג';
const correctedText = 'אנשים צועקים כל העת שהם רו צים ליצור עתיד טוב יותר. העתיד הוא תהום חסרת עניין. העבר לעומתו מלא חיים, מתגרה בנו בלי די, מאתגר ומעליב. בה בעת, מפתה אותנו לשנות או להרוס אותו. הסיבה היחידה שאנשים רוצים להיות אדוני העתיד היא על מנת לשנות את העבר. - מילן קונדרה פרולוג';

console.log('=== ORIGINAL TEXT ===');
console.log(originalText);
console.log('\n=== CORRECTED TEXT ===');
console.log(correctedText);

console.log('\n=== WORD DIFF WITH SPACE ===');
const wordDiffs = diff.diffWordsWithSpace(originalText, correctedText);
wordDiffs.forEach((part, index) => {
  console.log(`Part ${index}: added=${part.added}, removed=${part.removed}, value="${part.value}"`);
});

console.log('\n=== WORD DIFF (NO SPACE) ===');
const wordDiffsNoSpace = diff.diffWords(originalText, correctedText);
wordDiffsNoSpace.forEach((part, index) => {
  console.log(`Part ${index}: added=${part.added}, removed=${part.removed}, value="${part.value}"`);
});

console.log('\n=== CHARACTER DIFF ===');
const charDiffs = diff.diffChars(originalText, correctedText);
charDiffs.forEach((part, index) => {
  if (part.added || part.removed) {
    console.log(`Part ${index}: added=${part.added}, removed=${part.removed}, value="${part.value}"`);
  }
});

// Extract words function (same as in service)
function extractWords(text) {
  const wordRegex = /[^\s.,;:!?()[\]{}""''`~@#$%^&*+=|\\/<>]+/g;
  return (text.match(wordRegex) || []).filter(word => word.trim().length > 0);
}

console.log('\n=== WORD EXTRACTION TEST ===');
console.log('Original words:', extractWords(originalText));
console.log('Corrected words:', extractWords(correctedText));
