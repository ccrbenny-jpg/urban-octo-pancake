/** @type {import('jest').Config} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  testMatch: ['**/__tests__/**/*.test.ts'],
  clearMocks: true,
  resetMocks: true,
  restoreMocks: true,
  
  // 🔒 SECURITY : Virtualise les peerDeps non installées
  // (elles seront fournies par les apps Expo/RN)
  moduleNameMapper: {
    '^expo-secure-store$': '<rootDir>/src/__mocks__/expo-secure-store.ts',
    '^@react-native-async-storage/async-storage$': '<rootDir>/src/__mocks__/async-storage.ts',
    '^react-native$': '<rootDir>/src/__mocks__/react-native.ts'
  },
  
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/*.d.ts',
    '!src/**/index.ts',
    '!src/__mocks__/**',
    '!src/__tests__/**'
  ],
  coverageDirectory: 'coverage',
  moduleFileExtensions: ['ts', 'js', 'json']
};