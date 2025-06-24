import { EPUBProcessor } from './EPUBProcessor';
import * as cheerio from 'cheerio';

describe('EPUBProcessor Paragraph Grouping', () => {
  let processor: EPUBProcessor;

  beforeEach(() => {
    processor = new EPUBProcessor('/fake/path/test.epub');
  });

  const chapter1Html = `<?xml version="1.0" encoding="UTF-8"?><html xmlns="http://www.w3.org/1999/xhtml" xml:lang="he" dir="rtl">  <head>    <title>מבוא</title>    <link rel="stylesheet" type="text/css" href="stylesheet.css"/>  </head>  <body>    <h2>מבוא</h2>    <p>רילוקיישן<br/>אוסף מתוך מדוריו של רון מיברג<br/>מעריב 2010–2025<br/>(לעמוד הקרדיטים)<br/>זכויות יוצרים בטורים של רון מיברג אשר התפרסמו ברבות השנים במעריב שייכות ל"מעריב" מקבוצת הג'רוזלם פוסט.<br/>"יצירה עברית" מודה ל"מעריב" על השימוש בטורים למטרות הוצאת ספר זה.<br/>פרולוג</p>  </body></html>`;

  const chapter2Html = `<?xml version="1.0" encoding="UTF-8"?><html xmlns="http://www.w3.org/1999/xhtml" xml:lang="he" dir="rtl">  <head>    <title>שער ראשון: מקום אחר</title>    <link rel="stylesheet" type="text/css" href="stylesheet.css"/>  </head>  <body>    <h2>שער ראשון: מקום אחר</h2>    <p>שער ראשון: מקום אחר<br/>ארווין קרויץ, הבלדה על הגרמני המבולבל<br/>אוכל בניו אינגלנד, חרפה בצלחת<br/>מאפיית מיברג, שלח לחמך<br/>אחים בדרכים, האם פריז בוערת<br/>פיטר לוגר, שלאג ד'אשתקד<br/>מרלין קרפנטר, תענית שתיקה ב"פלאזה"</p>  </body></html>`;

  // Problematic HTML that breaks into multiple paragraphs
  const problematicChapterHtml = `<?xml version="1.0" encoding="UTF-8"?>
<html xmlns="http://www.w3.org/1999/xhtml" xml:lang="he" dir="rtl">
  <head>
    <title>שער ראשון</title>
    <link rel="stylesheet" type="text/css" href="stylesheet.css"/>
  </head>
  <body>
    <h2>שער ראשון</h2>
    <p>שער ראשון<br/>מקום אחר<br/>ארווין קרויץ, הבלדה על הגרמני המבולבל<br/>בנגור, הנמצאת מרחק שעה נסיעה מביתי, היא עיר שאני מתנזר ממנה באדיקות. בשנים הראשונות במיין חרגתי מאזור הנוחות שלי והתלוויתי לנעמי בגיחות ייעודיות שלא הייתה דרך להתחמק מהן. לרוב לחנויות המקיפות את בנגור באזור המכונה The Mall; שעטנז נטול חן ואטרקציות בין קניון ואאוטלט הניזון משש יציאות נפרדות בכביש המהיר דרומה, בזבוז מובהק ומייאש של זמן משום שאין מה לקנות בו, אין מה לראות ומה לאכול. בחיוך קפוא ועיניים ששידרו אימה גדולה, דשדשתי בעקבות בעלת הבית ככלב מאולף ומדוכדך. יש מחירים בחיים והגיחות שלי לבנגור היו מחיר סביר לתחזוק הזוגיות.<br/>איכשהו קרה שבנגור – אותה כיניתי בעוינות "פנינת הצפון" עד שגם המקומיים החלו להביט בי עקום – הפכה לחדר המיון ולבית החולים האישי שלנו. עם 35 אלף תושבים, היא העיר השנייה בגודלה אחרי פורטלנד עם 67 אלף תושבים ועם מרכז רפואי גדול. עברנו בה אירועים רפואיים מסדר גודל שאפילו בניו יורק מחייבים דעה שנייה בדרך כלל. כולל הסרת גידול שפיר בגודל פוטבול מהכבד של אחד מאיתנו, שבשל גודלו נשמר בפורמלין ויש לו שעות ביקור; קיבוע ברך מרוסקת והחלמה שארכה שנה; בדיקות פולשניות שגרתיות היו כסף קטן אצלנו.<br/>בשבוע שעבר נקלעתי שוב לבנגור למעקב החצי שנתי אצל הנפרולוג. הוא גבר צעיר מרומניה שהגיע לבנגור מבוקרשט, אם אתם תוהים עד כמה מסתוריות ואכזריות הן דרכי האל, ואנחנו מפטפטים בעליצות בנושאים שונים, בעיקר קולינריים. הכול חוץ ממצב הכליות שלי. הפעם הבאתי דווקא תוצאות בדיקות דם ושתן טובות. אני מודע לתמיהה במחלקה כאשר שרנו יחד את האינטרנציונל וצעקנו מיטיטיי ומורטורה. מיכאיל שאל איך בישראל ועניתי לו מבלי להוציא את דיבתה של המולדת. במקום לחכות שלוש שעות לתור בגסטרו בקומה הראשונה, הצלחתי לשכנע את הרופא שיראה אותי מיד. איפה שפעם קראתי שפתיים, בגלל המסכות בשנה האחרונה אני רוב הזמן מנחש מה שאומרים לי. במקומות שבהם אני מכיר את סדר השאלות השגרתיות, אני מסתדר עם הימור מיומן בכן ולא. מה שלא עובד עם רופא ששואל אם אתה אלכוהוליסט ואתה עונה כן כי לא שמעת.<br/>אין לי ידיעה ברורה בעניין בריאותי, אבל בנגור נשארה אחת הערים המדכאות בעולם, והייתי גם במזרח אירופה ובקמבודיה. חוץ מפנום פן ושדות הקטל, בנגור מובילה את רשימת המדכאות. בעיקר בחורף, כאשר יציקות הבטון החשוף השולטות בה מקבלות מראה רטוב וכהה, הרחובות נטושים, מאחורי דלתות מסבאות מוגפות מטביעים אנשים את יגונם באלכוהול והעיר נראית כמו כתם רורשאך. והגרוע מכול, בעיירה הדיכאונית הזו אין מאורה אחת שבה ניתן ללעוס דבר מה סביר. שעה וחצי דרומה בפורטלנד, פורחת אחת הסצנות הקולינריות המסעירות באמריקה. השבוע, וכל מילה אמת, קבעו במגזין Food & Wine, שכמה מהבייגל'ס הטובים ביבשת אופים באזור פורטלנד.<br/>***<br/>מיכאיל מהכליות, אפרופו תחושת התלישות האתנית שלנו, הפנה את תשומת ליבי לסיפור האנושי, המוזר והנוגע ללב, על התייר הגרמני ארווין קרויץ והרפתקאותיו בבנגור. מכיוון שהיינו מול מחשב, מיכאיל העלה כמה קטעי עיתונות ושלח לי לינקים.<br/>את בנגור ראיתי לראשונה בתחילת שנות השמונים. לא את העיר אלא את שדה התעופה שלה, המכונה בינלאומי. משום שאורך מסלולו שני מייל, בעיתות מצוקה נוחתות בו טיסות בינלאומיות, ובמלחמות עיראק ואפגניסטן הוא היה אחד מנמלי היציאה והחזרה של חיילים אמריקאים. טסתי אז בטאוור אייר זצ"ל והמטוס היה חייב לנחות בבנגור כדי לתדלק, בעיקר משום שהיעד הסופי היה סן פרנסיסקו. היו מקרים שבהם חייבו את הנוסעים לרדת ולעבור בבנגור ביקורת דרכונים ולחזור למטוס. אבל רוב הזמן ישבנו על המסלול עם דלת פתוחה מוקפים בשורות של מטוסי קרב.<br/>ארווין קרויץ מתואר כגרמני חביב וידידותי (באף מקום לא כינו אותו בוק), עובד במבשלת בירה (17 שנה) בבוואריה, שמעולם לא עזב את גרמניה חוץ מגיחה קצרה לשווייץ. הוא חסך את כספו לביקור שאמור היה להיות פסגת חייו ומאווייו בסן פרנסיסקו. באוקטובר 1977 עלה קרויץ על טיסת צ'רטר מפרנקפורט לסן פרנסיסקו. בעיני רוחו ראה עצמו לוגם בירה מאגרטלים גדולים בגרסה האמריקאית לאוקטוברפסט. ניסיונות לחקור אודותיו ממרחק השנים העלו כי השתתף במלחמת העולם השנייה מצד הרעים, אך אין תיעוד לאיזו יחידה היה שייך והיכן לחם.</p>
  </body>
</html>`;

  it('should group headings with following paragraphs correctly', async () => {
    // Test chapter 1
    const chapter1 = {
      title: 'מבוא',
      href: 'chapter1.xhtml',
      content: chapter1Html,
    };

    const pages1 = await processor.paginateChapter(chapter1, 0, 1);
    
    expect(pages1).toHaveLength(1);
    expect(pages1[0].content).toContain('מבוא');
    expect(pages1[0].content).toContain('רילוקיישן');
    expect(pages1[0].content).toContain('פרולוג');
    
    // Verify the heading is included in the paragraph content
    expect(pages1[0].content).toContain('מבוא');
    expect(pages1[0].content).toContain('רילוקיישן');

    // Test chapter 2
    const chapter2 = {
      title: 'שער ראשון: מקום אחר',
      href: 'chapter2.xhtml',
      content: chapter2Html,
    };

    const pages2 = await processor.paginateChapter(chapter2, 1000, 2);
    
    expect(pages2).toHaveLength(1);
    expect(pages2[0].content).toContain('שער ראשון: מקום אחר');
    expect(pages2[0].content).toContain('ארווין קרויץ');
    expect(pages2[0].content).toContain('תענית שתיקה');
    
    // Verify the heading is included in the paragraph content
    expect(pages2[0].content).toContain('שער ראשון: מקום אחר');
    expect(pages2[0].content).toContain('ארווין קרויץ');

    // Test problematic chapter
    const problematicChapter = {
      title: 'שער ראשון',
      href: 'problematic-chapter.xhtml',
      content: problematicChapterHtml,
    };

    // Use a processor with larger target page size for the large content
    const largePageProcessor = new EPUBProcessor('/fake/path/test.epub', {
      targetPageSize: 5000, // Large enough to contain the entire content
    });
    
    const problematicPages = await largePageProcessor.paginateChapter(problematicChapter, 2000, 3);
    
    expect(problematicPages).toHaveLength(1);
    expect(problematicPages[0].content).toContain('שער ראשון');
    expect(problematicPages[0].content).toContain('מקום אחר');
    expect(problematicPages[0].content).toContain('ארווין קרויץ');
    expect(problematicPages[0].content).toContain('בנגור');
    expect(problematicPages[0].content).toContain('פנינת הצפון');
    expect(problematicPages[0].content).toContain('פנום פן');
    expect(problematicPages[0].content).toContain('שדות הקטל');
    expect(problematicPages[0].content).toContain('פורטלנד');
    expect(problematicPages[0].content).toContain('Food & Wine');
    expect(problematicPages[0].content).toContain('בייגל\'ס');
    expect(problematicPages[0].content).toContain('סן פרנסיסקו');
    expect(problematicPages[0].content).toContain('פרנקפורט');
    expect(problematicPages[0].content).toContain('בוואריה');
    expect(problematicPages[0].content).toContain('שווייץ');
    expect(problematicPages[0].content).toContain('אוקטוברפסט');
    expect(problematicPages[0].content).toContain('טאוור אייר');
    expect(problematicPages[0].content).toContain('עיראק');
    expect(problematicPages[0].content).toContain('אפגניסטן');
  });

  it('should handle large Hebrew HTML content as a single paragraph', async () => {
    // Create a processor with a larger target page size to handle the large content
    const largePageProcessor = new EPUBProcessor('/fake/path/test.epub', {
      targetPageSize: 5000, // Large enough to contain the entire content
    });
    
    const problematicChapter = {
      title: 'שער ראשון',
      href: 'problematic-chapter.xhtml',
      content: problematicChapterHtml,
    };

    // This test verifies that the large Hebrew content should be treated as one paragraph
    // Currently this may fail if the content is being split incorrectly
    const pages = await largePageProcessor.paginateChapter(problematicChapter, 5000, 3);
    
    // Should produce exactly one page/paragraph since it's all one continuous text
    expect(pages).toHaveLength(1);
    
    // Verify the heading is included at the beginning
    const content = pages[0].content;
    expect(content).toMatch(/^שער ראשון/);
    
    // Verify key content is present throughout the single paragraph
    expect(content).toContain('מקום אחר');
    expect(content).toContain('ארווין קרויץ, הבלדה על הגרמני המבולבל');
    expect(content).toContain('בנגור, הנמצאת מרחק שעה נסיעה מביתי');
    expect(content).toContain('פנינת הצפון');
    expect(content).toContain('מיכאיל מהכליות');
    expect(content).toContain('סן פרנסיסקו');
    expect(content).toContain('באוקטובר 1977 עלה קרויץ על טיסת צ\'רטר מפרנקפורט');
    
    // Verify the content length is substantial (this is a long paragraph)
    expect(content.length).toBeGreaterThan(3000);
    
    // Verify no artificial paragraph breaks were introduced
    // The content should flow as one continuous narrative
    const paragraphBreaks = content.split('\n\n').filter(p => p.trim().length > 0);
    expect(paragraphBreaks).toHaveLength(1);
  });

  it('should handle problematic Hebrew content with correct paragraph grouping and splitting', async () => {
    // Use a processor with larger targetPageSize to handle large Hebrew content
    const processorWithLargeChunks = new EPUBProcessor('/fake/path/test.epub', { targetPageSize: 5000 });
    
    const chapter = {
      title: 'שער ראשון',
      href: 'chapter.xhtml',
      content: problematicChapterHtml,
    };

    const pages = await processorWithLargeChunks.paginateChapter(chapter, 0, 1);
    
    // Should have at least one page
    expect(pages.length).toBeGreaterThan(0);
    
    // ISSUE 1: The heading "שער ראשון" should be grouped with following content
    const firstPage = pages[0];
    expect(firstPage.content).toContain('שער ראשון');
    expect(firstPage.content).toContain('מקום אחר');
    
    // ISSUE 2: No paragraph should exceed the configured chunk size significantly
    for (const page of pages) {
      expect(page.content.length).toBeLessThan(4000);
    }
    
    // Verify all key content is preserved across pages
    const allContent = pages.map(p => p.content).join(' ');
    expect(allContent).toContain('שער ראשון');
    expect(allContent).toContain('מקום אחר');
    expect(allContent).toContain('ארווין קרויץ, הבלדה על הגרמני המבולבל');
    expect(allContent).toContain('בנגור, הנמצאת מרחק שעה נסיעה מביתי');
    expect(allContent).toContain('פנינת הצפון');
    expect(allContent).toContain('מיכאיל מהכליות');
    expect(allContent).toContain('סן פרנסיסקו');
    expect(allContent).toContain('באוקטובר 1977 עלה קרויץ על טיסת צ\'רטר מפרנקפורט');
  });

  it('should produce exactly 2 paragraphs for the test chapters', async () => {
    // Mock the metadata to simulate a complete EPUB with these two chapters
    (processor as any).metadata = {
      title: 'Test Book',
      author: 'Test Author',
      chapters: [
        {
          title: 'מבוא',
          href: 'chapter1.xhtml',
          content: chapter1Html,
        },
        {
          title: 'שער ראשון: מקום אחר',
          href: 'chapter2.xhtml',
          content: chapter2Html,
        },
      ],
    };

    // Extract all pages
    const allPages = [];
    for (let i = 0; i < (processor as any).metadata.chapters.length; i++) {
      const chapter = (processor as any).metadata.chapters[i];
      const pages = await processor.paginateChapter(chapter, allPages.length * 1000, allPages.length + 1);
      allPages.push(...pages);
    }

    // Should produce exactly 2 paragraphs (pages)
    expect(allPages).toHaveLength(2);
    
    // First paragraph should include heading "מבוא" and its content
    expect(allPages[0].content).toContain('מבוא');
    expect(allPages[0].content).toContain('רילוקיישן');
    
    // Second paragraph should include heading "שער ראשון: מקום אחר" and its content
    expect(allPages[1].content).toContain('שער ראשון: מקום אחר');
    expect(allPages[1].content).toContain('ארווין קרויץ');
  });

  it('should extract page blocks correctly from HTML', () => {
    const $ = cheerio.load(chapter1Html);
    const pageBlocks = (processor as any).extractPageBlocks($);
    
    expect(pageBlocks).toHaveLength(2);
    
    // First block should be the heading
    const headingBlock = pageBlocks[0];
    const headingText = (processor as any).extractText(headingBlock);
    expect(headingText).toBe('מבוא');
    expect((processor as any).isHeading(headingBlock)).toBe(true);
    
    // Second block should be the paragraph
    const paragraphBlock = pageBlocks[1];
    const paragraphText = (processor as any).extractText(paragraphBlock);
    expect(paragraphText).toContain('רילוקיישן');
    expect(paragraphText).toContain('פרולוג');
    expect((processor as any).isHeading(paragraphBlock)).toBe(false);
  });

  it('should handle br tags correctly in text extraction', () => {
    const $ = cheerio.load(chapter1Html);
    const paragraphElement = $('p').first();
    const extractedText = (processor as any).extractText(paragraphElement);
    
    // br tags should be converted to spaces
    expect(extractedText).not.toContain('<br/>');
    expect(extractedText).toContain('רילוקיישן אוסף מתוך');
    expect(extractedText).toContain('מעריב 2010–2025');
  });
});
