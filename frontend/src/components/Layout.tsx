import { Outlet, useParams, NavLink } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import {
  Home, Shield, Gift, Users, Calendar, Gamepad2,
  Settings, LogOut, Bot, ChevronRight,
} from 'lucide-react';
import { useState } from 'react';
import { api } from '../api/client';
import type { Guild } from '../api/client';
import { useEffect } from 'react';
import clsx from 'clsx';

const navItems = [
  { to: '', label: 'Accueil', icon: Home },
  { to: 'moderation', label: 'Modération', icon: Shield },
  { to: 'welcome', label: 'Bienvenue', icon: Gift },
  { to: 'roles', label: 'Rôles', icon: Users },
  { to: 'events', label: 'Événements', icon: Calendar },
  { to: 'games', label: 'Jeux JP', icon: Gamepad2 },
  { to: 'settings', label: 'Paramètres', icon: Settings },
];

function GuildIcon({ guild }: { guild: Guild }) {
  if (guild.icon) {
    return (
      <img
        src={`https://cdn.discordapp.com/icons/${guild.id}/${guild.icon}.png`}
        alt={guild.name}
        className="w-10 h-10 rounded-full"
      />
    );
  }
  return (
    <div className="w-10 h-10 rounded-full bg-discord-blurple flex items-center justify-center text-white font-bold">
      {guild.name.charAt(0)}
    </div>
  );
}

export default function Layout() {
  const { user, logout } = useAuth();
  const { guildId } = useParams();
  const [guilds, setGuilds] = useState<Guild[]>([]);
  const [currentGuild, setCurrentGuild] = useState<Guild | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);

  useEffect(() => {
    api.get<Guild[]>('/guilds').then((res) => {
      const botGuilds = res.data.filter((g) => g.botPresent);
      setGuilds(botGuilds);
      if (guildId) {
        const found = botGuilds.find((g) => g.id === guildId);
        if (found) setCurrentGuild(found);
      }
    }).catch(() => null);
  }, [guildId]);

  const avatarUrl = user?.avatar
    ? `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.png`
    : `https://cdn.discordapp.com/embed/avatars/0.png`;

  return (
    <div className="flex min-h-screen bg-discord-darkest">
      {/* Sidebar */}
      <aside className={clsx(
        'flex flex-col bg-discord-darker border-r border-discord-darkest/50 transition-all duration-300 z-10',
        sidebarOpen ? 'w-64' : 'w-16'
      )}>
        {/* Logo */}
        <div className="flex items-center gap-3 px-4 py-5 border-b border-discord-darkest/50">
          <div className="w-8 h-8 bg-discord-blurple rounded-lg flex items-center justify-center flex-shrink-0">
            <Bot className="w-5 h-5 text-white" />
          </div>
          {sidebarOpen && <span className="font-bold text-white text-lg">Ryoko</span>}
        </div>

        {/* Guild selector */}
        {guildId && currentGuild && sidebarOpen && (
          <div className="px-4 py-3 border-b border-discord-darkest/50">
            <div className="flex items-center gap-2">
              <GuildIcon guild={currentGuild} />
              <div className="flex-1 min-w-0">
                <p className="text-white text-sm font-medium truncate">{currentGuild.name}</p>
                <p className="text-gray-400 text-xs">Serveur actif</p>
              </div>
            </div>
          </div>
        )}

        {/* Navigation */}
        <nav className="flex-1 py-4 px-2 space-y-1 overflow-y-auto">
          {guildId ? (
            navItems.map(({ to, label, icon: Icon }) => (
              <NavLink
                key={to}
                to={to ? `/dashboard/${guildId}/${to}` : `/dashboard`}
                end={!to}
                className={({ isActive }) =>
                  clsx(
                    'flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors text-sm',
                    isActive
                      ? 'bg-discord-blurple text-white'
                      : 'text-gray-400 hover:bg-discord-darkest/50 hover:text-white'
                  )
                }
              >
                <Icon className="w-5 h-5 flex-shrink-0" />
                {sidebarOpen && <span>{label}</span>}
              </NavLink>
            ))
          ) : (
            <NavLink
              to="/dashboard"
              end
              className={({ isActive }) =>
                clsx(
                  'flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors text-sm',
                  isActive ? 'bg-discord-blurple text-white' : 'text-gray-400 hover:bg-discord-darkest/50 hover:text-white'
                )
              }
            >
              <Home className="w-5 h-5 flex-shrink-0" />
              {sidebarOpen && <span>Accueil</span>}
            </NavLink>
          )}
        </nav>

        {/* User footer */}
        <div className="p-3 border-t border-discord-darkest/50">
          <div className="flex items-center gap-3">
            <img src={avatarUrl} alt={user?.username} className="w-8 h-8 rounded-full flex-shrink-0" />
            {sidebarOpen && (
              <>
                <div className="flex-1 min-w-0">
                  <p className="text-white text-sm font-medium truncate">{user?.username}</p>
                  <p className="text-gray-500 text-xs">En ligne</p>
                </div>
                <button onClick={logout} className="text-gray-400 hover:text-discord-red transition-colors" title="Déconnexion">
                  <LogOut className="w-4 h-4" />
                </button>
              </>
            )}
          </div>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Topbar */}
        <header className="h-14 bg-discord-darker border-b border-discord-darkest/50 flex items-center px-4 gap-4">
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="text-gray-400 hover:text-white transition-colors"
          >
            <ChevronRight className={clsx('w-5 h-5 transition-transform', sidebarOpen && 'rotate-180')} />
          </button>

          {!guildId && guilds.length > 0 && (
            <div className="flex items-center gap-2 overflow-x-auto">
              {guilds.slice(0, 5).map((g) => (
                <NavLink
                  key={g.id}
                  to={`/dashboard/${g.id}`}
                  className="flex items-center gap-2 px-3 py-1.5 rounded-md bg-discord-darkest hover:bg-discord-blurple/20 transition-colors text-sm whitespace-nowrap"
                >
                  <GuildIcon guild={g} />
                  <span className="text-white hidden sm:block">{g.name}</span>
                </NavLink>
              ))}
            </div>
          )}
        </header>

        <main className="flex-1 p-6 overflow-y-auto animate-fade-in">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
