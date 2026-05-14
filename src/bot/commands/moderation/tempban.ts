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
import { parseDuration, formatDuration, addSeconds } from '../../../utils/duration';
import { logger } from '../../../utils/logger';

const command: SlashCommand = {
  data: new SlashCommandBuilder()
    .setName('tempban')
    .setDescription('Bannir temporairement un membre')
    .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers)
    .addUserOption((o) =>
      o.setName('membre').setDescription('Le membre à bannir').setRequired(true)
    )
    .addStringOption((o) =>
      o.setName('durée').setDescription('Durée (ex: 1h, 2d, 30m)').setRequired(true)
    )
    .addStringOption((o) =>
      o.setName('raison').setDescription('Raison du ban').setRequired(true)
    ),

  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    await interaction.deferReply({ flags: 'Ephemeral' });

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
    const durationStr = interaction.options.getString('durée', true);
    const reason = interaction.options.getString('raison', true);

    const durationSecs = parseDuration(durationStr);
    if (!durationSecs || durationSecs < 60) {
      await interaction.editReply({
        embeds: [errorEmbed('Durée invalide', 'Utilisez un format comme : 30m, 2h, 1d')],
      });
      return;
    }

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

      await targetUser
        .send({
          embeds: [
            errorEmbed(
              'Ban temporaire',
              t('mod.tempban.success', lang, {
                user: targetUser.tag,
                duration: formatDuration(durationSecs, lang),
                reason,
              })
            ),
          ],
        })
        .catch(() => null);
    }

    try {
      await guild.bans.create(targetUser.id, {
        reason: `[TEMPBAN ${formatDuration(durationSecs)}] ${moderator.user.tag}: ${reason}`,
      });

      const expiresAt = addSeconds(new Date(), durationSecs);

      await prisma.sanction.create({
        data: {
          guildId: guild.id,
          userId: targetUser.id,
          moderatorId: moderator.id,
          type: 'TEMPBAN',
          reason,
          duration: durationSecs,
          active: true,
          expiresAt,
        },
      });

      const formatted = formatDuration(durationSecs, lang);
      const embed = moderationEmbed('Ban Temporaire', [
        { name: 'Membre', value: `${targetUser.tag} (${targetUser.id})`, inline: true },
        { name: 'Modérateur', value: moderator.user.tag, inline: true },
        { name: 'Durée', value: formatted, inline: true },
        { name: 'Expire le', value: `<t:${Math.floor(expiresAt.getTime() / 1000)}:F>`, inline: true },
        { name: 'Raison', value: reason },
      ]);

      await interaction.editReply({ embeds: [embed] });

      if (guildData.modLogChannelId) {
        const logChannel = guild.channels.cache.get(guildData.modLogChannelId);
        if (logChannel?.isTextBased()) await logChannel.send({ embeds: [embed] });
      }

      logger.info('TempBan exécuté', { guildId: guild.id, userId: targetUser.id, duration: durationSecs });
    } catch (error) {
      logger.error('Erreur lors du tempban', { error });
      await interaction.editReply({ embeds: [errorEmbed('Erreur', t('error.generic', lang))] });
    }
  },
};

export default command;
