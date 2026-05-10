import axios from 'axios';

export const api = axios.create({
  baseURL: '/api',
  withCredentials: true,
  timeout: 10000,
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    // Ne pas rediriger pour /auth/me : AuthContext gère ce cas (user = null → page login)
    // Rediriger uniquement si la session expire pendant l'utilisation du dashboard
    const url: string = error.config?.url ?? '';
    if (error.response?.status === 401 && !url.includes('/auth/me')) {
      window.location.href = '/';
    }
    return Promise.reject(error);
  }
);

export type Guild = {
  id: string;
  name: string;
  icon: string | null;
  botPresent: boolean;
};

export type Sanction = {
  id: string;
  guildId: string;
  userId: string;
  moderatorId: string;
  type: 'BAN' | 'TEMPBAN' | 'KICK' | 'MUTE' | 'WARN';
  reason: string;
  active: boolean;
  duration: number | null;
  expiresAt: string | null;
  createdAt: string;
};

export type Event = {
  id: string;
  title: string;
  description: string | null;
  channelId: string;
  scheduledAt: string;
  roleId: string | null;
  reminded: boolean;
  createdAt: string;
};

export type GuildStats = {
  memberCount: number;
  banCount: number;
  sanctionCount: number;
  upcomingEvents: number;
  warningCount: number;
  channelCount: number;
  roleCount: number;
};

export type Channel = { id: string; name: string; type: number };
export type Role = { id: string; name: string; color: string; position: number };

export type RoleReaction = {
  id: string;
  guildId: string;
  channelId: string;
  messageId: string;
  emoji: string;
  roleId: string;
  category: string | null;
  description: string | null;
};
