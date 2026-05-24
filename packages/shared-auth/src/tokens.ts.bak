// ════════════════════════════════════════════════════════════
// Fichier  : packages/shared-auth/src/tokens.ts
// Module   : shared-auth
// Fonction : Stockage sécurisé des JWT + décodage local
// Perf     : Décodage JWT sans appel réseau (lib jose)
// Deps     : expo-secure-store, jose (decode-only)
// Tests    : packages/shared-auth/src/__tests__/tokens.test.ts
// ════════════════════════════════════════════════════════════

import * as SecureStore from 'expo-secure-store';
import { decodeJwt } from 'jose';
import type { AuthTokens, JWTPayload } from './types';

// 🔒 SECURITY : Clés de stockage SecureStore
const KEY_ACCESS_TOKEN = 'nexus_access_token';
const KEY_REFRESH_TOKEN = 'nexus_refresh_token';
const KEY_ACCESS_EXPIRES = 'nexus_access_expires';
const KEY_REFRESH_EXPIRES = 'nexus_refresh_expires';

// ⚡ PERF : Marge de sécurité avant expiration (30s)
const EXPIRY_BUFFER_MS = 30_000;

/**
 * 🔒 SECURITY : Sauvegarde les tokens dans expo-secure-store (chiffré natif).
 */
export async function saveTokens(tokens: AuthTokens): Promise<void> {
  try {
    await Promise.all([
      SecureStore.setItemAsync(KEY_ACCESS_TOKEN, tokens.access_token),
      SecureStore.setItemAsync(KEY_REFRESH_TOKEN, tokens.refresh_token),
      SecureStore.setItemAsync(KEY_ACCESS_EXPIRES, String(tokens.access_expires_at)),
      SecureStore.setItemAsync(KEY_REFRESH_EXPIRES, String(tokens.refresh_expires_at)),
    ]);
  } catch (error) {
    console.error('[tokens] Failed to save tokens:', error);
    throw new Error('TOKEN_SAVE_FAILED');
  }
}

/**
 * 🔒 SECURITY : Récupère les tokens stockés. null si absents/corrompus.
 */
export async function getTokens(): Promise<AuthTokens | null> {
  try {
    const [access, refresh, accessExp, refreshExp] = await Promise.all([
      SecureStore.getItemAsync(KEY_ACCESS_TOKEN),
      SecureStore.getItemAsync(KEY_REFRESH_TOKEN),
      SecureStore.getItemAsync(KEY_ACCESS_EXPIRES),
      SecureStore.getItemAsync(KEY_REFRESH_EXPIRES),
    ]);

    if (!access || !refresh || !accessExp || !refreshExp) {
      return null;
    }

    const access_expires_at = parseInt(accessExp, 10);
    const refresh_expires_at = parseInt(refreshExp, 10);

    if (isNaN(access_expires_at) || isNaN(refresh_expires_at)) {
      console.warn('[tokens] Corrupted expiry data, clearing tokens');
      await clearTokens();
      return null;
    }

    return {
      access_token: access,
      refresh_token: refresh,
      access_expires_at,
      refresh_expires_at,
    };
  } catch (error) {
    console.warn('[tokens] Failed to read tokens:', error);
    return null;
  }
}

/**
 * 🔒 SECURITY : Supprime tous les tokens (logout complet).
 */
export async function clearTokens(): Promise<void> {
  try {
    await Promise.all([
      SecureStore.deleteItemAsync(KEY_ACCESS_TOKEN),
      SecureStore.deleteItemAsync(KEY_REFRESH_TOKEN),
      SecureStore.deleteItemAsync(KEY_ACCESS_EXPIRES),
      SecureStore.deleteItemAsync(KEY_REFRESH_EXPIRES),
    ]);
  } catch (error) {
    console.warn('[tokens] Failed to clear tokens:', error);
  }
}

/**
 * ⚡ PERF : Décode un JWT localement SANS vérifier la signature.
 * 🔒 SECURITY : La vérification de signature est FAITE CÔTÉ BACKEND uniquement.
 */
export function decodeToken(token: string): JWTPayload | null {
  try {
    const payload = decodeJwt(token) as JWTPayload;
    return payload;
  } catch (error) {
    console.warn('[tokens] Failed to decode JWT:', error);
    return null;
  }
}

/**
 * ⚡ PERF : Vérifie si le access_token est expiré (avec buffer 30s).
 */
export function isAccessTokenExpired(tokens: AuthTokens | null): boolean {
  if (tokens === null) return true;
  const now = Date.now();
  return now >= tokens.access_expires_at - EXPIRY_BUFFER_MS;
}

/**
 * ⚡ PERF : Vérifie si le refresh_token est expiré.
 */
export function isRefreshTokenExpired(tokens: AuthTokens | null): boolean {
  if (tokens === null) return true;
  const now = Date.now();
  return now >= tokens.refresh_expires_at - EXPIRY_BUFFER_MS;
}

// ════════════════════════════════════════════════════════════
// 🆕 AJOUT — Fonction manquante détectée par les tests
// ════════════════════════════════════════════════════════════

/**
 * ⚡ PERF : Récupère un access_token valide prêt à l'emploi.
 *
 * Comportement :
 *  - Lit les tokens depuis SecureStore
 *  - Retourne access_token si encore valide (>30s avant expiry)
 *  - Retourne null si absent OU expiré
 *
 * ⚠️ Ne fait PAS de refresh automatique. La logique de refresh
 *    appartient au hook useAuth (qui appellera l'API /auth/refresh).
 *
 * 🔒 SECURITY : Centralise la lecture token pour tous les appels API
 *    → Aucun composant ne doit lire SecureStore directement.
 *
 * @returns access_token (string) si valide, null sinon
 *
 * @example
 *   const token = await getValidAccessToken();
 *   if (!token) {
 *     // Besoin de refresh ou de re-login
 *     await refreshOrLogout();
 *     return;
 *   }
 *   fetch(url, { headers: { Authorization: `Bearer ${token}` } });
 */
export async function getValidAccessToken(): Promise<string | null> {
  const tokens = await getTokens();

  // Cas 1 : Aucun token stocké
  if (tokens === null) {
    return null;
  }

  // Cas 2 : Token expiré (avec buffer 30s)
  if (isAccessTokenExpired(tokens)) {
    return null;
  }

  // Cas 3 : Token valide → on le retourne
  return tokens.access_token;
}