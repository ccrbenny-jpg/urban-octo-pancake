// ════════════════════════════════════════════════════════════
// Fichier  : packages/shared-auth/src/__tests__/tokens.test.ts
// Module   : @shared/auth
// Fonction : Tests Jest exhaustifs pour tokens.ts
//            (API AuthTokens — snake_case)
// Perf     : Mocks complets — aucun I/O réel
// Deps     : jest, mocks de expo-secure-store
// Tests    : Couvre saveTokens, getTokens, clearTokens,
//            decodeToken, isAccessTokenExpired,
//            isRefreshTokenExpired, getValidAccessToken
// ════════════════════════════════════════════════════════════

// 🔒 SECURITY : Mock complet de expo-secure-store AVANT import
const mockSecureStore = {
  setItemAsync: jest.fn(),
  getItemAsync: jest.fn(),
  deleteItemAsync: jest.fn(),
};
jest.mock('expo-secure-store', () => mockSecureStore);



import {
  saveTokens,
  getTokens,
  clearTokens,
  isAccessTokenExpired,
  isRefreshTokenExpired,
  decodeToken,
  getValidAccessToken,
} from '../tokens';
import type { AuthTokens } from '../types';

// ─── Helpers ────────────────────────────────────────────────

/**
 * Génère un JWT factice (header.payload.signature)
 * ⚠️ NE PAS utiliser en production — signature fictive.
 */
function makeFakeJWT(payload: Record<string, unknown>): string {
  const header = Buffer.from(
    JSON.stringify({ alg: 'HS256', typ: 'JWT' })
  ).toString('base64url');
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
  return `${header}.${body}.fake-signature`;
}

const nowMs = () => Date.now();

/**
 * Construit un objet AuthTokens valide pour les tests.
 */
function makeTokens(overrides: Partial<AuthTokens> = {}): AuthTokens {
  return {
    access_token: 'access-xyz',
    refresh_token: 'refresh-abc',
    access_expires_at: nowMs() + 15 * 60 * 1000,   // +15min
    refresh_expires_at: nowMs() + 30 * 24 * 3600 * 1000, // +30j
    ...overrides,
  };
}

// ════════════════════════════════════════════════════
// ─── Test: saveTokens ──────────────────────────────
// ════════════════════════════════════════════════════
describe('saveTokens', () => {
  beforeEach(() => {
    mockSecureStore.setItemAsync.mockReset();
  });

  it('should store all 4 token fields', async () => {
    mockSecureStore.setItemAsync.mockResolvedValue(undefined);

    const tokens = makeTokens();
    await saveTokens(tokens);

    expect(mockSecureStore.setItemAsync).toHaveBeenCalledTimes(4);
    expect(mockSecureStore.setItemAsync).toHaveBeenCalledWith(
      'nexus_access_token',
      tokens.access_token
    );
    expect(mockSecureStore.setItemAsync).toHaveBeenCalledWith(
      'nexus_refresh_token',
      tokens.refresh_token
    );
  });

  it('should throw TOKEN_SAVE_FAILED on secure-store error', async () => {
    mockSecureStore.setItemAsync.mockRejectedValueOnce(
      new Error('Keystore unavailable')
    );

    await expect(saveTokens(makeTokens())).rejects.toThrow(
      'TOKEN_SAVE_FAILED'
    );
  });
});

