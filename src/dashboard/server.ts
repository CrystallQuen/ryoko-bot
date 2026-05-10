import express from 'express';
import { createServer } from 'http';
import { Server as SocketServer } from 'socket.io';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import cookieParser from 'cookie-parser';
import rateLimit from 'express-rate-limit';
import morgan from 'morgan';
import path from 'path';
import { Client } from 'discord.js';
import { logger } from '../utils/logger';
import { authRouter } from './routes/auth';
import { guildsRouter } from './routes/guilds';
import { moderationRouter } from './routes/moderation';
import { welcomeRouter } from './routes/welcome';
import { rolesRouter } from './routes/roles';
import { eventsRouter } from './routes/events';
import { gamesRouter } from './routes/games';
import { settingsRouter } from './routes/settings';
import { authMiddleware } from './middleware/auth';

export function createDashboard(client: Client): { app: express.Application; io: SocketServer } {
  const app = express();
  const httpServer = createServer(app);

  const io = new SocketServer(httpServer, {
    cors: {
      origin: process.env.DASHBOARD_URL ?? 'http://localhost:3000',
      credentials: true,
    },
  });

  // Sécurité & middlewares
  app.use(helmet({ contentSecurityPolicy: false }));
  app.use(compression());
  app.use(cookieParser());
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true }));

  app.use(
    cors({
      origin: process.env.DASHBOARD_URL ?? 'http://localhost:3000',
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
    })
  );

  // Logs HTTP
  if (process.env.NODE_ENV !== 'production') {
    app.use(morgan('dev'));
  }

  // Rate limiting global (toutes les routes API)
  const limiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 300,
    message: { error: 'Trop de requêtes, réessayez plus tard.' },
    skip: (req) => req.path === '/api/auth/me', // /me est déjà protégé par authMiddleware
  });
  app.use('/api/', limiter);

  // Limiter strict uniquement sur login/callback (flux OAuth2)
  const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 30,
    message: { error: 'Trop de tentatives d\'authentification.' },
  });
  app.use('/api/auth/login', authLimiter);
  app.use('/api/auth/callback', authLimiter);

  // Injection du client Discord
  app.set('client', client);
  app.set('io', io);

  // Routes API
  app.use('/api/auth', authRouter);
  app.use('/api/guilds', authMiddleware, guildsRouter(client));
  app.use('/api/guilds', authMiddleware, moderationRouter);
  app.use('/api/guilds', authMiddleware, welcomeRouter);
  app.use('/api/guilds', authMiddleware, rolesRouter);
  app.use('/api/guilds', authMiddleware, eventsRouter);
  app.use('/api/guilds', authMiddleware, gamesRouter);
  app.use('/api/guilds', authMiddleware, settingsRouter);

  // Servir le frontend en production
  const frontendPath = path.join(__dirname, '../../frontend/dist');
  app.use(express.static(frontendPath));
  app.get('*', (_req, res) => {
    res.sendFile(path.join(frontendPath, 'index.html'));
  });

  // Gestion des erreurs
  app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    logger.error('Erreur Express', { error: err.message, stack: err.stack });
    res.status(500).json({ error: 'Erreur interne du serveur' });
  });

  // WebSocket
  io.on('connection', (socket) => {
    logger.debug('Client WebSocket connecté', { id: socket.id });

    socket.on('join:guild', (guildId: string) => {
      socket.join(`guild:${guildId}`);
    });

    socket.on('disconnect', () => {
      logger.debug('Client WebSocket déconnecté', { id: socket.id });
    });
  });

  const port = parseInt(process.env.PORT ?? process.env.BOT_API_PORT ?? '4000', 10);
  httpServer.listen(port, () => {
    logger.info(`🌐 Dashboard API démarré sur le port ${port}`);
  });

  return { app, io };
}
