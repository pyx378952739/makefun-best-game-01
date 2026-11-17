// The screenshot scenes behind ?shot=start|play|end. Each one plays the real
// rules forward from a fresh world for a fixed number of steps, steered by a
// simple autopilot, so the frame is what a short game really looks like and
// the same seed always gives the same frame.
import { FIELD, SHOTS } from './config.js';

const SAMPLE = 1 / 30;
const DIRECTIONS = [
  [0, 0], [1, 0], [-1, 0], [0, 1], [0, -1],
  [1, 1], [1, -1], [-1, 1], [-1, -1],
];

/** Seconds until moving in `dir` runs the player into an enemy or an orb. */
function timeToHit(world, dir, horizon) {
  const p = world.player;
  const speed = 320;
  for (let t = SAMPLE; t <= horizon; t += SAMPLE) {
    const x = Math.min(FIELD.width - p.radius, Math.max(p.radius, p.x + dir[0] * speed * t));
    const y = Math.min(FIELD.height - p.radius, Math.max(p.radius, p.y + dir[1] * speed * t));
    for (const e of world.enemies) {
      const ex = e.x + e.vx * t;
      const ey = e.y + e.vy * t;
      const rr = e.radius + p.radius;
      if ((ex - x) ** 2 + (ey - y) ** 2 < rr * rr) return t;
    }
    for (const o of world.orbs) {
      const ox = o.x + o.vx * t;
      const oy = o.y + o.vy * t;
      const rr = o.radius + p.radius;
      if ((ox - x) ** 2 + (oy - y) ** 2 < rr * rr) return t;
    }
  }
  return Infinity;
}

function nearestEnemy(world) {
  const p = world.player;
  let best = null;
  let bestD = Infinity;
  for (const e of world.enemies) {
    const d = (e.x - p.x) ** 2 + (e.y - p.y) ** 2;
    if (d < bestD) {
      bestD = d;
      best = e;
    }
  }
  return best;
}

function nearestPowerup(world) {
  const p = world.player;
  let best = null;
  let bestD = Infinity;
  for (const u of world.powerups) {
    const d = (u.x - p.x) ** 2 + (u.y - p.y) ** 2;
    if (d < bestD) {
      bestD = d;
      best = u;
    }
  }
  return best;
}

/**
 * One autopilot decision: the safest direction (longest time to a hit), with
 * a pull toward the nearest power-up when it is safe to go there.
 */
function autopilot(world, horizon, firing) {
  const p = world.player;
  const target = nearestPowerup(world);
  let bestDir = DIRECTIONS[0];
  let bestScore = -Infinity;
  for (const dir of DIRECTIONS) {
    const t = timeToHit(world, dir, horizon);
    let score = t === Infinity ? 10 : t;
    // Small pull toward a power-up, and toward the centre when idle.
    const tx = target ? target.x : FIELD.width / 2;
    const ty = target ? target.y : FIELD.height / 2;
    const nx = p.x + dir[0] * 60;
    const ny = p.y + dir[1] * 60;
    const before = (tx - p.x) ** 2 + (ty - p.y) ** 2;
    const after = (tx - nx) ** 2 + (ty - ny) ** 2;
    if (after < before) score += 0.15;
    if (score > bestScore) {
      bestScore = score;
      bestDir = dir;
    }
  }
  const enemy = nearestEnemy(world);
  return {
    moveX: bestDir[0],
    moveY: bestDir[1],
    aimX: enemy ? enemy.x : p.x,
    aimY: enemy ? enemy.y : p.y - 1,
    firing,
  };
}

/**
 * Set `world` to the named scene and return the screen it shows.
 * start: a few seconds of the title demo, topped up until a few enemies are
 * on screen behind the panel. play: a mid-wave dogfight, topped up until the
 * field is busy. end: good play, then standing still until destroyed.
 */
export function stageShot(name, world) {
  if (name !== 'play' && name !== 'end') {
    const spec = SHOTS.start;
    for (let i = 0; i < spec.seconds / (1 / 60); i += 1) {
      world.step(1 / 60, autopilot(world, spec.horizon, true));
    }
    for (let i = 0; i < 10 / (1 / 60) && world.enemies.length < 3; i += 1) {
      world.step(1 / 60, autopilot(world, spec.horizon, true));
    }
    return { screen: 'title' };
  }
  world.startGame();
  if (name === 'end') {
    // Phase 1: play well for 20 seconds to build a real score and wave.
    for (let i = 0; i < 20 / (1 / 60); i += 1) {
      world.step(1 / 60, autopilot(world, 0.7, true));
      if (world.state === 'over') break;
    }
    // Phase 2: stand still and stop firing until the swarm destroys the
    // ship, so the frame shows a genuine game-over screen.
    const idle = { moveX: 0, moveY: 0, aimX: world.player.x, aimY: world.player.y - 1, firing: false };
    for (let i = 0; i < 120 / (1 / 60); i += 1) {
      world.step(1 / 60, idle);
      if (world.state === 'over') break;
    }
    return { screen: world.state === 'over' ? 'over' : 'playing' };
  }
  const spec = SHOTS.play;
  for (let i = 0; i < spec.seconds / (1 / 60); i += 1) {
    world.step(1 / 60, autopilot(world, spec.horizon, true));
    if (world.state === 'over') break;
  }
  // Top up until the field is busy AND the fight has closed in on the
  // player, so the cover frame reads as a dogfight, not a standoff.
  const p = world.player;
  const closedIn = () => world.enemies.some((e) => (e.x - p.x) ** 2 + (e.y - p.y) ** 2 < 320 * 320);
  for (let i = 0; i < 14 / (1 / 60) && !(world.enemies.length >= 6 && closedIn()); i += 1) {
    world.step(1 / 60, autopilot(world, spec.horizon, true));
    if (world.state === 'over') break;
  }
  return { screen: world.state === 'over' ? 'over' : 'playing' };
}
