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
    // The split disclosures are tap targets: at least 44px tall, the iOS minimum.
    cy.contains('summary', /apply this split/i).should(($summary) => {
      expect($summary[0].getBoundingClientRect().height).to.be.at.least(44);
    });
  });

  it('copies a container command to the clipboard exactly as shown', () => {
    cy.window().then((win) => {
      cy.stub(win.navigator.clipboard, 'writeText').as('writeText').resolves();
    });
    cy.contains('summary', /apply this split/i).click();
    cy.get('button[aria-label="Copy the command for container 1"]').first().as('copy').click();

    cy.get('@copy').should('have.text', 'Copied');
    cy.get('@copy')
      .siblings('code')
      .invoke('text')
      .then((command) => {
        cy.get('@writeText').should('have.been.calledOnceWithExactly', command);
      });
  });

  it('shares with a link preview: description, large card and a served image', () => {
    cy.get('meta[name="description"]').should('have.attr', 'content').and('match', /cypress/i);
    cy.get('meta[name="twitter:card"]').should('have.attr', 'content', 'summary_large_image');
    cy.get('meta[property="og:image"]').should('have.attr', 'content').and('match', /\/og\.png$/);

    // The image the tags point at ships with the site, at the size they declare.
    cy.request({ url: '/og.png', encoding: 'binary' }).then((response) => {
      expect(response.headers['content-type']).to.eq('image/png');
      const png = Cypress.Buffer.from(response.body, 'binary');
      expect([png.readUInt32BE(16), png.readUInt32BE(20)]).to.deep.eq([1200, 630]);
    });
  });

  it('has no accessibility violations, disclosures open', () => {
    // Scan what the collapsible sections hide too (help, chart and split lists).
    cy.get('details').invoke('attr', 'open', '');
    cy.injectAxe();
    cy.checkA11y();
  });
});
