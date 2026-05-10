import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { api } from '../api/client';
import { Gift, Save, Eye } from 'lucide-react';
import toast from 'react-hot-toast';
import type { Channel } from '../api/client';

interface WelcomeConfig {
  welcomeEnabled: boolean;
  welcomeChannelId: string | null;
  welcomeMessage: string | null;
  welcomeDmEnabled: boolean;
  welcomeDmMessage: string | null;
  welcomeImageUrl: string | null;
}

export default function Welcome() {
  const { guildId } = useParams<{ guildId: string }>();
  const [config, setConfig] = useState<WelcomeConfig>({
    welcomeEnabled: false, welcomeChannelId: null, welcomeMessage: null,
    welcomeDmEnabled: false, welcomeDmMessage: null, welcomeImageUrl: null,
  });
  const [channels, setChannels] = useState<Channel[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!guildId) return;
    Promise.all([
      api.get<WelcomeConfig>(`/guilds/${guildId}/welcome`),
      api.get<Channel[]>(`/guilds/${guildId}/channels`),
    ]).then(([welcomeRes, channelsRes]) => {
      setConfig(welcomeRes.data);
      setChannels(channelsRes.data.filter((c) => c.type === 0));
    }).catch(() => toast.error('Erreur de chargement'))
      .finally(() => setLoading(false));
  }, [guildId]);

  const handleSave = async () => {
    if (!guildId) return;
    setSaving(true);
    try {
      await api.patch(`/guilds/${guildId}/welcome`, config);
      toast.success('Configuration sauvegardée !');
    } catch {
      toast.error('Erreur lors de la sauvegarde');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="text-center py-12 text-gray-400">Chargement...</div>;

  const previewMessage = (config.welcomeMessage ?? 'Bienvenue sur **{guild}**, {user} ! 🎉')
    .replace(/{user}/g, '@NouvelUtilisateur')
    .replace(/{username}/g, 'NouvelUtilisateur')
    .replace(/{guild}/g, 'Mon Serveur')
    .replace(/{count}/g, '100');

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-discord-green/20 rounded-lg flex items-center justify-center">
            <Gift className="w-5 h-5 text-discord-green" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white">Bienvenue</h1>
            <p className="text-gray-400 text-sm">Configurer le message de bienvenue</p>
          </div>
        </div>
        <button onClick={handleSave} disabled={saving} className="btn-primary flex items-center gap-2">
          <Save className="w-4 h-4" />
          {saving ? 'Sauvegarde...' : 'Sauvegarder'}
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Config */}
        <div className="space-y-4">
          <div className="card">
            <h2 className="text-white font-semibold mb-4">Paramètres généraux</h2>

            <div className="flex items-center justify-between mb-4">
              <div>
                <p className="text-white text-sm font-medium">Activer le bienvenue</p>
                <p className="text-gray-400 text-xs">Envoyer un message à chaque nouvelle arrivée</p>
              </div>
              <button
                onClick={() => setConfig({ ...config, welcomeEnabled: !config.welcomeEnabled })}
                className={`relative w-12 h-6 rounded-full transition-colors ${config.welcomeEnabled ? 'bg-discord-green' : 'bg-gray-600'}`}
              >
                <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full transition-transform ${config.welcomeEnabled ? 'translate-x-6' : ''}`} />
              </button>
            </div>

            <div className="mb-4">
              <label className="block text-sm text-gray-400 mb-2">Salon de bienvenue</label>
              <select
                value={config.welcomeChannelId ?? ''}
                onChange={(e) => setConfig({ ...config, welcomeChannelId: e.target.value || null })}
                className="input"
              >
                <option value="">— Sélectionner un salon —</option>
                {channels.map((c) => (
                  <option key={c.id} value={c.id}>#{c.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm text-gray-400 mb-2">
                Message de bienvenue
                <span className="text-gray-500 ml-2 text-xs">Variables : {'{user}'}, {'{username}'}, {'{guild}'}, {'{count}'}</span>
              </label>
              <textarea
                value={config.welcomeMessage ?? ''}
                onChange={(e) => setConfig({ ...config, welcomeMessage: e.target.value })}
                placeholder="Bienvenue sur {guild}, {user} ! 🎉"
                rows={4}
                className="input resize-none"
              />
            </div>
          </div>

          <div className="card">
            <h2 className="text-white font-semibold mb-4">Message privé</h2>

            <div className="flex items-center justify-between mb-4">
              <div>
                <p className="text-white text-sm font-medium">Activer le DM</p>
                <p className="text-gray-400 text-xs">Envoyer un message privé au nouvel arrivant</p>
              </div>
              <button
                onClick={() => setConfig({ ...config, welcomeDmEnabled: !config.welcomeDmEnabled })}
                className={`relative w-12 h-6 rounded-full transition-colors ${config.welcomeDmEnabled ? 'bg-discord-green' : 'bg-gray-600'}`}
              >
                <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full transition-transform ${config.welcomeDmEnabled ? 'translate-x-6' : ''}`} />
              </button>
            </div>

            {config.welcomeDmEnabled && (
              <div>
                <label className="block text-sm text-gray-400 mb-2">Contenu du DM</label>
                <textarea
                  value={config.welcomeDmMessage ?? ''}
                  onChange={(e) => setConfig({ ...config, welcomeDmMessage: e.target.value })}
                  placeholder="Bienvenue {user} !"
                  rows={3}
                  className="input resize-none"
                />
              </div>
            )}
          </div>
        </div>

        {/* Aperçu */}
        <div className="card">
          <div className="flex items-center gap-2 mb-4">
            <Eye className="w-4 h-4 text-discord-blurple" />
            <h2 className="text-white font-semibold">Aperçu</h2>
          </div>

          <div className="bg-discord-darkest rounded-lg p-4">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-full bg-discord-blurple flex items-center justify-center text-white text-sm font-bold flex-shrink-0">R</div>
              <div>
                <div className="flex items-baseline gap-2 mb-1">
                  <span className="text-discord-green font-semibold text-sm">Ryoko Bot</span>
                  <span className="bg-discord-blurple text-white text-xs px-1 rounded">BOT</span>
                  <span className="text-gray-500 text-xs">Aujourd'hui</span>
                </div>
                <div className="bg-discord-blurple/20 border-l-4 border-discord-blurple rounded p-3 max-w-sm">
                  <p className="text-white text-sm">{previewMessage}</p>
                </div>
              </div>
            </div>
          </div>

          <p className="text-gray-500 text-xs mt-3">
            * Aperçu approximatif. L'apparence réelle dépend de la configuration embed.
          </p>
        </div>
      </div>
    </div>
  );
}
