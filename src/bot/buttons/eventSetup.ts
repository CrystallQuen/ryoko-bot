import {
  ButtonInteraction,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ActionRowBuilder,
  TextChannel,
  EmbedBuilder,
  GuildScheduledEventEntityType,
  GuildScheduledEventPrivacyLevel,
} from 'discord.js';
import { ButtonHandler } from '../../types';
import {
  getEventConfig,
  setEventConfig,
  clearEventConfig,
  buildScheduledAt,
  buildEventSetupMessage,
} from '../modules/events/eventConfig';
import { prisma } from '../../database';
import { successEmbed, errorEmbed } from '../../utils/embed';
import { logger } from '../../utils/logger';

const handler: ButtonHandler = {
  customId: /^ecfg_(info|create|cancel|cal_prev|cal_next|day_\d{4}-\d{2}-\d{2}):/,

  async execute(interaction: ButtonInteraction): Promise<void> {
    const parts = interaction.customId.split(':');
    const rawAction = parts[0].replace('ecfg_', '');
    const userId = parts[1];

    const action = rawAction.startsWith('day_') ? 'day' : rawAction;
    const dayDate = rawAction.startsWith('day_') ? rawAction.replace('day_', '') : null;

    if (interaction.user.id !== userId) {
      await interaction.reply({ content: '❌ Seul l\'auteur peut modifier cette configuration.', flags: 'Ephemeral' }).catch(() => null);
      return;
    }

    // ── navigation calendrier ────────────────────────────────────────────────
    if (action === 'cal_prev' || action === 'cal_next') {
      const cfg = getEventConfig(userId);
      const newOffset = action === 'cal_prev'
        ? Math.max(0, cfg.weekOffset - 1)
        : cfg.weekOffset + 1;
      setEventConfig(userId, { weekOffset: newOffset });
      await interaction.deferUpdate();
      const updated = getEventConfig(userId);
      const setup = buildEventSetupMessage(userId, updated);
      await interaction.editReply({ embeds: setup.embeds, components: setup.components as never });
      return;
    }

    // ── sélection d'un jour ──────────────────────────────────────────────────
    if (action === 'day' && dayDate) {
      setEventConfig(userId, { selectedDate: dayDate });
      await interaction.deferUpdate();
      const cfg = getEventConfig(userId);
      const setup = buildEventSetupMessage(userId, cfg);
      await interaction.editReply({ embeds: setup.embeds, components: setup.components as never });
      return;
    }

    // ── info : ouvre le modal de saisie ──────────────────────────────────────
    if (action === 'info') {
      const cfg = getEventConfig(userId);

      const modal = new ModalBuilder()
        .setCustomId(`ecfg_modal:${userId}`)
        .setTitle('📝 Informations de l\'événement');

      const titreInput = new TextInputBuilder()
        .setCustomId('titre')
        .setLabel('Titre de l\'événement')
        .setStyle(TextInputStyle.Short)
        .setPlaceholder('Ex : Soirée karaoké, Tournoi Among Us...')
        .setRequired(true)
        .setMaxLength(100)
        .setValue(cfg.titre ?? '');

      const descInput = new TextInputBuilder()
        .setCustomId('description')
        .setLabel('Description (optionnelle)')
        .setStyle(TextInputStyle.Paragraph)
        .setPlaceholder('Décrivez l\'événement...')
        .setRequired(false)
        .setMaxLength(500)
        .setValue(cfg.description);

      modal.addComponents(
        new ActionRowBuilder<TextInputBuilder>().addComponents(titreInput),
        new ActionRowBuilder<TextInputBuilder>().addComponents(descInput),
      );

      await interaction.showModal(modal);
      return;
    }

    // ── cancel ───────────────────────────────────────────────────────────────
    if (action === 'cancel') {
      clearEventConfig(userId);
      await interaction.message.delete().catch(() => null);
      await interaction.reply({ content: '✖ Création d\'événement annulée.', flags: 'Ephemeral' }).catch(() => null);
      return;
    }

    // ── create ───────────────────────────────────────────────────────────────
    if (action === 'create') {
      const cfg = getEventConfig(userId);
      if (!cfg.titre || cfg.selectedDate === null || cfg.selectedHour === null || cfg.selectedMinute === null) {
        await interaction.reply({ content: '❌ Veuillez saisir le titre et sélectionner une date/heure.', flags: 'Ephemeral' }).catch(() => null);
        return;
      }

      const scheduledAt = buildScheduledAt(cfg);
      if (!scheduledAt || scheduledAt <= new Date()) {
        await interaction.reply({ content: '❌ La date sélectionnée est déjà passée.', flags: 'Ephemeral' }).catch(() => null);
        return;
      }

      await interaction.deferUpdate();

      const guild = interaction.guild!;
      const channel = interaction.channel as TextChannel;
      const endTime = new Date(scheduledAt.getTime() + cfg.duration * 3600000);

      let discordEventId: string | undefined;
      try {
        const discordEvent = await guild.scheduledEvents.create({
          name: cfg.titre,
          scheduledStartTime: scheduledAt,
          scheduledEndTime: endTime,
          privacyLevel: GuildScheduledEventPrivacyLevel.GuildOnly,
          entityType: GuildScheduledEventEntityType.External,
          entityMetadata: { location: `#${channel.name}` },
          description: cfg.description || undefined,
        });
        discordEventId = discordEvent.id;
      } catch {
        // permissions manquantes — on continue
      }

      const event = await prisma.event.create({
        data: {
          guildId: guild.id,
          channelId: channel.id,
          title: cfg.titre,
          description: cfg.description,
          scheduledAt,
          createdBy: userId,
          discordEventId,
        },
      });

      clearEventConfig(userId);

      const ts = Math.floor(scheduledAt.getTime() / 1000);
      const announceEmbed = new EmbedBuilder()
        .setColor('#5865F2')
        .setTitle(`📅 ${cfg.titre}`)
        .setDescription(cfg.description || null)
        .addFields(
          { name: 'Date', value: `<t:${ts}:F>`, inline: true },
          { name: 'Dans', value: `<t:${ts}:R>`, inline: true },
          { name: 'Durée', value: cfg.duration < 1 ? '30 min' : `${cfg.duration}h`, inline: true },
        )
        .setTimestamp();

      await interaction.message.delete().catch(() => null);
      await channel.send({ embeds: [announceEmbed] }).catch(() => null);
      await interaction.followUp({
        embeds: [successEmbed('Événement créé !', `**${cfg.titre}** prévu pour <t:${ts}:F>\nID : \`${event.id}\``)],
        flags: 'Ephemeral',
      }).catch(() => null);

      logger.info('Événement créé via panel', { guildId: guild.id, title: cfg.titre, scheduledAt });
    }
  },
};

export default handler;
