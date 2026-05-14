import { Router, Response } from 'express';
import { Client, EmbedBuilder, TextChannel, GuildScheduledEventEntityType, GuildScheduledEventPrivacyLevel, VoiceChannel } from 'discord.js';
import { prisma } from '../../database';
import { logger } from '../../utils/logger';

export function eventsRouter(client: Client): Router {
  const router = Router();

  router.get('/:guildId/events', async (req, res: Response) => {
    const { guildId } = req.params;
    const upcoming = req.query.upcoming === 'true';
    try {
      const events = await prisma.event.findMany({
        where: { guildId, ...(upcoming ? { scheduledAt: { gte: new Date() } } : {}) },
        orderBy: { scheduledAt: 'asc' },
      });
      res.json(events);
    } catch {
      res.status(500).json({ error: 'Erreur interne' });
    }
  });

  router.post('/:guildId/events', async (req, res: Response) => {
    const { guildId } = req.params;
    const { channelId, voiceChannelId, title, description, scheduledAt, roleId, duration } = req.body;

    if (!channelId || !title || !scheduledAt) {
      return res.status(400).json({ error: 'Champs manquants' });
    }

    const date = new Date(scheduledAt);
    if (isNaN(date.getTime()) || date <= new Date()) {
      return res.status(400).json({ error: 'Date invalide ou passée' });
    }

    const durationHours = parseFloat(duration ?? '2') || 2;
    const endTime = new Date(date.getTime() + durationHours * 3600000);

    try {
      const guild = client.guilds.cache.get(guildId);

      // Création de l'événement Discord natif
      let discordEventId: string | undefined;
      if (guild) {
        try {
          if (voiceChannelId) {
            const de = await guild.scheduledEvents.create({
              name: title,
              scheduledStartTime: date,
              scheduledEndTime: endTime,
              privacyLevel: GuildScheduledEventPrivacyLevel.GuildOnly,
              entityType: GuildScheduledEventEntityType.Voice,
              channel: voiceChannelId,
              description: description || undefined,
            });
            discordEventId = de.id;
          } else {
            const textChannel = guild.channels.cache.get(channelId) as TextChannel | undefined;
            const de = await guild.scheduledEvents.create({
              name: title,
              scheduledStartTime: date,
              scheduledEndTime: endTime,
              privacyLevel: GuildScheduledEventPrivacyLevel.GuildOnly,
              entityType: GuildScheduledEventEntityType.External,
              entityMetadata: { location: textChannel ? `#${textChannel.name}` : 'Serveur' },
              description: description || undefined,
            });
            discordEventId = de.id;
          }
        } catch {
          // permissions manquantes — on continue
        }
      }

      const event = await prisma.event.create({
        data: {
          guildId,
          channelId,
          voiceChannelId: voiceChannelId || null,
          title,
          description: description || '',
          scheduledAt: date,
          roleId: roleId || null,
          createdBy: 'dashboard',
          discordEventId,
        },
      });

      // Annonce dans le salon texte
      if (guild) {
        const textChannel = guild.channels.cache.get(channelId) as TextChannel | undefined;
        if (textChannel?.isTextBased()) {
          const ts = Math.floor(date.getTime() / 1000);
          const embed = new EmbedBuilder()
            .setColor('#5865F2')
            .setTitle(`📅 ${title}`)
            .setDescription(description || null)
            .addFields(
              { name: 'Date', value: `<t:${ts}:F>`, inline: true },
              { name: 'Dans', value: `<t:${ts}:R>`, inline: true },
              { name: 'Durée', value: durationHours < 1 ? '30 min' : `${durationHours}h`, inline: true },
            );

          if (voiceChannelId) {
            const vc = guild.channels.cache.get(voiceChannelId) as VoiceChannel | undefined;
            if (vc) embed.addFields({ name: '🔊 Salon vocal', value: `<#${vc.id}>`, inline: true });
          }

          embed.setTimestamp();
          const mention = roleId ? `<@&${roleId}>` : '';
          await textChannel.send({ content: mention || undefined, embeds: [embed] }).catch(() => null);
        }
      }

      logger.info('Événement créé via dashboard', { guildId, title, scheduledAt: date });
      res.status(201).json(event);
    } catch (error) {
      logger.error('Erreur création événement dashboard', { error });
      res.status(500).json({ error: 'Erreur interne' });
    }
  });

  router.patch('/:guildId/events/:id', async (req, res: Response) => {
    const { guildId, id } = req.params;
    const { title, description, scheduledAt, roleId } = req.body;
    try {
      const event = await prisma.event.findFirst({ where: { id, guildId } });
      if (!event) return res.status(404).json({ error: 'Événement introuvable' });
      const updated = await prisma.event.update({
        where: { id },
        data: {
          ...(title && { title }),
          ...(description !== undefined && { description }),
          ...(scheduledAt && { scheduledAt: new Date(scheduledAt) }),
          ...(roleId !== undefined && { roleId }),
        },
      });
      res.json(updated);
    } catch {
      res.status(500).json({ error: 'Erreur interne' });
    }
  });

  router.delete('/:guildId/events/:id', async (req, res: Response) => {
    const { guildId, id } = req.params;
    try {
      const event = await prisma.event.findFirst({ where: { id, guildId } });
      if (event?.discordEventId) {
        const guild = client.guilds.cache.get(guildId);
        await guild?.scheduledEvents.delete(event.discordEventId).catch(() => null);
      }
      await prisma.event.deleteMany({ where: { id, guildId } });
      res.json({ success: true });
    } catch {
      res.status(500).json({ error: 'Erreur interne' });
    }
  });

  return router;
}
