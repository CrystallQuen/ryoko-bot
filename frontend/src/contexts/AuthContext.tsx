import React, { createContext, useContext, useEffect, useState } from 'react';
import { api } from '../api/client';

interface DiscordUser {
  id: string;
  username: string;
  avatar: string | null;
  discriminator: string;
}

interface DiscordGuild {
  id: string;
  name: string;
  icon: string | null;
  permissions: string;
}

interface AuthContextValue {
  user: DiscordUser | null;
  guilds: DiscordGuild[];
  loading: boolean;
  logout: () => Promise<void>;
  refetch: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue>({
  user: null,
  guilds: [],
  loading: true,
  logout: async () => {},
  refetch: async () => {},
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<DiscordUser | null>(null);
  const [guilds, setGuilds] = useState<DiscordGuild[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchMe = async () => {
    try {
      const res = await api.get('/auth/me');
      setUser(res.data.user);
      setGuilds(res.data.guilds);
    } catch {
      setUser(null);
      setGuilds([]);
    } finally {
      setLoading(false);
    }
  };

  const logout = async () => {
    await api.post('/auth/logout').catch(() => null);
    setUser(null);
    setGuilds([]);
    window.location.href = '/';
  };

  useEffect(() => {
    fetchMe();
  }, []);

  return (
    <AuthContext.Provider value={{ user, guilds, loading, logout, refetch: fetchMe }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
