import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  PermissionFlagsBits,
  GuildMember,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} from 'discord.js';
import { SlashCommand } from '../../../types';
import { prisma, getOrCreateGuild } from '../../../database';
import { isModerator } from '../../../utils/permissions';
import { successEmbed, errorEmbed, infoEmbed } from '../../../utils/embed';
import { logger } from '../../../utils/logger';

const command: SlashCommand = {
  data: new SlashCommandBuilder()
    .setName('event')
    .setDescription('Gérer les animations et événements')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageEvents)
    .addSubcommand((sub) =>
      sub
        .setName('delete')
        .setDescription('Supprimer une animation')
        .addStringOption((o) => o.setName('id').setDescription("ID de l'événement").setRequired(true))
    )
    .addSubcommand((sub) => sub.setName('list').setDescription('Lister les animations à venir'))
    .addSubcommand((sub) =>
      sub.setName('creer').setDescription('Créer un événement via le panneau de configuration')
    ),

  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    await interaction.deferReply({ flags: 'Ephemeral' });

    const guild = interaction.guild!;
    const moderator = interaction.member as GuildMember;
    const sub = interaction.options.getSubcommand();

    try {
      await getOrCreateGuild(guild.id, guild.name);

      if (!isModerator(moderator)) {
        await interaction.editReply({
          embeds: [errorEmbed('Permission refusée', 'Vous devez être modérateur.')],
        });
        return;
      }

      const guildData = await prisma.guild.findUnique({ where: { id: guild.id } });

      const sendLog = async (embed: EmbedBuilder) => {
        if (!guildData?.modLogChannelId) return;
        const logChannel = guild.channels.cache.get(guildData.modLogChannelId);
        if (logChannel?.isTextBased()) await logChannel.send({ embeds: [embed] }).catch(() => null);
      };

      if (sub === 'creer') {
        const dashboardUrl = process.env.DASHBOARD_URL ?? 'https://ryoko-bot.up.railway.app';
        const url = `${dashboardUrl}/dashboard/${guild.id}/events`;
        const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
          new ButtonBuilder()
            .setLabel('📅 Ouvrir le calendrier')
            .setStyle(ButtonStyle.Link)
            .setURL(url)
        );
        await interaction.editReply({
          embeds: [infoEmbed('Créer un événement', `Cliquez sur le bouton ci-dessous pour créer un événement.\nVous aurez accès à un **vrai calendrier** avec sélection du salon vocal.`)],
          components: [row as never],
        });
        return;
      }

      if (sub === 'delete') {
        const id = interaction.options.getString('id', true);
        const event = await prisma.event.findFirst({ where: { id, guildId: guild.id } });

        if (!event) {
          await interaction.editReply({ embeds: [errorEmbed('Introuvable', 'Événement non trouvé.')] });
          return;
        }

        if (event.discordEventId) {
          await guild.scheduledEvents.delete(event.discordEventId).catch(() => null);
        }

        await prisma.event.delete({ where: { id } });

        await sendLog(
          new EmbedBuilder()
            .setColor('#ED4245')
            .setTitle('🗑️ Événement supprimé')
            .addFields(
              { name: 'Titre', value: event.title, inline: true },
              { name: 'Supprimé par', value: `<@${moderator.id}>`, inline: true },
              { name: 'ID', value: event.id, inline: false }
            )
            .setTimestamp()
        );

        await interaction.editReply({
          embeds: [successEmbed('Supprimé', `Événement **${event.title}** supprimé.`)],
        });
      } else if (sub === 'list') {
        const events = await prisma.event.findMany({
          where: { guildId: guild.id, scheduledAt: { gte: new Date() } },
          orderBy: { scheduledAt: 'asc' },
          take: 10,
        });

        if (!events.length) {
          await interaction.editReply({ embeds: [infoEmbed('Événements', 'Aucune animation à venir.')] });
          return;
        }

        const lines = events.map((e) => {
          const voicePart = e.voiceChannelId ? `\n  🔊 <#${e.voiceChannelId}>` : '';
          return `• **${e.title}** — <t:${Math.floor(e.scheduledAt.getTime() / 1000)}:F>${voicePart}\n  ID: \`${e.id}\``;
        });

        const embed = infoEmbed('📅 Animations à venir', lines.join('\n\n'));
        await interaction.editReply({ embeds: [embed] });
      }
    } catch (error) {
      logger.error('Erreur commande /event', { error, sub });
      const isDeferred = interaction.deferred || interaction.replied;
      const errorReply = {
        embeds: [errorEmbed('Erreur', 'Une erreur est survenue. Vérifiez les logs du bot.')],
      };
      if (isDeferred) {
        await interaction.editReply(errorReply).catch(() => null);
      } else {
        await interaction.reply({ ...errorReply, flags: 'Ephemeral' }).catch(() => null);
      }
    }
  },
};

export default command;
