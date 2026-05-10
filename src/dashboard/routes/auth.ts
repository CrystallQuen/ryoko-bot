import { Router, Request, Response } from 'express';
import axios from 'axios';
import jwt from 'jsonwebtoken';
import { prisma } from '../../database';
import { logger } from '../../utils/logger';

export const authRouter = Router();

const DISCORD_API = 'https://discord.com/api/v10';

// Cache mémoire pour /me — TTL 5 min par session
interface CachedMe { user: unknown; guilds: unknown; at: number }
const meCache = new Map<string, CachedMe>();
const ME_TTL = 5 * 60 * 1000;

authRouter.get('/login', (_req: Request, res: Response) => {
  const params = new URLSearchParams({
    client_id: process.env.DISCORD_CLIENT_ID!,
    redirect_uri: process.env.OAUTH2_REDIRECT_URI!,
    response_type: 'code',
    scope: 'identify guilds',
    prompt: 'none',
  });
  res.redirect(`https://discord.com/api/oauth2/authorize?${params}`);
});

authRouter.get('/callback', async (req: Request, res: Response) => {
  const { code } = req.query;
  if (!code || typeof code !== 'string') {
    return res.redirect(`${process.env.DASHBOARD_URL}?error=missing_code`);
  }

  try {
    // Échange du code contre un token Discord
    const tokenRes = await axios.post(
      `${DISCORD_API}/oauth2/token`,
      new URLSearchParams({
        client_id: process.env.DISCORD_CLIENT_ID!,
        client_secret: process.env.DISCORD_CLIENT_SECRET!,
        grant_type: 'authorization_code',
        code,
        redirect_uri: process.env.OAUTH2_REDIRECT_URI!,
      }),
      { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
    );

    const { access_token } = tokenRes.data;

    // Récupération des infos utilisateur Discord
    const userRes = await axios.get(`${DISCORD_API}/users/@me`, {
      headers: { Authorization: `Bearer ${access_token}` },
    });
    const discordUser = userRes.data;

    // Création du JWT
    const expiresAt = new Date(Date.now() + 7 * 24 * 3600 * 1000);
    const session = await prisma.dashboardSession.create({
      data: {
        userId: discordUser.id,
        accessToken: access_token,
        expiresAt,
      },
    });

    const jwtToken = jwt.sign(
      { userId: discordUser.id, sessionId: session.id },
      process.env.JWT_SECRET!,
      { expiresIn: '7d' }
    );

    res.cookie('token', jwtToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 7 * 24 * 3600 * 1000,
    });

    logger.info('Connexion dashboard', { userId: discordUser.id });
    res.redirect(`${process.env.DASHBOARD_URL}/dashboard`);
  } catch (error) {
    logger.error('Erreur OAuth2 callback', { error });
    res.redirect(`${process.env.DASHBOARD_URL}?error=auth_failed`);
  }
});

authRouter.get('/me', async (req: Request, res: Response) => {
  const token = req.cookies?.token ?? req.headers.authorization?.replace('Bearer ', '');
  if (!token) return res.status(401).json({ error: 'Non authentifié' });

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET!) as { userId: string; sessionId: string };
    const session = await prisma.dashboardSession.findFirst({
      where: { userId: payload.userId, accessToken: { not: '' }, expiresAt: { gte: new Date() } },
    });

    if (!session) return res.status(401).json({ error: 'Session expirée' });

    // Retourne le cache si encore frais
    const cached = meCache.get(session.id);
    if (cached && Date.now() - cached.at < ME_TTL) {
      return res.json({ user: cached.user, guilds: cached.guilds });
    }

    const [userRes, guildsRes] = await Promise.all([
      axios.get(`${DISCORD_API}/users/@me`, {
        headers: { Authorization: `Bearer ${session.accessToken}` },
      }),
      axios.get(`${DISCORD_API}/users/@me/guilds`, {
        headers: { Authorization: `Bearer ${session.accessToken}` },
      }),
    ]);

    meCache.set(session.id, { user: userRes.data, guilds: guildsRes.data, at: Date.now() });
    res.json({ user: userRes.data, guilds: guildsRes.data });
  } catch {
    res.status(401).json({ error: 'Token invalide' });
  }
});

authRouter.post('/logout', async (req: Request, res: Response) => {
  const token = req.cookies?.token;
  if (token) {
    try {
      const payload = jwt.verify(token, process.env.JWT_SECRET!) as { userId: string; sessionId: string };
      meCache.delete(payload.sessionId);
      await prisma.dashboardSession.deleteMany({ where: { userId: payload.userId } });
    } catch {
      // token invalide, on déconnecte quand même
    }
  }
  res.clearCookie('token');
  res.json({ success: true });
});
