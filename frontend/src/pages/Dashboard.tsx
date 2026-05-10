import { useEffect, useState } from 'react';
import { NavLink } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { api } from '../api/client';
import type { Guild } from '../api/client';
import { Bot, ExternalLink, Users } from 'lucide-react';

function GuildCard({ guild }: { guild: Guild }) {
  const iconUrl = guild.icon
    ? `https://cdn.discordapp.com/icons/${guild.id}/${guild.icon}.png?size=64`
    : null;

  return (
    <NavLink
      to={`/dashboard/${guild.id}`}
      className="card hover:border-discord-blurple/50 hover:-translate-y-1 transition-all duration-200 flex items-center gap-4 group"
    >
      {iconUrl ? (
        <img src={iconUrl} alt={guild.name} className="w-14 h-14 rounded-full" />
      ) : (
        <div className="w-14 h-14 rounded-full bg-discord-blurple flex items-center justify-center text-white font-bold text-xl">
          {guild.name.charAt(0)}
        </div>
      )}
      <div className="flex-1 min-w-0">
        <h3 className="text-white font-semibold truncate">{guild.name}</h3>
        <p className="text-discord-green text-sm flex items-center gap-1">
          <Bot className="w-3.5 h-3.5" /> Bot présent
        </p>
      </div>
      <ExternalLink className="w-4 h-4 text-gray-500 group-hover:text-discord-blurple transition-colors" />
    </NavLink>
  );
}

export default function Dashboard() {
  const { user } = useAuth();
  const [guilds, setGuilds] = useState<Guild[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get<Guild[]>('/guilds')
      .then((res) => setGuilds(res.data))
      .catch(() => null)
      .finally(() => setLoading(false));
  }, []);

  const botGuilds = guilds.filter((g) => g.botPresent);
  const missingGuilds = guilds.filter((g) => !g.botPresent);

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-white">
          Bonjour, <span className="text-discord-blurple">{user?.username}</span> 👋
        </h1>
        <p className="text-gray-400 mt-1">Sélectionnez un serveur à gérer</p>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="card animate-pulse h-24 bg-discord-darker/50" />
          ))}
        </div>
      ) : (
        <>
          {botGuilds.length > 0 && (
            <section className="mb-8">
              <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                <Bot className="w-5 h-5 text-discord-green" />
                Serveurs avec Ryoko ({botGuilds.length})
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {botGuilds.map((g) => <GuildCard key={g.id} guild={g} />)}
              </div>
            </section>
          )}

          {missingGuilds.length > 0 && (
            <section>
              <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                <Users className="w-5 h-5 text-gray-500" />
                Ajouter Ryoko à un serveur ({missingGuilds.length})
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {missingGuilds.map((g) => (
                  <a
                    key={g.id}
                    href={`https://discord.com/oauth2/authorize?client_id=${import.meta.env.VITE_DISCORD_CLIENT_ID ?? ''}&guild_id=${g.id}&scope=bot+applications.commands&permissions=8`}
                    target="_blank"
                    rel="noreferrer"
                    className="card hover:border-discord-yellow/50 transition-all flex items-center gap-4 opacity-60 hover:opacity-100"
                  >
                    {g.icon ? (
                      <img src={`https://cdn.discordapp.com/icons/${g.id}/${g.icon}.png?size=64`} alt={g.name} className="w-14 h-14 rounded-full" />
                    ) : (
                      <div className="w-14 h-14 rounded-full bg-discord-darker border-2 border-dashed border-gray-600 flex items-center justify-center text-gray-500 text-xl font-bold">
                        {g.name.charAt(0)}
                      </div>
                    )}
                    <div className="flex-1">
                      <h3 className="text-white font-semibold">{g.name}</h3>
                      <p className="text-discord-yellow text-sm">Cliquer pour inviter</p>
                    </div>
                  </a>
                ))}
              </div>
            </section>
          )}

          {guilds.length === 0 && (
            <div className="text-center py-16">
              <Bot className="w-16 h-16 text-gray-600 mx-auto mb-4" />
              <h2 className="text-xl font-semibold text-gray-400">Aucun serveur trouvé</h2>
              <p className="text-gray-500 mt-2">Vous devez être administrateur d'un serveur pour le gérer.</p>
            </div>
          )}
        </>
      )}
    </div>
  );
}
