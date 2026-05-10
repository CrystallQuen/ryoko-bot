import { MessageReaction, User, PartialMessageReaction, PartialUser } from 'discord.js';
import { BotEvent } from '../../types';
import { prisma } from '../../database';
import { logger } from '../../utils/logger';

const event: BotEvent = {
  name: 'messageReactionAdd',
  async execute(reaction: MessageReaction | PartialMessageReaction, user: User | PartialUser) {
    try {
      if (user.bot) return;

      // Fetch si partiel
      if (reaction.partial) await reaction.fetch();
      if (user.partial) await user.fetch();
      if (!reaction.message.guild) return;

      const guild = reaction.message.guild;
      const member = await guild.members.fetch(user.id).catch(() => null);
      if (!member) return;

      const emojiIdentifier = reaction.emoji.id
        ? `<:${reaction.emoji.name}:${reaction.emoji.id}>`
        : reaction.emoji.name ?? '';

      // Règlement
      const ruleMsg = await prisma.ruleMessage.findFirst({
        where: {
          guildId: guild.id,
          messageId: reaction.message.id,
          emoji: emojiIdentifier,
          active: true,
        },
      });

      if (ruleMsg) {
        const role = guild.roles.cache.get(ruleMsg.roleId);
        if (role && !member.roles.cache.has(role.id)) {
          await member.roles.add(role, 'Règlement accepté').catch(() => null);
          logger.info('Rôle règlement attribué', { guildId: guild.id, userId: user.id, roleId: role.id });
        }
        return;
      }

      // Rôles par réaction
      const roleReaction = await prisma.roleReaction.findFirst({
        where: {
          guildId: guild.id,
          messageId: reaction.message.id,
          emoji: emojiIdentifier,
        },
      });

      if (roleReaction) {
        const role = guild.roles.cache.get(roleReaction.roleId);
        if (role && !member.roles.cache.has(role.id)) {
          await member.roles.add(role, 'Rôle par réaction').catch(() => null);
          logger.info('Rôle par réaction attribué', { guildId: guild.id, userId: user.id, roleId: role.id });
        }
      }
    } catch (error) {
      logger.error('Erreur messageReactionAdd', { error });
    }
  },
};

export default event;
