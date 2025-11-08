// Jest configuration for Next.js and TypeScript
const nextJest = require('next/jest')

const createJestConfig = nextJest({
  // Provide the path to your Next.js app to load next.config.js and .env files in your test environment
  dir: './',
})

// Add any custom config to be passed to Jest
const customJestConfig = {
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
  testEnvironment: 'jest-environment-jsdom',
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/$1',
  },
  testMatch: [
    '**/__tests__/**/*.[jt]s?(x)',
    '**/?(*.)+(spec|test).[jt]s?(x)',
  ],
  collectCoverageFrom: [
    'lib/**/*.{ts,tsx}',
    '!**/*.d.ts',
    '!**/node_modules/**',
    '!**/.next/**',
  ],
  coverageReporters: ['text', 'lcov'],
  coverageThreshold: {
    global: {
      branches: 28,
      functions: 45,
      lines: 35,
      statements: 35,
    },
    './lib/performance/memory-manager.ts': {
      branches: 60,
      functions: 70,
      lines: 80,
      statements: 80,
    },
    './lib/rendering/shared-webgl-context.ts': {
      branches: 80,
      functions: 70,
      lines: 90,
      statements: 90,
    },
    './lib/phases/explosion-phase.ts': {
      branches: 60,
      functions: 80,
      lines: 85,
      statements: 85,
    },
    './lib/phases/phase-manager.ts': {
      branches: 70,
      functions: 90,
      lines: 85,
      statements: 85,
    },
  },
}

// createJestConfig is exported this way to ensure that next/jest can load the Next.js config which is async
module.exports = createJestConfig(customJestConfig)

