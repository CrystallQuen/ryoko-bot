import path from 'path';
import fs from 'fs';
import { pathToFileURL } from 'url';
import { ExtendedClient, BotEvent } from '../../types';
import { logger } from '../../utils/logger';

export async function loadEvents(client: ExtendedClient): Promise<void> {
  const eventsPath = path.join(__dirname, '..', 'events');
  const eventFiles = fs
    .readdirSync(eventsPath)
    .filter((f) => (f.endsWith('.ts') || f.endsWith('.js')) && !f.endsWith('.d.ts'));

  for (const file of eventFiles) {
    try {
      const filePath = pathToFileURL(path.join(eventsPath, file)).href;
      const event: BotEvent = (await import(filePath)).default;

      if (event.once) {
        client.once(event.name, (...args) => event.execute(...args));
      } else {
        client.on(event.name, (...args) => event.execute(...args));
      }

      logger.debug(`✅ Événement chargé : ${event.name}`);
    } catch (error) {
      logger.error(`❌ Erreur lors du chargement de l'événement ${file}`, { error });
    }
  }

  logger.info(`📡 ${eventFiles.length} événement(s) chargé(s)`);
}
