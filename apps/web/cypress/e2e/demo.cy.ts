describe('demo analysis', () => {
  beforeEach(() => {
    cy.visit('/');
  });

  it('loads a preloaded current situation and moves without any input', () => {
    cy.contains('h1', 'CI Shard Advisor').should('be.visible');
    cy.contains(/demo.*3 containers/i).should('be.visible');
    cy.contains(/rebalance/i).should('be.visible');
    // The frontier chart lives in a collapsible section; expand it.
    cy.contains(/show the full cost \/ time frontier/i).click();
    cy.get('svg[role="img"]').should('have.attr', 'aria-label').and('match', /feedback time versus billed cost/i);
  });

  it('fits a phone screen: no sideways scroll and a legible chart', () => {
    cy.viewport(390, 844);
    cy.contains(/show the full cost \/ time frontier/i).click();
    cy.document().its('documentElement.scrollWidth').should('be.at.most', 390);
    // Axis labels are 13px. Drawn at the real width they stay that size; a
    // scaled-down desktop drawing would shrink them to about 6px.
    cy.get('svg[role="img"]')
      .contains('text', 'Cost per run')
      .should(($label) => {
        expect($label[0].getBoundingClientRect().height).to.be.at.least(12);
      });
  });

  it('has no serious or critical accessibility violations', () => {
    cy.injectAxe();
    cy.checkA11y(undefined, { includedImpacts: ['serious', 'critical'] });
  });
});
