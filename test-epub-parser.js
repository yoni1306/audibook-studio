const { JSDOM } = require('jsdom');

// Test HTML content with numbered lists
const testHtml = `
<html>
<body>
  <h1>Chapter 1</h1>
  <p>This is a regular paragraph.</p>
  
  <ol>
    <li>First numbered item</li>
    <li>Second numbered item</li>
    <li>Third numbered item</li>
  </ol>
  
  <p>Another paragraph between lists.</p>
  
  <ul>
    <li>First bullet item</li>
    <li>Second bullet item</li>
  </ul>
  
  <div>
    <p>Paragraph inside div</p>
    <ol>
      <li>Nested numbered item 1</li>
      <li>Nested numbered item 2</li>
    </ol>
  </div>
</body>
</html>
`;

console.log('Testing EPUB parser logic with sample HTML...');

const dom = new JSDOM(testHtml, { contentType: 'text/html' });
const document = dom.window.document;

// Remove script and style elements
document.querySelectorAll('script, style').forEach((el) => el.remove());

// Extract text from various elements including lists
const textElements = document.querySelectorAll(
  'p, h1, h2, h3, h4, h5, h6, div, section, article, ol, ul, li'
);

// Process elements in document order
const processedElements = new Set();
const results = [];

textElements.forEach((element) => {
  // Skip if this element was already processed as part of a list
  if (processedElements.has(element)) return;

  let currentText = '';

  // Handle different element types appropriately
  if (element.tagName.toLowerCase() === 'ol') {
    console.log(`Processing ordered list with ${element.children.length} items`);
    // Ordered list - process each li with numbering
    const listItems = element.querySelectorAll('li');
    listItems.forEach((li, index) => {
      processedElements.add(li); // Mark as processed
      const itemText = li.textContent?.trim();
      if (itemText && itemText.length > 0) {
        currentText += `${index + 1}. ${itemText}\n`;
        console.log(`Added numbered item ${index + 1}: ${itemText}`);
      }
    });
  } else if (element.tagName.toLowerCase() === 'ul') {
    console.log(`Processing unordered list with ${element.children.length} items`);
    // Unordered list - process each li with bullet
    const listItems = element.querySelectorAll('li');
    listItems.forEach((li) => {
      processedElements.add(li); // Mark as processed
      const itemText = li.textContent?.trim();
      if (itemText && itemText.length > 0) {
        currentText += `• ${itemText}\n`;
        console.log(`Added bullet item: ${itemText}`);
      }
    });
  } else if (element.tagName.toLowerCase() === 'li') {
    // Skip standalone li elements - they should be processed as part of their parent list
    const parentList = element.closest('ol, ul');
    if (!parentList) {
      // Orphaned li element - treat as regular paragraph
      const itemText = element.textContent?.trim();
      if (itemText && itemText.length > 0) {
        currentText = itemText;
        console.log(`Processing orphaned li element: ${itemText}`);
      }
    }
  } else {
    // Regular elements - extract text normally
    const hasChildLists = element.querySelector('ol, ul');
    if (!hasChildLists) {
      const walker = document.createTreeWalker(
        element,
        dom.window.NodeFilter.SHOW_TEXT,
        {
          acceptNode: (node) => {
            const text = node.textContent?.trim();
            if (text && text.length > 0) {
              return dom.window.NodeFilter.FILTER_ACCEPT;
            }
            return dom.window.NodeFilter.FILTER_SKIP;
          },
        }
      );

      let node;
      while ((node = walker.nextNode())) {
        currentText += ' ' + node.textContent?.trim();
      }
    }
  }

  currentText = currentText.trim();
  if (currentText.length > 0) {
    results.push(currentText);
    console.log(`\n--- Result ${results.length} ---`);
    console.log(currentText);
    console.log('--- End Result ---\n');
  }
});

console.log(`\nTotal results: ${results.length}`);
console.log('\nAll results:');
results.forEach((result, index) => {
  console.log(`${index + 1}. ${result.replace(/\n/g, ' | ')}`);
});
