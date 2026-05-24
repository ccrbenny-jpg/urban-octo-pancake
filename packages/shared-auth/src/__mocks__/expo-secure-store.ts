// ════════════════════════════════════════════════
// Fichier  : src/__mocks__/expo-secure-store.ts
// Module   : shared-auth (mocks Jest)
// Fonction : Mock par défaut pour expo-secure-store
// Note     : Surchargeable par jest.mock() dans les tests
// ════════════════════════════════════════════════

export const getItemAsync = jest.fn(async (_key: string): Promise<string | null> => null);
export const setItemAsync = jest.fn(async (_key: string, _value: string): Promise<void> => undefined);
export const deleteItemAsync = jest.fn(async (_key: string): Promise<void> => undefined);

export default {
  getItemAsync,
  setItemAsync,
  deleteItemAsync
};