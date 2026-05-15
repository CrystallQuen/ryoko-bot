import {
  ModalSubmitInteraction,
  EmbedBuilder,
  TextChannel,
  GuildScheduledEventEntityType,
  GuildScheduledEventPrivacyLevel,
  VoiceChannel,
} from 'discord.js';
import { ModalHandler } from '../../types';
import { prisma } from '../../database';
import { successEmbed, errorEmbed } from '../../utils/embed';
import { logger } from '../../utils/logger';

function parseDate(dateStr: string, heureStr: string): Date | null {
  const d = dateStr.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  const h = heureStr.match(/^(\d{1,2}):(\d{2})$/);
  if (!d || !h) return null;
  const date = new Date(
    parseInt(d[3]), parseInt(d[2]) - 1, parseInt(d[1]),
    parseInt(h[1]), parseInt(h[2])
  );
  return isNaN(date.getTime()) ? null : date;
}

function fromParisTime(localDate: Date): Date {
  const naive = new Date(Date.UTC(
    localDate.getFullYear(), localDate.getMonth(), localDate.getDate(),
    localDate.getHours(), localDate.getMinutes()
  ));
  const utcStr = naive.toLocaleString('en-US', { timeZone: 'UTC' });
  const parisStr = naive.toLocaleString('en-US', { timeZone: 'Europe/Paris' });
  const offsetMs = new Date(utcStr).getTime() - new Date(parisStr).getTime();
  return new Date(naive.getTime() + offsetMs);
}

const handler: ModalHandler = {
  customId: /^event_create:/,

  async execute(interaction: ModalSubmitInteraction): Promise<void> {
    const parts = interaction.customId.split(':');
    const guildId = parts[1];
    const announceChannelId = parts[2];
    const voiceChannelId = parts[3] === 'none' ? null : parts[3];
    const roleId = parts[4] === 'none' ? null : parts[4];

    const titre = interaction.fields.getTextInputValue('titre').trim();
    const dateStr = interaction.fields.getTextInputValue('date').trim();
    const heureStr = interaction.fields.getTextInputValue('heure').trim();
    const description = interaction.fields.getTextInputValue('description').trim();

    const localDate = parseDate(dateStr, heureStr);
    if (!localDate) {
      await interaction.reply({
        embeds: [errorEmbed('Date invalide', 'Format attendu : **JJ/MM/AAAA** pour la date et **HH:MM** pour l\'heure.')],
        flags: 'Ephemeral',
      });
      return;
    }

    const scheduledAt = fromParisTime(localDate);
    if (scheduledAt <= new Date()) {
      await interaction.reply({
        embeds: [errorEmbed('Date passée', 'L\'événement doit être planifié dans le futur.')],
        flags: 'Ephemeral',
      });
      return;
    }

    await interaction.deferReply({ flags: 'Ephemeral' });

    const guild = interaction.guild!;
    const endTime = new Date(scheduledAt.getTime() + 2 * 3600000);
    const ts = Math.floor(scheduledAt.getTime() / 1000);

    // Création de l'événement Discord natif
    let discordEventId: string | undefined;
    try {
      if (voiceChannelId) {
        const de = await guild.scheduledEvents.create({
          name: titre,
          scheduledStartTime: scheduledAt,
          scheduledEndTime: endTime,
          privacyLevel: GuildScheduledEventPrivacyLevel.GuildOnly,
          entityType: GuildScheduledEventEntityType.Voice,
          channel: voiceChannelId,
          description: description || undefined,
        });
        discordEventId = de.id;
      } else {
        const textChan = guild.channels.cache.get(announceChannelId) as TextChannel | undefined;
        const de = await guild.scheduledEvents.create({
          name: titre,
          scheduledStartTime: scheduledAt,
          scheduledEndTime: endTime,
          privacyLevel: GuildScheduledEventPrivacyLevel.GuildOnly,
          entityType: GuildScheduledEventEntityType.External,
          entityMetadata: { location: textChan ? `#${textChan.name}` : 'Serveur' },
          description: description || undefined,
        });
        discordEventId = de.id;
      }
    } catch {
      // permissions manquantes pour les événements — on continue
    }

    // Enregistrement en base
    const event = await prisma.event.create({
      data: {
        guildId,
        channelId: announceChannelId,
        voiceChannelId,
        title: titre,
        description,
        scheduledAt,
        roleId,
        createdBy: interaction.user.id,
        discordEventId,
      },
    });

    // Annonce dans le salon texte
    const textChannel = guild.channels.cache.get(announceChannelId) as TextChannel | undefined;
    if (textChannel?.isTextBased()) {
      const announceEmbed = new EmbedBuilder()
        .setColor('#5865F2')
        .setTitle(`📅 ${titre}`)
        .setDescription(description || null)
        .addFields(
          { name: 'Date', value: `<t:${ts}:F>`, inline: true },
          { name: 'Dans', value: `<t:${ts}:R>`, inline: true },
        );

      if (voiceChannelId) {
        const vc = guild.channels.cache.get(voiceChannelId) as VoiceChannel | undefined;
        if (vc) announceEmbed.addFields({ name: '🔊 Salon vocal', value: `<#${vc.id}>`, inline: true });
      }

      announceEmbed.setTimestamp();
      const mention = roleId ? `<@&${roleId}>` : '';
      await textChannel.send({ content: mention || undefined, embeds: [announceEmbed] }).catch(() => null);
    }

    await interaction.editReply({
      embeds: [
        successEmbed(
          'Événement créé !',
          `**${titre}** planifié pour <t:${ts}:F>\n` +
          (voiceChannelId ? `🔊 <#${voiceChannelId}>\n` : '') +
          `ID : \`${event.id}\``
        ),
      ],
    });

    logger.info('Événement créé via modal', { guildId, title: titre, scheduledAt });
  },
};

export default handler;
