import { Client, EmbedBuilder, TextChannel } from 'discord.js';
import cron from 'node-cron';
import { prisma } from '../../../database';
import { logger } from '../../../utils/logger';

const REMINDER_CHANNEL_ID = process.env.EVENT_REMINDER_CHANNEL_ID;

export function startEventReminders(client: Client): void {
  // Vérifie toutes les minutes les événements dans les 10 prochaines minutes
  cron.schedule('* * * * *', async () => {
    try {
      const now = new Date();
      const in10min = new Date(now.getTime() + 10 * 60 * 1000);
      const in11min = new Date(now.getTime() + 11 * 60 * 1000);

      const upcomingEvents = await prisma.event.findMany({
        where: {
          scheduledAt: { gte: in10min, lte: in11min },
          reminded: false,
        },
      });

      for (const event of upcomingEvents) {
        try {
          // Priorité : salon de rappel configuré → salon d'annonce de l'événement
          const targetChannelId = REMINDER_CHANNEL_ID ?? event.channelId;
          const channel = client.channels.cache.get(targetChannelId);
          if (!(channel instanceof TextChannel)) continue;

          const roleMention = event.roleId ? `<@&${event.roleId}>` : '';
          const timestamp = Math.floor(event.scheduledAt.getTime() / 1000);

          const embed = new EmbedBuilder()
            .setColor('#FEE75C')
            .setTitle(`⏰ Rappel — ${event.title}`)
            .setDescription(
              `L'animation commence dans **10 minutes** !\n\n` +
              `📅 **Date :** <t:${timestamp}:F>\n` +
              `⌛ **Dans :** <t:${timestamp}:R>` +
              (event.voiceChannelId ? `\n🔊 **Salon vocal :** <#${event.voiceChannelId}>` : '')
            )
            .setTimestamp();

          await channel.send({
            content: roleMention || undefined,
            embeds: [embed],
          });

          await prisma.event.update({
            where: { id: event.id },
            data: { reminded: true },
          });

          logger.info('Rappel événement envoyé', { eventId: event.id, title: event.title, channelId: targetChannelId });
        } catch (error) {
          logger.error('Erreur envoi rappel événement', { error, eventId: event.id });
        }
      }
    } catch (error) {
      logger.error('Erreur cron rappels événements', { error });
    }
  });

  logger.info('⏰ Planificateur de rappels événements démarré');
}
