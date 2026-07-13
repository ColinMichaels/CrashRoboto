import { DEFAULT_ENEMY_DECK } from '../game/core/content';
import { getArenaAssetManifest } from '../game/phaser/arenaAssets';
import type { MatchSnapshot } from '../game/core/types';

export interface AssetLoadProgress {
  completed: number;
  total: number;
  ratio: number;
  label: string;
}

interface InitialAssetPlan {
  decodedImages: readonly string[];
  warmedFiles: readonly string[];
}

type ProgressListener = (progress: AssetLoadProgress) => void;

const LOBBY_IMAGE_PATHS = [
  'assets/game/arena-board-long.webp',
  'assets/game/relay-weapon-sprites.webp',
  'assets/game/robot-sprites.webp',
  'assets/game/system-sprites.webp',
  'assets/game/vault-sprites.webp',
  'assets/audio/music/crash-roboto-cover.jpg',
] as const;

const DEFERRED_ASSET_PATHS = [
  'assets/game/arena-board-sewer.webp',
  'assets/game/arena-board-volcanic.webp',
  'assets/game/arena-board-orbital.webp',
  'assets/game/arena-board-alien.webp',
  'assets/game/vault-unit-sprites.webp',
  'assets/game/bonus-cache-open.webp',
  'assets/audio/music/crash-roboto.mp3',
] as const;

// Decoded lobby images and byte-warmed match files share the browser cache but
// have different readiness guarantees, so their in-flight work is tracked separately.
const filePromises = new Map<string, Promise<void>>();
const imagePromises = new Map<string, Promise<void>>();
let gameCanvasPromise: Promise<typeof import('./GameCanvas')> | null = null;
let deferredWarmupScheduled = false;

function unique(paths: readonly string[]): string[] {
  return [...new Set(paths)];
}

function toAssetUrl(path: string): string {
  return `${import.meta.env.BASE_URL}${path}`;
}

function describeAsset(path: string): string {
  if (path.includes('arena-board')) return 'CALIBRATING ARENA GEOMETRY';
  if (path.endsWith('.mp3')) return 'BUFFERING AUDIO LINK';
  if (path.includes('sprites')) return 'DECODING COMBAT SPRITES';
  return 'SYNCING ASSET CACHE';
}

function notifyProgress(
  listener: ProgressListener | undefined,
  completed: number,
  total: number,
  label: string,
): void {
  listener?.({ completed, total, ratio: total === 0 ? 1 : completed / total, label });
}

function decodeImage(path: string): Promise<void> {
  const url = toAssetUrl(path);
  const existing = imagePromises.get(url);
  if (existing) return existing;

  const promise = new Promise<void>((resolve, reject) => {
    const image = new Image();
    image.decoding = 'async';
    image.onload = () => {
      if (typeof image.decode !== 'function') {
        resolve();
        return;
      }
      void image.decode().then(resolve, resolve);
    };
    image.onerror = () => reject(new Error(`Could not decode ${path}`));
    image.src = url;
  }).catch((error) => {
    imagePromises.delete(url);
    throw error;
  });

  imagePromises.set(url, promise);
  return promise;
}

function warmFile(path: string): Promise<void> {
  const url = toAssetUrl(path);
  if (imagePromises.has(url)) return imagePromises.get(url)!;
  const existing = filePromises.get(url);
  if (existing) return existing;

  const promise = fetch(url, { cache: 'force-cache' })
    .then(async (response) => {
      if (!response.ok) throw new Error(`Could not load ${path} (${response.status})`);
      await response.arrayBuffer();
    })
    .catch((error) => {
      filePromises.delete(url);
      throw error;
    });

  filePromises.set(url, promise);
  return promise;
}

async function runTasks(
  tasks: ReadonlyArray<{ label: string; run: () => Promise<unknown> }>,
  onProgress?: ProgressListener,
): Promise<void> {
  let completed = 0;
  notifyProgress(onProgress, 0, tasks.length, 'ESTABLISHING COMMAND LINK');
  await Promise.all(tasks.map(async (task) => {
    await task.run();
    completed += 1;
    notifyProgress(onProgress, completed, tasks.length, task.label);
  }));
}

export function getInitialAssetPlan(
  decks: MatchSnapshot['decks'],
  playerLevel: number,
): InitialAssetPlan {
  const decodedImages = unique(LOBBY_IMAGE_PATHS);
  const decodedSet = new Set(decodedImages);
  // The initial gate loads only the saved match's arena manifest. Other boards
  // warm after the lobby becomes interactive instead of delaying first paint.
  const arenaPaths = getArenaAssetManifest(decks, playerLevel).map((asset) => asset.path);
  return {
    decodedImages,
    warmedFiles: unique([
      ...arenaPaths.filter((path) => !decodedSet.has(path)),
      'assets/audio/music/crash-roboto-lobby-entrance.mp3',
    ]),
  };
}

export function loadGameCanvasModule(): Promise<typeof import('./GameCanvas')> {
  gameCanvasPromise ??= import('./GameCanvas').catch((error) => {
    gameCanvasPromise = null;
    throw error;
  });
  return gameCanvasPromise;
}

export async function prepareInitialGameAssets(
  playerDeck: MatchSnapshot['decks']['player'],
  playerLevel: number,
  loadAppModule: () => Promise<unknown>,
  onProgress?: ProgressListener,
): Promise<void> {
  const plan = getInitialAssetPlan({
    player: playerDeck,
    enemy: [...DEFAULT_ENEMY_DECK],
  }, playerLevel);
  const tasks = [
    { label: 'LOADING COMMAND INTERFACE', run: loadAppModule },
    { label: 'PRIMING COMBAT RUNTIME', run: loadGameCanvasModule },
    ...plan.decodedImages.map((path) => ({ label: describeAsset(path), run: () => decodeImage(path) })),
    ...plan.warmedFiles.map((path) => ({ label: describeAsset(path), run: () => warmFile(path) })),
  ];
  await runTasks(tasks, onProgress);
}

export async function prepareMatchAssets(
  decks: MatchSnapshot['decks'],
  playerLevel: number,
  onProgress?: ProgressListener,
): Promise<void> {
  const paths = unique(getArenaAssetManifest(decks, playerLevel).map((asset) => asset.path));
  await runTasks([
    { label: 'PRIMING COMBAT RUNTIME', run: loadGameCanvasModule },
    ...paths.map((path) => ({ label: describeAsset(path), run: () => warmFile(path) })),
  ], onProgress);
}

export function scheduleDeferredAssetWarmup(): void {
  if (deferredWarmupScheduled) return;
  deferredWarmupScheduled = true;
  // Idle warmup makes progression previews and later deck changes instant while
  // preserving the shortest possible critical startup path.
  const warm = () => {
    void Promise.all(DEFERRED_ASSET_PATHS.map((path) => (
      path.endsWith('.webp') ? decodeImage(path) : warmFile(path)
    ))).catch(() => {
      deferredWarmupScheduled = false;
    });
  };

  if ('requestIdleCallback' in window) {
    window.requestIdleCallback(warm, { timeout: 4_000 });
  } else {
    setTimeout(warm, 0);
  }
}
