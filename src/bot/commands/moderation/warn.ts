import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  PermissionFlagsBits,
  GuildMember,
  EmbedBuilder,
} from 'discord.js';
import { SlashCommand } from '../../../types';
import { prisma, getOrCreateGuild } from '../../../database';
import { isModerator, canModerate } from '../../../utils/permissions';
import { moderationEmbed, errorEmbed, infoEmbed } from '../../../utils/embed';
import { t, Lang } from '../../../utils/i18n';
import { logger } from '../../../utils/logger';

const command: SlashCommand = {
  data: new SlashCommandBuilder()
    .setName('warn')
    .setDescription('Gérer les avertissements')
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
    .addSubcommand((sub) =>
      sub
        .setName('add')
        .setDescription('Donner un avertissement')
        .addUserOption((o) => o.setName('membre').setDescription('Le membre').setRequired(true))
        .addStringOption((o) => o.setName('raison').setDescription('Raison').setRequired(true))
    )
    .addSubcommand((sub) =>
      sub
        .setName('list')
        .setDescription('Voir les avertissements d\'un membre')
        .addUserOption((o) => o.setName('membre').setDescription('Le membre').setRequired(true))
    )
    .addSubcommand((sub) =>
      sub
        .setName('clear')
        .setDescription('Effacer tous les avertissements d\'un membre')
        .addUserOption((o) => o.setName('membre').setDescription('Le membre').setRequired(true))
    ),

  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    await interaction.deferReply({ ephemeral: true });

    const guild = interaction.guild!;
    const moderator = interaction.member as GuildMember;
    const guildData = await getOrCreateGuild(guild.id, guild.name);
    const lang = (guildData.language as Lang) ?? 'fr';
    const sub = interaction.options.getSubcommand();

    if (!isModerator(moderator)) {
      await interaction.editReply({
        embeds: [errorEmbed('Permission refusée', t('mod.no_permission', lang))],
      });
      return;
    }

    const targetUser = interaction.options.getUser('membre', true);

    if (sub === 'add') {
      const reason = interaction.options.getString('raison', true);
      const target = await guild.members.fetch(targetUser.id).catch(() => null);

      if (target && !canModerate(moderator, target)) {
        await interaction.editReply({
          embeds: [errorEmbed('Permission refusée', t('mod.higher_role', lang))],
        });
        return;
      }

      await prisma.warning.create({
        data: {
          guildId: guild.id,
          userId: targetUser.id,
          moderatorId: moderator.id,
          reason,
        },
      });

      await prisma.sanction.create({
        data: {
          guildId: guild.id,
          userId: targetUser.id,
          moderatorId: moderator.id,
          type: 'WARN',
          reason,
          active: false,
        },
      });

      await targetUser
        .send({
          embeds: [
            new EmbedBuilder()
              .setColor('#FEE75C')
              .setTitle('⚠️ Avertissement')
              .setDescription(`Vous avez reçu un avertissement sur **${guild.name}**.\nRaison : ${reason}`)
              .setTimestamp(),
          ],
        })
        .catch(() => null);

      const warnCount = await prisma.warning.count({
        where: { guildId: guild.id, userId: targetUser.id },
      });

      const embed = moderationEmbed('Avertissement', [
        { name: 'Membre', value: `${targetUser.tag} (${targetUser.id})`, inline: true },
        { name: 'Modérateur', value: moderator.user.tag, inline: true },
        { name: 'Total warns', value: warnCount.toString(), inline: true },
        { name: 'Raison', value: reason },
      ]);

      await interaction.editReply({ embeds: [embed] });

      if (guildData.modLogChannelId) {
        const logChannel = guild.channels.cache.get(guildData.modLogChannelId);
        if (logChannel?.isTextBased()) await logChannel.send({ embeds: [embed] });
      }

      logger.info('Warn ajouté', { guildId: guild.id, userId: targetUser.id });
    } else if (sub === 'list') {
      const warnings = await prisma.warning.findMany({
        where: { guildId: guild.id, userId: targetUser.id },
        orderBy: { createdAt: 'desc' },
        take: 10,
      });

      if (!warnings.length) {
        await interaction.editReply({
          embeds: [infoEmbed('Avertissements', `${targetUser.tag} n'a aucun avertissement.`)],
        });
        return;
      }

      const embed = infoEmbed(
        `Avertissements de ${targetUser.tag}`,
        warnings
          .map((w, i) => `**${i + 1}.** ${w.reason} — <t:${Math.floor(w.createdAt.getTime() / 1000)}:R>`)
          .join('\n')
      );

      await interaction.editReply({ embeds: [embed] });
    } else if (sub === 'clear') {
      await prisma.warning.deleteMany({ where: { guildId: guild.id, userId: targetUser.id } });
      await interaction.editReply({
        embeds: [infoEmbed('Warnings effacés', `Tous les avertissements de ${targetUser.tag} ont été supprimés.`)],
      });
    }
  },
};

export default command;
