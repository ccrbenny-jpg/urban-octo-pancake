// ════════════════════════════════════════════════════════════
// Fichier  : packages/shared-auth/src/types.ts
// Module   : shared-auth
// Fonction : Types et interfaces pour auth hybride Option C
// Perf     : TypeScript pur — zéro impact runtime
// Deps     : Aucune
// Tests    : packages/shared-auth/src/__tests__/types.test.ts
// ════════════════════════════════════════════════════════════

/**
 * 🔒 SECURITY : Modes d'authentification supportés (Option C)
 * → frictionless : 1er lancement, juste device_id + username
 * → secured     : compte avec password + phone vérifié
 */
export enum AuthMode {
  FRICTIONLESS = 'frictionless',
  SECURED = 'secured',
}

/**
 * 📱 AOF : Rôles utilisateur (player par défaut, admin créé manuellement)
 */
export enum UserRole {
  PLAYER = 'player',
  ADMIN = 'admin',
}

/**
 * 🔒 SECURITY : Utilisateur authentifié (côté client)
 * password_hash JAMAIS exposé côté client
 */
export interface User {
  id: string;                      // UUID
  username: string;
  phone: string | null;            // Optionnel en Phase 1
  phone_verified: boolean;
  role: UserRole;
  is_active: boolean;
  auth_mode: AuthMode;             // Calculé côté backend
  has_password: boolean;           // Indique si Option C activée
  created_at: string;              // ISO 8601
  last_seen_at: string | null;
}

/**
 * 🔒 SECURITY : Tokens JWT
 * → access  : 15 minutes (court pour limiter exposition)
 * → refresh : 30 jours (stocké en expo-secure-store)
 */
export interface AuthTokens {
  access_token: string;
  refresh_token: string;
  access_expires_at: number;       // Unix timestamp ms
  refresh_expires_at: number;
}

/**
 * 🔒 SECURITY : Payload JWT décodé
 * sub = user.id (standard JWT)
 */
export interface JWTPayload {
  sub: string;                     // user.id
  username: string;
  role: UserRole;
  iat: number;                     // Issued at
  exp: number;                     // Expires at
}

/**
 * 🎯 Requête d'inscription frictionless (1er lancement)
 */
export interface RegisterFrictionlessRequest {
  username: string;
  device_id: string;
}

/**
 * 🔒 SECURITY : Requête de sécurisation du compte (Option C activation)
 * Appelée APRÈS inscription frictionless quand le joueur veut
 * protéger son compte (ex: avant un retrait)
 */
export interface SecureAccountRequest {
  password: string;                // Min 6 caractères côté backend
  phone: string;                   // Format +225XXXXXXXX
}

/**
 * 🔒 SECURITY : Requête de récupération (nouveau téléphone)
 */
export interface RecoveryRequest {
  phone: string;
  password: string;
  new_device_id: string;
}

/**
 * 🎯 Login standard pour comptes secured
 */
export interface LoginRequest {
  username: string;
  password?: string;               // Optionnel si frictionless
  device_id: string;
}

/**
 * 🎯 Réponse standard auth (register/login/recover)
 */
export interface AuthResponse {
  user: User;
  tokens: AuthTokens;
}

/**
 * 🚨 PRS : Erreurs auth typées
 * Permet au client de réagir intelligemment (pas juste afficher)
 */
export enum AuthErrorCode {
  INVALID_CREDENTIALS = 'INVALID_CREDENTIALS',
  USERNAME_TAKEN = 'USERNAME_TAKEN',
  PHONE_ALREADY_USED = 'PHONE_ALREADY_USED',
  ACCOUNT_NOT_SECURED = 'ACCOUNT_NOT_SECURED',
  RATE_LIMITED = 'RATE_LIMITED',
  PRS_FROZEN = 'PRS_FROZEN',
  INVALID_PHONE_FORMAT = 'INVALID_PHONE_FORMAT',
  WEAK_PASSWORD = 'WEAK_PASSWORD',
  NETWORK_ERROR = 'NETWORK_ERROR',
  TOKEN_EXPIRED = 'TOKEN_EXPIRED',
  UNKNOWN = 'UNKNOWN',
}

export interface AuthError {
  code: AuthErrorCode;
  message: string;                 // Affichable au joueur (FR)
  retry_after?: number;            // Secondes (si rate limited)
}

/**
 * 🎯 État global du store Zustand
 */
export interface AuthState {
  user: User | null;
  tokens: AuthTokens | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: AuthError | null;

  // Actions
  registerFrictionless: (username: string) => Promise<void>;
  secureAccount: (password: string, phone: string) => Promise<void>;
  recoverAccount: (req: RecoveryRequest) => Promise<void>;
  login: (req: LoginRequest) => Promise<void>;
  logout: () => Promise<void>;
  refreshTokens: () => Promise<boolean>;
  loadFromStorage: () => Promise<void>;
  clearError: () => void;
}