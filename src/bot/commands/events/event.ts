import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  PermissionFlagsBits,
  GuildMember,
  EmbedBuilder,
  TextChannel,
  VoiceChannel,
  ChannelType,
  GuildScheduledEventEntityType,
  GuildScheduledEventPrivacyLevel,
} from 'discord.js';
import { SlashCommand } from '../../../types';
import { prisma, getOrCreateGuild } from '../../../database';
import { isModerator } from '../../../utils/permissions';
import { successEmbed, errorEmbed, infoEmbed } from '../../../utils/embed';
import { getEventConfig, buildEventSetupMessage, clearEventConfig } from '../../modules/events/eventConfig';
import { logger } from '../../../utils/logger';

const command: SlashCommand = {
  data: new SlashCommandBuilder()
    .setName('event')
    .setDescription('Gérer les animations et événements')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageEvents)
    .addSubcommand((sub) =>
      sub
        .setName('create')
        .setDescription('Créer une animation')
        .addStringOption((o) => o.setName('titre').setDescription("Titre de l'animation").setRequired(true))
        .addStringOption((o) =>
          o.setName('date').setDescription('Date et heure (ex: 2025-12-25 20:00)').setRequired(true)
        )
        .addStringOption((o) => o.setName('description').setDescription('Description').setRequired(false))
        .addChannelOption((o) =>
          o
            .setName('salon')
            .setDescription("Salon texte d'annonce")
            .addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement)
            .setRequired(false)
        )
        .addChannelOption((o) =>
          o
            .setName('salon_vocal')
            .setDescription('Salon vocal où se déroulera l\'événement')
            .addChannelTypes(ChannelType.GuildVoice, ChannelType.GuildStageVoice)
            .setRequired(false)
        )
        .addRoleOption((o) => o.setName('role').setDescription('Rôle à mentionner').setRequired(false))
    )
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
        const userId = interaction.user.id;
        clearEventConfig(userId);
        const cfg = getEventConfig(userId);
        const setup = buildEventSetupMessage(userId, cfg);
        await interaction.editReply({ ...setup } as never);
        setTimeout(() => clearEventConfig(userId), 10 * 60 * 1000);
        return;
      }

      if (sub === 'create') {
        const titre = interaction.options.getString('titre', true);
        const dateStr = interaction.options.getString('date', true);
        const description = interaction.options.getString('description') ?? '';
        const role = interaction.options.getRole('role');

        // Salon texte d'annonce
        const channelOption = interaction.options.getChannel('salon');
        const announceChannel = channelOption
          ? (guild.channels.cache.get(channelOption.id) ?? interaction.channel)
          : interaction.channel;

        // Salon vocal
        const voiceOption = interaction.options.getChannel('salon_vocal');
        const voiceChannel = voiceOption
          ? (guild.channels.cache.get(voiceOption.id) as VoiceChannel | null)
          : null;

        const scheduledAt = new Date(dateStr);
        if (isNaN(scheduledAt.getTime()) || scheduledAt <= new Date()) {
          await interaction.editReply({
            embeds: [errorEmbed('Date invalide', 'Format attendu : YYYY-MM-DD HH:mm (ex: 2025-12-25 20:00)')],
          });
          return;
        }

        let discordEventId: string | undefined;
        try {
          if (voiceChannel) {
            // Événement dans un salon vocal Discord natif
            const discordEvent = await guild.scheduledEvents.create({
              name: titre,
              scheduledStartTime: scheduledAt,
              scheduledEndTime: new Date(scheduledAt.getTime() + 2 * 3600000),
              privacyLevel: GuildScheduledEventPrivacyLevel.GuildOnly,
              entityType: GuildScheduledEventEntityType.Voice,
              channel: voiceChannel.id,
              description: description || undefined,
            });
            discordEventId = discordEvent.id;
          } else {
            // Événement externe (salon texte ou localisation libre)
            const discordEvent = await guild.scheduledEvents.create({
              name: titre,
              scheduledStartTime: scheduledAt,
              scheduledEndTime: new Date(scheduledAt.getTime() + 2 * 3600000),
              privacyLevel: GuildScheduledEventPrivacyLevel.GuildOnly,
              entityType: GuildScheduledEventEntityType.External,
              entityMetadata: {
                location: announceChannel ? `#${(announceChannel as TextChannel).name ?? 'salon'}` : 'Serveur',
              },
              description: description || undefined,
            });
            discordEventId = discordEvent.id;
          }
        } catch {
          // Permissions manquantes pour les événements Discord — on continue quand même
        }

        const event = await prisma.event.create({
          data: {
            guildId: guild.id,
            channelId: announceChannel?.id ?? interaction.channelId,
            voiceChannelId: voiceChannel?.id ?? null,
            title: titre,
            description,
            scheduledAt,
            roleId: role?.id,
            createdBy: moderator.id,
            discordEventId,
          },
        });

        const embed = new EmbedBuilder()
          .setColor('#5865F2')
          .setTitle(`📅 ${titre}`)
          .setDescription(description || 'Aucune description')
          .addFields(
            { name: 'Date', value: `<t:${Math.floor(scheduledAt.getTime() / 1000)}:F>`, inline: true },
            { name: 'Dans', value: `<t:${Math.floor(scheduledAt.getTime() / 1000)}:R>`, inline: true },
            { name: 'ID', value: event.id, inline: true }
          );

        if (voiceChannel) {
          embed.addFields({ name: '🔊 Salon vocal', value: `<#${voiceChannel.id}>`, inline: true });
        }

        embed.setTimestamp();

        // Envoi de l'annonce dans le salon texte
        if (announceChannel instanceof TextChannel) {
          const mention = role ? `<@&${role.id}>` : '';
          await announceChannel.send({ content: mention || undefined, embeds: [embed] }).catch(() => null);
        }

        await interaction.editReply({
          embeds: [
            successEmbed(
              'Événement créé',
              `**${titre}** planifié pour <t:${Math.floor(scheduledAt.getTime() / 1000)}:F>${voiceChannel ? `\n🔊 Salon vocal : <#${voiceChannel.id}>` : ''}`
            ),
          ],
        });

        await sendLog(
          new EmbedBuilder()
            .setColor('#5865F2')
            .setTitle('📅 Événement créé')
            .addFields(
              { name: 'Titre', value: titre, inline: true },
              { name: 'Date', value: `<t:${Math.floor(scheduledAt.getTime() / 1000)}:F>`, inline: true },
              { name: 'Créé par', value: `<@${moderator.id}>`, inline: true },
              ...(voiceChannel ? [{ name: '🔊 Salon vocal', value: `<#${voiceChannel.id}>`, inline: true }] : []),
              { name: 'ID', value: event.id, inline: false }
            )
            .setTimestamp()
        );

        logger.info('Événement créé', { guildId: guild.id, title: titre, scheduledAt, voiceChannelId: voiceChannel?.id });
      } else if (sub === 'delete') {
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
