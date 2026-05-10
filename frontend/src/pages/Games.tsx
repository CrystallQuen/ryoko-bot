import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { api } from '../api/client';
import { Gamepad2, Trophy, BookOpen } from 'lucide-react';
import toast from 'react-hot-toast';

interface LeaderboardEntry { userId: string; score: number }
interface GameStats {
  shiritori: { totalSessions: number; leaderboard: LeaderboardEntry[] };
  jpStory: { totalSessions: number; leaderboard: LeaderboardEntry[] };
}

export default function Games() {
  const { guildId } = useParams<{ guildId: string }>();
  const [stats, setStats] = useState<GameStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!guildId) return;
    api.get<GameStats>(`/guilds/${guildId}/games/stats`)
      .then((res) => setStats(res.data))
      .catch(() => toast.error('Erreur de chargement'))
      .finally(() => setLoading(false));
  }, [guildId]);

  if (loading) return <div className="text-center py-12 text-gray-400">Chargement...</div>;

  const MEDALS = ['🥇', '🥈', '🥉'];

  return (
    <div>
      <div className="flex items-center gap-3 mb-8">
        <div className="w-10 h-10 bg-discord-blurple/20 rounded-lg flex items-center justify-center">
          <Gamepad2 className="w-5 h-5 text-discord-blurple" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-white">Jeux Japonais</h1>
          <p className="text-gray-400 text-sm">Statistiques et classements</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Shiritori */}
        <div className="card">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 bg-discord-fuchsia/20 rounded-lg flex items-center justify-center text-xl">🎮</div>
            <div>
              <h2 className="text-white font-bold text-lg">Shiritori</h2>
              <p className="text-gray-400 text-sm font-jp">しりとり</p>
            </div>
            <div className="ml-auto text-right">
              <div className="text-2xl font-bold text-discord-fuchsia">{stats?.shiritori.totalSessions ?? 0}</div>
              <div className="text-gray-500 text-xs">parties jouées</div>
            </div>
          </div>

          <div className="mb-4">
            <p className="text-xs text-gray-500 mb-3">Commandes Discord :</p>
            <div className="space-y-1">
              {['/shiritori start', '/shiritori play [mot]', '/shiritori stop', '/shiritori score'].map((cmd) => (
                <code key={cmd} className="block text-xs bg-discord-darkest px-2 py-1 rounded text-discord-blurple">{cmd}</code>
              ))}
            </div>
          </div>

          <div>
            <h3 className="text-white text-sm font-semibold mb-3 flex items-center gap-2">
              <Trophy className="w-4 h-4 text-discord-yellow" /> Classement
            </h3>
            {stats?.shiritori.leaderboard.length === 0 ? (
              <p className="text-gray-500 text-sm text-center py-4">Aucune partie encore</p>
            ) : (
              <div className="space-y-2">
                {stats?.shiritori.leaderboard.slice(0, 5).map((entry, i) => (
                  <div key={entry.userId} className="flex items-center gap-3 px-3 py-2 bg-discord-darkest rounded-lg">
                    <span className="text-lg w-6">{MEDALS[i] ?? `${i + 1}.`}</span>
                    <span className="text-gray-300 text-sm font-mono flex-1 truncate">{entry.userId}</span>
                    <span className="text-discord-blurple font-bold">{entry.score} pts</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* jp-story */}
        <div className="card">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 bg-discord-green/20 rounded-lg flex items-center justify-center text-xl">📖</div>
            <div>
              <h2 className="text-white font-bold text-lg">Histoire Japonaise</h2>
              <p className="text-gray-400 text-sm font-jp">日本語作文</p>
            </div>
            <div className="ml-auto text-right">
              <div className="text-2xl font-bold text-discord-green">{stats?.jpStory.totalSessions ?? 0}</div>
              <div className="text-gray-500 text-xs">histoires créées</div>
            </div>
          </div>

          <div className="mb-4">
            <p className="text-xs text-gray-500 mb-3">Commandes Discord :</p>
            <div className="space-y-1">
              {['/jp-story start', '/jp-story write [phrase]', '/jp-story stop', '/jp-story scores'].map((cmd) => (
                <code key={cmd} className="block text-xs bg-discord-darkest px-2 py-1 rounded text-discord-green">{cmd}</code>
              ))}
            </div>
          </div>

          <div className="mb-4 p-3 bg-discord-darkest/50 rounded-lg">
            <h3 className="text-white text-xs font-semibold mb-2 flex items-center gap-1">
              <BookOpen className="w-3 h-3" /> Système de score
            </h3>
            <div className="text-xs text-gray-400 space-y-1">
              <p>• Kanji utilisés : <span className="text-discord-green">+2 pts/kanji</span></p>
              <p>• Ponctuation japonaise : <span className="text-discord-green">+3 pts</span></p>
              <p>• Phrase longue (20+ chars) : <span className="text-discord-green">+5 pts</span></p>
              <p>• Phrase très longue (40+) : <span className="text-discord-green">+5 pts</span></p>
              <p>• Trop de caractères latins : <span className="text-discord-red">-5 pts</span></p>
            </div>
          </div>

          <div>
            <h3 className="text-white text-sm font-semibold mb-3 flex items-center gap-2">
              <Trophy className="w-4 h-4 text-discord-yellow" /> Classement
            </h3>
            {stats?.jpStory.leaderboard.length === 0 ? (
              <p className="text-gray-500 text-sm text-center py-4">Aucune histoire encore</p>
            ) : (
              <div className="space-y-2">
                {stats?.jpStory.leaderboard.slice(0, 5).map((entry, i) => (
                  <div key={entry.userId} className="flex items-center gap-3 px-3 py-2 bg-discord-darkest rounded-lg">
                    <span className="text-lg w-6">{MEDALS[i] ?? `${i + 1}.`}</span>
                    <span className="text-gray-300 text-sm font-mono flex-1 truncate">{entry.userId}</span>
                    <span className="text-discord-green font-bold">{entry.score} pts</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
