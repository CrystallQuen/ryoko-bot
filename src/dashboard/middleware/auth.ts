import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { prisma } from '../../database';
import { JwtPayload } from '../../types';

export async function authMiddleware(req: Request, res: Response, next: NextFunction): Promise<void> {
  const token =
    req.cookies?.token ??
    req.headers.authorization?.replace('Bearer ', '');

  if (!token) {
    res.status(401).json({ error: 'Non authentifié' });
    return;
  }

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET!) as JwtPayload;

    const session = await prisma.dashboardSession.findFirst({
      where: {
        id: payload.sessionId,
        userId: payload.userId,
        expiresAt: { gte: new Date() },
      },
    });

    if (!session) {
      res.status(401).json({ error: 'Session expirée ou invalide' });
      return;
    }

    (req as Request & { userId: string; sessionId: string }).userId = payload.userId;
    (req as Request & { userId: string; sessionId: string }).sessionId = payload.sessionId;
    next();
  } catch {
    res.status(401).json({ error: 'Token invalide' });
  }
}

export type AuthRequest = Request & { userId: string; sessionId: string };
