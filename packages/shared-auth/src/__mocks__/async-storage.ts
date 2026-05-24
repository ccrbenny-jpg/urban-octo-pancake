// ════════════════════════════════════════════════
// Fichier  : src/__mocks__/async-storage.ts
// Module   : shared-auth (mocks Jest)
// Fonction : Mock par défaut pour AsyncStorage
// ════════════════════════════════════════════════

const storage = new Map<string, string>();

export const getItem = jest.fn(async (key: string): Promise<string | null> => 
  storage.get(key) ?? null
);
export const setItem = jest.fn(async (key: string, value: string): Promise<void> => {
  storage.set(key, value);
});
export const removeItem = jest.fn(async (key: string): Promise<void> => {
  storage.delete(key);
});
export const clear = jest.fn(async (): Promise<void> => {
  storage.clear();
});

export default {
  getItem,
  setItem,
  removeItem,
  clear
};