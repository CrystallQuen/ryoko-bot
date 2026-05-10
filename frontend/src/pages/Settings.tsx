import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { api } from '../api/client';
import { Settings as SettingsIcon, Save, Shield, Zap } from 'lucide-react';
import toast from 'react-hot-toast';
import type { Channel } from '../api/client';

interface GuildSettings {
  language: string;
  levelEnabled: boolean;
  levelChannelId: string | null;
}

interface AntiSpamConfig {
  enabled: boolean;
  maxMessages: number;
  timeWindow: number;
  action: string;
  muteDuration: number;
}

export default function Settings() {
  const { guildId } = useParams<{ guildId: string }>();
  const [settings, setSettings] = useState<GuildSettings>({ language: 'fr', levelEnabled: false, levelChannelId: null });
  const [antispam, setAntispam] = useState<AntiSpamConfig>({ enabled: false, maxMessages: 5, timeWindow: 5, action: 'mute', muteDuration: 300 });
  const [channels, setChannels] = useState<Channel[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!guildId) return;
    Promise.all([
      api.get<GuildSettings>(`/guilds/${guildId}/settings`),
      api.get<AntiSpamConfig>(`/guilds/${guildId}/settings/antispam`),
      api.get<Channel[]>(`/guilds/${guildId}/channels`),
    ]).then(([s, a, c]) => {
      setSettings({ language: s.data.language, levelEnabled: s.data.levelEnabled, levelChannelId: s.data.levelChannelId });
      setAntispam(a.data);
      setChannels(c.data.filter((x) => x.type === 0));
    }).catch(() => toast.error('Erreur de chargement'))
      .finally(() => setLoading(false));
  }, [guildId]);

  const handleSaveSettings = async () => {
    if (!guildId) return;
    setSaving(true);
    try {
      await api.patch(`/guilds/${guildId}/settings`, settings);
      toast.success('Paramètres sauvegardés !');
    } catch {
      toast.error('Erreur lors de la sauvegarde');
    } finally {
      setSaving(false);
    }
  };

  const handleSaveAntispam = async () => {
    if (!guildId) return;
    setSaving(true);
    try {
      await api.put(`/guilds/${guildId}/settings/antispam`, antispam);
      toast.success('Anti-spam configuré !');
    } catch {
      toast.error('Erreur lors de la sauvegarde');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="text-center py-12 text-gray-400">Chargement...</div>;

  const Toggle = ({ value, onChange }: { value: boolean; onChange: (v: boolean) => void }) => (
    <button
      onClick={() => onChange(!value)}
      className={`relative w-12 h-6 rounded-full transition-colors ${value ? 'bg-discord-green' : 'bg-gray-600'}`}
    >
      <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full transition-transform ${value ? 'translate-x-6' : ''}`} />
    </button>
  );

  return (
    <div>
      <div className="flex items-center gap-3 mb-8">
        <div className="w-10 h-10 bg-gray-500/20 rounded-lg flex items-center justify-center">
          <SettingsIcon className="w-5 h-5 text-gray-400" />
        </div>
        <h1 className="text-2xl font-bold text-white">Paramètres</h1>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Général */}
        <div className="card">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-white font-semibold flex items-center gap-2">
              <SettingsIcon className="w-4 h-4" /> Général
            </h2>
            <button onClick={handleSaveSettings} disabled={saving} className="btn-primary flex items-center gap-2 text-sm py-1.5">
              <Save className="w-3.5 h-3.5" /> Sauvegarder
            </button>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-sm text-gray-400 mb-2">Langue du bot</label>
              <select value={settings.language} onChange={(e) => setSettings({ ...settings, language: e.target.value })} className="input">
                <option value="fr">🇫🇷 Français</option>
                <option value="jp">🇯🇵 Japonais</option>
              </select>
            </div>

            <div className="border-t border-discord-darkest/50 pt-4">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <p className="text-white text-sm font-medium flex items-center gap-2"><Zap className="w-4 h-4 text-discord-yellow" /> Système de niveaux XP</p>
                  <p className="text-gray-500 text-xs">Les membres gagnent de l'XP en discutant</p>
                </div>
                <Toggle value={settings.levelEnabled} onChange={(v) => setSettings({ ...settings, levelEnabled: v })} />
              </div>

              {settings.levelEnabled && (
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Salon d'annonce de level-up</label>
                  <select value={settings.levelChannelId ?? ''} onChange={(e) => setSettings({ ...settings, levelChannelId: e.target.value || null })} className="input">
                    <option value="">— Salon actif —</option>
                    {channels.map((c) => <option key={c.id} value={c.id}>#{c.name}</option>)}
                  </select>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Anti-spam */}
        <div className="card">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-white font-semibold flex items-center gap-2">
              <Shield className="w-4 h-4 text-discord-red" /> Anti-spam
            </h2>
            <button onClick={handleSaveAntispam} disabled={saving} className="btn-primary flex items-center gap-2 text-sm py-1.5">
              <Save className="w-3.5 h-3.5" /> Sauvegarder
            </button>
          </div>

          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-white text-sm font-medium">Activer l'anti-spam</p>
                <p className="text-gray-500 text-xs">Détection et sanction automatique des spammeurs</p>
              </div>
              <Toggle value={antispam.enabled} onChange={(v) => setAntispam({ ...antispam, enabled: v })} />
            </div>

            {antispam.enabled && (
              <>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm text-gray-400 mb-1">Messages max</label>
                    <input
                      type="number"
                      min={2} max={20}
                      value={antispam.maxMessages}
                      onChange={(e) => setAntispam({ ...antispam, maxMessages: parseInt(e.target.value) || 5 })}
                      className="input"
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-gray-400 mb-1">Fenêtre (secondes)</label>
                    <input
                      type="number"
                      min={1} max={60}
                      value={antispam.timeWindow}
                      onChange={(e) => setAntispam({ ...antispam, timeWindow: parseInt(e.target.value) || 5 })}
                      className="input"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm text-gray-400 mb-1">Action</label>
                  <select value={antispam.action} onChange={(e) => setAntispam({ ...antispam, action: e.target.value })} className="input">
                    <option value="warn">Avertissement</option>
                    <option value="mute">Mute (timeout)</option>
                    <option value="kick">Expulsion</option>
                    <option value="ban">Ban</option>
                  </select>
                </div>

                {antispam.action === 'mute' && (
                  <div>
                    <label className="block text-sm text-gray-400 mb-1">Durée du mute (secondes)</label>
                    <input
                      type="number"
                      min={60}
                      value={antispam.muteDuration}
                      onChange={(e) => setAntispam({ ...antispam, muteDuration: parseInt(e.target.value) || 300 })}
                      className="input"
                    />
                  </div>
                )}

                <div className="bg-discord-darkest/50 rounded-lg p-3 text-xs text-gray-500">
                  Si un utilisateur envoie plus de <strong className="text-gray-300">{antispam.maxMessages}</strong> messages
                  en <strong className="text-gray-300">{antispam.timeWindow}s</strong>, l'action <strong className="text-gray-300">{antispam.action}</strong> sera déclenchée.
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
