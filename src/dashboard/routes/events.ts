import { Router, Response } from 'express';
import { prisma } from '../../database';
import { logger } from '../../utils/logger';

export const eventsRouter = Router();

eventsRouter.get('/:guildId/events', async (req, res: Response) => {
  const { guildId } = req.params;
  const upcoming = req.query.upcoming === 'true';

  try {
    const events = await prisma.event.findMany({
      where: {
        guildId,
        ...(upcoming ? { scheduledAt: { gte: new Date() } } : {}),
      },
      orderBy: { scheduledAt: 'asc' },
    });
    res.json(events);
  } catch (error) {
    res.status(500).json({ error: 'Erreur interne' });
  }
});

eventsRouter.post('/:guildId/events', async (req, res: Response) => {
  const { guildId } = req.params;
  const { channelId, title, description, scheduledAt, roleId } = req.body;

  if (!channelId || !title || !scheduledAt) {
    return res.status(400).json({ error: 'Champs manquants' });
  }

  const date = new Date(scheduledAt);
  if (isNaN(date.getTime()) || date <= new Date()) {
    return res.status(400).json({ error: 'Date invalide ou passée' });
  }

  try {
    const event = await prisma.event.create({
      data: { guildId, channelId, title, description, scheduledAt: date, roleId, createdBy: 'dashboard' },
    });
    res.status(201).json(event);
  } catch (error) {
    logger.error('Erreur création événement dashboard', { error });
    res.status(500).json({ error: 'Erreur interne' });
  }
});

eventsRouter.patch('/:guildId/events/:id', async (req, res: Response) => {
  const { guildId, id } = req.params;
  const { title, description, scheduledAt, roleId } = req.body;

  try {
    const event = await prisma.event.findFirst({ where: { id, guildId } });
    if (!event) return res.status(404).json({ error: 'Événement introuvable' });

    const updated = await prisma.event.update({
      where: { id },
      data: {
        ...(title && { title }),
        ...(description !== undefined && { description }),
        ...(scheduledAt && { scheduledAt: new Date(scheduledAt) }),
        ...(roleId !== undefined && { roleId }),
      },
    });
    res.json(updated);
  } catch (error) {
    res.status(500).json({ error: 'Erreur interne' });
  }
});

eventsRouter.delete('/:guildId/events/:id', async (req, res: Response) => {
  const { guildId, id } = req.params;
  try {
    await prisma.event.deleteMany({ where: { id, guildId } });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Erreur interne' });
  }
});
