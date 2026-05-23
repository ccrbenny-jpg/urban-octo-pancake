// ════════════════════════════════════════════════
// Fichier  : packages/shared-auth/src/types.d.ts
// Module   : @shared/auth
// Fonction : Déclarations TypeScript ambient pour les
//            peer dependencies React Native non installées
//            localement dans ce package partagé.
// Perf     : N/A (fichier de types uniquement)
// Deps     : Aucune
// Tests    : N/A
// ════════════════════════════════════════════════

// 🔒 SECURITY : Ces déclarations minimales évitent les erreurs
// TS 2307 dans Codespaces. Les vrais types viendront des apps
// Expo qui installent réellement les packages.

declare module 'expo-secure-store' {
  export function setItemAsync(
    key: string,
    value: string,
    options?: { keychainAccessible?: number }
  ): Promise<void>;
  export function getItemAsync(
    key: string,
    options?: { keychainAccessible?: number }
  ): Promise<string | null>;
  export function deleteItemAsync(
    key: string,
    options?: { keychainAccessible?: number }
  ): Promise<void>;
  export const WHEN_UNLOCKED: number;
  export const WHEN_UNLOCKED_THIS_DEVICE_ONLY: number;
}

declare module 'expo-device' {
  export const modelName: string | null;
  export const osName: string | null;
  export const osVersion: string | null;
  export const brand: string | null;
  export const manufacturer: string | null;
  export const deviceName: string | null;
  export function getDeviceTypeAsync(): Promise<number>;
}

declare module '@react-native-async-storage/async-storage' {
  interface AsyncStorageStatic {
    getItem(key: string): Promise<string | null>;
    setItem(key: string, value: string): Promise<void>;
    removeItem(key: string): Promise<void>;
    multiGet(keys: readonly string[]): Promise<readonly [string, string | null][]>;
    multiSet(keyValuePairs: [string, string][]): Promise<void>;
    multiRemove(keys: readonly string[]): Promise<void>;
    clear(): Promise<void>;
    getAllKeys(): Promise<readonly string[]>;
  }
  const AsyncStorage: AsyncStorageStatic;
  export default AsyncStorage;
}