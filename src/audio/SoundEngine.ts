import type { GameEvent } from '../game/core/types';

export class SoundEngine {
  private static readonly MAX_VOICES = 16;

  private context: AudioContext | null = null;
  private voices = new Map<OscillatorNode, GainNode>();
  private muted = false;

  setMuted(muted: boolean) {
    this.muted = muted;
  }

  playEvent(event: GameEvent) {
    if (this.muted) return;
    if (event.type === 'cardPlayed') this.tone(event.team === 'player' ? 320 : 220, 0.08, 'square', 0.035);
    if (event.type === 'programCast') this.tone(event.kind === 'emp' ? 680 : 430, 0.16, 'sawtooth', 0.035);
    if (event.type === 'installationPlaced') this.tone(180, 0.14, 'square', 0.035);
    if (event.type === 'overdriveActivated') this.tone(760, 0.24, 'triangle', 0.045);
    if (event.type === 'projectileFired') {
      const friendly = event.source.team === 'player';
      if (event.projectile === 'rocket') this.tone(friendly ? 190 : 145, 0.11, 'sawtooth', 0.016);
      else this.tone(friendly ? 760 : 540, 0.045, 'square', 0.01);
    }
    if (event.type === 'robotUpgraded') {
      this.tone(520 + event.tier * 55, 0.1, 'triangle', 0.03);
      this.tone(760 + event.tier * 70, 0.14, 'triangle', 0.025, 0.065);
    }
    if (event.type === 'towerDestroyed') this.tone(90, 0.28, 'sawtooth', 0.055);
    if (event.type === 'matchEnded') this.tone(event.result.winner === 'player' ? 520 : 130, 0.45, 'triangle', 0.05);
  }

  blip() {
    if (!this.muted) this.tone(420, 0.06, 'sine', 0.025);
  }

  unlock() {
    const context = this.getContext();
    if (context?.state === 'suspended') void context.resume().catch(() => undefined);
  }

  dispose() {
    for (const [oscillator, gain] of this.voices) {
      oscillator.onended = null;
      oscillator.stop();
      oscillator.disconnect();
      gain.disconnect();
    }
    this.voices.clear();

    const context = this.context;
    this.context = null;
    if (context && context.state !== 'closed') void context.close().catch(() => undefined);
  }

  private getContext(): AudioContext | null {
    const AudioCtor = window.AudioContext ?? (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtor) return null;
    this.context ??= new AudioCtor();
    return this.context;
  }

  private tone(frequency: number, duration: number, type: OscillatorType, volume: number, delay = 0) {
    if (this.voices.size >= SoundEngine.MAX_VOICES) return;
    const context = this.getContext();
    if (!context) return;
    if (context.state === 'suspended') void context.resume().catch(() => undefined);
    const now = context.currentTime + delay;
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(frequency, now);
    oscillator.frequency.exponentialRampToValueAtTime(Math.max(55, frequency * 0.76), now + duration);
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(volume, now + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
    const releaseVoice = () => {
      this.voices.delete(oscillator);
      oscillator.disconnect();
      gain.disconnect();
    };
    oscillator.onended = releaseVoice;
    this.voices.set(oscillator, gain);
    oscillator.connect(gain).connect(context.destination);
    oscillator.start(now);
    oscillator.stop(now + duration + 0.02);
  }
}
