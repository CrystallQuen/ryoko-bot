import { GuildMember, PartialGuildMember } from 'discord.js';
import { BotEvent } from '../../types';
import { logger } from '../../utils/logger';

const event: BotEvent = {
  name: 'guildMemberUpdate',
  async execute(_oldMember: GuildMember | PartialGuildMember, _newMember: GuildMember) {
    // La logique de bienvenue est gérée directement dans guildMemberAdd.
    logger.debug('guildMemberUpdate reçu', { userId: _newMember.id });
  },
};

export default event;
