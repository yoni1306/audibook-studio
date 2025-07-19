export default {
  displayName: 'workers',
  preset: '../../jest.preset.js',
  testEnvironment: 'node',
  setupFilesAfterEnv: ['<rootDir>/src/test-setup.ts'],
  transform: {
    '^.+\\.[tj]s$': ['ts-jest', { tsconfig: '<rootDir>/tsconfig.spec.json' }],
  },
  moduleFileExtensions: ['ts', 'js', 'html'],
  coverageDirectory: '../../coverage/apps/workers',
  moduleNameMapper: {
    '^@audibook/logger$': '<rootDir>/../../libs/shared/logger/src/index.ts',
    '^@audibook/correlation$': '<rootDir>/../../libs/shared/correlation/src/index.ts',
    '^@audibook/api-client$': '<rootDir>/../../libs/api-client/src/index.ts',
  },
};
