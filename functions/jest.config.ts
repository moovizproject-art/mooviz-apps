import type { Config } from "jest";

const config: Config = {
  preset: "ts-jest",
  testEnvironment: "node",
  roots: ["<rootDir>/src"],
  testMatch: ["**/__tests__/**/*.test.ts"],
  moduleNameMapper: {
    "^@mooviz/shared$": "<rootDir>/../shared/src",
    "^@mooviz/shared/(.*)$": "<rootDir>/../shared/src/$1",
  },
  transform: {
    "^.+\\.tsx?$": [
      "ts-jest",
      {
        tsconfig: "tsconfig.json",
      },
    ],
  },
  // firestoreRules requires the Firestore emulator — run via `pnpm test:rules`
  testPathIgnorePatterns: ["firestoreRules"],
  // Clear mocks between tests
  clearMocks: true,
  restoreMocks: true,
};

export default config;
