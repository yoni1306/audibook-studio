// Debug script to test bulk fix issues
const text1 = "ב־2 ביוני 1930, והוא בן 45 בלבד, תלה את עצמו בסטודיו שלו אחרי שחתך את ורידיו.";
const text2 = "ממנו עלה שטוראי טיל נתלה אחרי משפט צבאי עד צאת נשמתו ב־2 ביולי 1945.";

console.log("Text 1 length:", text1.length);
console.log("Text 2 length:", text2.length);
console.log("Are they identical?", text1 === text2);

// Check for invisible characters
console.log("Text 1 char codes:", [...text1].map(c => c.charCodeAt(0)).join(','));
console.log("Text 2 char codes:", [...text2].map(c => c.charCodeAt(0)).join(','));

// Check if they're the same text being compared against itself
console.log("Text 1:", JSON.stringify(text1));
console.log("Text 2:", JSON.stringify(text2));
