/** A minimal valid Cypress report carrying a canary string in a test title. */
function reportWithCanary(canary: string): string {
  return JSON.stringify({
    runs: [
      {
        spec: { relative: 'cypress/e2e/canary.cy.ts' },
        tests: [
          { title: ['Canary', canary], state: 'passed', duration: 4200 },
          { title: ['Canary', 'another test'], state: 'passed', duration: 8100 },
        ],
      },
    ],
  });
}

function upload(json: string, fileName: string) {
  cy.get('input[type=file]').selectFile(
    { contents: Cypress.Buffer.from(json), fileName, mimeType: 'application/json' },
    { force: true },
  );
}

describe('uploading a report', () => {
  beforeEach(() => {
    cy.visit('/');
  });

  it('analyzes an uploaded report client-side', () => {
    upload(reportWithCanary('renders results fast'), 'my-suite.json');
    cy.contains(/my-suite\.json/).should('be.visible');
    cy.contains(/2 tests/i).should('be.visible');
  });

  it('analyzes one report per container as a measured setup (multi-upload)', () => {
    // The product's preferred input (spec §3.1): N files at once → measured.
    cy.get('input[type=file]').selectFile(
      [
        { contents: Cypress.Buffer.from(reportWithCanary('slow container')), fileName: 'container-1.json', mimeType: 'application/json' },
        { contents: Cypress.Buffer.from(reportWithCanary('fast container')), fileName: 'container-2.json', mimeType: 'application/json' },
      ],
      { force: true },
    );
    cy.contains(/2 uploaded reports/i).should('be.visible');
    cy.get('section[aria-labelledby="current-heading"]').within(() => {
      cy.contains(/measured/i).should('be.visible');
      cy.contains(/2 containers/i).should('be.visible');
    });
  });

  it('surfaces a clear error for a malformed report', () => {
    upload('{ not valid json', 'broken.json');
    cy.get('[role="alert"]').should('be.visible');
    cy.contains(/demo.*3 containers/i).should('be.visible');
  });

  it('never sends the report off the page (privacy)', () => {
    const canary = 'PRIVACY-CANARY-cy-8f3a2b';
    const outbound: string[] = [];
    cy.intercept('**', (req) => {
      outbound.push(`${req.url} ${JSON.stringify(req.body ?? '')}`);
      req.continue();
    });

    upload(reportWithCanary(canary), 'canary.json');
    cy.contains(/canary\.json/).should('be.visible');

    // No intercepted request ever carries the report content.
    cy.wrap(null).then(() => {
      expect(outbound.join(' ')).not.to.contain(canary);
    });
  });
});
