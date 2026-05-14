import { EmbedBuilder } from 'discord.js';
import { prisma, getOrCreateGuild } from '../../../database';
import type { KanjiSession } from './session';
import { logger } from '../../../utils/logger';

export async function saveQuizStats(session: KanjiSession): Promise<void> {
  const entries = Object.entries(session.scores);
  logger.info('saveQuizStats appelé', { guildId: session.guildId, entries });
  if (entries.length === 0) {
    logger.info('saveQuizStats: aucun score, abandon');
    return;
  }

  try {
    await getOrCreateGuild(session.guildId, session.guildId);

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
    logger.info('saveQuizStats: sauvegarde réussie', { guildId: session.guildId, entries });
  } catch (err) {
    logger.error('Erreur sauvegarde stats kanji', { err, guildId: session.guildId });
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
