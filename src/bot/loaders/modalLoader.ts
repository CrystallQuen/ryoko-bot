import path from 'path';
import fs from 'fs';
import { pathToFileURL } from 'url';
import { ExtendedClient, ModalHandler } from '../../types';
import { logger } from '../../utils/logger';

export async function loadModals(client: ExtendedClient): Promise<void> {
  const modalsPath = path.join(__dirname, '..', 'modals');
  if (!fs.existsSync(modalsPath)) return;

  const files = fs
    .readdirSync(modalsPath)
    .filter((f) => (f.endsWith('.ts') || f.endsWith('.js')) && !f.endsWith('.d.ts'));

  for (const file of files) {
    try {
      const filePath = pathToFileURL(path.join(modalsPath, file)).href;
      const raw = await import(filePath);
      const handler: ModalHandler = raw.default?.default ?? raw.default;

      if (!handler?.customId || !handler?.execute) {
        logger.warn(`⚠️ Modal invalide : ${file}`);
        continue;
      }

      client.modals.set(String(handler.customId), handler);
    } catch (error) {
      logger.error(`❌ Erreur lors du chargement du modal ${file}`, { error });
    }
  }

  logger.info(`📋 ${client.modals.size} modal(s) chargé(s)`);
}
