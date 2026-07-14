import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  BATTLE_MUSIC_PLAYLIST,
  LOBBY_MUSIC_PLAYLIST,
  useGameAudio,
} from '../features/audio/useGameAudio';
import { GameBridge } from '../game/bridge/GameBridge';
import type {
  CardId,
  GameCommand,
  GameModeId,
  Lane,
  RobotCardId,
  TowerWeaponId,
  UpgradeStat,
} from '../game/core/types';
import type { PilotId } from '../game/core/pilots';
import { MusicPlayer } from '../features/audio/MusicPlayer';
import { GameOverlay } from '../features/hud/GameOverlay';
import { Hud } from '../features/hud/Hud';
import { useGameSnapshot } from '../features/hud/useGameSnapshot';
import { Lobby } from '../features/lobby/Lobby';
import { useMatchRewards } from '../features/progression/useMatchRewards';
import { TutorialCoach, type TutorialStep } from '../features/tutorial/TutorialCoach';
import {
  CARDS,
  cloneRobotUpgrades,
  DEFAULT_ENEMY_DECK,
  DEFAULT_PLAYER_DECK,
  DECK_SIZE,
  ROBOT_CARD_IDS,
} from '../game/core/content';
import {
  getCollectionCardLevels,
  isCardUnlocked,
} from '../game/core/collection';
import {
  getFirmwareBudgetForLevel,
  getPlayerLevel,
} from '../game/core/progression';
import { DECK_PRESETS, type DeckPresetId } from '../game/core/deckGuidance';
import { readStorageItem, writeStorageItem } from '../persistence/browserStorage';
import type { GameCanvasHandle } from './GameCanvas';
import { readLobbyLoadout, resetLobbyLoadout, saveLobbyLoadout } from '../persistence/loadoutStorage';
import {
  loadGameCanvasModule,
  prepareMatchAssets,
  type AssetLoadProgress,
} from './assetPreloader';
import { GameLoadingScreen } from './GameLoadingScreen';

const GameCanvas = lazy(() => loadGameCanvasModule().then((module) => ({ default: module.GameCanvas })));
const TUTORIAL_STORAGE_KEY = 'crash-roboto-tutorial-complete';
const POWER_DRAIN_PREVIEW_ENABLED = import.meta.env.DEV &&
  new URLSearchParams(window.location.search).get('preview') === 'power-drain';

interface ArenaLoadState {
  active: boolean;
  progress: number;
  label: string;
  error: string | null;
}

const IDLE_ARENA_LOAD: ArenaLoadState = {
  active: false,
  progress: 0,
  label: 'PREPARING DEPLOYMENT GRID',
  error: null,
};

function readSeed() {
  const value = new URLSearchParams(window.location.search).get('seed');
  const seed = Number(value);
  if (Number.isFinite(seed) && seed > 0) return seed;
  const generated = window.crypto.getRandomValues(new Uint32Array(1))[0];
  return generated || 0xc0ffee;
}

