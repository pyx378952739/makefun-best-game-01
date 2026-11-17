// Synthesised sound effects with the Web Audio API: no audio files, nothing
// to download. The context is created on the first user gesture; in
// screenshot mode there is no gesture and the mixer stays silent.
export function createAudio() {
  let context = null;
  let muted = false;
  let noiseBuffer = null;

  function ensure() {
    if (context) return context;
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return null;
    context = new AudioContext();
    const length = context.sampleRate * 0.5;
    noiseBuffer = context.createBuffer(1, length, context.sampleRate);
    const data = noiseBuffer.getChannelData(0);
    for (let i = 0; i < length; i += 1) data[i] = Math.random() * 2 - 1;
    return context;
  }

  /** Call from any user gesture so later sounds are allowed to play. */
  function unlock() {
    const ctx = ensure();
    if (ctx && ctx.state === 'suspended') void ctx.resume();
  }

  function tone({ type = 'square', from = 880, to = 440, seconds = 0.08, volume = 0.12, delay = 0 }) {
    if (muted) return;
    const ctx = ensure();
    if (!ctx) return;
    const start = ctx.currentTime + delay;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(from, start);
    osc.frequency.exponentialRampToValueAtTime(Math.max(1, to), start + seconds);
    gain.gain.setValueAtTime(volume, start);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + seconds);
    osc.connect(gain).connect(ctx.destination);
    osc.start(start);
    osc.stop(start + seconds + 0.02);
  }

  function noise({ seconds = 0.3, volume = 0.25, cutoff = 1200 }) {
    if (muted) return;
    const ctx = ensure();
    if (!ctx) return;
    const start = ctx.currentTime;
    const source = ctx.createBufferSource();
    source.buffer = noiseBuffer;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(cutoff, start);
    filter.frequency.exponentialRampToValueAtTime(80, start + seconds);
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(volume, start);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + seconds);
    source.connect(filter).connect(gain).connect(ctx.destination);
    source.start(start);
    source.stop(start + seconds + 0.02);
  }

  return {
    unlock,
    toggleMute() {
      muted = !muted;
      return muted;
    },
    get muted() {
      return muted;
    },
    shoot() {
      tone({ type: 'square', from: 920, to: 380, seconds: 0.07, volume: 0.07 });
    },
    explosion(big = false) {
      noise({ seconds: big ? 0.45 : 0.25, volume: big ? 0.3 : 0.18, cutoff: big ? 900 : 1600 });
      tone({ type: 'sine', from: 160, to: 40, seconds: 0.3, volume: 0.16 });
    },
    hurt() {
      tone({ type: 'sawtooth', from: 220, to: 55, seconds: 0.35, volume: 0.2 });
      noise({ seconds: 0.25, volume: 0.2, cutoff: 800 });
    },
    pickup() {
      tone({ type: 'sine', from: 660, to: 660, seconds: 0.08, volume: 0.12 });
      tone({ type: 'sine', from: 990, to: 990, seconds: 0.12, volume: 0.12, delay: 0.07 });
    },
    waveClear() {
      [523, 659, 784, 1047].forEach((freq, i) => {
        tone({ type: 'triangle', from: freq, to: freq, seconds: 0.14, volume: 0.12, delay: i * 0.09 });
      });
    },
    gameOver() {
      [392, 311, 233, 175].forEach((freq, i) => {
        tone({ type: 'triangle', from: freq, to: freq * 0.94, seconds: 0.22, volume: 0.14, delay: i * 0.16 });
      });
    },
  };
}
