import { GuildMember, EmbedBuilder } from 'discord.js';
import { BotEvent } from '../../types';
import { prisma, getOrCreateGuild } from '../../database';
import { logger } from '../../utils/logger';

const event: BotEvent = {
  name: 'guildMemberAdd',
  async execute(member: GuildMember) {
    try {
      const guildData = await getOrCreateGuild(member.guild.id, member.guild.name);

      if (!guildData.welcomeEnabled || !guildData.welcomeChannelId) return;

      const channel = member.guild.channels.cache.get(guildData.welcomeChannelId);
      if (!channel?.isTextBased()) return;

      const memberCount = member.guild.memberCount;

      let message = guildData.welcomeMessage ?? `Bienvenue sur **{guild}**, {user} ! 🎉`;
      message = message
        .replace(/{user}/g, `<@${member.id}>`)
        .replace(/{username}/g, member.user.username)
        .replace(/{guild}/g, member.guild.name)
        .replace(/{count}/g, memberCount.toString());

      const embedData = guildData.welcomeEmbed as Record<string, unknown> | null;

      if (embedData) {
        const embed = new EmbedBuilder()
          .setColor((embedData.color as `#${string}`) ?? '#5865F2')
          .setTitle((embedData.title as string)?.replace(/{username}/g, member.user.username) ?? `Bienvenue !`)
          .setDescription(message)
          .setThumbnail(member.user.displayAvatarURL())
          .setTimestamp();

        if (embedData.footer) {
          embed.setFooter({ text: (embedData.footer as string).replace(/{count}/g, memberCount.toString()) });
        }

        await channel.send({ embeds: [embed] });
      } else {
        await channel.send({ content: message });
      }

      // Message privé de bienvenue
      if (guildData.welcomeDmEnabled && guildData.welcomeDmMessage) {
        let dm = guildData.welcomeDmMessage
          .replace(/{user}/g, member.user.username)
          .replace(/{guild}/g, member.guild.name);

        await member.user.send(dm).catch(() => null);
      }

      // Enregistrement XP si niveau activé
      if (guildData.levelEnabled) {
        await prisma.userLevel.upsert({
          where: { guildId_userId: { guildId: member.guild.id, userId: member.id } },
          update: {},
          create: { guildId: member.guild.id, userId: member.id },
        });
      }

      logger.info('Bienvenue envoyé', { guildId: member.guild.id, userId: member.id });
    } catch (error) {
      logger.error('Erreur événement guildMemberAdd', { error });
    }
  },
};

export default event;
