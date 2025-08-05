#!/usr/bin/env tsx

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function runSql() {
  const sql = process.argv[2];
  
  if (!sql) {
    console.error('Usage: tsx run-sql.ts "SQL_QUERY"');
    process.exit(1);
  }

  try {
    console.log(`Executing: ${sql}`);
    console.log('---');
    
    // Use $queryRawUnsafe for SELECT queries, $executeRawUnsafe for other operations
    if (sql.trim().toUpperCase().startsWith('SELECT')) {
      const result = await prisma.$queryRawUnsafe(sql) as any[];
      console.log('Results:');
      console.table(result);
      console.log(`\nReturned ${result.length} row(s)`);
    } else {
      const result = await prisma.$executeRawUnsafe(sql);
      console.log(`Operation completed. Affected rows: ${result}`);
    }
  } catch (error) {
    console.error('Error executing SQL:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

runSql();
