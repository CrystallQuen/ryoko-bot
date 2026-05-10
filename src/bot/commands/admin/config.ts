import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  PermissionFlagsBits,
  ChannelType,
  EmbedBuilder,
} from 'discord.js';
import { SlashCommand } from '../../../types';
import { prisma, getOrCreateGuild } from '../../../database';
import { successEmbed, errorEmbed } from '../../../utils/embed';
import { logger } from '../../../utils/logger';

const command: SlashCommand = {
  data: new SlashCommandBuilder()
    .setName('config')
    .setDescription('Configurer le serveur')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addSubcommand((sub) =>
      sub
        .setName('log-channel')
        .setDescription('Définir le salon de logs (sanctions & événements)')
        .addChannelOption((o) =>
          o
            .setName('salon')
            .setDescription('Salon texte où envoyer les logs')
            .addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement)
            .setRequired(true)
        )
    )
    .addSubcommand((sub) =>
      sub.setName('show').setDescription('Voir la configuration actuelle')
    ),

  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    await interaction.deferReply({ ephemeral: true });

    const guild = interaction.guild!;
    const sub = interaction.options.getSubcommand();

    try {
      const guildData = await getOrCreateGuild(guild.id, guild.name);

      if (sub === 'log-channel') {
        const channel = interaction.options.getChannel('salon', true);

        await prisma.guild.update({
          where: { id: guild.id },
          data: { modLogChannelId: channel.id },
        });

        await interaction.editReply({
          embeds: [
            successEmbed(
              'Salon de logs configuré',
              `Les sanctions et créations d'événements seront désormais journalisées dans <#${channel.id}>.`
            ),
          ],
        });

        logger.info('Log channel configuré', { guildId: guild.id, channelId: channel.id });
      } else if (sub === 'show') {
        const embed = new EmbedBuilder()
          .setColor('#5865F2')
          .setTitle('⚙️ Configuration du serveur')
          .addFields(
            {
              name: '📋 Salon de logs',
              value: guildData.modLogChannelId ? `<#${guildData.modLogChannelId}>` : '❌ Non configuré',
              inline: true,
            },
            {
              name: '👋 Salon de bienvenue',
              value: guildData.welcomeChannelId ? `<#${guildData.welcomeChannelId}>` : '❌ Non configuré',
              inline: true,
            },
            {
              name: '🌐 Langue',
              value: guildData.language.toUpperCase(),
              inline: true,
            }
          )
          .setTimestamp();

        await interaction.editReply({ embeds: [embed] });
      }
    } catch (error) {
      logger.error('Erreur /config', { error, sub });
      await interaction.editReply({
        embeds: [errorEmbed('Erreur', 'Une erreur est survenue. Vérifie que la base de données est connectée.')],
      });
    }
  },
};

export default command;
