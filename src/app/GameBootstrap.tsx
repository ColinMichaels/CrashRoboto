import { lazy, Suspense, useCallback, useEffect, useState } from 'react';
import { getPlayerLevel } from '../game/core/progression';
import { readPlayerProgress } from '../persistence/playerProgressStorage';
import { readLobbyLoadout } from '../persistence/loadoutStorage';
import {
  prepareInitialGameAssets,
  scheduleDeferredAssetWarmup,
  type AssetLoadProgress,
} from './assetPreloader';
import { GameLoadingScreen } from './GameLoadingScreen';

let appModulePromise: Promise<typeof import('./App')> | null = null;
// Keep the loading shell in the entry bundle and fetch the full application
// behind it. The rejected-promise reset allows the visible retry control to work.
const loadAppModule = () => {
  appModulePromise ??= import('./App').catch((error) => {
    appModulePromise = null;
    throw error;
  });
  return appModulePromise;
};
const App = lazy(() => loadAppModule().then((module) => ({ default: module.App })));

const INITIAL_PROGRESS: AssetLoadProgress = {
  completed: 0,
  total: 1,
  ratio: 0,
  label: 'ESTABLISHING COMMAND LINK',
};

export function GameBootstrap() {
  const [attempt, setAttempt] = useState(0);
  const [ready, setReady] = useState(false);
  const [progress, setProgress] = useState(INITIAL_PROGRESS);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    setError(null);
    setProgress(INITIAL_PROGRESS);
    const loadout = readLobbyLoadout();
    const playerLevel = getPlayerLevel(readPlayerProgress().xp);
    void prepareInitialGameAssets(loadout.deck, playerLevel, loadAppModule, (nextProgress) => {
      if (active) setProgress(nextProgress);
    }).then(() => {
      if (!active) return;
      setReady(true);
      scheduleDeferredAssetWarmup();
    }).catch((reason: unknown) => {
      if (!active) return;
      setError(reason instanceof Error ? reason.message : 'The asset cache could not be prepared.');
    });
    return () => { active = false; };
  }, [attempt]);

  const retry = useCallback(() => {
    setReady(false);
    setAttempt((current) => current + 1);
  }, []);

  if (!ready) {
    return (
      <GameLoadingScreen
        progress={progress.ratio}
        label={progress.label}
        error={error}
        onRetry={retry}
      />
    );
  }

  return (
    <Suspense fallback={<GameLoadingScreen progress={1} label="OPENING COMMAND INTERFACE" />}>
      <App />
    </Suspense>
  );
}
