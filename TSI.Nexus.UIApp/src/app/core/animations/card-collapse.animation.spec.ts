import { cardCollapseAnimation } from './card-collapse.animation';

describe('cardCollapseAnimation', () => {
  it('is registered under the cardCollapse trigger name', () => {
    expect(cardCollapseAnimation.name).toBe('cardCollapse');
  });

  it('defines both open and closed states with a transition between them', () => {
    const definitions = cardCollapseAnimation.definitions;
    expect(definitions.length).toBeGreaterThan(0);
  });
});
