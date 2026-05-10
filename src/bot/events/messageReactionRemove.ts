import { MessageReaction, User, PartialMessageReaction, PartialUser } from 'discord.js';
import { BotEvent } from '../../types';
import { prisma } from '../../database';
import { logger } from '../../utils/logger';

const event: BotEvent = {
  name: 'messageReactionRemove',
  async execute(reaction: MessageReaction | PartialMessageReaction, user: User | PartialUser) {
    try {
      if (user.bot) return;
      if (reaction.partial) await reaction.fetch();
      if (user.partial) await user.fetch();
      if (!reaction.message.guild) return;

      const guild = reaction.message.guild;
      const member = await guild.members.fetch(user.id).catch(() => null);
      if (!member) return;

      const emojiIdentifier = reaction.emoji.id
        ? `<:${reaction.emoji.name}:${reaction.emoji.id}>`
        : reaction.emoji.name ?? '';

      // Retrait du rôle règlement
      const ruleMsg = await prisma.ruleMessage.findFirst({
        where: { guildId: guild.id, messageId: reaction.message.id, emoji: emojiIdentifier, active: true },
      });

      if (ruleMsg) {
        const role = guild.roles.cache.get(ruleMsg.roleId);
        if (role && member.roles.cache.has(role.id)) {
          await member.roles.remove(role, 'Règlement retiré').catch(() => null);
          logger.info('Rôle règlement retiré', { guildId: guild.id, userId: user.id });
        }
        return;
      }

      // Retrait rôle par réaction
      const roleReaction = await prisma.roleReaction.findFirst({
        where: { guildId: guild.id, messageId: reaction.message.id, emoji: emojiIdentifier },
      });

      if (roleReaction) {
        const role = guild.roles.cache.get(roleReaction.roleId);
        if (role && member.roles.cache.has(role.id)) {
          await member.roles.remove(role, 'Rôle par réaction retiré').catch(() => null);
          logger.info('Rôle par réaction retiré', { guildId: guild.id, userId: user.id });
        }
      }
    } catch (error) {
      logger.error('Erreur messageReactionRemove', { error });
    }
  },
};

export default event;
