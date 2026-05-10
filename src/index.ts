import 'dotenv/config';
import { logger } from './utils/logger';
import { connectDatabase } from './database';
import { initializeBot } from './bot/client';
import { createDashboard } from './dashboard/server';

async function main(): Promise<void> {
  logger.info('🚀 Démarrage de Ryoko Bot...');

  // Vérification des variables d'environnement obligatoires
  const required = ['DISCORD_TOKEN', 'DISCORD_CLIENT_ID', 'DISCORD_CLIENT_SECRET', 'DATABASE_URL', 'JWT_SECRET'];
  const missing = required.filter((k) => !process.env[k]);
  if (missing.length > 0) {
    logger.error(`❌ Variables d'environnement manquantes : ${missing.join(', ')}`);
    process.exit(1);
  }

  // Connexion base de données
  await connectDatabase();

  // Initialisation du bot Discord
  const client = await initializeBot();

  // Démarrage du dashboard web
  createDashboard(client);

  // Connexion Discord
  await client.login(process.env.DISCORD_TOKEN!);

  // Gestion de l'arrêt propre
  process.on('SIGINT', async () => {
    logger.info('🛑 Arrêt du bot...');
    client.destroy();
    process.exit(0);
  });

  process.on('SIGTERM', async () => {
    logger.info('🛑 Arrêt du bot (SIGTERM)...');
    client.destroy();
    process.exit(0);
  });

  process.on('unhandledRejection', (reason) => {
    logger.error('Unhandled rejection', { reason });
  });

  process.on('uncaughtException', (error) => {
    logger.error('Uncaught exception', { error });
    process.exit(1);
  });
}

main().catch((error) => {
  logger.error('Erreur fatale au démarrage', { error });
  process.exit(1);
});
