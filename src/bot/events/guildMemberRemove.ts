import { GuildMember, PartialGuildMember } from 'discord.js';
import { BotEvent } from '../../types';
import { prisma } from '../../database';
import { logger } from '../../utils/logger';

const event: BotEvent = {
  name: 'guildMemberRemove',
  async execute(member: GuildMember | PartialGuildMember) {
    try {
      // Réinitialise welcomeSentAt pour que la carte de bienvenue se déclenche
      // correctement si la personne rejoint à nouveau
      await prisma.userLevel.updateMany({
        where: { guildId: member.guild.id, userId: member.id },
        data: { welcomeSentAt: null },
      });

      logger.info('Membre parti — welcomeSentAt réinitialisé', {
        guildId: member.guild.id,
        userId: member.id,
      });
    } catch (error) {
      logger.error('Erreur événement guildMemberRemove', { error });
    }
  },
};

export default event;
