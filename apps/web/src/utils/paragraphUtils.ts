/**
 * Utility functions for paragraph-related operations
 */

/**
 * Formats a paragraph number for display, ensuring consistent 1-based indexing
 * and avoiding "N/A" display for zero values.
 * 
 * @param paragraphNumber - The paragraph number/index (can be 0-based or 1-based)
 * @param isZeroBased - Whether the input number is 0-based (default: true)
 * @returns Formatted paragraph number as string (always 1-based for display)
 */
export function formatParagraphNumber(paragraphNumber: number | null | undefined, isZeroBased = true): string {
  // Handle null, undefined, or invalid numbers
  if (paragraphNumber === null || paragraphNumber === undefined || isNaN(paragraphNumber)) {
    return '1'; // Default to paragraph 1 instead of N/A
  }

  // Convert to 1-based indexing if input is 0-based
  const displayNumber = isZeroBased ? paragraphNumber + 1 : paragraphNumber;
  
  // Ensure minimum value of 1
  return Math.max(1, displayNumber).toString();
}

/**
 * Formats location information for display (Page X, Paragraph Y)
 * 
 * @param pageNumber - The page number
 * @param paragraphNumber - The paragraph number/index
 * @param isZeroBased - Whether the paragraph number is 0-based (default: true)
 * @returns Formatted location string
 */
export function formatLocationInfo(
  pageNumber: number | null | undefined,
  paragraphNumber: number | null | undefined,
  isZeroBased = true
): string {
  const page = pageNumber || 1;
  const paragraph = formatParagraphNumber(paragraphNumber, isZeroBased);
  
  return `Page: ${page}, Paragraph: ${paragraph}`;
}
