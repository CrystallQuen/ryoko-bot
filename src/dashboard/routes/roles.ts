import { Router, Response } from 'express';
import { prisma } from '../../database';
import { logger } from '../../utils/logger';

export const rolesRouter = Router();

// Liste des panneaux de rôles par réaction
rolesRouter.get('/:guildId/roles/reactions', async (req, res: Response) => {
  const { guildId } = req.params;
  try {
    const reactions = await prisma.roleReaction.findMany({
      where: { guildId },
      orderBy: { createdAt: 'desc' },
    });
    res.json(reactions);
  } catch (error) {
    res.status(500).json({ error: 'Erreur interne' });
  }
});

// Créer un rôle par réaction
rolesRouter.post('/:guildId/roles/reactions', async (req, res: Response) => {
  const { guildId } = req.params;
  const { channelId, messageId, emoji, roleId, category, description } = req.body;

  if (!channelId || !messageId || !emoji || !roleId) {
    return res.status(400).json({ error: 'Champs manquants' });
  }

  try {
    const reaction = await prisma.roleReaction.create({
      data: { guildId, channelId, messageId, emoji, roleId, category, description },
    });
    res.status(201).json(reaction);
  } catch (error: unknown) {
    if ((error as { code?: string }).code === 'P2002') {
      return res.status(409).json({ error: 'Cette combinaison message/emoji existe déjà' });
    }
    logger.error('Erreur création rôle réaction', { error });
    res.status(500).json({ error: 'Erreur interne' });
  }
});

// Supprimer un rôle par réaction
rolesRouter.delete('/:guildId/roles/reactions/:id', async (req, res: Response) => {
  const { guildId, id } = req.params;
  try {
    await prisma.roleReaction.deleteMany({ where: { id, guildId } });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Erreur interne' });
  }
});

// Règlement
rolesRouter.get('/:guildId/roles/rules', async (req, res: Response) => {
  const { guildId } = req.params;
  try {
    const rules = await prisma.ruleMessage.findMany({ where: { guildId } });
    res.json(rules);
  } catch (error) {
    res.status(500).json({ error: 'Erreur interne' });
  }
});

rolesRouter.post('/:guildId/roles/rules', async (req, res: Response) => {
  const { guildId } = req.params;
  const { messageId, channelId, roleId, emoji } = req.body;

  if (!messageId || !channelId || !roleId || !emoji) {
    return res.status(400).json({ error: 'Champs manquants' });
  }

  try {
    await prisma.ruleMessage.updateMany({ where: { guildId }, data: { active: false } });
    const rule = await prisma.ruleMessage.create({
      data: { guildId, messageId, channelId, roleId, emoji },
    });
    res.status(201).json(rule);
  } catch (error) {
    logger.error('Erreur création règlement', { error });
    res.status(500).json({ error: 'Erreur interne' });
  }
});
