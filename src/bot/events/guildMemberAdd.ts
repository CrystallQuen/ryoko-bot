import { GuildMember, EmbedBuilder, AttachmentBuilder } from 'discord.js';
import { BotEvent } from '../../types';
import { prisma, getOrCreateGuild } from '../../database';
import { logger } from '../../utils/logger';
import { generateWelcomeCard } from '../modules/welcome/welcomeCard';

const MEMBRE_ROLE_ID = '1394696937713831997';

const event: BotEvent = {
  name: 'guildMemberAdd',
  async execute(member: GuildMember) {
    try {
      const guildData = await getOrCreateGuild(member.guild.id, member.guild.name);

      // Créer la ligne DB en premier (avant roles.add)
      await prisma.userLevel.upsert({
        where: { guildId_userId: { guildId: member.guild.id, userId: member.id } },
        update: {},
        create: { guildId: member.guild.id, userId: member.id },
      });

      // Attribution automatique du rôle Membre
      const membreRole =
        member.guild.roles.cache.get(MEMBRE_ROLE_ID) ??
        await member.guild.roles.fetch(MEMBRE_ROLE_ID).catch(() => null);

      if (membreRole) {
        await member.roles.add(membreRole, 'Attribution automatique à l\'arrivée');
        logger.info('Rôle Membre attribué', { guildId: member.guild.id, userId: member.id });
      } else {
        logger.warn('Rôle Membre introuvable', { guildId: member.guild.id, roleId: MEMBRE_ROLE_ID });
      }

      // ── Message de bienvenue ─────────────────────────────────────────────
      if (!guildData.welcomeEnabled || !guildData.welcomeChannelId) return;

      const channel = member.guild.channels.cache.get(guildData.welcomeChannelId);
      if (!channel?.isTextBased()) return;

      const memberCount = member.guild.memberCount;
      const displayName = member.displayName || member.user.username;

      let message = guildData.welcomeMessage ?? `🌸 ようこそ！sur le serveur **{guild}** ! ✨`;
      message = message
        .replace(/{user}/g, `@${displayName}`)
        .replace(/<@user>/g, `@${displayName}`)
        .replace(/{username}/g, member.user.username)
        .replace(/{guild}/g, member.guild.name)
        .replace(/{count}/g, memberCount.toString());

      const mention = `<@${member.id}>`;
      const embedData = guildData.welcomeEmbed as Record<string, unknown> | null;
      const accentColor: string = (embedData?.color as string) ?? '#f25858';

      let cardAttachment: AttachmentBuilder | null = null;
      try {
        const cardBuffer = await generateWelcomeCard({
          username: member.user.username,
          displayName: member.displayName,
          avatarUrl: member.user.displayAvatarURL({ extension: 'png' }),
          guildName: member.guild.name,
          memberCount,
          backgroundUrl: guildData.welcomeImageUrl ?? null,
          accentColor,
        });
        cardAttachment = new AttachmentBuilder(cardBuffer, { name: 'welcome.png' });
      } catch (cardError) {
        logger.warn('Impossible de générer la carte de bienvenue', { error: cardError });
      }

      if (embedData) {
        const embed = new EmbedBuilder()
          .setColor((accentColor as `#${string}`) ?? '#f25858')
          .setTitle(
            (embedData.title as string)?.replace(/{username}/g, member.user.username) ?? 'Bienvenue !'
          )
          .setDescription(message)
          .setTimestamp();

        if (cardAttachment) {
          embed.setImage('attachment://welcome.png');
        } else {
          embed.setThumbnail(member.user.displayAvatarURL());
        }

        if (embedData.footer) {
          embed.setFooter({
            text: (embedData.footer as string).replace(/{count}/g, memberCount.toString()),
          });
        }

        await channel.send({
          content: mention,
          embeds: [embed],
          ...(cardAttachment ? { files: [cardAttachment] } : {}),
        });
      } else {
        await channel.send({
          content: `${mention}\n${message}`,
          ...(cardAttachment ? { files: [cardAttachment] } : {}),
        });
      }

      if (guildData.welcomeDmEnabled && guildData.welcomeDmMessage) {
        const dm = guildData.welcomeDmMessage
          .replace(/{user}/g, member.user.username)
          .replace(/{guild}/g, member.guild.name);
        await member.user.send(dm).catch(() => null);
      }

      logger.info('Bienvenue envoyée', { guildId: member.guild.id, userId: member.id });
    } catch (error) {
      logger.error('Erreur événement guildMemberAdd', { error });
    }
  },
};

export default event;
