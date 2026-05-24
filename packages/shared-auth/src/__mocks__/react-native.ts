// ════════════════════════════════════════════════
// Fichier  : src/__mocks__/react-native.ts
// Module   : shared-auth (mocks Jest)
// Fonction : Mock minimal pour react-native côté Node.js
// ════════════════════════════════════════════════

export const Platform = {
  OS: 'android' as 'android' | 'ios' | 'web',
  Version: 30,
  select: <T>(specifics: { android?: T; ios?: T; default?: T }): T | undefined => 
    specifics.android ?? specifics.default
};

export default {
  Platform
};