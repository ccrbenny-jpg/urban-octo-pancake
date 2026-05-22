# urban-octo-pancake
🎮 NEXUS — Monorepo 5 Jeux Mobiles AOF
> Architecture solo-dev pour 5 jeux mobiles Android optimisés Tecno Pop 5
> avec ba> avec backend partagé, anti-fraude PRS, et économie HRE.

---

## 📱 Les 5 Jeux

| # | Jeu | Type | Statut |
|---|-----|------|--------|
| 1 | **Wax Sort** | Puzzle tri (calebasses) | 🚧 En cours |
| 2 | **Ludo Connect** | Multi-joueurs async | ⏳ À venir |
| 3 | **Awalé Masters** | Stratégie offline (Minimax) | ⏳ À venir |
| 4 | **Savoir AOF** | Quiz culture AOF | ⏳ À venir |
| 5 | **Frenezy Mbappé** | Arcade football | ⏳ À venir |

---

## 🎯 Cible Technique

- **Appareil cible** : Tecno Pop 5 (Android 11 Go, 2GB RAM, MediaTek Helio A22)
- **APK max** : 30 MB par jeu
- **Performance** : 60 FPS garanti, <180MB RAM par jeu
- **Réseau** : 2G/3G — modes offline obligatoires

---

## 🏗️ Architecture Monorepo

```
/
├── .nvmrc                    # Node 20 LTS
├── .github/workflows/        # CI/CD GitHub Actions
├── packages/                 # Code partagé (file: protocol)
│   ├── shared-auth/          # JWT + UUID fallback
│   ├── shared-wallet/        # Économie HRE
│   ├── shared-ads/           # AdMob SSV
│   ├── shared-antiFraud/     # PRS engine
│   ├── shared-payments/      # YengaPay + manuel
│   └── shared-ui/            # Theme designer
├── apps/                     # Apps Expo indépendantes
│   ├── game1-wax-sort/
│   ├── game2-ludo-connect/
│   ├── game3-awale-masters/
│   ├── game4-savoir-aof/
│   └── game5-frenezy-mbappe/
└── backend/                  # Express + TypeScript
    ├── migrations/           # SQL Supabase
    └── src/                  # Code backend
```

> ⚠️ **PAS de npm workspaces** — chaque app a son `node_modules` indépendant.

---

## 🚀 Stack Technique

### Mobile
- Expo SDK 52 + React Native 0.76
- expo-router v4 + expo-linking
- react-native-reanimated ~3.16.x
- react-native-worklets-core ~1.3.x ⚠️ (PAS `react-native-worklets`)
- zustand ~5.x
- expo-sqlite ~15.x (cache offline)

### Backend
- Node.js v20 LTS
- Express 5 + TypeScript strict
- PostgreSQL via Supabase
- Redis / Upstash (rate limiting)
- Déployé sur Railway

### Sécurité
- AdMob SSV ECDSA (crédit publicitaire)
- PRS — Progressive Response System (5 niveaux anti-fraude)
- JWT access 15min + refresh 30j
- Bcrypt cost 12 (admin password)

### Paiements
- **Phase 1** : Manuel (admin dashboard)
- **Phase 2** : YengaPay (Orange Money, Wave, Moov Money)

---

## ⚙️ Pré-requis Installation

### Comptes à créer (actions parallèles)

| Service | Usage | Statut |
|---------|-------|--------|
| Supabase | BDD PostgreSQL + Realtime | ⏳ À créer |
| Railway | Déploiement backend | ⏳ À créer |
| Expo / EAS | Build APK Android | ⏳ À créer |
| AdMob | Rewarded ads + SSV ECDSA | ⏳ À créer |
| Upstash Redis | Rate limiting | ⏳ À créer |
| YengaPay | Paiements (Phase 2) | ⏳ À créer plus tard |

