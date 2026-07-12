export type TutorialStep = 'firmware' | 'launch' | 'select' | 'placement' | 'relay' | 'complete';

const TUTORIAL_COPY: Record<TutorialStep, { label: string; title: string; detail: string }> = {
  firmware: {
    label: '1 / 5 · FIRMWARE',
    title: 'OPEN A ROBOT LAB',
    detail: 'Choose any LAB button and install one Output, Range, or Speed tier.',
  },
  launch: {
    label: '2 / 5 · LOADOUT',
    title: 'DEPLOY YOUR LOADOUT',
    detail: 'Your Firmware is installed. Launch the selected protocol when ready.',
  },
  select: {
    label: '3 / 5 · COMMAND',
    title: 'SELECT A CARD',
    detail: 'Choose one of the four active command cards along the bottom rail.',
  },
  placement: {
    label: '4 / 5 · DEPLOYMENT',
    title: 'PLACE ON YOUR SIDE',
    detail: 'Use the cyan placement zone and the cursor message to make a valid deployment.',
  },
  relay: {
    label: '5 / 5 · TERRITORY',
    title: 'BREACH AN ENEMY RELAY',
    detail: 'Destroy either rear Relay. Its lane will unlock for deployment on the enemy side.',
  },
  complete: {
    label: 'TRAINING COMPLETE',
    title: 'COMMAND LINK READY',
    detail: 'You installed Firmware, deployed a card, and opened an enemy territory lane.',
  },
};

interface TutorialCoachProps {
  step: TutorialStep;
  onSkip: () => void;
  onComplete: () => void;
}

export function TutorialCoach({ step, onSkip, onComplete }: TutorialCoachProps) {
  const copy = TUTORIAL_COPY[step];
  return (
    <aside className={`tutorial-coach tutorial-${step}`} aria-live="polite" aria-label="Interactive training objective">
      <span>{copy.label}</span>
      <strong>{copy.title}</strong>
      <p>{copy.detail}</p>
      {step === 'complete' ? (
        <button type="button" onClick={onComplete}>FINISH TRAINING</button>
      ) : (
        <button type="button" onClick={onSkip}>SKIP TRAINING</button>
      )}
    </aside>
  );
}
