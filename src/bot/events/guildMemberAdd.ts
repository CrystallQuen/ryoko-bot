import { GuildMember } from 'discord.js';
import { BotEvent } from '../../types';
import { prisma, getOrCreateGuild } from '../../database';
import { logger } from '../../utils/logger';

const MEMBRE_ROLE_ID = '1394696937713831997';

const event: BotEvent = {
  name: 'guildMemberAdd',
  async execute(member: GuildMember) {
    try {
      await getOrCreateGuild(member.guild.id, member.guild.name);

      // Attribution automatique du rôle Membre → déclenche guildMemberUpdate → carte de bienvenue
      // On utilise fetch pour être sûr que le rôle est disponible même si le cache est vide
      const membreRole =
        member.guild.roles.cache.get(MEMBRE_ROLE_ID) ??
        await member.guild.roles.fetch(MEMBRE_ROLE_ID).catch(() => null);

      if (membreRole) {
        await member.roles.add(membreRole, 'Attribution automatique à l\'arrivée');
        logger.info('Rôle Membre attribué', { guildId: member.guild.id, userId: member.id });
      } else {
        logger.warn('Rôle Membre introuvable', { guildId: member.guild.id, roleId: MEMBRE_ROLE_ID });
      }

      // Crée ou réinitialise l'entrée — welcomeSentAt à null pour que le welcome
      // se déclenche correctement, même si la personne avait déjà rejoint par le passé
      await prisma.userLevel.upsert({
        where: { guildId_userId: { guildId: member.guild.id, userId: member.id } },
        update: { welcomeSentAt: null },
        create: { guildId: member.guild.id, userId: member.id },
      });
    } catch (error) {
      logger.error('Erreur événement guildMemberAdd', { error });
    }
  },
};

export default event;
