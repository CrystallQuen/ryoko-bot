import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { api } from '../api/client';
import { Gift, Save, Eye, Image, Palette } from 'lucide-react';
import toast from 'react-hot-toast';
import type { Channel } from '../api/client';

interface WelcomeConfig {
  welcomeEnabled: boolean;
  welcomeChannelId: string | null;
  welcomeMessage: string | null;
  welcomeEmbed: { color?: string; title?: string; footer?: string } | null;
  welcomeDmEnabled: boolean;
  welcomeDmMessage: string | null;
  welcomeImageUrl: string | null;
}

const DEFAULT_COLOR = '#f25858';

export default function Welcome() {
  const { guildId } = useParams<{ guildId: string }>();
  const [config, setConfig] = useState<WelcomeConfig>({
    welcomeEnabled: false,
    welcomeChannelId: null,
    welcomeMessage: null,
    welcomeEmbed: null,
    welcomeDmEnabled: false,
    welcomeDmMessage: null,
    welcomeImageUrl: null,
  });
  const [channels, setChannels] = useState<Channel[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [bgError, setBgError] = useState(false);

  useEffect(() => {
    if (!guildId) return;
    Promise.all([
      api.get<WelcomeConfig>(`/guilds/${guildId}/welcome`),
      api.get<Channel[]>(`/guilds/${guildId}/channels`),
    ])
      .then(([welcomeRes, channelsRes]) => {
        setConfig(welcomeRes.data);
        setChannels(channelsRes.data.filter((c) => c.type === 0));
      })
      .catch(() => toast.error('Erreur de chargement'))
      .finally(() => setLoading(false));
  }, [guildId]);

  const accentColor = config.welcomeEmbed?.color ?? DEFAULT_COLOR;

  const setEmbed = (patch: Partial<WelcomeConfig['welcomeEmbed']>) =>
    setConfig((prev) => ({ ...prev, welcomeEmbed: { ...(prev.welcomeEmbed ?? {}), ...patch } }));

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
            <p className="text-gray-400 text-sm">Configurer le panneau de bienvenue</p>
          </div>
        </div>
        <button onClick={handleSave} disabled={saving} className="btn-primary flex items-center gap-2">
          <Save className="w-4 h-4" />
          {saving ? 'Sauvegarde...' : 'Sauvegarder'}
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* ── Colonne gauche : config ──────────────────────────────────── */}
        <div className="space-y-4">

          {/* Paramètres généraux */}
          <div className="card">
            <h2 className="text-white font-semibold mb-4">Paramètres généraux</h2>

            <div className="flex items-center justify-between mb-4">
              <div>
                <p className="text-white text-sm font-medium">Activer le bienvenue</p>
                <p className="text-gray-400 text-xs">Déclenché à l'attribution du rôle Membre</p>
              </div>
              <button
                onClick={() => setConfig({ ...config, welcomeEnabled: !config.welcomeEnabled })}
                className={`relative w-12 h-6 rounded-full transition-colors ${config.welcomeEnabled ? 'bg-discord-green' : 'bg-gray-600'}`}
              >
                <span
                  className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full transition-transform ${config.welcomeEnabled ? 'translate-x-6' : ''}`}
                />
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
                <span className="text-gray-500 ml-2 text-xs">
                  Variables : {'{user}'} {'{username}'} {'{guild}'} {'{count}'}
                </span>
              </label>
              <textarea
                value={config.welcomeMessage ?? ''}
                onChange={(e) => setConfig({ ...config, welcomeMessage: e.target.value })}
                placeholder="Bienvenue sur {guild}, {user} ! 🎉"
                rows={3}
                className="input resize-none"
              />
            </div>
          </div>

          {/* Apparence de la carte */}
          <div className="card">
            <div className="flex items-center gap-2 mb-4">
              <Palette className="w-4 h-4 text-discord-blurple" />
              <h2 className="text-white font-semibold">Apparence de la carte</h2>
            </div>

            <div className="mb-4">
              <label className="block text-sm text-gray-400 mb-2">Couleur d'accent</label>
              <div className="flex items-center gap-3">
                <input
                  type="color"
                  value={accentColor}
                  onChange={(e) => setEmbed({ color: e.target.value })}
                  className="w-10 h-10 rounded cursor-pointer border-0 bg-transparent"
                />
                <input
                  type="text"
                  value={accentColor}
                  onChange={(e) => setEmbed({ color: e.target.value })}
                  placeholder="#f25858"
                  maxLength={7}
                  className="input w-32 font-mono"
                />
                <span className="text-gray-500 text-xs">Bande latérale & anneau avatar</span>
              </div>
            </div>

            <div className="mb-4">
              <label className="block text-sm text-gray-400 mb-2">Titre de l'embed (optionnel)</label>
              <input
                type="text"
                value={config.welcomeEmbed?.title ?? ''}
                onChange={(e) => setEmbed({ title: e.target.value || undefined })}
                placeholder="Bienvenue !"
                className="input"
              />
            </div>

            <div>
              <label className="block text-sm text-gray-400 mb-2">Pied de page (optionnel)</label>
              <input
                type="text"
                value={config.welcomeEmbed?.footer ?? ''}
                onChange={(e) => setEmbed({ footer: e.target.value || undefined })}
                placeholder="Membre #{count} du serveur"
                className="input"
              />
              <p className="text-gray-600 text-xs mt-1">Variable disponible : {'{count}'}</p>
            </div>
          </div>

          {/* Background */}
          <div className="card">
            <div className="flex items-center gap-2 mb-4">
              <Image className="w-4 h-4 text-discord-blurple" />
              <h2 className="text-white font-semibold">Image de fond</h2>
            </div>

            <div>
              <label className="block text-sm text-gray-400 mb-2">URL de l'image</label>
              <input
                type="url"
                value={config.welcomeImageUrl ?? ''}
                onChange={(e) => {
                  setBgError(false);
                  setConfig({ ...config, welcomeImageUrl: e.target.value || null });
                }}
                placeholder="https://exemple.com/background.png"
                className="input"
              />
              <p className="text-gray-600 text-xs mt-1">
                Laissez vide pour le dégradé par défaut. PNG, JPG recommandé (900×300 px).
              </p>
            </div>

            {config.welcomeImageUrl && (
              <div className="mt-3">
                <p className="text-gray-500 text-xs mb-1">Aperçu du background :</p>
                {bgError ? (
                  <div className="rounded-lg h-20 bg-gray-800 flex items-center justify-center text-gray-500 text-sm">
                    Image introuvable
                  </div>
                ) : (
                  <img
                    src={config.welcomeImageUrl}
                    alt="background"
                    onError={() => setBgError(true)}
                    className="rounded-lg w-full h-24 object-cover"
                  />
                )}
              </div>
            )}
          </div>

          {/* Message privé */}
          <div className="card">
            <h2 className="text-white font-semibold mb-4">Message privé (DM)</h2>

            <div className="flex items-center justify-between mb-4">
              <div>
                <p className="text-white text-sm font-medium">Activer le DM</p>
                <p className="text-gray-400 text-xs">Envoyer un message privé au nouveau membre</p>
              </div>
              <button
                onClick={() => setConfig({ ...config, welcomeDmEnabled: !config.welcomeDmEnabled })}
                className={`relative w-12 h-6 rounded-full transition-colors ${config.welcomeDmEnabled ? 'bg-discord-green' : 'bg-gray-600'}`}
              >
                <span
                  className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full transition-transform ${config.welcomeDmEnabled ? 'translate-x-6' : ''}`}
                />
              </button>
            </div>

            {config.welcomeDmEnabled && (
              <div>
                <label className="block text-sm text-gray-400 mb-2">Contenu du DM</label>
                <textarea
                  value={config.welcomeDmMessage ?? ''}
                  onChange={(e) => setConfig({ ...config, welcomeDmMessage: e.target.value })}
                  placeholder="Bienvenue {user} sur {guild} !"
                  rows={3}
                  className="input resize-none"
                />
              </div>
            )}
          </div>
        </div>

        {/* ── Colonne droite : aperçu ──────────────────────────────────── */}
        <div className="space-y-4">
          <div className="card sticky top-4">
            <div className="flex items-center gap-2 mb-4">
              <Eye className="w-4 h-4 text-discord-blurple" />
              <h2 className="text-white font-semibold">Aperçu de la carte</h2>
            </div>

            {/* Simulation visuelle de la carte */}
            <div
              className="rounded-xl overflow-hidden relative"
              style={{ height: '160px', background: `linear-gradient(135deg, #2e1a1a, #3e1616, #600f0f)` }}
            >
              {/* Background image */}
              {config.welcomeImageUrl && !bgError && (
                <img
                  src={config.welcomeImageUrl}
                  alt=""
                  className="absolute inset-0 w-full h-full object-cover"
                />
              )}
              {/* Overlay */}
              <div className="absolute inset-0 bg-black/55" />
              {/* Accent stripe */}
              <div className="absolute left-0 top-0 w-1.5 h-full rounded-l-xl" style={{ background: accentColor }} />

              {/* Content */}
              <div className="absolute inset-0 flex items-center gap-5 px-6">
                {/* Avatar placeholder */}
                <div className="relative flex-shrink-0">
                  <div
                    className="w-16 h-16 rounded-full"
                    style={{ background: accentColor, padding: '3px' }}
                  >
                    <div className="w-full h-full rounded-full bg-gray-600 flex items-center justify-center text-white font-bold text-xl">
                      M
                    </div>
                  </div>
                </div>

                {/* Text */}
                <div className="min-w-0">
                  <p className="text-white font-bold text-lg leading-tight">Bienvenue !</p>
                  <p className="font-bold truncate" style={{ color: accentColor }}>
                    NouvelUtilisateur
                  </p>
                  <div className="mt-1 border-t border-white/10 pt-1">
                    <p className="text-gray-400 text-xs">Membre #100 · Mon Serveur</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Embed preview */}
            <div className="mt-4 bg-discord-darkest rounded-lg p-4">
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-full bg-discord-blurple flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
                  R
                </div>
                <div className="min-w-0">
                  <div className="flex items-baseline gap-2 mb-1">
                    <span className="text-discord-green font-semibold text-sm">Ryoko Bot</span>
                    <span className="bg-discord-blurple text-white text-xs px-1 rounded">BOT</span>
                  </div>
                  <div
                    className="border-l-4 rounded p-3 max-w-xs"
                    style={{ borderColor: accentColor, background: 'rgba(0,0,0,0.2)' }}
                  >
                    <p className="text-white text-xs font-semibold mb-1">
                      {config.welcomeEmbed?.title || 'Bienvenue !'}
                    </p>
                    <p className="text-gray-300 text-xs">{previewMessage}</p>
                    {config.welcomeEmbed?.footer && (
                      <p className="text-gray-500 text-xs mt-2 border-t border-gray-700 pt-1">
                        {config.welcomeEmbed.footer.replace(/{count}/g, '100')}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            </div>

            <p className="text-gray-600 text-xs mt-3">
              * Aperçu indicatif. La carte réelle est générée par le bot.
              Utilise <code className="bg-gray-800 px-1 rounded">/bienvenue test</code> pour un aperçu exact.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
