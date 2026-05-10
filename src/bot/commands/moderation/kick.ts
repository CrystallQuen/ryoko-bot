import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  PermissionFlagsBits,
  GuildMember,
} from 'discord.js';
import { SlashCommand } from '../../../types';
import { prisma, getOrCreateGuild } from '../../../database';
import { isModerator, canModerate, botCanModerate } from '../../../utils/permissions';
import { moderationEmbed, errorEmbed } from '../../../utils/embed';
import { t, Lang } from '../../../utils/i18n';
import { logger } from '../../../utils/logger';

const command: SlashCommand = {
  data: new SlashCommandBuilder()
    .setName('kick')
    .setDescription('Expulser un membre du serveur')
    .setDefaultMemberPermissions(PermissionFlagsBits.KickMembers)
    .addUserOption((o) =>
      o.setName('membre').setDescription('Le membre à expulser').setRequired(true)
    )
    .addStringOption((o) =>
      o.setName('raison').setDescription('Raison de l\'expulsion').setRequired(true)
    ),

  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    await interaction.deferReply({ ephemeral: true });

    const guild = interaction.guild!;
    const moderator = interaction.member as GuildMember;
    const guildData = await getOrCreateGuild(guild.id, guild.name);
    const lang = (guildData.language as Lang) ?? 'fr';

    if (!isModerator(moderator)) {
      await interaction.editReply({
        embeds: [errorEmbed('Permission refusée', t('mod.no_permission', lang))],
      });
      return;
    }

    const targetUser = interaction.options.getUser('membre', true);
    const reason = interaction.options.getString('raison', true);
    const target = await guild.members.fetch(targetUser.id).catch(() => null);

    if (!target) {
      await interaction.editReply({
        embeds: [errorEmbed('Introuvable', t('mod.user_not_found', lang))],
      });
      return;
    }

    if (!canModerate(moderator, target)) {
      await interaction.editReply({
        embeds: [errorEmbed('Permission refusée', t('mod.higher_role', lang))],
      });
      return;
    }

    if (!botCanModerate(target)) {
      await interaction.editReply({
        embeds: [errorEmbed('Permissions insuffisantes', t('error.bot_missing_perms', lang))],
      });
      return;
    }

    try {
      await targetUser.send({
        embeds: [errorEmbed('Expulsion', `Vous avez été expulsé de **${guild.name}**. Raison : ${reason}`)],
      }).catch(() => null);

      await target.kick(`${moderator.user.tag}: ${reason}`);

      await prisma.sanction.create({
        data: {
          guildId: guild.id,
          userId: targetUser.id,
          moderatorId: moderator.id,
          type: 'KICK',
          reason,
          active: false,
        },
      });

      const embed = moderationEmbed('Expulsion', [
        { name: 'Membre', value: `${targetUser.tag} (${targetUser.id})`, inline: true },
        { name: 'Modérateur', value: moderator.user.tag, inline: true },
        { name: 'Raison', value: reason },
      ]);

      await interaction.editReply({ embeds: [embed] });

      if (guildData.modLogChannelId) {
        const logChannel = guild.channels.cache.get(guildData.modLogChannelId);
        if (logChannel?.isTextBased()) await logChannel.send({ embeds: [embed] });
      }

      logger.info('Kick exécuté', { guildId: guild.id, userId: targetUser.id });
    } catch (error) {
      logger.error('Erreur lors du kick', { error });
      await interaction.editReply({ embeds: [errorEmbed('Erreur', t('error.generic', lang))] });
    }
  },
};

export default command;
