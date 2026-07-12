import type { CardId, CardLevel, PlayerCardLevelConfig } from './types';

export const STARTER_CARD_IDS = [
  'zip',
  'swarm',
  'brute',
  'rail',
  'pulse',
  'arc',
  'drone',
  'patch',
  'vector',
  'emp',
  'nano',
  'sentry',
  'foundry',
] as const satisfies readonly CardId[];

export const VAULT_CARD_IDS = [
  'aegis',
  'wraith',
  'viper',
  'gravity',
  'firewall',
] as const satisfies readonly CardId[];

export type StarterCardId = (typeof STARTER_CARD_IDS)[number];
export type VaultCardId = (typeof VAULT_CARD_IDS)[number];
export type CollectionCardId = CardId;
export type UnlockedCardMasteryLevel = CardLevel;
export type CardMasteryLevel = 0 | UnlockedCardMasteryLevel;

export interface CardCollectionEntry {
  level: CardMasteryLevel;
  copies: number;
}

export type CardCollection = Record<CollectionCardId, CardCollectionEntry>;

export const ALL_COLLECTION_CARD_IDS: readonly CollectionCardId[] = [
  ...STARTER_CARD_IDS,
  ...VAULT_CARD_IDS,
];

export const CARD_COPY_REQUIREMENTS = {
  0: 8,
  1: 12,
  2: 20,
  3: 32,
  4: 48,
  5: null,
} as const satisfies Record<CardMasteryLevel, number | null>;

export const CARD_MASTERY_BONUSES = {
  0: 0,
  1: 0,
  2: 0.04,
  3: 0.08,
  4: 0.12,
  5: 0.16,
} as const satisfies Record<CardMasteryLevel, number>;

export type ChestTier = 'cache' | 'vault' | 'core';

export interface CardFragmentDrop {
  cardId: CollectionCardId;
  copies: number;
}

export interface DirectCardUpgrade {
  cardId: CollectionCardId;
}

export interface VictoryChest {
  tier: ChestTier;
  fragments: CardFragmentDrop[];
  directUpgrade?: DirectCardUpgrade;
}

export type CardRewardKind = 'fragments' | 'direct-upgrade';

export interface CardRewardReveal {
  kind: CardRewardKind;
  cardId: CollectionCardId;
  copiesAwarded: number;
  before: CardCollectionEntry;
  after: CardCollectionEntry;
  levelsGained: number;
  unlocked: boolean;
}

export interface VictoryChestReveal {
  tier: ChestTier;
  rewards: CardRewardReveal[];
}

export interface AppliedVictoryChests {
  collection: CardCollection;
  reveals: VictoryChestReveal[];
}

export type CollectionCardLevels = PlayerCardLevelConfig;
export type RewardRng = () => number;

interface ChestDefinition {
  fragmentDrops: number;
  minimumCopies: number;
  maximumCopies: number;
  directUpgradeChance: number;
  guaranteesVaultCard: boolean;
}

const CHEST_DEFINITIONS: Record<ChestTier, ChestDefinition> = {
  cache: {
    fragmentDrops: 2,
    minimumCopies: 2,
    maximumCopies: 4,
    directUpgradeChance: 0.15,
    guaranteesVaultCard: false,
  },
  vault: {
    fragmentDrops: 3,
    minimumCopies: 3,
    maximumCopies: 6,
    directUpgradeChance: 0.35,
    guaranteesVaultCard: true,
  },
  core: {
    fragmentDrops: 4,
    minimumCopies: 5,
    maximumCopies: 9,
    directUpgradeChance: 1,
    guaranteesVaultCard: true,
  },
};

const MAX_RANDOM_VALUE = 1 - Number.EPSILON;
const STARTER_CARD_ID_SET = new Set<string>(STARTER_CARD_IDS);
const VAULT_CARD_ID_SET = new Set<string>(VAULT_CARD_IDS);

const isPlainRecord = (value: unknown): value is Record<string, unknown> => {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false;
  try {
    const prototype = Object.getPrototypeOf(value);
    return prototype === Object.prototype || prototype === null;
  } catch {
    return false;
  }
};

const cloneEntry = (entry: CardCollectionEntry): CardCollectionEntry => ({ ...entry });

const cloneCollection = (collection: CardCollection): CardCollection =>
  Object.fromEntries(
    ALL_COLLECTION_CARD_IDS.map((cardId) => [cardId, cloneEntry(collection[cardId])]),
  ) as CardCollection;

const getDefaultEntry = (cardId: CollectionCardId): CardCollectionEntry => ({
  level: STARTER_CARD_ID_SET.has(cardId) ? 1 : 0,
  copies: 0,
});

