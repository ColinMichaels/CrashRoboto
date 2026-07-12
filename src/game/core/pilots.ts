export type PilotId = 'nova-7' | 'axiom-3' | 'vesper-6' | 'rift-11';

export type PilotMark = 'diamond' | 'crosshair' | 'orbit' | 'split';

export interface PilotDefinition {
  id: PilotId;
  name: string;
  specialty: string;
  accent: string;
  mark: PilotMark;
}

export const PILOT_IDS: readonly PilotId[] = [
  'nova-7',
  'axiom-3',
  'vesper-6',
  'rift-11',
] as const;

export const DEFAULT_PILOT_ID: PilotId = 'nova-7';

export const PILOTS: Record<PilotId, PilotDefinition> = {
  'nova-7': {
    id: 'nova-7',
    name: 'NOVA-7',
    specialty: 'GRID TACTICIAN',
    accent: '#28e7d2',
    mark: 'diamond',
  },
  'axiom-3': {
    id: 'axiom-3',
    name: 'AXIOM-3',
    specialty: 'SIEGE SPECIALIST',
    accent: '#f6c453',
    mark: 'crosshair',
  },
  'vesper-6': {
    id: 'vesper-6',
    name: 'VESPER-6',
    specialty: 'SIGNAL RUNNER',
    accent: '#6da8ff',
    mark: 'orbit',
  },
  'rift-11': {
    id: 'rift-11',
    name: 'RIFT-11',
    specialty: 'SYSTEM SABOTEUR',
    accent: '#d683ff',
    mark: 'split',
  },
};

export function isPilotId(value: unknown): value is PilotId {
  return typeof value === 'string' && Object.hasOwn(PILOTS, value);
}
