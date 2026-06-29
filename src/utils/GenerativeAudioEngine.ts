// Deterministic Generative Audio Engine using Web Audio API
// Takes a memberNumber seed and synthesizes a unique, repeatable ambient loop.

export class GenerativeAudioEngine {
  private audioCtx: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private gainNode: GainNode | null = null;
  private activeNotes: { osc: OscillatorNode; gain: GainNode }[] = [];
  private isPlaying = false;
  private schedulerTimer: NodeJS.Timeout | null = null;

  // Simple seedable PRNG (Mulberry32)
  private createRandom(seed: number) {
    let s = seed;
    return function () {
      s |= 0;
      s = (s + 0x6d2b79f5) | 0;
      let t = Math.imul(s ^ (s >>> 15), 1 | s);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  // Map degree to frequency in a scale
  private getFrequency(rootMidi: number, degree: number, scale: number[]) {
    const octave = Math.floor(degree / scale.length);
    const scaleIndex = ((degree % scale.length) + scale.length) % scale.length;
    const semitones = scale[scaleIndex] + octave * 12;
    return 440 * Math.pow(2, (rootMidi + semitones - 69) / 12);
  }

  public start(memberNumber: number) {
    if (this.isPlaying) return;

    // 1. Initialize Audio Context
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextClass) {
      console.warn('Web Audio API not supported in this browser.');
      return;
    }

    this.audioCtx = new AudioContextClass();
    this.isPlaying = true;

    // 2. Setup audio nodes
    this.analyser = this.audioCtx.createAnalyser();
    this.analyser.fftSize = 64; // High frequency resolution not needed for simple 3D mesh driving
    
    this.gainNode = this.audioCtx.createGain();
    this.gainNode.gain.setValueAtTime(0.001, this.audioCtx.currentTime);
    // Smooth fade in
    this.gainNode.gain.exponentialRampToValueAtTime(0.3, this.audioCtx.currentTime + 1.0);

    // Dynamic Filter sweep (adds cyber ambient feeling)
    const filter = this.audioCtx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.Q.value = 4.0;

    // Delay/Echo effect
    const delay = this.audioCtx.createDelay(1.0);
    const delayFeedback = this.audioCtx.createGain();
    delay.delayTime.value = 0.35;
    delayFeedback.gain.value = 0.4;

    // Route nodes: Synth -> Filter -> Gain -> Analyser -> Output
    // Also feed Filter -> Delay -> DelayFeedback -> Delay (feedback loop) -> Gain
    filter.connect(this.gainNode);
    filter.connect(delay);
    delay.connect(delayFeedback);
    delayFeedback.connect(delay);
    delayFeedback.connect(this.gainNode);
    
    this.gainNode.connect(this.analyser);
    this.analyser.connect(this.audioCtx.destination);

    // 3. Generate deterministic composition parameters based on member number
    const random = this.createRandom(memberNumber);
    
    // Choose base scale
    const scales = [
      [0, 2, 4, 5, 7, 9, 11], // Major (Bright, heroic)
      [0, 2, 3, 5, 7, 8, 10], // Minor (Deep, mysterious)
      [0, 2, 3, 5, 7, 9, 10], // Dorian (Cyberpunk, futuristic)
      [0, 1, 3, 5, 7, 8, 10], // Phrygian (Exotic, dark)
    ];
    const scale = scales[Math.floor(random() * scales.length)];
    
    // Choose root note (MIDI 55 to 64: G3 to E4)
    const rootMidi = 55 + Math.floor(random() * 10);
    
    // Choose tempo (90 to 120 BPM)
    const bpm = 90 + Math.floor(random() * 31);
    const beatDuration = 60 / bpm; // duration of one beat in seconds
    
    // Chord progression (degrees of the scale)
    const chordProgressions = [
      [0, 5, 3, 4], // I - VI - IV - V
      [0, 4, 5, 3], // I - V - VI - IV
      [5, 3, 0, 4], // VI - IV - I - V (classic pop/sad)
      [0, 3, 4, 0], // I - IV - V - I
    ];
    const progression = chordProgressions[Math.floor(random() * chordProgressions.length)];
    
    // Arpeggio notes (offset from chord root)
    const arpeggioOffsets = [
      [0, 2, 4, 7, 9, 7, 4, 2],
      [0, 4, 7, 11, 7, 4, 0, -2],
      [0, 2, 5, 7, 12, 7, 5, 2],
    ];
    const arpeggio = arpeggioOffsets[Math.floor(random() * arpeggioOffsets.length)];

    let beatCount = 0;
    
    // 4. Scheduling Loop
    const scheduleNextBeats = () => {
      if (!this.isPlaying || !this.audioCtx) return;

      const lookAhead = 0.5; // schedule 500ms in advance
      const now = this.audioCtx.currentTime;
      
      // Let's schedule notes for the next beat
      const scheduleTime = now + lookAhead;
      
      const currentChordIndex = Math.floor(beatCount / 8) % progression.length;
      const chordRoot = progression[currentChordIndex];
      const arpeggioStep = beatCount % arpeggio.length;
      const noteDegree = chordRoot + arpeggio[arpeggioStep];
      
      const freq = this.getFrequency(rootMidi, noteDegree, scale);
      
      // Synthesize note
      const osc = this.audioCtx.createOscillator();
      const oscGain = this.audioCtx.createGain();
      
      // Triangle wave has a soft, flute-like/ambient tone
      osc.type = random() > 0.5 ? 'triangle' : 'sine';
      osc.frequency.setValueAtTime(freq, scheduleTime);
      
      // Simple ADS envelope
      oscGain.gain.setValueAtTime(0, scheduleTime);
      oscGain.gain.linearRampToValueAtTime(0.12, scheduleTime + 0.05); // attack
      oscGain.gain.exponentialRampToValueAtTime(0.001, scheduleTime + beatDuration * 1.5); // release
      
      // Filter sweep modulation
      const filterFreq = 300 + (Math.sin(scheduleTime * 0.5) + 1.0) * 1200; // 300Hz to 1500Hz sweep
      filter.frequency.setValueAtTime(filterFreq, scheduleTime);
      
      osc.connect(oscGain);
      oscGain.connect(filter);
      
      osc.start(scheduleTime);
      osc.stop(scheduleTime + beatDuration * 1.6);
      
      this.activeNotes.push({ osc, gain: oscGain });
      
      // Cleanup finished note nodes to free memory
      setTimeout(() => {
        if (osc) {
          try { osc.disconnect(); } catch(e){}
        }
        if (oscGain) {
          try { oscGain.disconnect(); } catch(e){}
        }
        this.activeNotes = this.activeNotes.filter(n => n.osc !== osc);
      }, (lookAhead + beatDuration * 2) * 1000);

      beatCount++;
      
      // Schedule next tick
      this.schedulerTimer = setTimeout(scheduleNextBeats, beatDuration * 1000);
    };

    scheduleNextBeats();
  }

  public stop() {
    this.isPlaying = false;
    
    if (this.schedulerTimer) {
      clearTimeout(this.schedulerTimer);
      this.schedulerTimer = null;
    }

    if (this.gainNode && this.audioCtx) {
      try {
        const now = this.audioCtx.currentTime;
        // Fade out quickly to avoid clicks
        this.gainNode.gain.setValueAtTime(this.gainNode.gain.value, now);
        this.gainNode.gain.linearRampToValueAtTime(0.001, now + 0.3);
      } catch (e) {}
    }

    setTimeout(() => {
      this.activeNotes.forEach(n => {
        try { n.osc.stop(); } catch(e) {}
        try { n.osc.disconnect(); } catch(e) {}
        try { n.gain.disconnect(); } catch(e) {}
      });
      this.activeNotes = [];

      if (this.audioCtx) {
        try {
          this.audioCtx.close();
        } catch(e) {}
        this.audioCtx = null;
      }
      this.analyser = null;
      this.gainNode = null;
    }, 350);
  }

  // Returns array of real-time frequencies (values 0-255) to drive 3D visualizer
  public getFrequencyData(): Uint8Array {
    if (!this.analyser) return new Uint8Array(32);
    const bufferLength = this.analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);
    this.analyser.getByteFrequencyData(dataArray);
    return dataArray;
  }
}
