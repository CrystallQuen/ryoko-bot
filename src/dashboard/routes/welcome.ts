import { Router, Response } from 'express';
import { prisma } from '../../database';
import { logger } from '../../utils/logger';

export const welcomeRouter = Router();

welcomeRouter.get('/:guildId/welcome', async (req, res: Response) => {
  const { guildId } = req.params;
  try {
    const guild = await prisma.guild.findUnique({
      where: { id: guildId },
      select: {
        welcomeEnabled: true, welcomeChannelId: true, welcomeMessage: true,
        welcomeEmbed: true, welcomeDmEnabled: true, welcomeDmMessage: true, welcomeImageUrl: true,
      },
    });
    if (!guild) return res.status(404).json({ error: 'Serveur introuvable' });
    res.json(guild);
  } catch (error) {
    res.status(500).json({ error: 'Erreur interne' });
  }
});

welcomeRouter.patch('/:guildId/welcome', async (req, res: Response) => {
  const { guildId } = req.params;
  const {
    welcomeEnabled, welcomeChannelId, welcomeMessage,
    welcomeEmbed, welcomeDmEnabled, welcomeDmMessage, welcomeImageUrl,
  } = req.body;

  try {
    await prisma.guild.update({
      where: { id: guildId },
      data: {
        ...(welcomeEnabled !== undefined && { welcomeEnabled }),
        ...(welcomeChannelId !== undefined && { welcomeChannelId }),
        ...(welcomeMessage !== undefined && { welcomeMessage }),
        ...(welcomeEmbed !== undefined && { welcomeEmbed }),
        ...(welcomeDmEnabled !== undefined && { welcomeDmEnabled }),
        ...(welcomeDmMessage !== undefined && { welcomeDmMessage }),
        ...(welcomeImageUrl !== undefined && { welcomeImageUrl }),
      },
    });
    res.json({ success: true });
  } catch (error) {
    logger.error('Erreur mise à jour welcome', { error });
    res.status(500).json({ error: 'Erreur interne' });
  }
});
