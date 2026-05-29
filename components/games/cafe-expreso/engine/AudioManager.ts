// ─── AUDIO MANAGER — Singleton Web Audio ───

type SfxId = 'deposit' | 'brew_done' | 'serve' | 'fail' | 'refill_done' | 'tick' | 'game_over';

interface SfxDef {
  freq: number;
  type: OscillatorType;
  duration: number;
  ramp?: [number, number]; // [startFreq, endFreq]
}

const SFX: Record<SfxId, SfxDef> = {
  deposit:     { freq: 440, type: 'sine', duration: 0.08 },
  brew_done:   { freq: 660, type: 'sine', duration: 0.15, ramp: [520, 880] },
  serve:       { freq: 880, type: 'sine', duration: 0.2 },
  fail:        { freq: 150, type: 'sawtooth', duration: 0.25 },
  refill_done: { freq: 520, type: 'sine', duration: 0.12 },
  tick:        { freq: 220, type: 'sine', duration: 0.05 },
  game_over:   { freq: 100, type: 'sawtooth', duration: 0.6 },
};

export class AudioManager {
  private static instance: AudioManager;
  private ctx: AudioContext | null = null;
  private unlocked = false;

  static getInstance(): AudioManager {
    if (!AudioManager.instance) AudioManager.instance = new AudioManager();
    return AudioManager.instance;
  }

  unlock(): void {
    if (this.unlocked) return;
    try {
      this.ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      this.unlocked = true;
    } catch { /* silent fail */ }
  }

  play(id: SfxId, volume = 0.12): void {
    if (!this.ctx || !this.unlocked) return;
    const def = SFX[id];
    if (!def) return;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = def.type;
    osc.connect(gain);
    gain.connect(this.ctx.destination);

    if (def.ramp) {
      osc.frequency.setValueAtTime(def.ramp[0], this.ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(def.ramp[1], this.ctx.currentTime + def.duration);
    } else {
      osc.frequency.setValueAtTime(def.freq, this.ctx.currentTime);
    }

    gain.gain.setValueAtTime(volume, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + def.duration);

    osc.start();
    osc.stop(this.ctx.currentTime + def.duration);
  }
}
