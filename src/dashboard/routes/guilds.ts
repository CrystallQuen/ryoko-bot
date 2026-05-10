import { Router, Response } from 'express';
import { Client, PermissionFlagsBits } from 'discord.js';
import axios from 'axios';
import { prisma } from '../../database';
import { AuthRequest } from '../middleware/auth';
import { logger } from '../../utils/logger';

export function guildsRouter(client: Client): Router {
  const router = Router();

  // Liste des serveurs où l'utilisateur est admin ET le bot est présent
  router.get('/', async (req, res: Response) => {
    const authReq = req as AuthRequest;
    try {
      const session = await prisma.dashboardSession.findFirst({
        where: { userId: authReq.userId, expiresAt: { gte: new Date() } },
      });
      if (!session) return res.status(401).json({ error: 'Session invalide' });

      const guildsRes = await axios.get('https://discord.com/api/v10/users/@me/guilds', {
        headers: { Authorization: `Bearer ${session.accessToken}` },
      });

      const userGuilds = guildsRes.data as { id: string; name: string; icon: string | null; permissions: string }[];

      const managedGuilds = userGuilds.filter((g) => {
        const perms = BigInt(g.permissions);
        return (perms & BigInt(PermissionFlagsBits.Administrator)) !== BigInt(0) ||
               (perms & BigInt(PermissionFlagsBits.ManageGuild)) !== BigInt(0);
      });

      const result = managedGuilds.map((g) => ({
        id: g.id,
        name: g.name,
        icon: g.icon,
        botPresent: client.guilds.cache.has(g.id),
      }));

      res.json(result);
    } catch (error) {
      logger.error('Erreur /guilds', { error });
      res.status(500).json({ error: 'Erreur interne' });
    }
  });

  // Statistiques d'un serveur
  router.get('/:guildId/stats', async (req, res: Response) => {
    const { guildId } = req.params;
    try {
      const guild = client.guilds.cache.get(guildId);
      if (!guild) return res.status(404).json({ error: 'Bot absent de ce serveur' });

      const [members, bans, sanctions, events, warnings] = await Promise.all([
        guild.members.fetch().then((m) => m.size).catch(() => guild.memberCount),
        guild.bans.fetch().then((b) => b.size).catch(() => 0),
        prisma.sanction.count({ where: { guildId } }),
        prisma.event.count({ where: { guildId, scheduledAt: { gte: new Date() } } }),
        prisma.warning.count({ where: { guildId } }),
      ]);

      res.json({
        memberCount: members,
        banCount: bans,
        sanctionCount: sanctions,
        upcomingEvents: events,
        warningCount: warnings,
        channelCount: guild.channels.cache.size,
        roleCount: guild.roles.cache.size,
      });
    } catch (error) {
      logger.error('Erreur stats guild', { error });
      res.status(500).json({ error: 'Erreur interne' });
    }
  });

  // Liste des channels texte d'un serveur
  router.get('/:guildId/channels', async (req, res: Response) => {
    const { guildId } = req.params;
    const guild = client.guilds.cache.get(guildId);
    if (!guild) return res.status(404).json({ error: 'Serveur introuvable' });

    const channels = guild.channels.cache
      .filter((c) => c.isTextBased())
      .map((c) => ({ id: c.id, name: (c as { name: string }).name, type: c.type }));

    res.json(channels);
  });

  // Liste des rôles d'un serveur
  router.get('/:guildId/roles', async (req, res: Response) => {
    const { guildId } = req.params;
    const guild = client.guilds.cache.get(guildId);
    if (!guild) return res.status(404).json({ error: 'Serveur introuvable' });

    const roles = guild.roles.cache
      .filter((r) => !r.managed && r.id !== guild.id)
      .sort((a, b) => b.position - a.position)
      .map((r) => ({ id: r.id, name: r.name, color: r.hexColor, position: r.position }));

    res.json(roles);
  });

  return router;
}
