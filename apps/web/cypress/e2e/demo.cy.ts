describe('demo analysis', () => {
  beforeEach(() => {
    cy.visit('/');
  });

  it('loads a preloaded recommendation without any input', () => {
    cy.contains('h1', 'CI Shard Advisor').should('be.visible');
    cy.contains(/demo report/i).should('be.visible');
    cy.contains(/\d+ shards/).should('be.visible');
    // The frontier chart renders with its accessible description.
    cy.get('svg[role="img"]').should('have.attr', 'aria-label').and('match', /feedback time versus billed cost/i);
  });

  it('has no serious or critical accessibility violations', () => {
    cy.injectAxe();
    cy.checkA11y(undefined, { includedImpacts: ['serious', 'critical'] });
  });
});
