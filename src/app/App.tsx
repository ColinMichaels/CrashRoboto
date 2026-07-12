import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { SoundEngine } from '../audio/SoundEngine';
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
import { GameOverlay } from '../features/hud/GameOverlay';
import { Hud } from '../features/hud/Hud';
import { useGameSnapshot } from '../features/hud/useGameSnapshot';
import { Lobby } from '../features/lobby/Lobby';
import { useMatchRewards } from '../features/progression/useMatchRewards';
import { TutorialCoach, type TutorialStep } from '../features/tutorial/TutorialCoach';
import {
  BOARD_HEIGHT,
  BOARD_WIDTH,
  CARDS,
  cloneRobotUpgrades,
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
import { readStorageItem, writeStorageItem } from './browserStorage';
import { readLobbyLoadout, resetLobbyLoadout, saveLobbyLoadout } from './loadoutStorage';

const loadGameCanvas = () => import('./GameCanvas');
const GameCanvas = lazy(() => loadGameCanvas().then((module) => ({ default: module.GameCanvas })));
const prepareArena = () => { void loadGameCanvas(); };
const MUTE_STORAGE_KEY = 'crash-roboto-muted';
const TUTORIAL_STORAGE_KEY = 'crash-roboto-tutorial-complete';

function readSeed() {
  const value = new URLSearchParams(window.location.search).get('seed');
  const seed = Number(value);
  if (Number.isFinite(seed) && seed > 0) return seed;
  const generated = window.crypto.getRandomValues(new Uint32Array(1))[0];
  return generated || 0xc0ffee;
}

export function App() {
  const bridge = useMemo(() => new GameBridge(readSeed()), []);
  const sound = useMemo(() => new SoundEngine(), []);
  const snapshot = useGameSnapshot(bridge);
  const frameRef = useRef<HTMLDivElement>(null);
  const dragOriginRef = useRef<{ cardId: CardId; x: number; y: number } | null>(null);
  const labTriggerRef = useRef<HTMLButtonElement | null>(null);
  const [muted, setMuted] = useState(() => readStorageItem(MUTE_STORAGE_KEY) === 'true');
  const [inspectedRobot, setInspectedRobot] = useState<RobotCardId | null>(null);
  const {
    playerProgress,
    cardCollection,
    lastProgressAward,
    lastCacheReward,
    clearMatchRewards,
  } = useMatchRewards(snapshot);
  const [tutorialStep, setTutorialStep] = useState<TutorialStep | null>(null);
  const [tutorialCompleted, setTutorialCompleted] = useState(() => readStorageItem(TUTORIAL_STORAGE_KEY) === 'true');
  const [lobbyLoadout, setLobbyLoadout] = useState(readLobbyLoadout);
  const tutorialFirmwareBaselineRef = useRef(0);
  const snapshotRef = useRef(snapshot);
  const inspectedRobotRef = useRef(inspectedRobot);
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
  inspectedRobotRef.current = inspectedRobot;

  const dispatch = useCallback((command: GameCommand) => bridge.dispatch(command), [bridge]);
  const select = useCallback((cardId: CardId) => {
    sound.blip();
    dispatch({ type: 'select', cardId: snapshot.selected === cardId ? null : cardId });
  }, [dispatch, snapshot.selected, sound]);

  const toggleMute = useCallback(() => {
    if (muted) sound.unlock();
    setMuted((current) => !current);
  }, [muted, sound]);

  const selectMode = useCallback((modeId: GameModeId) => {
    sound.blip();
    setLobbyLoadout((current) => ({ ...current, modeId }));
  }, [sound]);

  const selectPilot = useCallback((pilotId: PilotId) => {
    sound.blip();
    setLobbyLoadout((current) => ({ ...current, pilotId }));
  }, [sound]);

  const selectTowerWeapon = useCallback((lane: Lane, weaponId: TowerWeaponId) => {
    sound.blip();
    setLobbyLoadout((current) => ({
      ...current,
      towerWeapons: { ...current.towerWeapons, [lane]: weaponId },
    }));
  }, [sound]);

  const toggleLobbyCard = useCallback((cardId: CardId) => {
    if (!isCardUnlocked(cardCollection, cardId)) return;
    sound.blip();
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
  }, [cardCollection, sound]);

  const removeLobbyCard = useCallback((cardId: CardId) => {
    sound.blip();
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
    sound.blip();
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
    sound.blip();
  }, [firmwareBudget, sound]);

  const resetLoadout = useCallback(() => {
    sound.blip();
    setLobbyLoadout(resetLobbyLoadout());
  }, [sound]);

  const launchMatch = useCallback(() => {
    if (
      lobbyLoadout.deck.length !== DECK_SIZE ||
      lobbyLoadout.deck.some((cardId) => !isCardUnlocked(cardCollection, cardId))
    ) return;
    saveLobbyLoadout(lobbyLoadout);
    clearMatchRewards();
    sound.blip();
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
  }, [cardCollection, clearMatchRewards, dispatch, firmwareBudget, lobbyLoadout, sound, tutorialStep]);

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
    clearMatchRewards();
    dispatch({ type: 'returnToLobby' });
  }, [clearMatchRewards, dispatch]);

  const restartMatch = useCallback(() => {
    dragOriginRef.current = null;
    setInspectedRobot(null);
    clearMatchRewards();
    dispatch({ type: 'restart' });
  }, [clearMatchRewards, dispatch]);

  const togglePause = useCallback(() => {
    dragOriginRef.current = null;
    setInspectedRobot(null);
    dispatch({ type: 'togglePause' });
  }, [dispatch]);

  const inspectRobot = useCallback((robotId: RobotCardId, trigger: HTMLButtonElement) => {
    dragOriginRef.current = null;
    labTriggerRef.current = trigger;
    sound.blip();
    setInspectedRobot(robotId);
  }, [sound]);

  const closeRobotStats = useCallback(() => {
    setInspectedRobot(null);
    window.requestAnimationFrame(() => labTriggerRef.current?.focus({ preventScroll: true }));
  }, []);

  const playDraggedCard = useCallback((cardId: CardId, clientX: number, clientY: number) => {
    const bounds = frameRef.current
      ?.querySelector<HTMLElement>('.game-canvas')
      ?.getBoundingClientRect();
    if (!bounds) return;
    dispatch({
      type: 'playCard',
      team: 'player',
      cardId,
      x: ((clientX - bounds.left) / bounds.width) * BOARD_WIDTH,
      y: ((clientY - bounds.top) / bounds.height) * BOARD_HEIGHT,
    });
  }, [dispatch]);

  const finishDrag = useCallback((clientX: number, clientY: number) => {
    const drag = dragOriginRef.current;
    dragOriginRef.current = null;
    if (!drag || Math.hypot(clientX - drag.x, clientY - drag.y) <= 10) return;
    playDraggedCard(drag.cardId, clientX, clientY);
  }, [playDraggedCard]);

  useEffect(() => {
    sound.setMuted(muted);
    writeStorageItem(MUTE_STORAGE_KEY, String(muted));
  }, [muted, sound]);
  useEffect(() => bridge.subscribeToEvents((event) => sound.playEvent(event)), [bridge, sound]);
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
          sound.blip();
          dispatch({ type: 'select', cardId: currentSnapshot.selected === cardId ? null : cardId });
        }
      } else if (event.key === 'Escape') {
        if (inspectedRobotRef.current) closeRobotStats();
        else dispatch({ type: 'select', cardId: null });
      } else if (event.key.toLowerCase() === 'p' && currentSnapshot.phase !== 'menu' && currentSnapshot.phase !== 'ended') {
        togglePause();
      } else if (event.key.toLowerCase() === 'm') {
        toggleMute();
      } else if (event.key.toLowerCase() === 'r' && currentSnapshot.phase === 'ended') {
        restartMatch();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [closeRobotStats, dispatch, restartMatch, sound, toggleMute, togglePause]);

  useEffect(() => {
    if (!import.meta.env.DEV) return;
    window.__CRASH_ROBOTO__ = {
      snapshot: bridge.getSnapshot,
      dispatch: (command) => bridge.dispatch(command),
      advance: (ms) => bridge.advanceForTest(ms),
      damageTower: (id, amount) => bridge.debugDamageTower(id, amount),
    };
    return () => { delete window.__CRASH_ROBOTO__; };
  }, [bridge]);
  useEffect(() => () => {
    bridge.dispose();
    sound.dispose();
  }, [bridge, sound]);

  return (
    <main className="app-shell">
      <div className="ambient-grid" aria-hidden="true" />
      <div
        ref={frameRef}
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
            onPrepareLaunch={prepareArena}
            onLaunch={launchMatch}
            muted={muted}
            onToggleMute={toggleMute}
          />
        ) : (
          <>
            <Suspense fallback={<div className="arena-loading" role="status">INITIALIZING GRID…</div>}>
              <GameCanvas bridge={bridge} />
            </Suspense>
            <Hud
              snapshot={snapshot}
              pilotId={lobbyLoadout.pilotId}
              muted={muted}
              onSelect={select}
              onBeginDrag={(cardId, x, y) => { dragOriginRef.current = { cardId, x, y }; }}
              onCancelDrag={() => { dragOriginRef.current = null; }}
              inspectedRobot={inspectedRobot}
              onInspectRobot={inspectRobot}
              onCloseRobotStats={closeRobotStats}
              onUpgradeRobot={(robotId: RobotCardId, stat: UpgradeStat) => dispatch({ type: 'upgradeRobot', team: 'player', robotId, stat })}
              onActivateOverdrive={() => dispatch({ type: 'activateOverdrive', team: 'player' })}
              onTogglePause={togglePause}
              onToggleMute={toggleMute}
              blocked={snapshot.phase !== 'playing'}
            />
            <GameOverlay
              snapshot={snapshot}
              pilotId={lobbyLoadout.pilotId}
              onRestart={restartMatch}
              onResume={togglePause}
              onReturnToLobby={returnToLobby}
              progressAward={lastProgressAward}
              cacheReward={lastCacheReward}
            />
          </>
        )}
        {tutorialStep && (
          <TutorialCoach step={tutorialStep} onSkip={stopTutorial} onComplete={finishTutorial} />
        )}
      </div>

      <div className="rotate-gate" role="dialog" aria-label="Rotate device">
        <div className="rotate-device" aria-hidden="true"><i /></div>
        <strong>ROTATE TO BATTLE</strong>
        <span>Crash Roboto is tuned for landscape command.</span>
      </div>
    </main>
  );
}
