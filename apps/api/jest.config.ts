export default {
  displayName: 'api',
  preset: '../../jest.preset.js',
  testEnvironment: 'node',
  transform: {
    '^.+\\.[tj]s$': ['ts-jest', { tsconfig: '<rootDir>/tsconfig.spec.json' }],
  },
  moduleFileExtensions: ['ts', 'js', 'html'],
  coverageDirectory: '../../coverage/apps/api',
  moduleNameMapper: {
    '^@audibook/logger$': '<rootDir>/../../libs/shared/logger/src/index.ts',
    '^@audibook/correlation$': '<rootDir>/../../libs/shared/correlation/src/index.ts',
    '^@audibook/api-client$': '<rootDir>/../../libs/api-client/src/index.ts',
  },
};
