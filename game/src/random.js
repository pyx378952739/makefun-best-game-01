// A small seeded RNG (mulberry32) so screenshot scenes and replays are
// deterministic: the same seed always builds the same game.
export function createRng(seed) {
  let state = (seed >>> 0) || 0x9e3779b9;
  return function next() {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Random float in [min, max). */
export function range(rng, min, max) {
  return min + rng() * (max - min);
}

/** Random integer in [min, max]. */
export function rangeInt(rng, min, max) {
  return Math.floor(range(rng, min, max + 1));
}

/** Pick one element of an array. */
export function pick(rng, array) {
  return array[Math.floor(rng() * array.length)];
}

/** Fisher-Yates shuffle, in place, driven by the seeded RNG. */
export function shuffle(rng, array) {
  for (let i = array.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
}
