// Debug script to test Hebrew disambiguation logic
const hebrewLetterPattern = /[\u0590-\u05FF]/g;

function debugHebrewDisambiguation(originalWord, correctedWord) {
  console.log(`\n=== Debugging: "${originalWord}" → "${correctedWord}" ===`);
  
  // Both words must contain Hebrew letters
  const hasHebrewInOriginal = hebrewLetterPattern.test(originalWord);
  const hasHebrewInCorrected = hebrewLetterPattern.test(correctedWord);
  
  console.log(`Original has Hebrew: ${hasHebrewInOriginal}`);
  console.log(`Corrected has Hebrew: ${hasHebrewInCorrected}`);
  
  if (!hasHebrewInOriginal || !hasHebrewInCorrected) {
    console.log('❌ Failed: One or both words do not contain Hebrew');
    return false;
  }
  
  // Extract Hebrew letters from both words
  const originalLetters = originalWord.match(hebrewLetterPattern) || [];
  const correctedLetters = correctedWord.match(hebrewLetterPattern) || [];
  
  console.log(`Original letters: [${originalLetters.join(', ')}] (length: ${originalLetters.length})`);
  console.log(`Corrected letters: [${correctedLetters.join(', ')}] (length: ${correctedLetters.length})`);
  
  // Both words should have reasonable length (at least 2 letters)
  if (originalLetters.length < 2 || correctedLetters.length < 2) {
    console.log('❌ Failed: One or both words have less than 2 letters');
    return false;
  }
  
  // For Hebrew-to-Hebrew disambiguation, corrected word should not be shorter than original
  if (correctedLetters.length < originalLetters.length) {
    console.log('❌ Failed: Corrected word is shorter than original');
    return false;
  }
  
  // Simple length check - words should be reasonably similar in length
  const lengthDiff = Math.abs(originalLetters.length - correctedLetters.length);
  console.log(`Length difference: ${lengthDiff}`);
  if (lengthDiff > 2) {
    console.log('❌ Failed: Length difference > 2');
    return false;
  }
  
  // Calculate similarity - require high similarity (>75%) for Hebrew-to-Hebrew disambiguation
  const originalUniqueLetters = new Set(originalLetters);
  const correctedUniqueLetters = new Set(correctedLetters);
  const commonLetters = [...originalUniqueLetters].filter(letter => correctedUniqueLetters.has(letter));
  const similarity = commonLetters.length / Math.max(originalUniqueLetters.size, correctedUniqueLetters.size);
  
  console.log(`Original unique letters: [${[...originalUniqueLetters].join(', ')}] (${originalUniqueLetters.size})`);
  console.log(`Corrected unique letters: [${[...correctedUniqueLetters].join(', ')}] (${correctedUniqueLetters.size})`);
  console.log(`Common letters: [${commonLetters.join(', ')}] (${commonLetters.length})`);
  console.log(`Similarity: ${commonLetters.length}/${Math.max(originalUniqueLetters.size, correctedUniqueLetters.size)} = ${similarity.toFixed(3)} (${(similarity * 100).toFixed(1)}%)`);
  
  const result = similarity > 0.75;
  console.log(`Result: ${result ? '✅ PASS' : '❌ FAIL'} (needs > 75%)`);
  
  return result;
}

// Test cases
debugHebrewDisambiguation('תשע', 'תישע');
debugHebrewDisambiguation('שמח', 'שמיח');
debugHebrewDisambiguation('כתב', 'כתיב');
debugHebrewDisambiguation('שלום', 'שלם');
