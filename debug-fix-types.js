// Debug script to test fix type classification
const { PrismaClient } = require('@prisma/client');

// Mock the TextFixesService classifyChange method
function classifyChange(originalWord, correctedWord) {
  // Hebrew niqqud detection - vowel marks (U+05B0-U+05BD, U+05BF, U+05C1-U+05C2, U+05C4-U+05C7)
  const niqqudPattern = /[\u05B0-\u05BD\u05BF\u05C1\u05C2\u05C4-\u05C7]/g;
  
  // Remove niqqud from both words to compare base letters
  const originalWithoutNiqqud = originalWord.replace(niqqudPattern, '');
  const correctedWithoutNiqqud = correctedWord.replace(niqqudPattern, '');
  
  // If base letters are identical, this is a niqqud correction
  if (originalWithoutNiqqud === correctedWithoutNiqqud && 
      originalWord !== correctedWord) {
    return 'niqqud';
  }
  
  // Check for punctuation-only changes
  const punctuationPattern = /[.,;:!?()[\]{}"""''`~@#$%^&*+=|\\/<>]/g;
  const originalPunctuation = originalWord.match(punctuationPattern) || [];
  const correctedPunctuation = correctedWord.match(punctuationPattern) || [];
  
  if (originalWithoutNiqqud === correctedWithoutNiqqud && 
      originalPunctuation.join('') !== correctedPunctuation.join('')) {
    return 'punctuation'; // Only punctuation changed
  }
  
  // Fallback to original heuristics for non-Hebrew text
  if (originalWord.length === correctedWord.length) {
    return 'character_substitution'; // Same length, character-level change
  }
  
  if (Math.abs(originalWord.length - correctedWord.length) === 1) {
    return 'insertion_deletion'; // Single character insertion/deletion
  }
  
  if (correctedWord.includes(originalWord) || originalWord.includes(correctedWord)) {
    return 'expansion_contraction'; // One word contains the other
  }
  
  return 'substitution'; // Complete word replacement
}

// Test the specific cases mentioned by the user
console.log('=== Testing Fix Type Classification ===\n');

// Case 1: פרידה -> פרידקה (should be letter fix)
const case1Original = 'פרידה';
const case1Corrected = 'פרידקה';
const case1FixType = classifyChange(case1Original, case1Corrected);
console.log(`Case 1: "${case1Original}" -> "${case1Corrected}"`);
console.log(`Fix Type: ${case1FixType}`);
console.log(`Expected: letter fix (character_substitution or insertion_deletion)\n`);

// Case 2: 2 -> שתי (should be substitution)
const case2Original = '2';
const case2Corrected = 'שתי';
const case2FixType = classifyChange(case2Original, case2Corrected);
console.log(`Case 2: "${case2Original}" -> "${case2Corrected}"`);
console.log(`Fix Type: ${case2FixType}`);
console.log(`Expected: substitution\n`);

// Additional test cases
console.log('=== Additional Test Cases ===\n');

const testCases = [
  ['hello', 'helo', 'insertion_deletion'],
  ['test', 'best', 'character_substitution'],
  ['word', 'words', 'expansion_contraction'],
  ['cat', 'dog', 'substitution'],
];

testCases.forEach(([original, corrected, expected]) => {
  const result = classifyChange(original, corrected);
  console.log(`"${original}" -> "${corrected}": ${result} (expected: ${expected})`);
});
