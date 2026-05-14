import path from 'path';
import fs from 'fs';
import { pathToFileURL } from 'url';
import { ExtendedClient, ButtonHandler } from '../../types';
import { logger } from '../../utils/logger';

export async function loadButtons(client: ExtendedClient): Promise<void> {
  const buttonsPath = path.join(__dirname, '..', 'buttons');
  if (!fs.existsSync(buttonsPath)) return;

  const files = fs
    .readdirSync(buttonsPath)
    .filter((f) => (f.endsWith('.ts') || f.endsWith('.js')) && !f.endsWith('.d.ts'));

  for (const file of files) {
    try {
      const filePath = pathToFileURL(path.join(buttonsPath, file)).href;
      const raw = await import(filePath);
      const handler: ButtonHandler = raw.default?.default ?? raw.default;

      if (!handler?.customId || !handler?.execute) {
        logger.warn(`⚠️ Bouton invalide : ${file}`);
        continue;
      }

      client.buttons.set(String(handler.customId), handler);
      logger.debug(`✅ Bouton chargé : ${String(handler.customId)}`);
    } catch (error) {
      logger.error(`❌ Erreur lors du chargement du bouton ${file}`, { error });
    }
  }

  logger.info(`🔘 ${client.buttons.size} bouton(s) chargé(s)`);
}
