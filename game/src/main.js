// NEON VOID — entry point. Wires input, audio, the world and the renderer
// together, runs the fixed-step loop, and stages deterministic screenshot
// scenes when the page opens with ?shot=start|play|end.
import { FIELD } from './config.js';
import { createWorld, EVENT_SHOOT, EVENT_EXPLOSION, EVENT_BIG_EXPLOSION, EVENT_HURT, EVENT_PICKUP, EVENT_WAVE_CLEAR, EVENT_GAME_OVER, EVENT_WAVE_START } from './world.js';
import { createRenderer } from './render.js';
import { createInput } from './input.js';
import { createAudio } from './audio.js';
import { stageShot } from './shots.js';

const STEP = 1 / 60;
const BEST_KEY = 'neon-void-best';

const canvas = document.getElementById('game');
const params = new URLSearchParams(window.location.search);
const shotName = params.get('shot');
const seed = Number(params.get('seed') || '7');

function loadBest() {
  try {
    return Number(window.localStorage.getItem(BEST_KEY) || '0') || 0;
  } catch {
    return 0;
  }
}
function saveBest(value) {
  try {
    window.localStorage.setItem(BEST_KEY, String(value));
  } catch {
    // Storage may be unavailable (file://, sandbox): the game plays on.
  }
}

const world = createWorld(seed, loadBest());
const renderer = createRenderer(canvas);
const input = createInput(canvas);
const audio = createAudio();

function playEvents(events) {
  for (const event of events) {
    if (event === EVENT_SHOOT) audio.shoot();
    else if (event === EVENT_EXPLOSION) audio.explosion(false);
    else if (event === EVENT_BIG_EXPLOSION) audio.explosion(true);
    else if (event === EVENT_HURT) audio.hurt();
    else if (event === EVENT_PICKUP) audio.pickup();
    else if (event === EVENT_WAVE_CLEAR) audio.waveClear();
    else if (event === EVENT_GAME_OVER) audio.gameOver();
    else if (event === EVENT_WAVE_START) { /* no sound */ }
  }
}

// --- Screenshot mode: stage one deterministic scene, draw it once. --------
if (shotName) {
  const staged = stageShot(shotName, world);
  renderer.draw(world);
  window.__shot = { name: shotName, screen: staged.screen, score: world.score, wave: world.wave };
} else {
  // --- Normal play ---------------------------------------------------------
  let last = performance.now();
  let accumulator = 0;

  function frame(now) {
    requestAnimationFrame(frame);
    const elapsed = Math.min(0.1, (now - last) / 1000);
    last = now;
    accumulator += elapsed;
    let steps = 0;
    while (accumulator >= STEP && steps < 5) {
      accumulator -= STEP;
      steps += 1;
      handleKeys();
      const events = world.step(STEP, input);
      playEvents(events);
      if (world.state === 'over' && world.newBest) saveBest(world.best);
    }
    renderer.draw(world);
  }

  function handleKeys() {
    if (input.consume('Enter')) {
      audio.unlock();
      if (world.state === 'title' || world.state === 'over') world.startGame();
    }
    if (input.consume('KeyR')) {
      if (world.state === 'playing' || world.state === 'paused' || world.state === 'over') world.startGame();
    }
    if (input.consume('KeyP') || input.consume('Escape')) {
      if (world.state === 'playing') world.state = 'paused';
      else if (world.state === 'paused') world.state = 'playing';
    }
    if (input.consume('KeyM')) audio.toggleMute();
    if (input.consume('KeyT')) {
      if (world.state === 'over' || world.state === 'paused') world.toTitle();
    }
  }

  canvas.addEventListener('mousedown', () => {
    audio.unlock();
    if (world.state === 'title' || world.state === 'over') world.startGame();
  });
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && world.state === 'playing') world.state = 'paused';
  });

  requestAnimationFrame(frame);
}
