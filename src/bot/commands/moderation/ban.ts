import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  PermissionFlagsBits,
  GuildMember,
  TextChannel,
} from 'discord.js';
import { SlashCommand } from '../../../types';
import { prisma, getOrCreateGuild } from '../../../database';
import { isModerator, canModerate, botCanModerate } from '../../../utils/permissions';
import { moderationEmbed, errorEmbed } from '../../../utils/embed';
import { t } from '../../../utils/i18n';
import { logger } from '../../../utils/logger';
import type { Lang } from '../../../utils/i18n';

const command: SlashCommand = {
  data: new SlashCommandBuilder()
    .setName('ban')
    .setDescription('Bannir définitivement un membre')
    .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers)
    .addUserOption((o) =>
      o.setName('membre').setDescription('Le membre à bannir').setRequired(true)
    )
    .addStringOption((o) =>
      o.setName('raison').setDescription('Raison du ban').setRequired(true)
    )
    .addBooleanOption((o) =>
      o.setName('silent').setDescription('Ne pas notifier le membre').setRequired(false)
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
    const silent = interaction.options.getBoolean('silent') ?? false;

    const target = await guild.members.fetch(targetUser.id).catch(() => null);

    if (target) {
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

      if (!silent) {
        await targetUser
          .send({
            embeds: [
              errorEmbed(
                'Vous avez été banni',
                t('mod.ban.dm', lang, { guild: guild.name, reason })
              ),
            ],
          })
          .catch(() => null);
      }
    }

    try {
      await guild.bans.create(targetUser.id, { reason: `${moderator.user.tag}: ${reason}`, deleteMessageSeconds: 86400 });

      await prisma.sanction.create({
        data: {
          guildId: guild.id,
          userId: targetUser.id,
          moderatorId: moderator.id,
          type: 'BAN',
          reason,
          active: true,
        },
      });

      const embed = moderationEmbed('Ban définitif', [
        { name: 'Membre', value: `${targetUser.tag} (${targetUser.id})`, inline: true },
        { name: 'Modérateur', value: `${moderator.user.tag}`, inline: true },
        { name: 'Raison', value: reason },
      ]);

      await interaction.editReply({ embeds: [embed] });

      if (guildData.modLogChannelId) {
        const logChannel = guild.channels.cache.get(guildData.modLogChannelId);
        if (logChannel?.isTextBased()) {
          await logChannel.send({ embeds: [embed] });
        }
      }

      logger.info('Ban exécuté', { guildId: guild.id, userId: targetUser.id, moderatorId: moderator.id, reason });
    } catch (error) {
      logger.error('Erreur lors du ban', { error });
      await interaction.editReply({
        embeds: [errorEmbed('Erreur', t('error.generic', lang))],
      });
    }
  },
};

export default command;
