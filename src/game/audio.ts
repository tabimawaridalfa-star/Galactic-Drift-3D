import type { MusicMode } from './rules';

/**
 * 100% Procedural Web Audio API Synthesizer for Galactic Drift 3D.
 * Produces adaptive procedural background music (ambient exploration space pad & arpeggio,
 * tense Boss synthwave bass pulse, majestic victory chord), engine hum, turbo boost afterburner,
 * dual laser plasma shots, explosions, planet scanning sonar pings, pickup chimes, hull impacts,
 * and victory/defeat stings without any external audio assets.
 */
export class SpaceAudioEngine {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private engineOsc1: OscillatorNode | null = null;
  private engineOsc2: OscillatorNode | null = null;
  private engineFilter: BiquadFilterNode | null = null;
  private engineGain: GainNode | null = null;

  private boostNoiseGain: GainNode | null = null;
  private boostFilter: BiquadFilterNode | null = null;
  private noiseBuffer: AudioBuffer | null = null;

  // Adaptive Procedural BGM buses & sequencer state
  private bgmBus: GainNode | null = null;
  private explorationBus: GainNode | null = null;
  private bossBus: GainNode | null = null;
  private victoryBus: GainNode | null = null;
  private padOscs: OscillatorNode[] = [];
  private padFilter: BiquadFilterNode | null = null;
  private musicMode: MusicMode = 'exploration';
  private bossIntensityPhase: 1 | 2 = 1;
  private bgmDucked = false;
  private bgmSchedulerId: number | null = null;
  private nextStepTime = 0;
  private stepIndex = 0;
  private explorationChordIdx = 0;

  private muted = false;
  private running = false;

  public isMuted(): boolean {
    return this.muted;
  }

