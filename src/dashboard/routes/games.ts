import { Router, Response } from 'express';
import { prisma } from '../../database';
import type { JpStorySession, ShiritoriSession } from '../../types';

export const gamesRouter = Router();

gamesRouter.get('/:guildId/games/stats', async (req, res: Response) => {
  const { guildId } = req.params;

  try {
    const [shiritoriSessions, storySessions] = await Promise.all([
      prisma.gameSession.findMany({ where: { guildId, type: 'SHIRITORI' }, orderBy: { createdAt: 'desc' }, take: 20 }),
      prisma.gameSession.findMany({ where: { guildId, type: 'JP_STORY' }, orderBy: { createdAt: 'desc' }, take: 20 }),
    ]);

    // Calcul classements Shiritori
    const shiritoriScores: Record<string, number> = {};
    for (const s of shiritoriSessions) {
      const data = s.data as unknown as ShiritoriSession;
      for (const [userId, score] of Object.entries(data.scores ?? {})) {
        shiritoriScores[userId] = (shiritoriScores[userId] ?? 0) + score;
      }
    }

    // Calcul classements jp-story
    const storyScores: Record<string, number> = {};
    for (const s of storySessions) {
      const data = s.data as unknown as JpStorySession;
      for (const entry of data.story ?? []) {
        if (entry.userId === 'bot') continue;
        storyScores[entry.userId] = (storyScores[entry.userId] ?? 0) + entry.score;
      }
    }

    res.json({
      shiritori: {
        totalSessions: shiritoriSessions.length,
        leaderboard: Object.entries(shiritoriScores)
          .sort(([, a], [, b]) => b - a)
          .slice(0, 10)
          .map(([userId, score]) => ({ userId, score })),
      },
      jpStory: {
        totalSessions: storySessions.length,
        leaderboard: Object.entries(storyScores)
          .sort(([, a], [, b]) => b - a)
          .slice(0, 10)
          .map(([userId, score]) => ({ userId, score })),
      },
    });
  } catch (error) {
    res.status(500).json({ error: 'Erreur interne' });
  }
});