### Variables d'environnement (Railway)
```bash
# Backend
NODE_ENV=production
PORT=3000
DATABASE_URL=postgresql://...
SUPABASE_URL=https://xxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJ...
REDIS_URL=redis://...

# JWT secrets (différents pour player et admin)
JWT_SECRET_PLAYER=<random-64-chars>
JWT_SECRET_ADMIN=<random-64-chars-DIFFERENT>

# AdMob SSV
ADMOB_SSV_PUBLIC_KEY=<PEM-format-ECDSA-key>

# Économie HRE (modifiable sans redéploiement)
COIN_TO_FCFA_RATE=10
COIN_TO_FCFA_RATE_PREMIUM=15
WITHDRAWAL_MIN_FCFA=1500
WITHDRAWAL_MAX_WEEKLY_FCFA=10000

# YengaPay (Phase 2 — laisser vide pour mode mock)
YENGAPAY_API_KEY=
YENGAPAY_GROUP_ID=
YENGAPAY_PROJECT_ID=
YENGAPAY_WEBHOOK_SECRET=
```

---

## 📦 Installation

```bash
# 1. Cloner le repo dans Codespaces
git clone https://github.com/[user]/[repo].git
cd [repo]

# 2. Installer Node 20 (auto via .nvmrc)
nvm use

# 3. Installer toutes les dépendances
npm run install:all

# 4. Configurer .env (backend/.env)
cp backend/.env.example backend/.env
# Éditer avec tes vraies clés

# 5. Lancer la migration SQL Supabase
# → Copier le contenu de backend/migrations/001_initial_schema.sql
# → Coller dans Supabase Dashboard → SQL Editor → Run

# 6. Démarrer le backend en dev
npm run dev:backend

# 7. Démarrer un jeu (ex : Wax Sort)
npm run dev:game1
```

---

## 🧪 Tests

```bash
# Tests unitaires backend (Jest)
npm run test:backend

# Tests routes API (curl)
npm run test:routes

# Tests complets
npm run test:all
```

---

## 🚀 Déploiement

### Backend → Railway (auto)
- Push sur `main` → Railway détecte → build via `nixpacks.toml`
- Health check : `GET /health`

### Apps → EAS Build (Android APK)
```bash
# Build preview (APK partageable)
npm run build:game1:preview

# Build production (Play Store)
npm run build:game1:prod
```

---

## 🛡️ Philosophie Anti-Fraude

> **PRS — Progressive Response System** : 5 niveaux, zéro exclusion automatique.

- **N1** : Surveillance silencieuse
- **N2** : Shadow limit (gains ×0.5 invisible)
- **N3** : Challenge CAPTCHA-like avant retrait
- **N4** : Freeze retrait, admin notifié
- **N5** : Revue admin humaine obligatoire

> "Un fraudeur détecté n'est jamais banni — il est ralenti jusqu'à se corriger."

---

## 💰 Modèle Économique HRE

| Source | Joueur | Dev |
|--------|--------|-----|
| Rewarded Ads (AdMob) | 25% | 75% |
| Premium 500 FCFA/mois | ×1.5 gains | 100% |
| Tournois (futur) | 80% prize pool | 20% rake |

- **Taux** : 100 Coins = 10 FCFA (base) / 15 FCFA (premium)
- **Retrait min** : 1500 FCFA (Phase 1) / 1000 FCFA (Phase 2)
- **Retrait max** : 10 000 FCFA/semaine/joueur

---

## 📊 Progression du Projet

> Consulte [NEXUS_MEMORY.md](./NEXUS_MEMORY.md) pour l'état détaillé.

- **Session actuelle** : 1 / N (Setup Infrastructure)
- **Fichiers livrés** : 1 / 10 (Session 1)

---

## 📚 Documentation Interne

- [`NEXUS_MEMORY.md`](./NEXUS_MEMORY.md) — Mémoire permanente du projet
- `backend/README.md` — Documentation backend (à venir)
- `apps/*/MANUAL_TEST_PROTOCOL.md` — Protocoles de test (à venir)

---

## 📝 Licence

UNLICENSED — Projet propriétaire NEXUS.

---

**Maintenu par** : Architecte NEXUS
**Dernière mise à jour** : Session 1 — FICHIER 01/10