// War Room soundscape: radar hum, radio clicks and a Geiger counter whose
// tick rate follows radiation. Starts muted; only plays after a tap.
import { hapticSelect } from "@/lib/telegram";

/** Geiger ticks per second for a radiation level 0..100. */
export function geigerRate(level: number): number {
  const l = Math.min(100, Math.max(0, level));
  return 0.5 + (l / 100) ** 1.6 * 11.5;
}

export class WarAudio {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private hum: OscillatorNode[] = [];
  private timers: number[] = [];
  private level = 0;

  start(level: number) {
    this.level = level;
    if (this.ctx) return;
    const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ctx = new Ctx();
    this.ctx = ctx;
    const master = ctx.createGain();
    master.gain.value = 0.5;
    master.connect(ctx.destination);
    this.master = master;

    // Radar hum: two detuned low sines through a slow tremolo.
    const humGain = ctx.createGain();
    humGain.gain.value = 0.03;
    humGain.connect(master);
    for (const f of [55, 55.7]) {
      const o = ctx.createOscillator();
      o.type = "sine";
      o.frequency.value = f;
      o.connect(humGain);
      o.start();
      this.hum.push(o);
    }
    const lfo = ctx.createOscillator();
    const lfoGain = ctx.createGain();
    lfo.frequency.value = 0.25;
    lfoGain.gain.value = 0.015;
    lfo.connect(lfoGain).connect(humGain.gain);
    lfo.start();
    this.hum.push(lfo);

    this.scheduleGeiger();
    this.scheduleRadio();
  }

  setLevel(level: number) {
    this.level = level;
  }

  private noiseBurst(duration: number, gain: number, freq: number) {
    const ctx = this.ctx;
    if (!ctx || !this.master) return;
    const len = Math.max(1, Math.floor(ctx.sampleRate * duration));
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const bp = ctx.createBiquadFilter();
    bp.type = "bandpass";
    bp.frequency.value = freq;
    const g = ctx.createGain();
    g.gain.value = gain;
    src.connect(bp).connect(g).connect(this.master);
    src.start();
  }

  private scheduleGeiger() {
    const rate = geigerRate(this.level);
    // Poisson-like spacing around the mean rate.
    const wait = (-Math.log(1 - Math.random()) / rate) * 1000;
    this.timers.push(
      window.setTimeout(() => {
        if (!this.ctx) return;
        this.noiseBurst(0.004, 0.5, 3500);
        if (this.level >= 75 && Math.random() < 0.15) hapticSelect();
        this.scheduleGeiger();
      }, wait),
    );
  }

  private scheduleRadio() {
    this.timers.push(
      window.setTimeout(() => {
        if (!this.ctx) return;
        this.noiseBurst(0.06, 0.12, 1200);
        window.setTimeout(() => this.noiseBurst(0.03, 0.08, 1800), 90);
        this.scheduleRadio();
      }, 4000 + Math.random() * 7000),
    );
  }

  stop() {
    for (const t of this.timers) clearTimeout(t);
    this.timers = [];
    for (const o of this.hum) {
      try {
        o.stop();
      } catch {
        /* already stopped */
      }
    }
    this.hum = [];
    void this.ctx?.close();
    this.ctx = null;
    this.master = null;
  }
}
