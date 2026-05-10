import { Router, Response } from 'express';
import { prisma } from '../../database';
import { logger } from '../../utils/logger';

export const settingsRouter = Router();

settingsRouter.get('/:guildId/settings', async (req, res: Response) => {
  const { guildId } = req.params;
  try {
    const guild = await prisma.guild.findUnique({ where: { id: guildId } });
    if (!guild) return res.status(404).json({ error: 'Serveur introuvable' });
    res.json(guild);
  } catch (error) {
    res.status(500).json({ error: 'Erreur interne' });
  }
});

settingsRouter.patch('/:guildId/settings', async (req, res: Response) => {
  const { guildId } = req.params;
  const { language, levelEnabled, levelChannelId } = req.body;

  const validLangs = ['fr', 'jp'];
  if (language && !validLangs.includes(language)) {
    return res.status(400).json({ error: 'Langue invalide (fr ou jp)' });
  }

  try {
    const updated = await prisma.guild.update({
      where: { id: guildId },
      data: {
        ...(language && { language }),
        ...(levelEnabled !== undefined && { levelEnabled }),
        ...(levelChannelId !== undefined && { levelChannelId }),
      },
    });
    res.json(updated);
  } catch (error) {
    logger.error('Erreur mise à jour settings', { error });
    res.status(500).json({ error: 'Erreur interne' });
  }
});

settingsRouter.get('/:guildId/settings/antispam', async (req, res: Response) => {
  const { guildId } = req.params;
  try {
    const config = await prisma.antiSpamConfig.findUnique({ where: { guildId } });
    res.json(config ?? { enabled: false, maxMessages: 5, timeWindow: 5, action: 'mute', muteDuration: 300 });
  } catch (error) {
    res.status(500).json({ error: 'Erreur interne' });
  }
});

settingsRouter.put('/:guildId/settings/antispam', async (req, res: Response) => {
  const { guildId } = req.params;
  const { enabled, maxMessages, timeWindow, action, muteDuration } = req.body;

  const validActions = ['warn', 'mute', 'kick', 'ban'];
  if (action && !validActions.includes(action)) {
    return res.status(400).json({ error: 'Action invalide' });
  }

  try {
    const config = await prisma.antiSpamConfig.upsert({
      where: { guildId },
      update: {
        ...(enabled !== undefined && { enabled }),
        ...(maxMessages && { maxMessages }),
        ...(timeWindow && { timeWindow }),
        ...(action && { action }),
        ...(muteDuration && { muteDuration }),
      },
      create: {
        guildId,
        enabled: enabled ?? true,
        maxMessages: maxMessages ?? 5,
        timeWindow: timeWindow ?? 5,
        action: action ?? 'mute',
        muteDuration: muteDuration ?? 300,
      },
    });
    res.json(config);
  } catch (error) {
    logger.error('Erreur mise à jour antispam', { error });
    res.status(500).json({ error: 'Erreur interne' });
  }
});

settingsRouter.get('/:guildId/settings/levels/leaderboard', async (req, res: Response) => {
  const { guildId } = req.params;
  try {
    const leaderboard = await prisma.userLevel.findMany({
      where: { guildId },
      orderBy: { xp: 'desc' },
      take: 20,
    });
    res.json(leaderboard);
  } catch (error) {
    res.status(500).json({ error: 'Erreur interne' });
  }
});
