import { PrismaClient, Prisma } from '@prisma/client';
import { EmbedBuilder } from 'discord.js';
import type { KanjiSession } from './session';
import { logger } from '../../../utils/logger';

const prisma = new PrismaClient();

export async function saveQuizStats(session: KanjiSession): Promise<void> {
  const entries = Object.entries(session.scores);
  if (entries.length === 0) return;

  try {
    // Upsert Guild si nécessaire (évite la FK violation)
    await prisma.guild.upsert({
      where: { id: session.guildId },
      update: {},
      create: { id: session.guildId, name: session.guildId },
    });

    await Promise.all(
      entries.map(([userId, correct]) =>
        prisma.kanjiStat.upsert({
          where: { guildId_userId: { guildId: session.guildId, userId } },
          update: {
            correct: { increment: correct },
            played: { increment: 1 },
          },
          create: {
            guildId: session.guildId,
            userId,
            correct,
            played: 1,
          },
        })
      )
    );
  } catch (err) {
    logger.error('Erreur sauvegarde stats kanji', { err });
  }
}

export async function buildHistoryEmbed(guildId: string): Promise<EmbedBuilder> {
  const stats = await prisma.kanjiStat.findMany({
    where: { guildId },
    orderBy: { correct: 'desc' },
    take: 10,
  });

  const medals = ['🥇', '🥈', '🥉'];
  let board = '';
  for (let i = 0; i < stats.length; i++) {
    const s = stats[i];
    const ratio = s.played > 0 ? Math.round((s.correct / (s.played * 10)) * 100) : 0;
    board +=
      `${medals[i] ?? `**${i + 1}.**`} <@${s.userId}> — **${s.correct}** bonne${s.correct > 1 ? 's' : ''} réponse${s.correct > 1 ? 's' : ''} ` +
      `sur **${s.played}** quiz\n`;
  }

  return new EmbedBuilder()
    .setColor('#f4a261')
    .setTitle('📊 Classement Kanji — Historique')
    .setDescription(board || '*Aucune partie enregistrée sur ce serveur.*')
    .setTimestamp();
}
