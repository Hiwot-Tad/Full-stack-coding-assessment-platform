import { PrismaClient } from '@prisma/client';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Fallback to direct URL only for local dev convenience. Prefer setting env.
const databaseUrl = process.env.DATABASE_URL || undefined;
if (!databaseUrl) {
  throw new Error('Server misconfiguration: DATABASE_URL not set');
}

export const prisma = new PrismaClient({
  datasources: {
    db: {
      url: databaseUrl
    }
  }
});
