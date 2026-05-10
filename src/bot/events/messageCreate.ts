import { Message } from 'discord.js';
import { BotEvent } from '../../types';
import { prisma, getOrCreateGuild } from '../../database';
import { logger } from '../../utils/logger';
import { checkAntiSpam } from '../modules/antispam';
import { handleXp } from '../modules/levels';

const event: BotEvent = {
  name: 'messageCreate',
  async execute(message: Message) {
    if (message.author.bot || !message.guild) return;

    try {
      const guildData = await getOrCreateGuild(message.guild.id, message.guild.name);

      // Anti-spam
      const spamConfig = await prisma.antiSpamConfig.findUnique({
        where: { guildId: message.guild.id },
      });

      if (spamConfig?.enabled) {
        await checkAntiSpam(message, spamConfig);
      }

      // Système de niveaux XP
      if (guildData.levelEnabled) {
        await handleXp(message, guildData);
      }
    } catch (error) {
      logger.error('Erreur messageCreate', { error });
    }
  },
};

export default event;
