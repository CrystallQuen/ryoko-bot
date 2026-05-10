import { Router, Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import { prisma } from '../../database';
import { logger } from '../../utils/logger';

export const moderationRouter = Router();

// Historique des sanctions
moderationRouter.get('/:guildId/moderation/sanctions', async (req, res: Response) => {
  const { guildId } = req.params;
  const page = parseInt(req.query.page as string) || 1;
  const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);
  const skip = (page - 1) * limit;

  try {
    const [sanctions, total] = await Promise.all([
      prisma.sanction.findMany({
        where: { guildId },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.sanction.count({ where: { guildId } }),
    ]);

    res.json({ sanctions, total, page, pages: Math.ceil(total / limit) });
  } catch (error) {
    logger.error('Erreur GET sanctions', { error });
    res.status(500).json({ error: 'Erreur interne' });
  }
});

// Détail d'une sanction
moderationRouter.get('/:guildId/moderation/sanctions/:id', async (req, res: Response) => {
  const { guildId, id } = req.params;
  try {
    const sanction = await prisma.sanction.findFirst({ where: { id, guildId } });
    if (!sanction) return res.status(404).json({ error: 'Sanction introuvable' });
    res.json(sanction);
  } catch (error) {
    res.status(500).json({ error: 'Erreur interne' });
  }
});

// Retirer une sanction (révocation)
moderationRouter.patch('/:guildId/moderation/sanctions/:id/revoke', async (req, res: Response) => {
  const { guildId, id } = req.params;
  try {
    const sanction = await prisma.sanction.findFirst({ where: { id, guildId } });
    if (!sanction) return res.status(404).json({ error: 'Sanction introuvable' });

    await prisma.sanction.update({ where: { id }, data: { active: false } });
    res.json({ success: true });
  } catch (error) {
    logger.error('Erreur révocation sanction', { error });
    res.status(500).json({ error: 'Erreur interne' });
  }
});

// Liste des avertissements
moderationRouter.get('/:guildId/moderation/warnings', async (req, res: Response) => {
  const { guildId } = req.params;
  const { userId } = req.query;

  try {
    const where = { guildId, ...(userId ? { userId: userId as string } : {}) };
    const warnings = await prisma.warning.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
    res.json(warnings);
  } catch (error) {
    res.status(500).json({ error: 'Erreur interne' });
  }
});

// Configurer le salon de logs
moderationRouter.patch('/:guildId/moderation/config', async (req, res: Response) => {
  const { guildId } = req.params;
  const { modLogChannelId, muteRoleId } = req.body;

  try {
    await prisma.guild.update({
      where: { id: guildId },
      data: {
        ...(modLogChannelId !== undefined && { modLogChannelId }),
        ...(muteRoleId !== undefined && { muteRoleId }),
      },
    });
    res.json({ success: true });
  } catch (error) {
    logger.error('Erreur config modération', { error });
    res.status(500).json({ error: 'Erreur interne' });
  }
});
