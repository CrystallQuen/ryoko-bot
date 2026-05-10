import { Client } from 'discord.js';
import cron from 'node-cron';
import { prisma } from '../../../database';
import { logger } from '../../../utils/logger';

export function startSanctionExpiry(client: Client): void {
  // Vérifie toutes les minutes les bans temporaires expirés
  cron.schedule('* * * * *', async () => {
    try {
      const now = new Date();

      const expiredBans = await prisma.sanction.findMany({
        where: {
          type: 'TEMPBAN',
          active: true,
          expiresAt: { lte: now },
        },
      });

      for (const sanction of expiredBans) {
        try {
          const guild = client.guilds.cache.get(sanction.guildId);
          if (!guild) continue;

          await guild.bans.remove(sanction.userId, 'Fin du ban temporaire').catch(() => null);

          await prisma.sanction.update({
            where: { id: sanction.id },
            data: { active: false },
          });

          logger.info('Ban temporaire expiré — débannissement', {
            guildId: sanction.guildId,
            userId: sanction.userId,
          });
        } catch (error) {
          logger.error('Erreur expiration ban', { error, sanctionId: sanction.id });
        }
      }
    } catch (error) {
      logger.error('Erreur cron expiration sanctions', { error });
    }
  });

  logger.info('🔄 Planificateur d\'expiration des sanctions démarré');
}
