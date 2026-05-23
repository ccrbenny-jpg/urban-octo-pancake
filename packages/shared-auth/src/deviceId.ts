// ════════════════════════════════════════════════════════════
// Fichier  : packages/shared-auth/src/deviceId.ts
// Module   : shared-auth
// Fonction : Génère et persiste un device_id unique par appareil
// Perf     : Cache en mémoire après 1er appel (zéro I/O répété)
// Deps     : @react-native-async-storage/async-storage, uuid, expo-device
// Tests    : packages/shared-auth/src/__tests__/deviceId.test.ts
// ════════════════════════════════════════════════════════════

import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Device from 'expo-device';
import { v4 as uuidv4 } from 'uuid';

// 🔒 SECURITY : Clé de stockage AsyncStorage
// Préfixe @nexus pour éviter collisions avec d'autres apps
const STORAGE_KEY = '@nexus/device_uuid';

// ⚡ PERF : Cache mémoire pour éviter les lectures AsyncStorage répétées
// Une seule lecture par session, puis tout vient de la RAM
let cachedDeviceId: string | null = null;

/**
 * 🔒 SECURITY + 📱 AOF :
 * Récupère ou génère un device_id unique persistant.
 *
 * Pourquoi pas Application.androidId ?
 * → Retourne null sur Android 10+ (restriction Google Privacy)
 * → Solution : UUID v4 généré au 1er lancement, stocké AsyncStorage
 *
 * Stratégie :
 * 1. Cache mémoire (instantané)
 * 2. AsyncStorage (rapide ~5ms)
 * 3. Génération UUID v4 si absent (1er lancement)
 *
 * Le device_id est utilisé pour :
 * → Login frictionless (couple username + device_id)
 * → Anti-fraude (device_fingerprint base)
 * → Multi-account detection (max 2 comptes/device)
 *
 * @returns device_id (UUID v4, ex: "550e8400-e29b-41d4-a716-446655440000")
 */
export async function getDeviceId(): Promise<string> {
  // ⚡ PERF : Cache mémoire — retour instantané si déjà chargé
  if (cachedDeviceId) {
    return cachedDeviceId;
  }

  try {
    // Lecture AsyncStorage
    const stored = await AsyncStorage.getItem(STORAGE_KEY);

    if (stored && isValidUUID(stored)) {
      cachedDeviceId = stored;
      return stored;
    }

    // 🔒 SECURITY : Premier lancement OU UUID corrompu → régénération
    const newDeviceId = uuidv4();
    await AsyncStorage.setItem(STORAGE_KEY, newDeviceId);
    cachedDeviceId = newDeviceId;
    return newDeviceId;
  } catch (error) {
    // 📱 AOF : Si AsyncStorage échoue (très rare), fallback en mémoire
    // L'app reste fonctionnelle, mais le device_id changera au prochain
    // lancement → considéré comme nouveau device par l'anti-fraude
    console.warn('[deviceId] AsyncStorage error, using volatile UUID:', error);
    const volatileId = uuidv4();
    cachedDeviceId = volatileId;
    return volatileId;
  }
}

/**
 * 🔒 SECURITY :
 * Valide qu'une string est bien un UUID v4 (format strict).
 * Protège contre l'injection ou la corruption du stockage.
 */
function isValidUUID(value: string): boolean {
  const UUID_V4_REGEX =
    /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return UUID_V4_REGEX.test(value);
}

/**
 * 🚨 PRS : Génère un device_fingerprint cohérent avec le backend.
 *
 * Formule : SHA-256-like simplifié côté client
 * → device_id + brand + modelName + osVersion
 *
 * Note : Le hash SHA-256 réel est calculé côté serveur sur ces
 * mêmes inputs pour cohérence. Le client envoie les composants
 * bruts, le serveur hash. Ceci évite des libs crypto côté mobile.
 *
 * @returns Objet avec les composants du fingerprint
 */
export async function getDeviceFingerprintComponents(): Promise<{
  device_id: string;
  brand: string;
  model: string;
  os_version: string;
}> {
  const device_id = await getDeviceId();

  return {
    device_id,
    brand: Device.brand ?? 'unknown',
    model: Device.modelName ?? 'unknown',
    os_version: Device.osVersion ?? 'unknown',
  };
}

/**
 * 🧪 TEST UTILITY : Vide le cache (uniquement pour tests Jest)
 * Ne PAS appeler en production.
 */
export function _resetCache(): void {
  cachedDeviceId = null;
}

/**
 * 🔒 SECURITY : Suppression définitive du device_id
 * Utilisé uniquement lors du logout complet ou debug.
 * ⚠️ Provoque la création d'un nouveau device_id au prochain getDeviceId()
 */
export async function clearDeviceId(): Promise<void> {
  try {
    await AsyncStorage.removeItem(STORAGE_KEY);
    cachedDeviceId = null;
  } catch (error) {
    console.warn('[deviceId] Failed to clear:', error);
  }
}