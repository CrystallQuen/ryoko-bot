import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { api } from '../api/client';
import type { Event, Channel, Role } from '../api/client';
import { Calendar, Plus, Trash2, Clock, Volume2 } from 'lucide-react';
import toast from 'react-hot-toast';
import CalendarPicker from '../components/CalendarPicker';

interface VoiceChannel {
  id: string;
  name: string;
  type: number;
}

export default function Events() {
  const { guildId } = useParams<{ guildId: string }>();
  const [events, setEvents] = useState<Event[]>([]);
  const [channels, setChannels] = useState<Channel[]>([]);
  const [voiceChannels, setVoiceChannels] = useState<VoiceChannel[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({
    title: '',
    description: '',
    channelId: '',
    voiceChannelId: '',
    roleId: '',
    duration: '2',
  });
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    if (!guildId) return;
    Promise.all([
      api.get<Event[]>(`/guilds/${guildId}/events`),
      api.get<Channel[]>(`/guilds/${guildId}/channels`),
      api.get<VoiceChannel[]>(`/guilds/${guildId}/voice-channels`),
      api.get<Role[]>(`/guilds/${guildId}/roles`),
    ]).then(([e, c, v, r]) => {
      setEvents(e.data);
      setChannels(c.data.filter((x) => x.type === 0));
      setVoiceChannels(v.data);
      setRoles(r.data);
    }).catch(() => toast.error('Erreur de chargement'))
      .finally(() => setLoading(false));
  }, [guildId]);

  const handleCreate = async () => {
    if (!guildId || !form.title || !form.channelId || !selectedDate) {
      return toast.error('Remplissez les champs obligatoires (titre, salon, date)');
    }
    if (selectedDate <= new Date()) {
      return toast.error('La date doit être dans le futur');
    }
    setCreating(true);
    try {
      const res = await api.post<Event>(`/guilds/${guildId}/events`, {
        ...form,
        scheduledAt: selectedDate.toISOString(),
        voiceChannelId: form.voiceChannelId || null,
        roleId: form.roleId || null,
      });
      setEvents([...events, res.data].sort((a, b) => new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime()));
      setForm({ title: '', description: '', channelId: '', voiceChannelId: '', roleId: '', duration: '2' });
      setSelectedDate(null);
      toast.success('Événement créé et annoncé dans Discord !');
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
      await api.delete(`/guilds/${guildId}/events/${id}`);
      setEvents(events.filter((e) => e.id !== id));
      toast.success('Événement supprimé');
    } catch {
      toast.error('Erreur lors de la suppression');
    }
  };

  const upcoming = events.filter((e) => new Date(e.scheduledAt) >= new Date());
  const past = events.filter((e) => new Date(e.scheduledAt) < new Date());

  if (loading) return <div className="text-center py-12 text-gray-400">Chargement...</div>;

  return (
    <div>
      <div className="flex items-center gap-3 mb-8">
        <div className="w-10 h-10 bg-discord-yellow/20 rounded-lg flex items-center justify-center">
          <Calendar className="w-5 h-5 text-discord-yellow" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-white">Événements</h1>
          <p className="text-gray-400 text-sm">{upcoming.length} à venir</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Formulaire */}
        <div className="card">
          <h2 className="text-white font-semibold mb-4 flex items-center gap-2">
            <Plus className="w-4 h-4" /> Créer un événement
          </h2>

          <div className="space-y-3">
            <div>
              <label className="block text-sm text-gray-400 mb-1">Titre *</label>
              <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Soirée animation" className="input" />
            </div>

            <div>
              <label className="block text-sm text-gray-400 mb-1">Description</label>
              <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={2} className="input resize-none" />
            </div>

            <div>
              <label className="block text-sm text-gray-400 mb-2">📅 Date et heure *</label>
              <CalendarPicker value={selectedDate} onChange={setSelectedDate} />
            </div>

            <div>
              <label className="block text-sm text-gray-400 mb-1">Durée</label>
              <select value={form.duration} onChange={(e) => setForm({ ...form, duration: e.target.value })} className="input">
                <option value="0.5">30 minutes</option>
                <option value="1">1 heure</option>
                <option value="2">2 heures</option>
                <option value="3">3 heures</option>
                <option value="6">6 heures</option>
              </select>
            </div>

            <div>
              <label className="block text-sm text-gray-400 mb-1">Salon d'annonce *</label>
              <select value={form.channelId} onChange={(e) => setForm({ ...form, channelId: e.target.value })} className="input">
                <option value="">— Salon texte —</option>
                {channels.map((c) => <option key={c.id} value={c.id}>#{c.name}</option>)}
              </select>
            </div>

            <div>
              <label className="block text-sm text-gray-400 mb-1 flex items-center gap-1">
                <Volume2 className="w-3 h-3" /> Salon vocal (optionnel)
              </label>
              <select value={form.voiceChannelId} onChange={(e) => setForm({ ...form, voiceChannelId: e.target.value })} className="input">
                <option value="">— Aucun salon vocal —</option>
                {voiceChannels.map((c) => <option key={c.id} value={c.id}>🔊 {c.name}</option>)}
              </select>
            </div>

            <div>
              <label className="block text-sm text-gray-400 mb-1">Rôle à mentionner</label>
              <select value={form.roleId} onChange={(e) => setForm({ ...form, roleId: e.target.value })} className="input">
                <option value="">— Aucun —</option>
                {roles.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
              </select>
            </div>

            <button onClick={handleCreate} disabled={creating} className="btn-primary w-full">
              {creating ? 'Création...' : '🗓️ Créer et annoncer'}
            </button>
          </div>
        </div>

        {/* Liste des événements */}
        <div className="lg:col-span-2 space-y-4">
          {upcoming.length > 0 && (
            <section>
              <h2 className="text-white font-semibold mb-3">À venir ({upcoming.length})</h2>
              <div className="space-y-3">
                {upcoming.map((e) => {
                  const date = new Date(e.scheduledAt);
                  const isToday = date.toDateString() === new Date().toDateString();
                  return (
                    <div key={e.id} className="card flex gap-4">
                      <div className="flex-shrink-0 text-center w-14">
                        <div className="text-2xl font-bold text-discord-blurple">{date.getDate()}</div>
                        <div className="text-xs text-gray-400">{date.toLocaleDateString('fr-FR', { month: 'short' })}</div>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between">
                          <div>
                            <h3 className="text-white font-medium">{e.title}</h3>
                            {e.description && <p className="text-gray-400 text-sm mt-0.5 line-clamp-2">{e.description}</p>}
                          </div>
                          <button onClick={() => handleDelete(e.id)} className="text-discord-red hover:text-discord-red/80 ml-2 flex-shrink-0">
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                        <div className="flex items-center gap-3 mt-2 flex-wrap">
                          <span className="flex items-center gap-1 text-xs text-gray-500">
                            <Clock className="w-3 h-3" />
                            {date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                          </span>
                          {(e as unknown as { voiceChannelId?: string }).voiceChannelId && (
                            <span className="flex items-center gap-1 text-xs text-gray-500">
                              <Volume2 className="w-3 h-3" /> Salon vocal
                            </span>
                          )}
                          {isToday && <span className="badge bg-discord-green/20 text-discord-green">Aujourd'hui</span>}
                          {e.reminded && <span className="badge bg-discord-yellow/20 text-discord-yellow">Rappel envoyé</span>}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          )}

          {past.length > 0 && (
            <section>
              <h2 className="text-gray-500 font-semibold mb-3">Passés ({past.length})</h2>
              <div className="space-y-2">
                {past.slice(0, 5).map((e) => (
                  <div key={e.id} className="card flex items-center gap-3 opacity-50">
                    <Calendar className="w-4 h-4 text-gray-500 flex-shrink-0" />
                    <span className="text-gray-400 text-sm flex-1">{e.title}</span>
                    <span className="text-gray-600 text-xs">{new Date(e.scheduledAt).toLocaleDateString('fr-FR')}</span>
                  </div>
                ))}
              </div>
            </section>
          )}

          {events.length === 0 && (
            <div className="card text-center py-12 text-gray-500">
              <Calendar className="w-12 h-12 mx-auto mb-3 opacity-30" />
              Aucun événement planifié
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
