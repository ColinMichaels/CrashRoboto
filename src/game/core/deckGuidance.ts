import { CARDS, DEFAULT_PLAYER_DECK } from './content';
import type { CardId } from './types';

export type DeckPresetId = 'balanced' | 'rush' | 'siege' | 'control';

export const DECK_PRESETS: Record<DeckPresetId, { name: string; deck: CardId[] }> = {
  balanced: { name: 'BALANCED', deck: [...DEFAULT_PLAYER_DECK] },
  rush: { name: 'RUSH', deck: ['zip', 'swarm', 'brute', 'pulse', 'arc', 'emp', 'sentry', 'vector'] },
  siege: { name: 'SIEGE', deck: ['brute', 'rail', 'pulse', 'patch', 'foundry', 'sentry', 'nano', 'vector'] },
  control: { name: 'CONTROL', deck: ['zip', 'pulse', 'arc', 'patch', 'emp', 'nano', 'sentry', 'foundry'] },
};

const containsAny = (deck: readonly CardId[], candidates: readonly CardId[]) =>
  candidates.some((cardId) => deck.includes(cardId));

export function getDeckGuidance(deck: readonly CardId[]): string[] {
  if (deck.length < 8) return [`SELECT ${8 - deck.length} MORE ${8 - deck.length === 1 ? 'CHIP' : 'CHIPS'}`];

  const guidance: string[] = [];
  if (deck.filter((cardId) => CARDS[cardId].cost <= 3).length < 2) guidance.push('ADD TWO LOW-COST OPENERS');
  if (!containsAny(deck, ['arc', 'emp', 'nano', 'sentry'])) guidance.push('ADD AREA CONTROL');
  if (!containsAny(deck, ['sentry', 'foundry'])) guidance.push('ADD AN INSTALLATION');
  if (!containsAny(deck, ['brute', 'rail', 'foundry'])) guidance.push('ADD STRUCTURE PRESSURE');
  if (!containsAny(deck, ['pulse', 'patch'])) guidance.push('ADD SUPPORT COVERAGE');

  const averageCost = deck.reduce((total, cardId) => total + CARDS[cardId].cost, 0) / deck.length;
  if (averageCost > 4.1) guidance.push('CURVE IS TOO EXPENSIVE');
  return guidance.length > 0 ? guidance : ['LOADOUT COVERAGE: READY'];
}
