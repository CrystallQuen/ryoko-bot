import { Client, ActivityType } from 'discord.js';
import { BotEvent } from '../../types';
import { logger } from '../../utils/logger';
import { startEventReminders } from '../modules/events/reminder';
import { startSanctionExpiry } from '../modules/moderation/sanctionExpiry';

const event: BotEvent = {
  name: 'clientReady',
  once: true,
  async execute(client: Client) {
    logger.info(`✅ Bot connecté en tant que ${client.user?.tag}`);
    logger.info(`📊 ${client.guilds.cache.size} serveur(s) | ${client.users.cache.size} utilisateur(s)`);

    client.user?.setPresence({
      activities: [
        { name: '/help | りょうこ', type: ActivityType.Playing },
      ],
      status: 'online',
    });

    // Démarrage des tâches planifiées
    startEventReminders(client);
    startSanctionExpiry(client);

    logger.info('🚀 Bot prêt !');
  },
};

export default event;
