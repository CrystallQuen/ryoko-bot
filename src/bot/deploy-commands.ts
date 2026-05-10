import { REST, Routes } from 'discord.js';
import path from 'path';
import fs from 'fs';
import { pathToFileURL } from 'url';
import dotenv from 'dotenv';

dotenv.config();

const token = process.env.DISCORD_TOKEN!;
const clientId = process.env.DISCORD_CLIENT_ID!;
const guildId = process.env.DISCORD_GUILD_ID;

async function deployCommands(): Promise<void> {
  const commands: unknown[] = [];
  const commandsPath = path.join(__dirname, 'commands');
  const commandFolders = fs.readdirSync(commandsPath);

  for (const folder of commandFolders) {
    const folderPath = path.join(commandsPath, folder);
    if (!fs.statSync(folderPath).isDirectory()) continue;

    const commandFiles = fs
      .readdirSync(folderPath)
      .filter((f) => f.endsWith('.ts') || f.endsWith('.js'));

    for (const file of commandFiles) {
      const command = (await import(pathToFileURL(path.join(folderPath, file)).href)).default;
      if (command?.data) {
        commands.push(command.data.toJSON());
      }
    }
  }

  const rest = new REST().setToken(token);

  if (guildId) {
    // Guild commands — propagation instantanée (idéal en développement)
    console.log(`📡 Déploiement de ${commands.length} commande(s) sur le serveur ${guildId}...`);
    await rest.put(Routes.applicationGuildCommands(clientId, guildId), { body: commands });
    console.log(`✅ ${commands.length} commande(s) déployée(s) sur le serveur (instantané).`);
  } else {
    // Global commands — jusqu'à 1h de propagation (pour la production)
    console.log(`📡 Déploiement global de ${commands.length} commande(s)...`);
    await rest.put(Routes.applicationCommands(clientId), { body: commands });
    console.log(`✅ ${commands.length} commande(s) déployée(s) globalement.`);
  }
}

deployCommands().catch(console.error);
