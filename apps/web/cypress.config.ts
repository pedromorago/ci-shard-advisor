import { defineConfig } from 'cypress';

export default defineConfig({
  e2e: {
    baseUrl: 'http://localhost:4173',
    specPattern: 'cypress/e2e/**/*.cy.ts',
    supportFile: 'cypress/support/e2e.ts',
    video: false,
  },
  // JUnit XML per spec for Jira/Xray import.
  reporter: 'mocha-junit-reporter',
  reporterOptions: {
    mochaFile: 'reports/junit/cypress-[hash].xml',
    toConsole: false,
  },
});
