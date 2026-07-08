describe('demo analysis', () => {
  beforeEach(() => {
    cy.visit('/');
  });

  it('loads a preloaded current situation and moves without any input', () => {
    cy.contains('h1', 'CI Shard Advisor').should('be.visible');
    cy.contains(/demo.*4 shards/i).should('be.visible');
    cy.contains(/rebalance/i).should('be.visible');
    // The frontier chart lives in a collapsible section; expand it.
    cy.contains(/show the full cost \/ time frontier/i).click();
    cy.get('svg[role="img"]').should('have.attr', 'aria-label').and('match', /feedback time versus billed cost/i);
  });

  it('has no serious or critical accessibility violations', () => {
    cy.injectAxe();
    cy.checkA11y(undefined, { includedImpacts: ['serious', 'critical'] });
  });
});
