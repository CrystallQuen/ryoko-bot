import { Guild } from 'discord.js';
import { BotEvent } from '../../types';
import { getOrCreateGuild } from '../../database';
import { logger } from '../../utils/logger';

const event: BotEvent = {
  name: 'guildCreate',
  async execute(guild: Guild) {
    try {
      await getOrCreateGuild(guild.id, guild.name);
      logger.info(`Bot ajouté au serveur : ${guild.name} (${guild.id})`);
    } catch (error) {
      logger.error('Erreur guildCreate', { error });
    }
  },
};

export default event;
