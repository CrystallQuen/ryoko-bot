import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  PermissionFlagsBits,
  GuildMember,
  EmbedBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ActionRowBuilder,
  ChannelType,
} from 'discord.js';
import { SlashCommand } from '../../../types';
import { prisma, getOrCreateGuild } from '../../../database';
import { canManageEvents } from '../../../utils/permissions';
import { successEmbed, errorEmbed, infoEmbed } from '../../../utils/embed';
import { logger } from '../../../utils/logger';

const command: SlashCommand = {
  data: new SlashCommandBuilder()
    .setName('event')
    .setDescription('Gérer les animations et événements')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageEvents)
    .addSubcommand((sub) =>
      sub
        .setName('creer')
        .setDescription('Créer un événement Discord')
        .addChannelOption((o) =>
          o
            .setName('salon_vocal')
            .setDescription('Salon vocal où se déroulera l\'événement (optionnel)')
            .addChannelTypes(ChannelType.GuildVoice, ChannelType.GuildStageVoice)
            .setRequired(false)
        )
        .addChannelOption((o) =>
          o
            .setName('salon')
            .setDescription('Salon d\'annonce (défaut : salon actuel)')
            .addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement)
            .setRequired(false)
        )
        .addRoleOption((o) =>
          o.setName('role').setDescription('Rôle à mentionner').setRequired(false)
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName('delete')
        .setDescription('Supprimer un événement')
        .addStringOption((o) => o.setName('id').setDescription("ID de l'événement").setRequired(true))
    )
    .addSubcommand((sub) => sub.setName('list').setDescription('Lister les animations à venir')),

  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    const guild = interaction.guild!;
    const moderator = interaction.member as GuildMember;
    const sub = interaction.options.getSubcommand();

    if (!canManageEvents(moderator)) {
      await interaction.reply({
        embeds: [errorEmbed('Permission refusée', 'Vous devez être modérateur.')],
        flags: 'Ephemeral',
      });
      return;
    }

    // ── creer : ouvre le modal Discord directement ───────────────────────────
    if (sub === 'creer') {
      const voiceChannelId = interaction.options.getChannel('salon_vocal')?.id ?? 'none';
      const announceChannelId = interaction.options.getChannel('salon')?.id ?? interaction.channelId;
      const roleId = interaction.options.getRole('role')?.id ?? 'none';

      const modal = new ModalBuilder()
        .setCustomId(`event_create:${guild.id}:${announceChannelId}:${voiceChannelId}:${roleId}`)
        .setTitle('🗓️ Créer un événement');

      const titreInput = new TextInputBuilder()
        .setCustomId('titre')
        .setLabel('Titre de l\'événement')
        .setStyle(TextInputStyle.Short)
        .setPlaceholder('Ex : Soirée karaoké, Tournoi Among Us...')
        .setRequired(true)
        .setMaxLength(100);

      const dateInput = new TextInputBuilder()
        .setCustomId('date')
        .setLabel('Date de début (JJ/MM/AAAA)')
        .setStyle(TextInputStyle.Short)
        .setPlaceholder('Ex : 25/12/2026')
        .setRequired(true);

      const heureInput = new TextInputBuilder()
        .setCustomId('heure')
        .setLabel('Heure de début (HH:MM)')
        .setStyle(TextInputStyle.Short)
        .setPlaceholder('Ex : 20:00')
        .setRequired(true);

      const descInput = new TextInputBuilder()
        .setCustomId('description')
        .setLabel('Description (optionnelle)')
        .setStyle(TextInputStyle.Paragraph)
        .setPlaceholder('Décrivez l\'événement...')
        .setRequired(false)
        .setMaxLength(500);

      modal.addComponents(
        new ActionRowBuilder<TextInputBuilder>().addComponents(titreInput),
        new ActionRowBuilder<TextInputBuilder>().addComponents(dateInput),
        new ActionRowBuilder<TextInputBuilder>().addComponents(heureInput),
        new ActionRowBuilder<TextInputBuilder>().addComponents(descInput),
      );

      await interaction.showModal(modal);
      return;
    }

    // ── subcommandes avec defer ──────────────────────────────────────────────
    await interaction.deferReply({ flags: 'Ephemeral' });

    try {
      await getOrCreateGuild(guild.id, guild.name);

      const guildData = await prisma.guild.findUnique({ where: { id: guild.id } });

      const sendLog = async (embed: EmbedBuilder) => {
        if (!guildData?.modLogChannelId) return;
        const logChannel = guild.channels.cache.get(guildData.modLogChannelId);
        if (logChannel?.isTextBased()) await logChannel.send({ embeds: [embed] }).catch(() => null);
      };

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

        await interaction.editReply({ embeds: [infoEmbed('📅 Animations à venir', lines.join('\n\n'))] });
      }
    } catch (error) {
      logger.error('Erreur commande /event', { error, sub });
      await interaction.editReply({
        embeds: [errorEmbed('Erreur', 'Une erreur est survenue.')],
      }).catch(() => null);
    }
  },
};

export default command;
