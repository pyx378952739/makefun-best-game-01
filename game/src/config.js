// NEON VOID — configuration: every tunable number of the game lives here.
export const FIELD = { width: 960, height: 600 };

export const PLAYER = {
  radius: 12,
  speed: 320,
  fireInterval: 0.16,
  rapidFireInterval: 0.07,
  bulletSpeed: 640,
  bulletRadius: 4,
  maxLives: 3,
  invulnerableSeconds: 2.0,
  respawnSafeRadius: 140,
};

export const ENEMY = {
  chaser: { radius: 14, speed: 95, hp: 1, score: 100, cost: 1, color: '#ff2d78' },
  weaver: { radius: 12, speed: 140, hp: 1, score: 150, cost: 2, color: '#ff9f1c' },
  splitter: { radius: 21, speed: 72, hp: 2, score: 200, cost: 3, color: '#b537f2' },
  mini: { radius: 8, speed: 185, hp: 1, score: 50, cost: 0, color: '#ff5da2' },
  shooter: { radius: 15, speed: 62, hp: 2, score: 250, cost: 3, color: '#ff4040' },
  orbSpeed: 165,
  orbRadius: 6,
  shootInterval: 2.3,
  contactDamage: 1,
};

export const POWERUP = {
  radius: 13,
  dropChance: 0.12,
  shieldSeconds: 0, // shield lasts until it absorbs one hit
  rapidSeconds: 8,
  spreadSeconds: 10,
  lifeSeconds: 9, // how long a power-up stays on the field
};

export const WAVES = {
  baseBudget: 6,
  budgetPerWave: 4,
  spawnInterval: 0.65,
  clearBonus: 250,
  breakSeconds: 2.0,
};

export const COMBO = {
  windowSeconds: 3.0,
  perTier: 4, // every 4 chained kills raises the multiplier one step
  maxMultiplier: 5,
};

export const SHOTS = {
  start: { seconds: 6, horizon: 0.7 },
  play: { seconds: 26, horizon: 0.7 },
  // The end scene is staged in two phases inside shots.js: 20 seconds of
  // good play, then standing still until the ship is destroyed.
};
