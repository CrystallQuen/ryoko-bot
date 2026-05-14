import path from 'path';
import fs from 'fs';
import { pathToFileURL } from 'url';
import { ExtendedClient, SelectMenuHandler } from '../../types';
import { logger } from '../../utils/logger';

export async function loadSelectMenus(client: ExtendedClient): Promise<void> {
  const menusPath = path.join(__dirname, '..', 'selectMenus');
  if (!fs.existsSync(menusPath)) return;

  const files = fs
    .readdirSync(menusPath)
    .filter((f) => (f.endsWith('.ts') || f.endsWith('.js')) && !f.endsWith('.d.ts'));

  for (const file of files) {
    try {
      const filePath = pathToFileURL(path.join(menusPath, file)).href;
      const raw = await import(filePath);
      const handler: SelectMenuHandler = raw.default?.default ?? raw.default;

      if (!handler?.customId || !handler?.execute) {
        logger.warn(`⚠️ SelectMenu invalide : ${file}`);
        continue;
      }

      client.selectMenus.set(String(handler.customId), handler);
      logger.debug(`✅ SelectMenu chargé : ${String(handler.customId)}`);
    } catch (error) {
      logger.error(`❌ Erreur lors du chargement du selectMenu ${file}`, { error });
    }
  }

  logger.info(`📋 ${client.selectMenus.size} selectMenu(s) chargé(s)`);
}
