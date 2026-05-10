import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  PermissionFlagsBits,
  GuildMember,
} from 'discord.js';
import { SlashCommand } from '../../../types';
import { prisma, getOrCreateGuild } from '../../../database';
import { isModerator } from '../../../utils/permissions';
import { moderationEmbed, errorEmbed } from '../../../utils/embed';
import { t, Lang } from '../../../utils/i18n';
import { logger } from '../../../utils/logger';

const command: SlashCommand = {
  data: new SlashCommandBuilder()
    .setName('unmute')
    .setDescription('Retirer le mute d\'un membre')
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
    .addUserOption((o) =>
      o.setName('membre').setDescription('Le membre à démuter').setRequired(true)
    )
    .addStringOption((o) =>
      o.setName('raison').setDescription('Raison').setRequired(false)
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
    const reason = interaction.options.getString('raison') ?? 'Aucune raison';
    const target = await guild.members.fetch(targetUser.id).catch(() => null);

    if (!target) {
      await interaction.editReply({
        embeds: [errorEmbed('Introuvable', t('mod.user_not_found', lang))],
      });
      return;
    }

    if (!target.isCommunicationDisabled()) {
      await interaction.editReply({
        embeds: [errorEmbed('Erreur', 'Ce membre n\'est pas en sourdine.')],
      });
      return;
    }

    try {
      await target.timeout(null, `${moderator.user.tag}: ${reason}`);

      await prisma.sanction.updateMany({
        where: { guildId: guild.id, userId: targetUser.id, type: 'MUTE', active: true },
        data: { active: false },
      });

      const embed = moderationEmbed('Unmute', [
        { name: 'Membre', value: `${targetUser.tag} (${targetUser.id})`, inline: true },
        { name: 'Modérateur', value: moderator.user.tag, inline: true },
        { name: 'Raison', value: reason },
      ]);

      await interaction.editReply({ embeds: [embed] });

      if (guildData.modLogChannelId) {
        const logChannel = guild.channels.cache.get(guildData.modLogChannelId);
        if (logChannel?.isTextBased()) await logChannel.send({ embeds: [embed] });
      }

      logger.info('Unmute exécuté', { guildId: guild.id, userId: targetUser.id });
    } catch (error) {
      logger.error('Erreur lors du unmute', { error });
      await interaction.editReply({ embeds: [errorEmbed('Erreur', t('error.generic', lang))] });
    }
  },
};

export default command;
