import {
  createDefaultCardCollection,
  normalizeCardCollection,
  type CardCollection,
} from '../game/core/collection';
import { readStorageItem, writeStorageItem } from './browserStorage';

export const CARD_COLLECTION_STORAGE_KEY = 'crash-roboto-card-collection-v1';

export function readCardCollection(): CardCollection {
  try {
    const stored = readStorageItem(CARD_COLLECTION_STORAGE_KEY);
    if (stored === null) return createDefaultCardCollection();
    return normalizeCardCollection(JSON.parse(stored));
  } catch {
    return createDefaultCardCollection();
  }
}

export function saveCardCollection(collection: CardCollection): boolean {
  try {
    return writeStorageItem(
      CARD_COLLECTION_STORAGE_KEY,
      JSON.stringify(normalizeCardCollection(collection)),
    );
  } catch {
    return false;
  }
}
