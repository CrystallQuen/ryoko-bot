import {
  Client,
  GatewayIntentBits,
  Partials,
  Collection,
} from 'discord.js';
import { ExtendedClient } from '../types';
import { logger } from '../utils/logger';
import { loadCommands } from './loaders/commandLoader';
import { loadEvents } from './loaders/eventLoader';

export function createClient(): ExtendedClient {
  const client = new Client({
    intents: [
      GatewayIntentBits.Guilds,
      GatewayIntentBits.GuildMembers,
      GatewayIntentBits.GuildMessages,
      GatewayIntentBits.GuildMessageReactions,
      GatewayIntentBits.GuildModeration,
      GatewayIntentBits.MessageContent,
      GatewayIntentBits.DirectMessages,
      GatewayIntentBits.GuildScheduledEvents,
    ],
    partials: [
      Partials.Message,
      Partials.Channel,
      Partials.Reaction,
      Partials.GuildMember,
      Partials.User,
    ],
  }) as ExtendedClient;

  client.commands = new Collection();
  client.buttons = new Collection();
  client.selectMenus = new Collection();
  client.cooldowns = new Collection();

  return client;
}

export async function initializeBot(): Promise<ExtendedClient> {
  const client = createClient();

  logger.info('🔧 Chargement des commandes...');
  await loadCommands(client);

  logger.info('🔧 Chargement des événements...');
  await loadEvents(client);

  return client;
}
