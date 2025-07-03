
# 📘 Hebrew AI Narration: Text Correction Manual

This guide outlines essential text preprocessing rules to improve the quality of AI-narrated Hebrew digital books.

---

## 1. 🔠 Fix Misread Words

### What it fixes:
Words that AI may mispronounce—such as homographs, Hebrew names, or missing vowels.

### Rules:
- Clarify ambiguous words (e.g., `ספר → sefer` vs `safar`)
- Add vowels or rewrite names (`דויד → דָוִד`)
- Disambiguate verb/noun forms (`עבר → עָבָר` vs `עָבַר`)

### How to fix:
- Use contextual analysis or morphology tools
- Add vowelization (ניקוד) where needed
- Apply replacement lists or phonetic hints

---

## 2. ✍️ Improve Sentence Flow

### What it fixes:
Unnatural rhythm, flat tone, or confusing sentence structure in narration.

### Rules:
- Break long/nested sentences into clear chunks
- Add commas, dashes, ellipses for pauses
- Mark dialogue or quotes clearly
- Insert tone/role cues where needed

### How to fix:
- Use regex or NLP tools to detect and split clauses
- Apply punctuation and formatting
- Tag narrative vs. speech (optionally with SSML)

---

## 3. 🔢 Expand Numbers & Acronyms

### What it fixes:
Numbers, currency, dates, and abbreviations that TTS misreads.

### Rules:
- Convert digits to Hebrew words (`123 → מאה עשרים ושלוש`)
- Expand currency and dates (`₪99 → תשעים ותשעה שקלים`)
- Replace acronyms with spoken forms (`צה"ל → צה-אל`)

### How to fix:
- Use a number-to-words function
- Keep a custom dictionary for acronyms
- Apply regex to detect and transform shorthand

---

