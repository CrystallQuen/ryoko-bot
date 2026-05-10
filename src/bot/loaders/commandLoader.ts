import path from 'path';
import fs from 'fs';
import { pathToFileURL } from 'url';
import { ExtendedClient, SlashCommand } from '../../types';
import { logger } from '../../utils/logger';

export async function loadCommands(client: ExtendedClient): Promise<void> {
  const commandsPath = path.join(__dirname, '..', 'commands');
  const commandFolders = fs.readdirSync(commandsPath);

  for (const folder of commandFolders) {
    const folderPath = path.join(commandsPath, folder);
    if (!fs.statSync(folderPath).isDirectory()) continue;

    const commandFiles = fs
      .readdirSync(folderPath)
      .filter((f) => f.endsWith('.ts') || f.endsWith('.js'));

    for (const file of commandFiles) {
      try {
        const filePath = pathToFileURL(path.join(folderPath, file)).href;
        const command: SlashCommand = (await import(filePath)).default;

        if (!command?.data || !command?.execute) {
          logger.warn(`⚠️ Commande invalide : ${file}`);
          continue;
        }

        client.commands.set(command.data.name, command);
        logger.debug(`✅ Commande chargée : /${command.data.name}`);
      } catch (error) {
        logger.error(`❌ Erreur lors du chargement de ${file}`, { error });
      }
    }
  }

  logger.info(`📦 ${client.commands.size} commande(s) chargée(s)`);
}