const normalizeMasteryLevel = (
  value: unknown,
  minimumLevel: 0 | 1,
): CardMasteryLevel => {
  if (!Number.isInteger(value) || (value as number) < minimumLevel || (value as number) > 5) {
    return minimumLevel;
  }
  return value as CardMasteryLevel;
};

const normalizeCopies = (value: unknown): number => {
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) return 0;
  return Math.min(Number.MAX_SAFE_INTEGER, Math.floor(value));
};

const addCopies = (entry: CardCollectionEntry, amount: number): CardCollectionEntry => {
  let level = entry.level;
  let copies = level === 5
    ? 0
    : Math.min(Number.MAX_SAFE_INTEGER, entry.copies + normalizeCopies(amount));

  while (level < 5) {
    const requirement = getCardCopyRequirement(level);
    if (requirement === null || copies < requirement) break;
    copies -= requirement;
    level = (level + 1) as CardMasteryLevel;
  }

  return { level, copies: level === 5 ? 0 : copies };
};

const normalizeEntry = (
  value: unknown,
  cardId: CollectionCardId,
): CardCollectionEntry => {
  const minimumLevel = STARTER_CARD_ID_SET.has(cardId) ? 1 : 0;
  if (!isPlainRecord(value)) return getDefaultEntry(cardId);
  try {
    const level = normalizeMasteryLevel(value.level, minimumLevel);
    return addCopies({ level, copies: 0 }, normalizeCopies(value.copies));
  } catch {
    return getDefaultEntry(cardId);
  }
};

const normalizeRandomValue = (value: unknown): number => {
  if (typeof value !== 'number' || Number.isNaN(value) || value === Number.NEGATIVE_INFINITY) {
    return 0;
  }
  if (value === Number.POSITIVE_INFINITY) return MAX_RANDOM_VALUE;
  return Math.max(0, Math.min(MAX_RANDOM_VALUE, value));
};

const createSafeRng = (rng: RewardRng): RewardRng => () => {
  try {
    return normalizeRandomValue(typeof rng === 'function' ? rng() : 0);
  } catch {
    return 0;
  }
};

const randomInteger = (minimum: number, maximum: number, rng: RewardRng): number =>
  minimum + Math.floor(rng() * (maximum - minimum + 1));

const getChestCount = (roll: number): 1 | 2 | 3 => {
  if (roll < 0.68) return 1;
  if (roll < 0.94) return 2;
  return 3;
};

const getChestTier = (roll: number): ChestTier => {
  if (roll < 0.68) return 'cache';
  if (roll < 0.95) return 'vault';
  return 'core';
};

const getFragmentWeight = (
  cardId: CollectionCardId,
  collection: CardCollection,
): number => {
  const entry = collection[cardId];
  if (entry.level === 5) return 0;
  if (!VAULT_CARD_ID_SET.has(cardId)) return 1;
  return entry.level === 0 ? 6 : 2;
};

const pickWeightedCard = (
  candidates: readonly CollectionCardId[],
  collection: CardCollection,
  rng: RewardRng,
): CollectionCardId => {
  const weights = candidates.map((cardId) => getFragmentWeight(cardId, collection));
  let totalWeight = weights.reduce((total, weight) => total + weight, 0);
  if (totalWeight <= 0) {
    totalWeight = candidates.length;
    weights.fill(1);
  }

  let cursor = rng() * totalWeight;
  for (let index = 0; index < candidates.length; index += 1) {
    cursor -= weights[index];
    if (cursor < 0) return candidates[index];
  }
  return candidates[candidates.length - 1];
};

const getEligibleDirectUpgradeIds = (collection: CardCollection): CollectionCardId[] =>
  ALL_COLLECTION_CARD_IDS.filter((cardId) => {
    const level = collection[cardId].level;
    return level >= 1 && level < 5;
  });

const applyDirectUpgrade = (
  entry: CardCollectionEntry,
): CardCollectionEntry => {
  if (entry.level < 1 || entry.level >= 5) return cloneEntry(entry);
  const level = (entry.level + 1) as CardMasteryLevel;
  return { level, copies: level === 5 ? 0 : entry.copies };
};

export function createDefaultCardCollection(): CardCollection {
  return Object.fromEntries(
    ALL_COLLECTION_CARD_IDS.map((cardId) => [cardId, getDefaultEntry(cardId)]),
  ) as CardCollection;
}

export function normalizeCardCollection(value: unknown): CardCollection {
  if (!isPlainRecord(value)) return createDefaultCardCollection();
  return Object.fromEntries(
    ALL_COLLECTION_CARD_IDS.map((cardId) => {
      try {
        return [
          cardId,
          normalizeEntry(Object.hasOwn(value, cardId) ? value[cardId] : undefined, cardId),
        ];
      } catch {
        return [cardId, getDefaultEntry(cardId)];
      }
    }),
  ) as CardCollection;
}

