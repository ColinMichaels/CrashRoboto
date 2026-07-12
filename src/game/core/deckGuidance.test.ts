import { describe, expect, it } from 'vitest';
import { isValidDeck } from './content';
import { DECK_PRESETS, getDeckGuidance } from './deckGuidance';

describe('deck guidance', () => {
  it('ships complete, unique starter archetypes', () => {
    expect(Object.values(DECK_PRESETS).every((preset) => isValidDeck(preset.deck))).toBe(true);
  });

  it('identifies missing curve and role coverage', () => {
    expect(getDeckGuidance(['brute', 'rail'])).toEqual(['SELECT 6 MORE CHIPS']);
    const expensiveWarnings = getDeckGuidance(['brute', 'rail', 'drone', 'vector', 'nano', 'foundry', 'arc', 'patch']);
    expect(expensiveWarnings).toContain('ADD TWO LOW-COST OPENERS');
    const warnings = getDeckGuidance(['brute', 'rail', 'drone', 'vector', 'nano', 'emp', 'arc', 'swarm']);
    expect(warnings).toContain('ADD AN INSTALLATION');
    expect(warnings).toContain('ADD SUPPORT COVERAGE');
  });

  it('recognizes the balanced preset as ready', () => {
    expect(getDeckGuidance(DECK_PRESETS.balanced.deck)).toEqual(['LOADOUT COVERAGE: READY']);
  });
});
