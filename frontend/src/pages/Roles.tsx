import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { api } from '../api/client';
import type { RoleReaction, Channel, Role } from '../api/client';
import { Users, Plus, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';

const JP_LEVEL_EMOJIS = [
  { emoji: '🫘', label: 'N5 — Débutant' },
  { emoji: '🌱', label: 'N4 — Élémentaire' },
  { emoji: '🌸', label: 'N3 — Intermédiaire' },
  { emoji: '🌷', label: 'N2 — Avancé' },
  { emoji: '💮', label: 'N1 — Expert' },
];

export default function Roles() {
  const { guildId } = useParams<{ guildId: string }>();
  const [reactions, setReactions] = useState<RoleReaction[]>([]);
  const [channels, setChannels] = useState<Channel[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({ channelId: '', messageId: '', emoji: '', roleId: '', category: '', description: '' });
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    if (!guildId) return;
    Promise.all([
      api.get<RoleReaction[]>(`/guilds/${guildId}/roles/reactions`),
      api.get<Channel[]>(`/guilds/${guildId}/channels`),
      api.get<Role[]>(`/guilds/${guildId}/roles`),
    ]).then(([r, c, ro]) => {
      setReactions(r.data);
      setChannels(c.data.filter((x) => x.type === 0));
      setRoles(ro.data);
    }).catch(() => toast.error('Erreur de chargement'))
      .finally(() => setLoading(false));
  }, [guildId]);

  const handleCreate = async () => {
    if (!guildId || !form.channelId || !form.messageId || !form.emoji || !form.roleId) {
      return toast.error('Remplissez tous les champs obligatoires');
    }
    setCreating(true);
    try {
      const res = await api.post<RoleReaction>(`/guilds/${guildId}/roles/reactions`, form);
      setReactions([res.data, ...reactions]);
      setForm({ channelId: '', messageId: '', emoji: '', roleId: '', category: '', description: '' });
      toast.success('Rôle par réaction créé !');
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error ?? 'Erreur';
      toast.error(msg);
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!guildId) return;
    try {
      await api.delete(`/guilds/${guildId}/roles/reactions/${id}`);
      setReactions(reactions.filter((r) => r.id !== id));
      toast.success('Supprimé');
    } catch {
      toast.error('Erreur lors de la suppression');
    }
  };

  if (loading) return <div className="text-center py-12 text-gray-400">Chargement...</div>;

  return (
    <div>
      <div className="flex items-center gap-3 mb-8">
        <div className="w-10 h-10 bg-discord-fuchsia/20 rounded-lg flex items-center justify-center">
          <Users className="w-5 h-5 text-discord-fuchsia" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-white">Rôles par réaction</h1>
          <p className="text-gray-400 text-sm">Attributions de rôles via emojis</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Formulaire */}
        <div className="card">
          <h2 className="text-white font-semibold mb-4 flex items-center gap-2">
            <Plus className="w-4 h-4" /> Nouveau rôle par réaction
          </h2>

          <div className="space-y-3">
            <div>
              <label className="block text-sm text-gray-400 mb-1">Salon *</label>
              <select value={form.channelId} onChange={(e) => setForm({ ...form, channelId: e.target.value })} className="input">
                <option value="">— Salon —</option>
                {channels.map((c) => <option key={c.id} value={c.id}>#{c.name}</option>)}
              </select>
            </div>

            <div>
              <label className="block text-sm text-gray-400 mb-1">ID du message *</label>
              <input
                value={form.messageId}
                onChange={(e) => setForm({ ...form, messageId: e.target.value })}
                placeholder="123456789012345678"
                className="input"
              />
            </div>

            <div>
              <label className="block text-sm text-gray-400 mb-1">Emoji *</label>
              <div className="flex gap-2">
                <input
                  value={form.emoji}
                  onChange={(e) => setForm({ ...form, emoji: e.target.value })}
                  placeholder="🌸 ou :nom_emoji:"
                  className="input flex-1"
                />
                <div className="flex gap-1">
                  {JP_LEVEL_EMOJIS.map(({ emoji }) => (
                    <button
                      key={emoji}
                      onClick={() => setForm({ ...form, emoji })}
                      className="w-8 h-8 flex items-center justify-center hover:bg-discord-darkest rounded transition-colors text-lg"
                      title={emoji}
                    >
                      {emoji}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div>
              <label className="block text-sm text-gray-400 mb-1">Rôle *</label>
              <select value={form.roleId} onChange={(e) => setForm({ ...form, roleId: e.target.value })} className="input">
                <option value="">— Rôle —</option>
                {roles.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
              </select>
            </div>

            <div>
              <label className="block text-sm text-gray-400 mb-1">Catégorie</label>
              <input value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} placeholder="Niveau japonais" className="input" />
            </div>

            <button onClick={handleCreate} disabled={creating} className="btn-primary w-full">
              {creating ? 'Création...' : 'Créer'}
            </button>
          </div>

          <div className="mt-4 p-3 bg-discord-darkest/50 rounded-lg">
            <p className="text-xs text-gray-500 mb-2 font-semibold">Niveaux japonais suggérés :</p>
            {JP_LEVEL_EMOJIS.map(({ emoji, label }) => (
              <p key={emoji} className="text-xs text-gray-400">{emoji} = {label}</p>
            ))}
          </div>
        </div>

        {/* Liste */}
        <div className="space-y-3">
          <h2 className="text-white font-semibold">Rôles configurés ({reactions.length})</h2>
          {reactions.length === 0 ? (
            <div className="card text-center py-8 text-gray-500">Aucun rôle par réaction configuré</div>
          ) : (
            reactions.map((r) => {
              const role = roles.find((x) => x.id === r.roleId);
              return (
                <div key={r.id} className="card flex items-center gap-4">
                  <span className="text-2xl">{r.emoji}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-white font-medium">{role?.name ?? r.roleId}</span>
                      {r.category && <span className="badge bg-discord-blurple/20 text-discord-blurple">{r.category}</span>}
                    </div>
                    <p className="text-gray-500 text-xs font-mono">msg: {r.messageId}</p>
                  </div>
                  <button
                    onClick={() => handleDelete(r.id)}
                    className="text-discord-red hover:text-discord-red/80 transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
