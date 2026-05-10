import { GuildMember } from 'discord.js';
import { BotEvent } from '../../types';
import { prisma, getOrCreateGuild } from '../../database';
import { logger } from '../../utils/logger';

const event: BotEvent = {
  name: 'guildMemberAdd',
  async execute(member: GuildMember) {
    try {
      const guildData = await getOrCreateGuild(member.guild.id, member.guild.name);

      // Le panneau de bienvenue est envoyé dans guildMemberUpdate
      // lorsque le rôle "Membre" est attribué.

      // Enregistrement XP si niveau activé
      if (guildData.levelEnabled) {
        await prisma.userLevel.upsert({
          where: { guildId_userId: { guildId: member.guild.id, userId: member.id } },
          update: {},
          create: { guildId: member.guild.id, userId: member.id },
        });
      }

      logger.info('Nouveau membre enregistré', { guildId: member.guild.id, userId: member.id });
    } catch (error) {
      logger.error('Erreur événement guildMemberAdd', { error });
    }
  },
};

export default event;
