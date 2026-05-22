═══════════════════════════════════════════════════════
🧠 MISE À JOUR — Conv #5 — DÉMARRAGE SESSION 1
═══════════════════════════════════════════════════════
DÉCISIONS VALIDÉES (immuables) :
🔖 Q1 LOGIN JOUEUR : Option C — HYBRIDE
   → Inscription : username + device_id (frictionless)
   → Sécurisation optionnelle : password bcrypt après connexion
   → Récupération compte possible si password défini
🔖 Q2 LOGIN ADMIN  : password bcrypt obligatoire
   → Hash bcrypt cost 12
   → JWT séparé (JWT_SECRET_ADMIN différent de JWT_SECRET_PLAYER)
   → Expiry 1h (refresh non applicable côté admin)

IMPACT SCHÉMA SQL :
→ Table `users` : ajout colonne `password_hash VARCHAR(255) NULL`
   (nullable pour joueurs sans password — optionnel)
→ Table `users` : ajout colonne `password_set_at TIMESTAMPTZ NULL`
   (date de sécurisation du compte joueur)
→ Index UNIQUE composite sur (username, role) pour distinguer
   joueur et admin partageant même username (rare mais possible)

STATUT : ✅ Prêt à livrer FICHIER 01/10
═══════════════════════════════════════════════════════