# 🤖 Ryoko Bot — Bot Discord Professionnel

> Bot Discord complet avec tableau de bord web moderne pour serveurs communautaires japonais.

## ✨ Fonctionnalités

### 🛡️ Modération
| Commande | Description |
|----------|-------------|
| `/ban` | Ban définitif avec raison obligatoire |
| `/tempban` | Ban temporaire (30m, 2h, 7d...) |
| `/kick` | Expulsion avec DM au membre |
| `/mute` | Timeout Discord avec durée |
| `/unmute` | Retrait du mute |
| `/warn add/list/clear` | Système d'avertissements |

### 🎌 Jeux japonais
- **Shiritori** (`/shiritori start/play/stop/score`) — Jeu de mots enchaînés en japonais
- **Histoire JP** (`/jp-story start/write/stop/scores`) — Rédaction collaborative avec analyse grammaticale

### 📋 Rôles & Règlement
- Rôles par réaction emoji (niveau japonais N5→N1 inclus)
- Validation du règlement par réaction → attribution automatique de rôle

### 🎉 Bienvenue
- Message configurable avec variables `{user}`, `{guild}`, `{count}`
- DM automatique aux nouveaux membres
- Embed personnalisable

### 📅 Événements
- Création d'animations avec intégration Discord Scheduled Events
- Rappel automatique 10 minutes avant
- Dashboard avec calendrier

### 🔧 Autres
- Système de niveaux XP (cooldown anti-farm)
- Anti-spam configurable (warn/mute/kick/ban)
- Support FR/JP
- Logs détaillés par rotation journalière

---

## 🚀 Installation rapide

### Prérequis
- Node.js 18+
- PostgreSQL 15+
- Un bot Discord ([discord.com/developers](https://discord.com/developers/applications))

### 1. Cloner et configurer

```bash
git clone https://github.com/votre-repo/ryoko-bot.git
cd ryoko-bot
cp .env.example .env
```

Remplir `.env` avec vos tokens.

### 2. Installer les dépendances

```bash
# Backend
npm install

# Frontend
cd frontend && npm install && cd ..
```

### 3. Base de données

```bash
npm run db:generate    # Génère le client Prisma
npm run db:migrate     # Crée les tables
npm run db:seed        # (optionnel) Données de test
```

### 4. Déployer les commandes slash

```bash
npm run deploy
```

### 5. Lancer

```bash
# Développement (bot + hot reload)
npm run dev

# Frontend (dans un autre terminal)
npm run dashboard:dev
```

**Dashboard accessible sur** : [http://localhost:3000](http://localhost:3000)
**API Bot** : [http://localhost:4000](http://localhost:4000)

---

## 🐳 Docker (Production)

```bash
# Copier et configurer .env
cp .env.example .env

# Lancer avec Docker Compose
docker-compose up -d

# Déployer les commandes (une seule fois)
docker-compose exec bot npm run deploy
```

---

## 📁 Structure du projet

```
ryoko-bot/
├── src/
│   ├── bot/
│   │   ├── commands/
│   │   │   ├── moderation/     # ban, tempban, kick, mute, unmute, warn
│   │   │   ├── events/         # event (create/delete/list)
│   │   │   └── games/          # shiritori, jp-story
│   │   ├── events/             # Listeners Discord.js
│   │   ├── modules/
│   │   │   ├── antispam/       # Détection et sanction du spam
│   │   │   ├── levels/         # Système XP
│   │   │   ├── events/         # Rappels automatiques
│   │   │   ├── moderation/     # Expiration des sanctions
│   │   │   └── games/
│   │   │       └── shiritori/  # Dictionnaire japonais
│   │   ├── loaders/            # Chargement dynamique commandes/events
│   │   └── client.ts           # Configuration Discord.js
│   ├── dashboard/
│   │   ├── routes/             # API Express (auth, guilds, moderation...)
│   │   ├── middleware/         # JWT auth
│   │   └── server.ts           # Express + Socket.io
│   ├── database/               # Prisma singleton
│   ├── utils/                  # logger, i18n, embed, permissions, duration
│   ├── types/                  # Types TypeScript partagés
│   └── index.ts                # Point d'entrée
├── frontend/                   # Dashboard React + Tailwind
│   └── src/
│       ├── pages/              # Dashboard, Moderation, Welcome...
│       ├── components/         # Layout, Navigation
│       ├── contexts/           # AuthContext
│       └── api/                # Client Axios
├── prisma/
│   └── schema.prisma           # Schéma BDD complet
├── .github/workflows/          # CI/CD GitHub Actions
├── docker-compose.yml
└── Dockerfile
```

---

## ⚙️ Variables d'environnement

| Variable | Description | Requis |
|----------|-------------|--------|
| `DISCORD_TOKEN` | Token du bot Discord | ✅ |
| `DISCORD_CLIENT_ID` | ID de l'application Discord | ✅ |
| `DISCORD_CLIENT_SECRET` | Secret OAuth2 Discord | ✅ |
| `DATABASE_URL` | URL PostgreSQL | ✅ |
| `JWT_SECRET` | Clé secrète JWT (min 32 chars) | ✅ |
| `OAUTH2_REDIRECT_URI` | URL de callback OAuth2 | ✅ |
| `DASHBOARD_URL` | URL du frontend | ✅ |
| `BOT_API_PORT` | Port de l'API backend (défaut: 4000) | ❌ |
| `LOG_LEVEL` | Niveau de log (info/debug/warn) | ❌ |

---

## 🔐 Permissions Discord requises

Le bot a besoin des permissions suivantes :
- `Kick Members`, `Ban Members`, `Moderate Members`
- `Manage Roles`, `Manage Messages`
- `Read Messages`, `Send Messages`, `Embed Links`
- `Add Reactions`, `Read Message History`
- `Manage Events`
- Intent : `Members`, `Message Content`, `Reactions`

---

## 📖 Dashboard Web

Connexion via **Discord OAuth2**.

| Page | Description |
|------|-------------|
| `/dashboard` | Sélection du serveur |
| `/dashboard/:id/moderation` | Historique et révocation des sanctions |
| `/dashboard/:id/welcome` | Configuration du bienvenue avec aperçu |
| `/dashboard/:id/roles` | Rôles par réaction + règlement |
| `/dashboard/:id/events` | Calendrier des animations |
| `/dashboard/:id/games` | Stats et classements des jeux JP |
| `/dashboard/:id/settings` | Langue, XP, anti-spam |

---

## 🤝 Contribuer

1. Fork le repo
2. Créer une branche (`git checkout -b feature/ma-feature`)
3. Commit (`git commit -m 'feat: ajouter ma-feature'`)
4. Push et ouvrir une Pull Request

---

## 📄 Licence

MIT — Libre d'utilisation avec attribution.

---

*Conçu pour les communautés Discord francophones passionnées de japonais 🇫🇷🇯🇵*