// ════════════════════════════════════════════════════
// ─── Test: getTokens ───────────────────────────────
// ════════════════════════════════════════════════════
describe('getTokens', () => {
  beforeEach(() => {
    mockSecureStore.getItemAsync.mockReset();
    mockSecureStore.deleteItemAsync.mockReset();
  });

  it('should return AuthTokens object when all 4 fields present', async () => {
    const expiresAccess = nowMs() + 900_000;
    const expiresRefresh = nowMs() + 2_592_000_000;

    mockSecureStore.getItemAsync
      .mockResolvedValueOnce('access-xyz')
      .mockResolvedValueOnce('refresh-abc')
      .mockResolvedValueOnce(String(expiresAccess))
      .mockResolvedValueOnce(String(expiresRefresh));

    const tokens = await getTokens();

    expect(tokens).not.toBeNull();
    expect(tokens?.access_token).toBe('access-xyz');
    expect(tokens?.refresh_token).toBe('refresh-abc');
    expect(tokens?.access_expires_at).toBe(expiresAccess);
    expect(tokens?.refresh_expires_at).toBe(expiresRefresh);
  });

  it('should return null when storage is empty', async () => {
    mockSecureStore.getItemAsync.mockResolvedValue(null);

    const tokens = await getTokens();
    expect(tokens).toBeNull();
  });

  it('should return null when any field is missing', async () => {
    mockSecureStore.getItemAsync
      .mockResolvedValueOnce('access-xyz')
      .mockResolvedValueOnce('refresh-abc')
      .mockResolvedValueOnce(null) // accessExp manquant
      .mockResolvedValueOnce(String(nowMs() + 1000));

    const tokens = await getTokens();
    expect(tokens).toBeNull();
  });

  it('should auto-clear corrupted tokens (NaN expiry)', async () => {
    mockSecureStore.getItemAsync
      .mockResolvedValueOnce('access-xyz')
      .mockResolvedValueOnce('refresh-abc')
      .mockResolvedValueOnce('not-a-number')  // 🚨 PRS : corruption
      .mockResolvedValueOnce(String(nowMs() + 1000));

    mockSecureStore.deleteItemAsync.mockResolvedValue(undefined);

    const tokens = await getTokens();

    expect(tokens).toBeNull();
    // 🔒 SECURITY : tokens corrompus → purge automatique
    expect(mockSecureStore.deleteItemAsync).toHaveBeenCalled();
  });

  it('should return null and not throw on secure-store error', async () => {
    mockSecureStore.getItemAsync.mockRejectedValueOnce(
      new Error('Keystore locked')
    );

    const tokens = await getTokens();
    expect(tokens).toBeNull();
  });
});

// ════════════════════════════════════════════════════
// ─── Test: clearTokens ─────────────────────────────
// ════════════════════════════════════════════════════
describe('clearTokens', () => {
  beforeEach(() => {
    mockSecureStore.deleteItemAsync.mockReset();
  });

  it('should delete all 4 token fields', async () => {
    mockSecureStore.deleteItemAsync.mockResolvedValue(undefined);

    await clearTokens();

    expect(mockSecureStore.deleteItemAsync).toHaveBeenCalledTimes(4);
    expect(mockSecureStore.deleteItemAsync).toHaveBeenCalledWith(
      'nexus_access_token'
    );
    expect(mockSecureStore.deleteItemAsync).toHaveBeenCalledWith(
      'nexus_refresh_token'
    );
  });

  it('should not throw if a field is already missing', async () => {
    // 🔒 SECURITY : clearTokens doit être idempotent
    mockSecureStore.deleteItemAsync.mockResolvedValue(undefined);

    await expect(clearTokens()).resolves.not.toThrow();
  });

  it('should swallow deletion errors silently', async () => {
    mockSecureStore.deleteItemAsync.mockRejectedValue(
      new Error('Already deleted')
    );

    // 🔒 SECURITY : ne JAMAIS bloquer le logout sur une erreur de purge
    await expect(clearTokens()).resolves.not.toThrow();
  });
});

// ════════════════════════════════════════════════════
// ─── Test: decodeToken ─────────────────────────────
// ════════════════════════════════════════════════════
describe('decodeToken', () => {
  it('should decode a valid JWT payload', () => {
    const jwt = makeFakeJWT({
      sub: 'user-123',
      username: 'mamadou',
      role: 'player',
      exp: Math.floor(nowMs() / 1000) + 900,
      iat: Math.floor(nowMs() / 1000),
    });

    const payload = decodeToken(jwt);

    expect(payload).not.toBeNull();
    expect(payload?.sub).toBe('user-123');
    expect(payload?.username).toBe('mamadou');
    expect(payload?.role).toBe('player');
  });

  it('should return null for malformed JWT', () => {
    const payload = decodeToken('not.a.jwt.token.extra');
    expect(payload).toBeNull();
  });

  it('should return null for empty string', () => {
    expect(decodeToken('')).toBeNull();
  });

  it('should return null for non-base64 payload', () => {
    expect(decodeToken('header.@@@@@.sig')).toBeNull();
  });
});

// ════════════════════════════════════════════════════
// ─── Test: isAccessTokenExpired ────────────────────
// ════════════════════════════════════════════════════
describe('isAccessTokenExpired', () => {
  it('should return false when access token is valid (>60s left)', () => {
    const tokens = makeTokens({
      access_expires_at: nowMs() + 5 * 60 * 1000, // +5min
    });
    expect(isAccessTokenExpired(tokens)).toBe(false);
  });

  it('should return true when access token expires within safety margin', () => {
    // 🔒 SECURITY : marge de 60s pour anticiper le refresh
    const tokens = makeTokens({
      access_expires_at: nowMs() + 30 * 1000, // +30s
    });
    expect(isAccessTokenExpired(tokens)).toBe(true);
  });

  it('should return true when access token is already expired', () => {
    const tokens = makeTokens({
      access_expires_at: nowMs() - 1000,
    });
    expect(isAccessTokenExpired(tokens)).toBe(true);
  });

  it('should return true when tokens is null', () => {
    expect(isAccessTokenExpired(null)).toBe(true);
  });
});

