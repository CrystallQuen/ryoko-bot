import 'dotenv/config';
import { createServer } from 'http';
import { logger } from './utils/logger';
import { connectDatabase } from './database';
import { initializeBot } from './bot/client';

async function main(): Promise<void> {
  logger.info('🚀 Démarrage de Ryoko Bot...');

  // Vérification des variables d'environnement obligatoires
  const required = ['DISCORD_TOKEN', 'DISCORD_CLIENT_ID', 'DATABASE_URL'];
  const missing = required.filter((k) => !process.env[k]);
  if (missing.length > 0) {
    logger.error(`❌ Variables d'environnement manquantes : ${missing.join(', ')}`);
    process.exit(1);
  }

  // Connexion base de données
  await connectDatabase();

  // Initialisation du bot Discord
  const client = await initializeBot();

  // Connexion Discord
  await client.login(process.env.DISCORD_TOKEN!);

  // Health check HTTP pour Fly.io (garde la machine active)
  const port = parseInt(process.env.PORT ?? '8080', 10);
  createServer((_, res) => {
    res.writeHead(200);
    res.end('ok');
  }).listen(port, () => {
    logger.info(`🩺 Health check en écoute sur le port ${port}`);
  });

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
