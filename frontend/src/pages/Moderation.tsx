import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { api } from '../api/client';
import type { Sanction } from '../api/client';
import { Shield, X, Check } from 'lucide-react';
import toast from 'react-hot-toast';
import clsx from 'clsx';

const TYPE_LABELS: Record<string, string> = {
  BAN: 'Ban', TEMPBAN: 'Ban Temp.', KICK: 'Kick', MUTE: 'Mute', WARN: 'Warn',
};
const TYPE_COLORS: Record<string, string> = {
  BAN: 'bg-discord-red/20 text-discord-red',
  TEMPBAN: 'bg-orange-500/20 text-orange-400',
  KICK: 'bg-discord-yellow/20 text-discord-yellow',
  MUTE: 'bg-discord-fuchsia/20 text-discord-fuchsia',
  WARN: 'bg-blue-500/20 text-blue-400',
};

export default function Moderation() {
  const { guildId } = useParams<{ guildId: string }>();
  const [sanctions, setSanctions] = useState<Sanction[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);

  const fetchSanctions = async () => {
    if (!guildId) return;
    setLoading(true);
    try {
      const res = await api.get(`/guilds/${guildId}/moderation/sanctions?page=${page}&limit=20`);
      setSanctions(res.data.sanctions);
      setTotal(res.data.total);
    } catch {
      toast.error('Erreur lors du chargement des sanctions');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchSanctions(); }, [guildId, page]);

  const revoke = async (id: string) => {
    if (!guildId) return;
    try {
      await api.patch(`/guilds/${guildId}/moderation/sanctions/${id}/revoke`);
      toast.success('Sanction révoquée');
      setSanctions((s) => s.map((x) => x.id === id ? { ...x, active: false } : x));
    } catch {
      toast.error('Erreur lors de la révocation');
    }
  };

  return (
    <div>
      <div className="flex items-center gap-3 mb-8">
        <div className="w-10 h-10 bg-discord-red/20 rounded-lg flex items-center justify-center">
          <Shield className="w-5 h-5 text-discord-red" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-white">Modération</h1>
          <p className="text-gray-400 text-sm">{total} sanction(s) au total</p>
        </div>
      </div>

      <div className="card overflow-hidden p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-discord-darkest/50 text-left">
                <th className="px-6 py-4 text-gray-400 font-medium">Type</th>
                <th className="px-6 py-4 text-gray-400 font-medium">Membre</th>
                <th className="px-6 py-4 text-gray-400 font-medium">Raison</th>
                <th className="px-6 py-4 text-gray-400 font-medium">Modérateur</th>
                <th className="px-6 py-4 text-gray-400 font-medium">Date</th>
                <th className="px-6 py-4 text-gray-400 font-medium">Statut</th>
                <th className="px-6 py-4 text-gray-400 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                [...Array(5)].map((_, i) => (
                  <tr key={i} className="border-b border-discord-darkest/30">
                    {[...Array(7)].map((_, j) => (
                      <td key={j} className="px-6 py-4">
                        <div className="h-4 bg-discord-darkest rounded animate-pulse" />
                      </td>
                    ))}
                  </tr>
                ))
              ) : sanctions.length === 0 ? (
                <tr><td colSpan={7} className="text-center py-12 text-gray-500">Aucune sanction</td></tr>
              ) : (
                sanctions.map((s) => (
                  <tr key={s.id} className="border-b border-discord-darkest/30 hover:bg-discord-darkest/20">
                    <td className="px-6 py-4">
                      <span className={clsx('badge', TYPE_COLORS[s.type])}>{TYPE_LABELS[s.type]}</span>
                    </td>
                    <td className="px-6 py-4 text-discord-light font-mono text-xs">{s.userId}</td>
                    <td className="px-6 py-4 text-gray-300 max-w-xs truncate">{s.reason}</td>
                    <td className="px-6 py-4 text-gray-400 font-mono text-xs">{s.moderatorId}</td>
                    <td className="px-6 py-4 text-gray-400 text-xs">
                      {new Date(s.createdAt).toLocaleDateString('fr-FR')}
                    </td>
                    <td className="px-6 py-4">
                      {s.active ? (
                        <span className="badge bg-discord-green/20 text-discord-green">Actif</span>
                      ) : (
                        <span className="badge bg-gray-500/20 text-gray-400">Terminé</span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      {s.active && (
                        <button
                          onClick={() => revoke(s.id)}
                          className="flex items-center gap-1 text-discord-red hover:text-discord-red/80 text-xs transition-colors"
                        >
                          <X className="w-3.5 h-3.5" /> Révoquer
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {total > 20 && (
          <div className="flex justify-between items-center px-6 py-4 border-t border-discord-darkest/50">
            <span className="text-gray-400 text-sm">Page {page} / {Math.ceil(total / 20)}</span>
            <div className="flex gap-2">
              <button
                onClick={() => setPage(Math.max(1, page - 1))}
                disabled={page === 1}
                className="btn-primary text-xs py-1 px-3 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Précédent
              </button>
              <button
                onClick={() => setPage(page + 1)}
                disabled={page >= Math.ceil(total / 20)}
                className="btn-primary text-xs py-1 px-3 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Suivant
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