  public init(): void {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') {
        this.ctx.resume().catch(() => {});
      }
      return;
    }

    const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return;

    const ctx = new AudioCtx();
    this.ctx = ctx;

    const master = ctx.createGain();
    master.gain.value = this.muted ? 0 : 0.42;
    master.connect(ctx.destination);
    this.masterGain = master;

    // Generate reusable 1.5s white noise buffer for explosions & boost roar
    const bufferLength = Math.floor(ctx.sampleRate * 1.5);
    const buffer = ctx.createBuffer(1, bufferLength, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferLength; i++) {
      data[i] = Math.random() * 2 - 1;
    }
    this.noiseBuffer = buffer;

    // Continuous starship engine hum
    const engineGain = ctx.createGain();
    engineGain.gain.value = 0.0;
    const engineFilter = ctx.createBiquadFilter();
    engineFilter.type = 'lowpass';
    engineFilter.frequency.value = 180;
    engineFilter.Q.value = 2.4;

    const osc1 = ctx.createOscillator();
    osc1.type = 'sawtooth';
    osc1.frequency.value = 54;

    const osc2 = ctx.createOscillator();
    osc2.type = 'triangle';
    osc2.frequency.value = 81.5;

    osc1.connect(engineFilter);
    osc2.connect(engineFilter);
    engineFilter.connect(engineGain);
    engineGain.connect(master);

    osc1.start();
    osc2.start();

    this.engineOsc1 = osc1;
    this.engineOsc2 = osc2;
    this.engineFilter = engineFilter;
    this.engineGain = engineGain;

    // Continuous filtered noise for Turbo Boost afterburner
    const boostSource = ctx.createBufferSource();
    boostSource.buffer = buffer;
    boostSource.loop = true;

    const boostFilter = ctx.createBiquadFilter();
    boostFilter.type = 'bandpass';
    boostFilter.frequency.value = 340;
    boostFilter.Q.value = 1.2;

    const boostGain = ctx.createGain();
    boostGain.gain.value = 0;

    boostSource.connect(boostFilter);
    boostFilter.connect(boostGain);
    boostGain.connect(master);
    boostSource.start();

    this.boostFilter = boostFilter;
    this.boostNoiseGain = boostGain;

    // Initialize Adaptive Procedural BGM synthesizer & crossfade buses
    this.initAdaptiveBgm(ctx, master);
    this.running = true;
  }

  private initAdaptiveBgm(ctx: AudioContext, master: GainNode): void {
    const bgmBus = ctx.createGain();
    bgmBus.gain.value = this.bgmDucked ? 0.17 : 0.34;
    bgmBus.connect(master);
    this.bgmBus = bgmBus;

    const explorationBus = ctx.createGain();
    explorationBus.gain.value = 0.0001;
    explorationBus.connect(bgmBus);
    this.explorationBus = explorationBus;

    const bossBus = ctx.createGain();
    bossBus.gain.value = 0.0001;
    bossBus.connect(bgmBus);
    this.bossBus = bossBus;

    const victoryBus = ctx.createGain();
    victoryBus.gain.value = 0.0001;
    victoryBus.connect(bgmBus);
    this.victoryBus = victoryBus;

    // Deep atmospheric space synth pad (warm detuned voices through breathing lowpass)
    const padFilter = ctx.createBiquadFilter();
    padFilter.type = 'lowpass';
    padFilter.frequency.value = 540;
    padFilter.Q.value = 1.6;
    padFilter.connect(explorationBus);
    this.padFilter = padFilter;

    // Slow LFO breathing modulation on pad filter cutoff
    const lfo = ctx.createOscillator();
    const lfoGain = ctx.createGain();
    lfo.type = 'sine';
    lfo.frequency.value = 0.09;
    lfoGain.gain.value = 210;
    lfo.connect(lfoGain);
    lfoGain.connect(padFilter.frequency);
    lfo.start();

    const initialChord = [110.0, 164.81, 220.0, 261.63]; // Deep Am7 voicing
    this.padOscs = initialChord.map((freq, idx) => {
      const osc = ctx.createOscillator();
      const vGain = ctx.createGain();
      osc.type = idx === 0 ? 'triangle' : 'sawtooth';
      osc.frequency.value = freq;
      osc.detune.value = (idx % 2 === 0 ? -1 : 1) * (4 + idx * 1.8);
      vGain.gain.value = idx === 0 ? 0.14 : 0.055;
      osc.connect(vGain);
      vGain.connect(padFilter);
      osc.start();
      return osc;
    });

    // Apply initial crossfade targets
    this.applyMusicCrossfade();

    // Start low-overhead lookahead step scheduler (16th notes at ~130 BPM = 0.115s)
    this.nextStepTime = ctx.currentTime + 0.08;
    this.stepIndex = 0;
    this.bgmSchedulerId = window.setInterval(() => this.scheduleBgmSteps(), 95);
  }

  private applyMusicCrossfade(): void {
    if (!this.ctx || !this.explorationBus || !this.bossBus || !this.victoryBus || !this.bgmBus) {
      return;
    }
    const now = this.ctx.currentTime;
    const tau = 0.65;

    const targetBgm = this.musicMode === 'off' ? 0.0001 : this.bgmDucked ? 0.16 : 0.36;
    this.bgmBus.gain.setTargetAtTime(targetBgm, now, 0.25);

    this.explorationBus.gain.setTargetAtTime(
      this.musicMode === 'exploration' ? 1.0 : 0.0001,
      now,
      tau
    );
    this.bossBus.gain.setTargetAtTime(this.musicMode === 'boss' ? 1.0 : 0.0001, now, tau);
    this.victoryBus.gain.setTargetAtTime(
      this.musicMode === 'victory' ? 1.0 : 0.0001,
      now,
      tau
    );
  }

  public setMusicMode(mode: MusicMode, bossPhase: 1 | 2 = 1): void {
    const changed = this.musicMode !== mode || this.bossIntensityPhase !== bossPhase;
    this.musicMode = mode;
    this.bossIntensityPhase = bossPhase;
    if (changed) {
      this.applyMusicCrossfade();
    }
  }

  public setBgmDucked(ducked: boolean): void {
    if (this.bgmDucked === ducked) return;
    this.bgmDucked = ducked;
    this.applyMusicCrossfade();
  }

  private scheduleBgmSteps(): void {
    if (!this.ctx || this.ctx.state !== 'running' || this.muted || this.musicMode === 'off') {
      if (this.ctx) {
        this.nextStepTime = this.ctx.currentTime + 0.08;
      }
      return;
    }

    const lookahead = 0.22;
    const stepDur = this.musicMode === 'boss' ? (this.bossIntensityPhase === 2 ? 0.105 : 0.114) : 0.145;

    // Prevent runaway backlog after tab switch
    if (this.nextStepTime < this.ctx.currentTime - 0.3) {
      this.nextStepTime = this.ctx.currentTime + 0.05;
    }

    while (this.nextStepTime < this.ctx.currentTime + lookahead) {
      const t = this.nextStepTime;
      const step = this.stepIndex;

      if (this.musicMode === 'exploration') {
        this.scheduleExplorationStep(step, t);
      } else if (this.musicMode === 'boss') {
        this.scheduleBossStep(step, t);
      } else if (this.musicMode === 'victory') {
        this.scheduleVictoryStep(step, t);
      }

      this.nextStepTime += stepDur;
      this.stepIndex = (this.stepIndex + 1) % 64;
    }
  }

  private scheduleExplorationStep(step: number, time: number): void {
    if (!this.ctx || !this.explorationBus) return;

    // Smoothly glide warm space synth pad chords every 16 steps (Am9 -> Fmaj7 -> Cmaj9 -> Em7)
    if (step % 16 === 0 && this.padOscs.length === 4) {
      const chords = [
        [110.0, 164.81, 220.0, 261.63], // Am7
        [87.31, 130.81, 174.61, 220.0], // Fmaj7
        [130.81, 196.0, 246.94, 293.66], // Cmaj9
        [98.0, 146.83, 196.0, 246.94], // G6
      ];
      this.explorationChordIdx = (step / 16) % chords.length;
      const chord = chords[this.explorationChordIdx];
      for (let i = 0; i < 4; i++) {
        this.padOscs[i].frequency.setTargetAtTime(chord[i], time, 0.45);
      }
    }

    // Soft crystalline ambient arpeggio every 2 steps
    if (step % 2 === 0) {
      const arpBanks = [
        [440.0, 523.25, 659.25, 783.99, 659.25, 523.25, 587.33, 493.88],
        [349.23, 440.0, 523.25, 659.25, 523.25, 440.0, 587.33, 523.25],
        [523.25, 659.25, 783.99, 987.77, 783.99, 659.25, 587.33, 493.88],
        [392.0, 493.88, 587.33, 783.99, 587.33, 493.88, 440.0, 392.0],
      ];
      const bank = arpBanks[this.explorationChordIdx % arpBanks.length];
      const noteIdx = (step / 2) % bank.length;
      // Leave gentle cosmic space on beat 7
      if (noteIdx !== 7) {
        const freq = bank[noteIdx];
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        const filter = this.ctx.createBiquadFilter();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, time);
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(1950, time);

        gain.gain.setValueAtTime(0.0001, time);
        gain.gain.linearRampToValueAtTime(0.068, time + 0.03);
        gain.gain.exponentialRampToValueAtTime(0.0008, time + 0.62);

        osc.connect(filter);
        filter.connect(gain);
        gain.connect(this.explorationBus);
        osc.start(time);
        osc.stop(time + 0.65);
      }
    }
  }

  private scheduleBossStep(step: number, time: number): void {
    if (!this.ctx || !this.bossBus) return;
    const isPhase2 = this.bossIntensityPhase === 2;

    // Intense 16th-note driving synthwave bass pulse (D minor / Phrygian dark progression)
    const roots = [73.42, 73.42, 77.78, 65.41]; // D2, D2, Eb2, C2
    const bar = Math.floor(step / 16) % roots.length;
    const subStep = step % 16;
    const octaveJump = subStep % 4 === 2 || (isPhase2 && subStep % 2 === 1) ? 2.0 : 1.0;
    const bassFreq = roots[bar] * octaveJump;

    const bassOsc = this.ctx.createOscillator();
    const bassFilter = this.ctx.createBiquadFilter();
    const bassGain = this.ctx.createGain();

    bassOsc.type = 'sawtooth';
    bassOsc.frequency.setValueAtTime(bassFreq, time);

    bassFilter.type = 'lowpass';
    bassFilter.Q.value = isPhase2 ? 5.2 : 3.6;
    bassFilter.frequency.setValueAtTime(isPhase2 ? 1280 : 880, time);
    bassFilter.frequency.exponentialRampToValueAtTime(175, time + 0.095);

    bassGain.gain.setValueAtTime(0.001, time);
    bassGain.gain.linearRampToValueAtTime(0.18, time + 0.008);
    bassGain.gain.exponentialRampToValueAtTime(0.001, time + 0.105);

    bassOsc.connect(bassFilter);
    bassFilter.connect(bassGain);
    bassGain.connect(this.bossBus);
    bassOsc.start(time);
    bassOsc.stop(time + 0.11);

    // Punchy synthwave 4-on-the-floor kick pulse
    if (subStep % 4 === 0) {
      const kick = this.ctx.createOscillator();
      const kGain = this.ctx.createGain();
      kick.type = 'sine';
      kick.frequency.setValueAtTime(145, time);
      kick.frequency.exponentialRampToValueAtTime(38, time + 0.11);
      kGain.gain.setValueAtTime(0.24, time);
      kGain.gain.exponentialRampToValueAtTime(0.001, time + 0.12);
      kick.connect(kGain);
      kGain.connect(this.bossBus);
      kick.start(time);
      kick.stop(time + 0.13);
    }

    // Tense high synthwave lead motif on accents
    if (subStep === 0 || subStep === 6 || subStep === 10 || (isPhase2 && subStep === 14)) {
      const leadNotes = [
        [293.66, 349.23, 329.63, 440.0],
        [293.66, 349.23, 466.16, 440.0],
        [311.13, 392.0, 466.16, 392.0],
        [261.63, 329.63, 392.0, 523.25],
      ];
      const idx = subStep === 0 ? 0 : subStep === 6 ? 1 : subStep === 10 ? 2 : 3;
      const leadFreq = leadNotes[bar][idx] * (isPhase2 ? 1.0 : 1.0);
      const lead = this.ctx.createOscillator();
      const lFilter = this.ctx.createBiquadFilter();
      const lGain = this.ctx.createGain();

      lead.type = 'square';
      lead.frequency.setValueAtTime(leadFreq, time);
      lFilter.type = 'lowpass';
      lFilter.frequency.setValueAtTime(isPhase2 ? 2200 : 1450, time);
      lGain.gain.setValueAtTime(0.001, time);
      lGain.gain.linearRampToValueAtTime(0.062, time + 0.015);
      lGain.gain.exponentialRampToValueAtTime(0.001, time + 0.24);

      lead.connect(lFilter);
      lFilter.connect(lGain);
      lGain.connect(this.bossBus);
      lead.start(time);
      lead.stop(time + 0.25);
    }
  }

  private scheduleVictoryStep(step: number, time: number): void {
    if (!this.ctx || !this.victoryBus) return;
    // Majestic triumphant Cmaj9 -> Gmaj9 -> Fmaj9 -> Cmaj9 harmonic shimmer
    if (step % 8 === 0) {
      const chordIdx = Math.floor(step / 8) % 4;
      const victoryChords = [
        [261.63, 329.63, 392.0, 493.88, 587.33],
        [196.0, 293.66, 392.0, 493.88, 587.33],
        [174.61, 261.63, 329.63, 440.0, 523.25],
        [261.63, 392.0, 493.88, 587.33, 659.25],
      ];
      const notes = victoryChords[chordIdx];
      for (let i = 0; i < notes.length; i++) {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(notes[i], time + i * 0.04);
        gain.gain.setValueAtTime(0.001, time + i * 0.04);
        gain.gain.linearRampToValueAtTime(0.068, time + i * 0.04 + 0.12);
        gain.gain.exponentialRampToValueAtTime(0.001, time + 1.25);
        osc.connect(gain);
        gain.connect(this.victoryBus);
        osc.start(time + i * 0.04);
        osc.stop(time + 1.28);
      }
    }
  }

  public setMuted(mute: boolean): void {
    this.muted = mute;
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.setTargetAtTime(mute ? 0 : 0.42, this.ctx.currentTime, 0.03);
    }
  }

  public toggleMute(): boolean {
    this.setMuted(!this.muted);
    return this.muted;
  }

  public setActive(active: boolean): void {
    this.running = active;
    if (!this.ctx || !this.engineGain || !this.boostNoiseGain) return;
    const now = this.ctx.currentTime;
    if (!active) {
      this.engineGain.gain.setTargetAtTime(0, now, 0.06);
      this.boostNoiseGain.gain.setTargetAtTime(0, now, 0.06);
    }
  }

  public updateEngine(speedRatio: number, isBoosting: boolean): void {
    if (!this.ctx || !this.running || !this.engineOsc1 || !this.engineOsc2 || !this.engineFilter || !this.engineGain || !this.boostNoiseGain || !this.boostFilter) {
      return;
    }
    const now = this.ctx.currentTime;
    const baseFreq = 50 + speedRatio * 34 + (isBoosting ? 28 : 0);
    this.engineOsc1.frequency.setTargetAtTime(baseFreq, now, 0.08);
    this.engineOsc2.frequency.setTargetAtTime(baseFreq * 1.505, now, 0.08);
    this.engineFilter.frequency.setTargetAtTime(isBoosting ? 540 : 170 + speedRatio * 130, now, 0.08);
    this.engineGain.gain.setTargetAtTime(isBoosting ? 0.16 : 0.095, now, 0.08);

    this.boostFilter.frequency.setTargetAtTime(isBoosting ? 620 : 260, now, 0.08);
    this.boostNoiseGain.gain.setTargetAtTime(isBoosting ? 0.18 : 0.0, now, 0.07);
  }

  public playLaser(isEnemy = false, weaponLevel = 1): void {
    if (!this.ctx || !this.masterGain || this.muted) return;
    const now = this.ctx.currentTime;
    const pitchJitter = 0.92 + Math.random() * 0.16;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = isEnemy ? 'sawtooth' : weaponLevel >= 4 ? 'sawtooth' : 'triangle';
    const levelPitch = isEnemy ? 1 : weaponLevel === 2 ? 1.15 : weaponLevel === 3 ? 0.95 : weaponLevel >= 4 ? 0.78 : 1.0;
    const startFreq = (isEnemy ? 560 : 1120 * levelPitch) * pitchJitter;
    const endFreq = (isEnemy ? 160 : 210 * levelPitch) * pitchJitter;

    osc.frequency.setValueAtTime(startFreq, now);
    osc.frequency.exponentialRampToValueAtTime(endFreq, now + (weaponLevel >= 4 && !isEnemy ? 0.17 : 0.13));

    const vol = isEnemy ? 0.085 : 0.16 + (weaponLevel - 1) * 0.018;
    gain.gain.setValueAtTime(vol, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + (weaponLevel >= 4 && !isEnemy ? 0.18 : 0.14));

    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start(now);
    osc.stop(now + 0.19);
  }

  public playExplosion(heavy = false): void {
    if (!this.ctx || !this.masterGain || !this.noiseBuffer || this.muted) return;
    const now = this.ctx.currentTime;
    const duration = heavy ? 0.58 : 0.36;

    // Noise burst
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuffer;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(heavy ? 640 : 920, now);
    filter.frequency.exponentialRampToValueAtTime(85, now + duration);

    const nGain = this.ctx.createGain();
    nGain.gain.setValueAtTime(heavy ? 0.36 : 0.24, now);
    nGain.gain.exponentialRampToValueAtTime(0.001, now + duration);

    src.connect(filter);
    filter.connect(nGain);
    nGain.connect(this.masterGain);
    src.start(now);
    src.stop(now + duration);

    // Sub impact thump
    const sub = this.ctx.createOscillator();
    const sGain = this.ctx.createGain();
    sub.type = 'sine';
    sub.frequency.setValueAtTime(heavy ? 125 : 155, now);
    sub.frequency.exponentialRampToValueAtTime(28, now + duration * 0.85);
    sGain.gain.setValueAtTime(heavy ? 0.34 : 0.2, now);
    sGain.gain.exponentialRampToValueAtTime(0.001, now + duration * 0.85);
    sub.connect(sGain);
    sGain.connect(this.masterGain);
    sub.start(now);
    sub.stop(now + duration);
  }

  public playSonarPing(progressRatio: number): void {
    if (!this.ctx || !this.masterGain || this.muted) return;
    const now = this.ctx.currentTime;
    const freq = 520 + progressRatio * 340;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq, now);
    osc.frequency.exponentialRampToValueAtTime(freq * 1.06, now + 0.24);

    gain.gain.setValueAtTime(0.001, now);
    gain.gain.linearRampToValueAtTime(0.15, now + 0.025);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.28);

    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start(now);
    osc.stop(now + 0.3);
  }

  public playScanComplete(): void {
    if (!this.ctx || !this.masterGain || this.muted) return;
    const now = this.ctx.currentTime;
    const notes = [523.25, 659.25, 783.99, 1046.5];
    notes.forEach((freq, idx) => {
      if (!this.ctx || !this.masterGain) return;
      const t = now + idx * 0.08;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, t);
      gain.gain.setValueAtTime(0.001, t);
      gain.gain.linearRampToValueAtTime(0.17, t + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.42);
      osc.connect(gain);
      gain.connect(this.masterGain);
      osc.start(t);
      osc.stop(t + 0.45);
    });
  }

  public playPickup(isHealth: boolean): void {
    if (!this.ctx || !this.masterGain || this.muted) return;
    const now = this.ctx.currentTime;
    const freqs = isHealth ? [587.33, 880] : [659.25, 987.77];
    freqs.forEach((f, idx) => {
      if (!this.ctx || !this.masterGain) return;
      const t = now + idx * 0.06;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(f, t);
      gain.gain.setValueAtTime(0.14, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.2);
      osc.connect(gain);
      gain.connect(this.masterGain);
      osc.start(t);
      osc.stop(t + 0.22);
    });
  }

  public playCoinPickup(): void {
    if (!this.ctx || !this.masterGain || this.muted) return;
    const now = this.ctx.currentTime;
    const pitch = 0.96 + Math.random() * 0.12;
    const freqs = [1174.66 * pitch, 1567.98 * pitch];
    freqs.forEach((f, idx) => {
      if (!this.ctx || !this.masterGain) return;
      const t = now + idx * 0.045;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(f, t);
      gain.gain.setValueAtTime(0.13, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.16);
      osc.connect(gain);
      gain.connect(this.masterGain);
      osc.start(t);
      osc.stop(t + 0.17);
    });
  }

  public playUpgradeSuccess(): void {
    if (!this.ctx || !this.masterGain || this.muted) return;
    const now = this.ctx.currentTime;
    const chord = [440, 554.37, 659.25, 880];
    chord.forEach((f, idx) => {
      if (!this.ctx || !this.masterGain) return;
      const t = now + idx * 0.055;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(f, t);
      osc.frequency.exponentialRampToValueAtTime(f * 1.03, t + 0.25);
      gain.gain.setValueAtTime(0.001, t);
      gain.gain.linearRampToValueAtTime(0.15, t + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.34);
      osc.connect(gain);
      gain.connect(this.masterGain);
      osc.start(t);
      osc.stop(t + 0.36);
    });
  }

  public playRepair(): void {
    if (!this.ctx || !this.masterGain || this.muted) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(320, now);
    osc.frequency.exponentialRampToValueAtTime(760, now + 0.32);
    gain.gain.setValueAtTime(0.001, now);
    gain.gain.linearRampToValueAtTime(0.16, now + 0.05);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.36);
    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start(now);
    osc.stop(now + 0.38);
  }

  public playBossWarningSiren(): void {
    if (!this.ctx || !this.masterGain || this.muted) return;
    const now = this.ctx.currentTime;
    for (let i = 0; i < 3; i++) {
      const t = now + i * 0.62;
      const osc = this.ctx.createOscillator();
      const filter = this.ctx.createBiquadFilter();
      const gain = this.ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(220, t);
      osc.frequency.linearRampToValueAtTime(490, t + 0.32);
      osc.frequency.linearRampToValueAtTime(210, t + 0.56);

      filter.type = 'bandpass';
      filter.frequency.value = 680;
      filter.Q.value = 2.0;

      gain.gain.setValueAtTime(0.001, t);
      gain.gain.linearRampToValueAtTime(0.24, t + 0.06);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.58);

      osc.connect(filter);
      filter.connect(gain);
      gain.connect(this.masterGain);
      osc.start(t);
      osc.stop(t + 0.6);
    }
  }

  public playBossPhaseShift(): void {
    if (!this.ctx || !this.masterGain || this.muted) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(110, now);
    osc.frequency.exponentialRampToValueAtTime(520, now + 0.55);
    gain.gain.setValueAtTime(0.001, now);
    gain.gain.linearRampToValueAtTime(0.22, now + 0.12);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.65);
    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start(now);
    osc.stop(now + 0.68);
  }

  public playBossExplosionChain(): void {
    this.playExplosion(true);
    if (!this.ctx || !this.masterGain || this.muted) return;
    const now = this.ctx.currentTime;
    const sub = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    sub.type = 'sine';
    sub.frequency.setValueAtTime(92, now);
    sub.frequency.exponentialRampToValueAtTime(24, now + 0.72);
    gain.gain.setValueAtTime(0.32, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.75);
    sub.connect(gain);
    gain.connect(this.masterGain);
    sub.start(now);
    sub.stop(now + 0.78);
  }

  public playDamage(): void {
    if (!this.ctx || !this.masterGain || this.muted) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(210, now);
    osc.frequency.exponentialRampToValueAtTime(68, now + 0.22);
    gain.gain.setValueAtTime(0.24, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.24);
    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start(now);
    osc.stop(now + 0.25);
  }

  public playTelegraph(): void {
    if (!this.ctx || !this.masterGain || this.muted) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(340, now);
    osc.frequency.exponentialRampToValueAtTime(840, now + 0.32);
    gain.gain.setValueAtTime(0.001, now);
    gain.gain.linearRampToValueAtTime(0.08, now + 0.15);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start(now);
    osc.stop(now + 0.36);
  }

  public playLockOnBeep(locked: boolean): void {
    if (!this.ctx || !this.masterGain || this.muted) return;
    const now = this.ctx.currentTime;
    const freqs = locked ? [1480, 1975] : [1140];
    freqs.forEach((f, idx) => {
      if (!this.ctx || !this.masterGain) return;
      const t = now + idx * 0.055;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = locked ? 'triangle' : 'sine';
      osc.frequency.setValueAtTime(f, t);
      gain.gain.setValueAtTime(0.001, t);
      gain.gain.linearRampToValueAtTime(locked ? 0.13 : 0.075, t + 0.008);
      gain.gain.exponentialRampToValueAtTime(0.001, t + (locked ? 0.095 : 0.055));
      osc.connect(gain);
      gain.connect(this.masterGain);
      osc.start(t);
      osc.stop(t + 0.11);
    });
  }

  public playMissileLaunch(): void {
    if (!this.ctx || !this.masterGain || !this.noiseBuffer || this.muted) return;
    const now = this.ctx.currentTime;

    // Rocket thruster ignition noise sweep
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.Q.value = 1.6;
    filter.frequency.setValueAtTime(360, now);
    filter.frequency.exponentialRampToValueAtTime(1650, now + 0.18);
    filter.frequency.exponentialRampToValueAtTime(520, now + 0.42);

    const nGain = this.ctx.createGain();
    nGain.gain.setValueAtTime(0.001, now);
    nGain.gain.linearRampToValueAtTime(0.28, now + 0.045);
    nGain.gain.exponentialRampToValueAtTime(0.001, now + 0.44);

    src.connect(filter);
    filter.connect(nGain);
    nGain.connect(this.masterGain);
    src.start(now);
    src.stop(now + 0.46);

    // Metallic rail launch whine
    const osc = this.ctx.createOscillator();
    const oGain = this.ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(420, now);
    osc.frequency.exponentialRampToValueAtTime(165, now + 0.28);
    oGain.gain.setValueAtTime(0.11, now);
    oGain.gain.exponentialRampToValueAtTime(0.001, now + 0.3);
    osc.connect(oGain);
    oGain.connect(this.masterGain);
    osc.start(now);
    osc.stop(now + 0.32);
  }

  public playMissileExplosion(): void {
    this.playExplosion(true);
    if (!this.ctx || !this.masterGain || this.muted) return;
    const now = this.ctx.currentTime;
    const boom = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    boom.type = 'triangle';
    boom.frequency.setValueAtTime(135, now);
    boom.frequency.exponentialRampToValueAtTime(26, now + 0.62);
    gain.gain.setValueAtTime(0.32, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.66);
    boom.connect(gain);
    gain.connect(this.masterGain);
    boom.start(now);
    boom.stop(now + 0.68);
  }

  public playBarrelRoll(): void {
    if (!this.ctx || !this.masterGain || !this.noiseBuffer || this.muted) return;
    const now = this.ctx.currentTime;

    // Aerodynamic plasma slipstream whoosh
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.Q.value = 2.4;
    filter.frequency.setValueAtTime(240, now);
    filter.frequency.exponentialRampToValueAtTime(1450, now + 0.16);
    filter.frequency.exponentialRampToValueAtTime(280, now + 0.46);

    const nGain = this.ctx.createGain();
    nGain.gain.setValueAtTime(0.001, now);
    nGain.gain.linearRampToValueAtTime(0.24, now + 0.08);
    nGain.gain.exponentialRampToValueAtTime(0.001, now + 0.48);

    src.connect(filter);
    filter.connect(nGain);
    nGain.connect(this.masterGain);
    src.start(now);
    src.stop(now + 0.5);

    // Quick phase-shift turbine chime
    const osc = this.ctx.createOscillator();
    const oGain = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(260, now);
    osc.frequency.exponentialRampToValueAtTime(640, now + 0.18);
    osc.frequency.exponentialRampToValueAtTime(340, now + 0.42);
    oGain.gain.setValueAtTime(0.001, now);
    oGain.gain.linearRampToValueAtTime(0.11, now + 0.06);
    oGain.gain.exponentialRampToValueAtTime(0.001, now + 0.44);
    osc.connect(oGain);
    oGain.connect(this.masterGain);
    osc.start(now);
    osc.stop(now + 0.46);
  }

  public playVictory(): void {
    if (!this.ctx || !this.masterGain || this.muted) return;
    const now = this.ctx.currentTime;
    const fanfare = [523.25, 659.25, 783.99, 1046.5, 1318.51];
    fanfare.forEach((f, idx) => {
      if (!this.ctx || !this.masterGain) return;
      const t = now + idx * 0.11;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(f, t);
      gain.gain.setValueAtTime(0.001, t);
      gain.gain.linearRampToValueAtTime(0.18, t + 0.03);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.7);
      osc.connect(gain);
      gain.connect(this.masterGain);
      osc.start(t);
      osc.stop(t + 0.75);
    });
  }

  public playDefeat(): void {
    if (!this.ctx || !this.masterGain || this.muted) return;
    const now = this.ctx.currentTime;
    const notes = [311.13, 277.18, 233.08, 174.61];
    notes.forEach((f, idx) => {
      if (!this.ctx || !this.masterGain) return;
      const t = now + idx * 0.14;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(f, t);
      gain.gain.setValueAtTime(0.12, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.4);
      osc.connect(gain);
      gain.connect(this.masterGain);
      osc.start(t);
      osc.stop(t + 0.42);
    });
  }

  public dispose(): void {
    if (this.bgmSchedulerId !== null) {
      clearInterval(this.bgmSchedulerId);
      this.bgmSchedulerId = null;
    }
    this.padOscs = [];
    if (this.ctx) {
      this.ctx.close().catch(() => {});
      this.ctx = null;
    }
  }
}
