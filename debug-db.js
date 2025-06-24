const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function main() {
  try {
    const books = await prisma.book.findMany({
      orderBy: { createdAt: 'desc' },
      take: 3,
      select: {
        id: true,
        title: true,
        chapterTitles: true,
        status: true,
        createdAt: true,
      }
    });
    
    console.log('Latest books:');
    books.forEach(book => {
      console.log(`ID: ${book.id}`);
      console.log(`Title: ${book.title}`);
      console.log(`Status: ${book.status}`);
      console.log(`Chapter Titles: ${JSON.stringify(book.chapterTitles)}`);
      console.log(`Created: ${book.createdAt}`);
      console.log('---');
    });
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

main();