export function App() {
  const bridge = useMemo(() => new GameBridge(readSeed()), []);
  const snapshot = useGameSnapshot(bridge);
  const {
    sound,
    music,
    sfxMuted,
    sfxVolume,
    musicMuted,
    audioMuted,
    startMusicPlaylist,
    toggleSfxMute,
    toggleMusicMute,
    toggleAudioMute,
    changeMusicVolume,
    changeSfxVolume,
  } = useGameAudio(bridge, snapshot.phase);
  const gameCanvasRef = useRef<GameCanvasHandle>(null);
  const dragOriginRef = useRef<{ cardId: CardId; x: number; y: number } | null>(null);
  const labTriggerRef = useRef<HTMLButtonElement | null>(null);
  const [inspectedRobot, setInspectedRobot] = useState<RobotCardId | null>(null);
  const [arenaLoad, setArenaLoad] = useState<ArenaLoadState>(IDLE_ARENA_LOAD);
  const {
    playerProgress,
    cardCollection,
    lastProgressAward,
    lastCacheReward,
    collectedCacheCount,
    collectCache,
    collectAllCaches,
    clearMatchRewards,
  } = useMatchRewards(snapshot);
  const [tutorialStep, setTutorialStep] = useState<TutorialStep | null>(null);
  const [tutorialCompleted, setTutorialCompleted] = useState(() => readStorageItem(TUTORIAL_STORAGE_KEY) === 'true');
  const [lobbyLoadout, setLobbyLoadout] = useState(readLobbyLoadout);
  const tutorialFirmwareBaselineRef = useRef(0);
  const snapshotRef = useRef(snapshot);
  const firmwareSpent = useMemo(
    () => ROBOT_CARD_IDS.reduce((total, robotId) => {
      const upgrades = lobbyLoadout.upgrades[robotId];
      return total + upgrades.output + upgrades.range + upgrades.speed;
    }, 0),
    [lobbyLoadout.upgrades],
  );
  const playerLevel = getPlayerLevel(playerProgress.xp);
  const firmwareBudget = getFirmwareBudgetForLevel(playerLevel);
  const firmwareRemaining = Math.max(0, firmwareBudget - firmwareSpent);

  snapshotRef.current = snapshot;

  const dispatch = useCallback((command: GameCommand) => bridge.dispatch(command), [bridge]);
  const select = useCallback((cardId: CardId) => {
    dispatch({ type: 'select', cardId: snapshot.selected === cardId ? null : cardId });
  }, [dispatch, snapshot.selected]);

  const selectMode = useCallback((modeId: GameModeId) => {
    sound.playInterfaceSound('modeSelect');
    setLobbyLoadout((current) => ({ ...current, modeId }));
  }, [sound]);

  const selectPilot = useCallback((pilotId: PilotId) => {
    sound.playInterfaceSound('pilotSelect');
    setLobbyLoadout((current) => ({ ...current, pilotId }));
  }, [sound]);

  const selectTowerWeapon = useCallback((lane: Lane, weaponId: TowerWeaponId) => {
    sound.playInterfaceSound('towerWeaponSelect');
    setLobbyLoadout((current) => ({
      ...current,
      towerWeapons: { ...current.towerWeapons, [lane]: weaponId },
    }));
  }, [sound]);

  const toggleLobbyCard = useCallback((cardId: CardId) => {
    if (!isCardUnlocked(cardCollection, cardId)) return;
    sound.playInterfaceSound(lobbyLoadout.deck.includes(cardId) ? 'cardRemove' : 'cardAdd');
    sound.playCardSelected(cardId);
    setLobbyLoadout((current) => {
      if (current.deck.includes(cardId)) {
        const upgrades = cloneRobotUpgrades(current.upgrades);
        if (CARDS[cardId].category === 'unit' || CARDS[cardId].category === 'commander') {
          upgrades[cardId as RobotCardId] = { output: 0, range: 0, speed: 0 };
        }
        return { ...current, deck: current.deck.filter((item) => item !== cardId), upgrades };
      }
      if (current.deck.length >= DECK_SIZE) return current;
      return { ...current, deck: [...current.deck, cardId] };
    });
  }, [cardCollection, lobbyLoadout.deck, sound]);

  const removeLobbyCard = useCallback((cardId: CardId) => {
    sound.playInterfaceSound('cardRemove');
    sound.playCardSelected(cardId);
    setLobbyLoadout((current) => {
      const upgrades = cloneRobotUpgrades(current.upgrades);
      if (CARDS[cardId].category === 'unit' || CARDS[cardId].category === 'commander') {
        upgrades[cardId as RobotCardId] = { output: 0, range: 0, speed: 0 };
      }
      return {
        ...current,
        deck: current.deck.filter((item) => item !== cardId),
        upgrades,
      };
    });
  }, [sound]);

  const applyDeckPreset = useCallback((presetId: DeckPresetId) => {
    sound.playInterfaceSound('loadoutPreset');
    setLobbyLoadout((current) => {
      const deck = DECK_PRESETS[presetId].deck.filter((cardId) => isCardUnlocked(cardCollection, cardId));
      if (deck.length !== DECK_SIZE) return current;
      const upgrades = cloneRobotUpgrades(current.upgrades);
      for (const robotId of ROBOT_CARD_IDS) {
        if (!deck.includes(robotId)) upgrades[robotId] = { output: 0, range: 0, speed: 0 };
      }
      return { ...current, deck, upgrades };
    });
  }, [cardCollection, sound]);

  const adjustLobbyUpgrade = useCallback((robotId: RobotCardId, stat: UpgradeStat, change: -1 | 1) => {
    const currentTier = lobbyLoadout.upgrades[robotId][stat];
    if (
      !lobbyLoadout.deck.includes(robotId) ||
      (change > 0 && (currentTier >= 2 || firmwareRemaining <= 0)) ||
      (change < 0 && currentTier <= 0)
    ) return;
    sound.playInterfaceSound(
      change < 0 ? 'upgradeRemove' : currentTier === 0 ? 'upgradeOne' : 'upgradeTwo',
    );
    setLobbyLoadout((current) => {
      if (!current.deck.includes(robotId)) return current;
      const currentTier = current.upgrades[robotId][stat];
      const spent = ROBOT_CARD_IDS.reduce((total, id) => {
        const state = current.upgrades[id];
        return total + state.output + state.range + state.speed;
      }, 0);
      if ((change > 0 && (currentTier >= 2 || spent >= firmwareBudget)) || (change < 0 && currentTier <= 0)) {
        return current;
      }
      const upgrades = cloneRobotUpgrades(current.upgrades);
      upgrades[robotId][stat] = (currentTier + change) as 0 | 1 | 2;
      return { ...current, upgrades };
    });
  }, [firmwareBudget, firmwareRemaining, lobbyLoadout.deck, lobbyLoadout.upgrades, sound]);

  const resetLoadout = useCallback(() => {
    sound.playInterfaceSound('loadoutPreset');
    setLobbyLoadout(resetLobbyLoadout());
  }, [sound]);

  const prepareArena = useCallback((onProgress?: (progress: AssetLoadProgress) => void) => (
    prepareMatchAssets({
      player: lobbyLoadout.deck,
      enemy: [...DEFAULT_ENEMY_DECK],
    }, playerLevel, onProgress)
  ), [lobbyLoadout.deck, playerLevel]);

  const launchMatch = useCallback(async () => {
    if (
      lobbyLoadout.deck.length !== DECK_SIZE ||
      lobbyLoadout.deck.some((cardId) => !isCardUnlocked(cardCollection, cardId))
    ) return;
    sound.playInterfaceSound('matchLaunch');
    setArenaLoad({ ...IDLE_ARENA_LOAD, active: true });
    try {
      // The player may have changed the saved deck after boot, so deployment
      // validates the current manifest before switching the bridge into battle.
      await prepareArena((progress) => {
        setArenaLoad({
          active: true,
          progress: progress.ratio,
          label: progress.label,
          error: null,
        });
      });
      saveLobbyLoadout(lobbyLoadout);
      clearMatchRewards();
      startMusicPlaylist(BATTLE_MUSIC_PLAYLIST);
      dispatch({
        type: 'start',
        config: {
          modeId: lobbyLoadout.modeId,
          playerDeck: [...lobbyLoadout.deck],
          playerUpgrades: lobbyLoadout.upgrades,
          playerCardLevels: getCollectionCardLevels(cardCollection),
          playerTowerWeapons: lobbyLoadout.towerWeapons,
          playerFirmwareBudget: firmwareBudget,
        },
      });
      if (tutorialStep === 'launch') setTutorialStep('select');
    } catch (reason) {
      setArenaLoad({
        active: true,
        progress: 0,
        label: 'DEPLOYMENT LINK INTERRUPTED',
        error: reason instanceof Error ? reason.message : 'The combat assets could not be prepared.',
      });
    }
  }, [cardCollection, clearMatchRewards, dispatch, firmwareBudget, lobbyLoadout, prepareArena, sound, startMusicPlaylist, tutorialStep]);

  const retryArenaLoad = useCallback(() => {
    void launchMatch();
  }, [launchMatch]);

  const handleArenaReady = useCallback(() => {
    setArenaLoad(IDLE_ARENA_LOAD);
  }, []);

  const startTutorial = useCallback(() => {
    tutorialFirmwareBaselineRef.current = firmwareSpent;
    setTutorialStep(firmwareSpent >= firmwareBudget ? 'launch' : 'firmware');
  }, [firmwareBudget, firmwareSpent]);

  const stopTutorial = useCallback(() => setTutorialStep(null), []);
  const finishTutorial = useCallback(() => {
    writeStorageItem(TUTORIAL_STORAGE_KEY, 'true');
    setTutorialCompleted(true);
    setTutorialStep(null);
  }, []);

  const returnToLobby = useCallback(() => {
    dragOriginRef.current = null;
    setInspectedRobot(null);
    collectAllCaches();
    clearMatchRewards();
    setArenaLoad(IDLE_ARENA_LOAD);
    startMusicPlaylist(LOBBY_MUSIC_PLAYLIST);
    dispatch({ type: 'returnToLobby' });
  }, [clearMatchRewards, collectAllCaches, dispatch, startMusicPlaylist]);

  const restartMatch = useCallback(() => {
    dragOriginRef.current = null;
    setInspectedRobot(null);
    collectAllCaches();
    clearMatchRewards();
    startMusicPlaylist(BATTLE_MUSIC_PLAYLIST);
    dispatch({ type: 'restart' });
  }, [clearMatchRewards, collectAllCaches, dispatch, startMusicPlaylist]);

  const nextRound = useCallback(() => {
    dragOriginRef.current = null;
    setInspectedRobot(null);
    dispatch({ type: 'nextRound' });
  }, [dispatch]);

  const previewPowerDrain = useCallback(() => {
    bridge.debugDamageTower('enemy-left', 900);
    bridge.debugDamageTower('player-left', 450);
    bridge.debugExpireTimer();
  }, [bridge]);

  const togglePause = useCallback(() => {
    dragOriginRef.current = null;
    setInspectedRobot(null);
    sound.playInterfaceSound(snapshotRef.current.phase === 'paused' ? 'resume' : 'pause');
    dispatch({ type: 'togglePause' });
  }, [dispatch, sound]);

  const inspectRobot = useCallback((robotId: RobotCardId, trigger: HTMLButtonElement) => {
    dragOriginRef.current = null;
    labTriggerRef.current = trigger;
    sound.playInterfaceSound('panelOpen');
    setInspectedRobot(robotId);
  }, [sound]);

  const closeRobotStats = useCallback(() => {
    sound.playInterfaceSound('panelClose');
    setInspectedRobot(null);
    window.requestAnimationFrame(() => labTriggerRef.current?.focus({ preventScroll: true }));
  }, [sound]);

  const playDraggedCard = useCallback((cardId: CardId, clientX: number, clientY: number) => {
    const point = gameCanvasRef.current?.clientToWorld(clientX, clientY);
    if (!point) return;
    dispatch({
      type: 'playCard',
      team: 'player',
      cardId,
      x: point.x,
      y: point.y,
    });
  }, [dispatch]);

  const finishDrag = useCallback((clientX: number, clientY: number) => {
    const drag = dragOriginRef.current;
    dragOriginRef.current = null;
    if (!drag || Math.hypot(clientX - drag.x, clientY - drag.y) <= 10) return;
    playDraggedCard(drag.cardId, clientX, clientY);
  }, [playDraggedCard]);

  useEffect(() => saveLobbyLoadout(lobbyLoadout), [lobbyLoadout]);
  useEffect(() => {
    setLobbyLoadout((current) => {
      const unlockedDeck = current.deck.filter((cardId) => isCardUnlocked(cardCollection, cardId));
      if (unlockedDeck.length === current.deck.length) return current;
      for (const cardId of DEFAULT_PLAYER_DECK) {
        if (unlockedDeck.length >= DECK_SIZE) break;
        if (!unlockedDeck.includes(cardId) && isCardUnlocked(cardCollection, cardId)) unlockedDeck.push(cardId);
      }
      const upgrades = cloneRobotUpgrades(current.upgrades);
      for (const robotId of ROBOT_CARD_IDS) {
        if (!unlockedDeck.includes(robotId)) upgrades[robotId] = { output: 0, range: 0, speed: 0 };
      }
      return { ...current, deck: unlockedDeck, upgrades };
    });
  }, [cardCollection]);
  useEffect(() => {
    if (tutorialStep === 'firmware' && firmwareSpent > tutorialFirmwareBaselineRef.current) {
      setTutorialStep('launch');
    } else if (tutorialStep === 'select' && snapshot.selected) {
      setTutorialStep('placement');
    } else if (
      tutorialStep === 'placement' &&
      (snapshot.units.some((unit) => unit.team === 'player') ||
        snapshot.installations.some((installation) => installation.team === 'player') ||
        snapshot.zones.some((zone) => zone.team === 'player'))
    ) {
      setTutorialStep('relay');
    } else if (tutorialStep === 'relay' && snapshot.score.player > 0) {
      setTutorialStep('complete');
    }
  }, [firmwareSpent, snapshot.installations, snapshot.score.player, snapshot.selected, snapshot.units, snapshot.zones, tutorialStep]);

  useEffect(() => {
    const onPointerUp = (event: PointerEvent) => finishDrag(event.clientX, event.clientY);
    const onPointerCancel = () => { dragOriginRef.current = null; };
    window.addEventListener('pointerup', onPointerUp);
    window.addEventListener('pointercancel', onPointerCancel);
    return () => {
      window.removeEventListener('pointerup', onPointerUp);
      window.removeEventListener('pointercancel', onPointerCancel);
    };
  }, [finishDrag]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.repeat) return;
      const currentSnapshot = snapshotRef.current;
      if (/^[1-4]$/.test(event.key) && currentSnapshot.phase === 'playing') {
        const cardId = currentSnapshot.hands.player[Number(event.key) - 1];
        if (cardId) {
          dispatch({ type: 'select', cardId: currentSnapshot.selected === cardId ? null : cardId });
        }
      } else if (
        event.key === 'Escape' &&
        (currentSnapshot.phase === 'playing' || currentSnapshot.phase === 'paused')
      ) {
        event.preventDefault();
        togglePause();
      } else if (
        event.key.toLowerCase() === 'p' &&
        (currentSnapshot.phase === 'playing' || currentSnapshot.phase === 'paused')
      ) {
        togglePause();
      } else if (event.key.toLowerCase() === 'm') {
        toggleAudioMute();
      } else if (event.key.toLowerCase() === 'r' && currentSnapshot.phase === 'ended') {
        restartMatch();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [dispatch, restartMatch, toggleAudioMute, togglePause]);

  useEffect(() => {
    if (!import.meta.env.DEV) return;
    window.__CRASH_ROBOTO__ = {
      snapshot: bridge.getSnapshot,
      dispatch: (command) => bridge.dispatch(command),
      advance: (ms) => bridge.advanceForTest(ms),
      damageTower: (id, amount) => bridge.debugDamageTower(id, amount),
      expireTimer: () => bridge.debugExpireTimer(),
    };
    return () => { delete window.__CRASH_ROBOTO__; };
  }, [bridge]);
  useEffect(() => () => bridge.dispose(), [bridge]);

  return (
    <main className="app-shell">
      <div className="ambient-grid" aria-hidden="true" />
      <div
        className={`game-frame${snapshot.phase === 'menu' ? ' is-lobby' : ' is-battle'}`}
        onContextMenu={(event) => event.preventDefault()}
      >
        {snapshot.phase === 'menu' ? (
          <Lobby
            selectedMode={lobbyLoadout.modeId}
            selectedDeck={lobbyLoadout.deck}
            selectedPilot={lobbyLoadout.pilotId}
            upgrades={lobbyLoadout.upgrades}
            towerWeapons={lobbyLoadout.towerWeapons}
            firmwareRemaining={firmwareRemaining}
            firmwareBudget={firmwareBudget}
            playerLevel={playerLevel}
            playerXp={playerProgress.xp}
            collection={cardCollection}
            onSelectMode={selectMode}
            onSelectPilot={selectPilot}
            onSelectTowerWeapon={selectTowerWeapon}
            onToggleCard={toggleLobbyCard}
            onRemoveCard={removeLobbyCard}
            onUpgradeRobot={(robotId, stat) => adjustLobbyUpgrade(robotId, stat, 1)}
            onDowngradeRobot={(robotId, stat) => adjustLobbyUpgrade(robotId, stat, -1)}
            onApplyDeckPreset={applyDeckPreset}
            onStartTutorial={startTutorial}
            tutorialCompleted={tutorialCompleted}
            onReset={resetLoadout}
            launchPreparing={arenaLoad.active}
            onPrepareLaunch={() => { void prepareArena(); }}
            onLaunch={() => { void launchMatch(); }}
          />
        ) : (
          <>
            <Suspense fallback={<div className="arena-loading" role="status">INITIALIZING GRID…</div>}>
              <GameCanvas
                ref={gameCanvasRef}
                bridge={bridge}
                playerLevel={playerLevel}
                onReady={handleArenaReady}
                onViewportChange={() => { dragOriginRef.current = null; }}
              />
            </Suspense>
            <Hud
              snapshot={snapshot}
              pilotId={lobbyLoadout.pilotId}
              onSelect={select}
              onBeginDrag={(cardId, x, y) => { dragOriginRef.current = { cardId, x, y }; }}
              onCancelDrag={() => { dragOriginRef.current = null; }}
              inspectedRobot={inspectedRobot}
              onInspectRobot={inspectRobot}
              onCloseRobotStats={closeRobotStats}
              onUpgradeRobot={(robotId: RobotCardId, stat: UpgradeStat) => dispatch({ type: 'upgradeRobot', team: 'player', robotId, stat })}
              onActivateOverdrive={() => dispatch({ type: 'activateOverdrive', team: 'player' })}
              onTogglePause={togglePause}
              blocked={snapshot.phase !== 'playing'}
            />
            <GameOverlay
              snapshot={snapshot}
              pilotId={lobbyLoadout.pilotId}
              onRestart={restartMatch}
              onResume={togglePause}
              onNextRound={nextRound}
              onReturnToLobby={returnToLobby}
              progressAward={lastProgressAward}
              cacheReward={lastCacheReward}
              collectedCacheCount={collectedCacheCount}
              onCollectCache={collectCache}
              onCollectAllCaches={collectAllCaches}
            />
          </>
        )}
        <MusicPlayer
          engine={music}
          bundledPlaylist={snapshot.phase === 'menu' ? LOBBY_MUSIC_PLAYLIST : BATTLE_MUSIC_PLAYLIST}
          audioMuted={audioMuted}
          musicMuted={musicMuted}
          sfxMuted={sfxMuted}
          sfxVolume={sfxVolume}
          onToggleAudioMute={toggleAudioMute}
          onToggleMusicMute={toggleMusicMute}
          onToggleSfxMute={toggleSfxMute}
          onVolumeChange={changeMusicVolume}
          onSfxVolumeChange={changeSfxVolume}
        />
        {arenaLoad.active && (
          <GameLoadingScreen
            mode="deployment"
            progress={arenaLoad.progress}
            label={arenaLoad.label}
            error={arenaLoad.error}
            onRetry={arenaLoad.error ? retryArenaLoad : undefined}
          />
        )}
        {POWER_DRAIN_PREVIEW_ENABLED && snapshot.phase === 'playing' && (
          <button
            className="power-drain-preview-button"
            type="button"
            onClick={previewPowerDrain}
            data-testid="power-drain-preview"
          >
            PREVIEW POWER DRAIN
          </button>
        )}
        {tutorialStep && (
          <TutorialCoach step={tutorialStep} onSkip={stopTutorial} onComplete={finishTutorial} />
        )}
      </div>

      <div className="rotate-gate" role="dialog" aria-label="Rotate to portrait">
        <div className="rotate-device" aria-hidden="true"><i /></div>
        <strong>ROTATE TO PORTRAIT</strong>
        <span>Mobile command is optimized for an upright battlefield.</span>
      </div>
    </main>
  );
}
