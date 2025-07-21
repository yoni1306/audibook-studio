/**
 * Text utilities for consistent text processing across the application
 */

/**
 * Detects if text contains Hebrew characters and should be displayed RTL
 * @param text - The text to check
 * @returns true if text contains Hebrew characters
 */
export const isRTLText = (text: string): boolean => {
  return /[\u0590-\u05FF\uFB1D-\uFB4F]/.test(text);
};

/**
 * Gets the appropriate text direction for a given text
 * @param text - The text to check
 * @returns 'rtl' for Hebrew text, 'ltr' for other text
 */
export const getTextDirection = (text: string): 'rtl' | 'ltr' => {
  return isRTLText(text) ? 'rtl' : 'ltr';
};

/**
 * Gets the appropriate text alignment for a given text
 * @param text - The text to check
 * @returns 'right' for Hebrew text, 'left' for other text
 */
export const getTextAlign = (text: string): 'right' | 'left' => {
  return isRTLText(text) ? 'right' : 'left';
};

/**
 * Counts words in a text string
 * @param text - The text to count words in
 * @returns Number of words
 */
export const countWords = (text: string): number => {
  return text.trim().split(/\s+/).filter(word => word.length > 0).length;
};

/**
 * Counts characters in a text string
 * @param text - The text to count characters in
 * @returns Number of characters
 */
export const countCharacters = (text: string): number => {
  return text.length;
};
