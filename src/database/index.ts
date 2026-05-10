import { PrismaClient } from '@prisma/client';
import { logger } from '../utils/logger';

declare global {
  // eslint-disable-next-line no-var
  var __prisma: PrismaClient | undefined;
}

// Singleton Prisma pour éviter les connexions multiples en dev
export const prisma = globalThis.__prisma ?? new PrismaClient({
  log: process.env.NODE_ENV === 'development'
    ? [{ emit: 'event', level: 'query' }, 'error', 'warn']
    : ['error'],
});

if (process.env.NODE_ENV === 'development') {
  globalThis.__prisma = prisma;
}

export async function connectDatabase(): Promise<void> {
  try {
    await prisma.$connect();
    logger.info('✅ Connecté à la base de données PostgreSQL');
  } catch (error) {
    logger.error('❌ Erreur de connexion à la base de données', { error });
    process.exit(1);
  }
}

export async function getOrCreateGuild(guildId: string, guildName: string) {
  return prisma.guild.upsert({
    where: { id: guildId },
    update: { name: guildName },
    create: { id: guildId, name: guildName },
  });
}

export default prisma;