export function getCardCopyRequirement(level: CardMasteryLevel): number | null {
  return CARD_COPY_REQUIREMENTS[level];
}

export function getCardMasteryBonus(level: CardMasteryLevel): number {
  return CARD_MASTERY_BONUSES[level];
}

export function isCardUnlocked(
  collection: CardCollection,
  cardId: CollectionCardId,
): boolean {
  return (collection[cardId]?.level ?? 0) > 0;
}

export function getUnlockedCardIds(collection: CardCollection): CollectionCardId[] {
  return ALL_COLLECTION_CARD_IDS.filter((cardId) => isCardUnlocked(collection, cardId));
}

export function getCollectionCardLevels(collection: CardCollection): CollectionCardLevels {
  return Object.fromEntries(
    ALL_COLLECTION_CARD_IDS.flatMap((cardId) => {
      const level = collection[cardId].level;
      return level === 0 ? [] : [[cardId, level]];
    }),
  ) as CollectionCardLevels;
}

export function generateVictoryChests(
  collection: CardCollection,
  rng: RewardRng,
): VictoryChest[] {
  const nextRandom = createSafeRng(rng);
  const chestCount = getChestCount(nextRandom());
  const workingCollection = normalizeCardCollection(collection);
  const chests: VictoryChest[] = [];

  for (let chestIndex = 0; chestIndex < chestCount; chestIndex += 1) {
    const tier = getChestTier(nextRandom());
    const definition = CHEST_DEFINITIONS[tier];
    const fragments: CardFragmentDrop[] = [];
    const selected = new Set<CollectionCardId>();

    for (let dropIndex = 0; dropIndex < definition.fragmentDrops; dropIndex += 1) {
      const guaranteedVaultDrop = definition.guaranteesVaultCard && dropIndex === 0;
      const sourceIds: readonly CollectionCardId[] = guaranteedVaultDrop
        ? VAULT_CARD_IDS
        : ALL_COLLECTION_CARD_IDS;
      const candidates = sourceIds.filter((cardId) => !selected.has(cardId));
      const cardId = pickWeightedCard(candidates, workingCollection, nextRandom);
      const copies = randomInteger(
        definition.minimumCopies,
        definition.maximumCopies,
        nextRandom,
      );
      selected.add(cardId);
      fragments.push({ cardId, copies });
      workingCollection[cardId] = addCopies(workingCollection[cardId], copies);
    }

    const chest: VictoryChest = { tier, fragments };
    if (nextRandom() < definition.directUpgradeChance) {
      const eligibleIds = getEligibleDirectUpgradeIds(workingCollection);
      if (eligibleIds.length > 0) {
        const targetIndex = Math.floor(nextRandom() * eligibleIds.length);
        const cardId = eligibleIds[targetIndex];
        chest.directUpgrade = { cardId };
        workingCollection[cardId] = applyDirectUpgrade(workingCollection[cardId]);
      }
    }
    chests.push(chest);
  }

  return chests;
}

export function applyVictoryChests(
  collection: CardCollection,
  chests: readonly VictoryChest[],
): AppliedVictoryChests {
  const nextCollection = normalizeCardCollection(collection);
  const reveals: VictoryChestReveal[] = [];

  for (const chest of chests) {
    const rewards: CardRewardReveal[] = [];
    for (const fragment of chest.fragments) {
      if (!ALL_COLLECTION_CARD_IDS.includes(fragment.cardId)) continue;
      const before = cloneEntry(nextCollection[fragment.cardId]);
      const after = addCopies(before, fragment.copies);
      nextCollection[fragment.cardId] = after;
      rewards.push({
        kind: 'fragments',
        cardId: fragment.cardId,
        copiesAwarded: normalizeCopies(fragment.copies),
        before,
        after: cloneEntry(after),
        levelsGained: after.level - before.level,
        unlocked: before.level === 0 && after.level > 0,
      });
    }

    const upgradeCardId = chest.directUpgrade?.cardId;
    if (upgradeCardId && ALL_COLLECTION_CARD_IDS.includes(upgradeCardId)) {
      const before = cloneEntry(nextCollection[upgradeCardId]);
      const after = applyDirectUpgrade(before);
      if (after.level !== before.level) {
        nextCollection[upgradeCardId] = after;
        rewards.push({
          kind: 'direct-upgrade',
          cardId: upgradeCardId,
          copiesAwarded: 0,
          before,
          after: cloneEntry(after),
          levelsGained: 1,
          unlocked: false,
        });
      }
    }

    reveals.push({ tier: chest.tier, rewards });
  }

  return { collection: cloneCollection(nextCollection), reveals };
}