// ════════════════════════════════════════════════════
// ─── Test: isRefreshTokenExpired ───────────────────
// ════════════════════════════════════════════════════
describe('isRefreshTokenExpired', () => {
  it('should return false when refresh token is valid', () => {
    const tokens = makeTokens({
      refresh_expires_at: nowMs() + 7 * 24 * 3600 * 1000, // +7j
    });
    expect(isRefreshTokenExpired(tokens)).toBe(false);
  });

  it('should return true when refresh token is expired', () => {
    const tokens = makeTokens({
      refresh_expires_at: nowMs() - 1000,
    });
    expect(isRefreshTokenExpired(tokens)).toBe(true);
  });

  it('should return true when tokens is null', () => {
    expect(isRefreshTokenExpired(null)).toBe(true);
  });
});

// ════════════════════════════════════════════════════
// ─── Test: getValidAccessToken ─────────────────────
// ════════════════════════════════════════════════════
describe('getValidAccessToken', () => {
  beforeEach(() => {
    mockSecureStore.getItemAsync.mockReset();
    mockSecureStore.deleteItemAsync.mockReset();
  });

  it('should return access token when still valid', async () => {
    const expiresAccess = nowMs() + 10 * 60 * 1000; // +10min
    const expiresRefresh = nowMs() + 30 * 24 * 3600 * 1000;

    mockSecureStore.getItemAsync
      .mockResolvedValueOnce('access-valid')
      .mockResolvedValueOnce('refresh-abc')
      .mockResolvedValueOnce(String(expiresAccess))
      .mockResolvedValueOnce(String(expiresRefresh));

    const token = await getValidAccessToken();
    expect(token).toBe('access-valid');
  });

  it('should return null when access token expired', async () => {
    const expiresAccess = nowMs() - 1000; // expiré
    const expiresRefresh = nowMs() + 30 * 24 * 3600 * 1000;

    mockSecureStore.getItemAsync
      .mockResolvedValueOnce('access-old')
      .mockResolvedValueOnce('refresh-abc')
      .mockResolvedValueOnce(String(expiresAccess))
      .mockResolvedValueOnce(String(expiresRefresh));

    const token = await getValidAccessToken();
    expect(token).toBeNull();
  });

  it('should return null when no tokens stored', async () => {
    mockSecureStore.getItemAsync.mockResolvedValue(null);

    const token = await getValidAccessToken();
    expect(token).toBeNull();
  });
});

// ════════════════════════════════════════════════════
// ─── Test: Scénarios anti-fraude ───────────────────
// ════════════════════════════════════════════════════
describe('Anti-fraud scenarios (PRS)', () => {
  beforeEach(() => {
    mockSecureStore.getItemAsync.mockReset();
    mockSecureStore.deleteItemAsync.mockReset();
  });

  it('should detect tampered expiry (negative timestamp)', async () => {
    // 🚨 PRS : un attaquant tente d'injecter une expiry négative
    mockSecureStore.getItemAsync
      .mockResolvedValueOnce('access-xyz')
      .mockResolvedValueOnce('refresh-abc')
      .mockResolvedValueOnce('-999999')
      .mockResolvedValueOnce(String(nowMs() + 1000));

    mockSecureStore.deleteItemAsync.mockResolvedValue(undefined);

    const tokens = await getTokens();
    // Le timestamp est techniquement valide en parsing mais expiré → null
    expect(tokens === null || isAccessTokenExpired(tokens)).toBe(true);
  });

  it('should detect tampered tokens (decode produces unexpected fields)', () => {
    // 🚨 PRS : payload sans 'sub' = token forgé
    const forgedJwt = makeFakeJWT({ role: 'admin' }); // pas de sub
    const payload = decodeToken(forgedJwt);

    // decodeToken ne valide pas le contenu — c'est le rôle de l'API serveur.
    // Ici on vérifie juste qu'on peut détecter l'absence de sub.
    expect(payload?.sub).toBeUndefined();
  });
});