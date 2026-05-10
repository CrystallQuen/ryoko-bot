import { Bot, Shield, Zap, Globe } from 'lucide-react';

const features = [
  { icon: Shield, title: 'Modération avancée', desc: 'Ban, mute, kick, avertissements et logs complets' },
  { icon: Zap, title: 'Jeux japonais', desc: 'Shiritori et rédaction collaborative en japonais' },
  { icon: Globe, title: 'Bilingue FR/JP', desc: 'Interface et réponses en français et japonais' },
];

export default function Login() {
  const handleLogin = () => {
    window.location.href = '/api/auth/login';
  };

  return (
    <div className="min-h-screen bg-discord-darkest flex flex-col">
      {/* Hero */}
      <div className="flex-1 flex flex-col items-center justify-center px-4 py-12">
        <div className="text-center mb-12 animate-fade-in">
          <div className="inline-flex items-center justify-center w-20 h-20 bg-discord-blurple rounded-2xl mb-6 shadow-lg shadow-discord-blurple/30">
            <Bot className="w-10 h-10 text-white" />
          </div>
          <h1 className="text-5xl font-bold text-white mb-4">
            Ryoko<span className="text-discord-blurple">Bot</span>
          </h1>
          <p className="text-xl text-gray-400 max-w-md">
            Le bot Discord professionnel pour votre serveur japonais
          </p>
          <p className="text-sm text-gray-500 mt-2 font-jp">りょうこ • プロフェッショナルDiscordボット</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 max-w-3xl w-full mb-10">
          {features.map(({ icon: Icon, title, desc }) => (
            <div key={title} className="card text-center animate-slide-in">
              <div className="inline-flex items-center justify-center w-12 h-12 bg-discord-blurple/20 rounded-xl mb-3">
                <Icon className="w-6 h-6 text-discord-blurple" />
              </div>
              <h3 className="text-white font-semibold mb-1">{title}</h3>
              <p className="text-gray-400 text-sm">{desc}</p>
            </div>
          ))}
        </div>

        <button
          onClick={handleLogin}
          className="flex items-center gap-3 bg-discord-blurple hover:bg-discord-blurple/90 text-white font-semibold px-8 py-4 rounded-xl transition-all hover:shadow-lg hover:shadow-discord-blurple/30 hover:-translate-y-0.5 active:translate-y-0"
        >
          <svg className="w-6 h-6" viewBox="0 0 24 24" fill="currentColor">
            <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994a.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03z"/>
          </svg>
          Se connecter avec Discord
        </button>
      </div>

      <footer className="text-center py-4 text-gray-600 text-sm">
        Ryoko Bot © 2026 — Conçu avec ❤️ pour les serveurs japonais
      </footer>
    </div>
  );
}
