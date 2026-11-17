// NEON VOID — the simulation. Pure logic: no DOM, no canvas, no audio here,
// so the same code runs in the browser and in a Node test. One fixed step
// advances the world by dt seconds from an input snapshot.
import { FIELD, PLAYER, ENEMY, POWERUP, WAVES, COMBO } from './config.js';
import { createRng, range, rangeInt, pick, shuffle } from './random.js';

export const EVENT_SHOOT = 'shoot';
export const EVENT_EXPLOSION = 'explosion';
export const EVENT_BIG_EXPLOSION = 'bigExplosion';
export const EVENT_HURT = 'hurt';
export const EVENT_PICKUP = 'pickup';
export const EVENT_WAVE_CLEAR = 'waveClear';
export const EVENT_GAME_OVER = 'gameOver';
export const EVENT_WAVE_START = 'waveStart';

const TAU = Math.PI * 2;

function dist2(ax, ay, bx, by) {
  const dx = ax - bx;
  const dy = ay - by;
  return dx * dx + dy * dy;
}

function edgeSpawnPoint(rng, player) {
  for (let tries = 0; tries < 12; tries += 1) {
    const side = rangeInt(rng, 0, 3);
    let x;
    let y;
    if (side === 0) { x = range(rng, 0, FIELD.width); y = -24; }
    else if (side === 1) { x = FIELD.width + 24; y = range(rng, 0, FIELD.height); }
    else if (side === 2) { x = range(rng, 0, FIELD.width); y = FIELD.height + 24; }
    else { x = -24; y = range(rng, 0, FIELD.height); }
    if (dist2(x, y, player.x, player.y) > 200 * 200) return { x, y };
  }
  return { x: FIELD.width / 2, y: -24 };
}

export function createWorld(seed, best = 0) {
  const rng = createRng(seed);

  // The starfield is fixed for the life of this world, so the title screen,
  // the playfield and the screenshots all share one sky.
  const stars = [];
  for (let layer = 0; layer < 3; layer += 1) {
    const count = [70, 45, 25][layer];
    for (let i = 0; i < count; i += 1) {
      stars.push({
        x: rng() * FIELD.width,
        y: rng() * FIELD.height,
        layer,
        size: [1, 1.5, 2.2][layer],
        phase: rng() * TAU,
        speed: [0.4, 0.9, 1.6][layer],
      });
    }
  }

  const world = {
    rng,
    stars,
    time: 0,
    state: 'title', // title | playing | paused | over
    demo: true, // title screen runs an invulnerable autopilot demo behind the text
    score: 0,
    best,
    newBest: false,
    wave: 1,
    lives: PLAYER.maxLives,
    combo: 0,
    comboTimer: 0,
    multiplier: 1,
    kills: 0,
    shake: 0,
    waveState: 'fighting',
    breakTimer: 0,
    banner: '',
    bannerTimer: 0,
    spawnQueue: [],
    spawnTimer: 0,
    player: null,
    bullets: [],
    enemies: [],
    orbs: [],
    particles: [],
    texts: [],
    powerups: [],
  };

  function resetPlayer() {
    world.player = {
      x: FIELD.width / 2,
      y: FIELD.height / 2,
      vx: 0,
      vy: 0,
      angle: -Math.PI / 2,
      radius: PLAYER.radius,
      fireCooldown: 0,
      invulnerable: 0,
      shield: false,
      rapid: 0,
      spread: 0,
      alive: true,
      thrust: 0,
    };
  }

  function buildSpawnQueue(wave) {
    let budget = WAVES.baseBudget + (wave - 1) * WAVES.budgetPerWave;
    const kinds = ['chaser', 'weaver'];
    if (wave >= 2) kinds.push('shooter');
    if (wave >= 3) kinds.push('splitter');
    const weights = { chaser: 5, weaver: 4, shooter: 3, splitter: 3 };
    const queue = [];
    while (budget > 0) {
      const pool = kinds.filter((k) => ENEMY[k].cost <= budget);
      const kind = pick(rng, pool.flatMap((k) => Array(weights[k]).fill(k)));
      queue.push(kind);
      budget -= ENEMY[kind].cost;
    }
    return shuffle(rng, queue);
  }

  function spawnEnemy(kind) {
    const spec = ENEMY[kind];
    const at = edgeSpawnPoint(rng, world.player);
    const enemy = {
      kind,
      x: at.x,
      y: at.y,
      vx: 0,
      vy: 0,
      radius: spec.radius,
      hp: spec.hp + (world.wave >= 6 && (kind === 'splitter' || kind === 'shooter') ? 1 : 0),
      maxHp: spec.hp,
      speed: spec.speed * (1 + Math.min(0.5, (world.wave - 1) * 0.05)),
      score: spec.score,
      color: spec.color,
      t: range(rng, 0, TAU),
      shootCooldown: range(rng, 1.2, 2.4),
      flash: 0,
    };
    world.enemies.push(enemy);
  }

  function burst(x, y, color, count, speed) {
    for (let i = 0; i < count; i += 1) {
      const angle = rng() * TAU;
      const v = range(rng, speed * 0.3, speed);
      world.particles.push({
        x, y,
        vx: Math.cos(angle) * v,
        vy: Math.sin(angle) * v,
        life: range(rng, 0.3, 0.7),
        maxLife: 0.7,
        size: range(rng, 1.5, 3.5),
        color,
        drag: 0.92,
      });
    }
  }

  function addText(x, y, text, color, size = 14) {
    world.texts.push({ x, y, vy: -34, life: 0.9, maxLife: 0.9, text, color, size });
  }

  function dropPowerup(x, y) {
    if (rng() > POWERUP.dropChance) return;
    const kinds = ['shield', 'rapid', 'spread'];
    world.powerups.push({
      kind: pick(rng, kinds),
      x: Math.max(24, Math.min(FIELD.width - 24, x)),
      y: Math.max(24, Math.min(FIELD.height - 24, y)),
      radius: POWERUP.radius,
      life: POWERUP.lifeSeconds,
      t: 0,
    });
  }

  function killEnemy(enemy, index) {
    const mult = world.multiplier;
    const gained = enemy.score * mult;
    world.score += gained;
    world.kills += 1;
    world.combo += 1;
    world.comboTimer = COMBO.windowSeconds;
    world.multiplier = Math.min(1 + Math.floor(world.combo / COMBO.perTier), COMBO.maxMultiplier);
    addText(enemy.x, enemy.y - 10, `+${gained}`, mult > 1 ? '#ffd166' : '#e8f6ff', mult > 1 ? 17 : 14);
    burst(enemy.x, enemy.y, enemy.color, enemy.kind === 'splitter' ? 22 : 14, 260);
    if (enemy.kind === 'splitter') {
      for (let i = 0; i < 2; i += 1) {
        const angle = rng() * TAU;
        world.enemies.push({
          kind: 'mini',
          x: enemy.x + Math.cos(angle) * 14,
          y: enemy.y + Math.sin(angle) * 14,
          vx: Math.cos(angle) * 120,
          vy: Math.sin(angle) * 120,
          radius: ENEMY.mini.radius,
          hp: 1,
          maxHp: 1,
          speed: ENEMY.mini.speed,
          score: ENEMY.mini.score,
          color: ENEMY.mini.color,
          t: rng() * TAU,
          shootCooldown: 0,
          flash: 0,
        });
      }
    }
    dropPowerup(enemy.x, enemy.y);
    world.enemies.splice(index, 1);
    return enemy.kind === 'splitter' ? EVENT_BIG_EXPLOSION : EVENT_EXPLOSION;
  }

  function hurtPlayer(events) {
    const player = world.player;
    if (world.demo) return;
    if (player.invulnerable > 0 || !player.alive) return;
    if (player.shield) {
      player.shield = false;
      player.invulnerable = 1.2;
      burst(player.x, player.y, '#4cc9f0', 18, 300);
      addText(player.x, player.y - 22, 'SHIELD DOWN', '#4cc9f0', 15);
      events.push(EVENT_HURT);
      return;
    }
    world.lives -= 1;
    world.combo = 0;
    world.multiplier = 1;
    world.comboTimer = 0;
    world.shake = 1;
    burst(player.x, player.y, '#00f5d4', 30, 380);
    burst(player.x, player.y, '#ffffff', 12, 200);
    events.push(EVENT_HURT);
    if (world.lives <= 0) {
      player.alive = false;
      world.state = 'over';
      world.newBest = world.score > world.best;
      if (world.newBest) world.best = world.score;
      events.push(EVENT_GAME_OVER);
    } else {
      player.invulnerable = PLAYER.invulnerableSeconds;
      player.x = FIELD.width / 2;
      player.y = FIELD.height / 2;
      player.vx = 0;
      player.vy = 0;
      world.orbs.length = 0;
    }
  }

  function startWave(wave) {
    world.wave = wave;
    world.spawnQueue = buildSpawnQueue(wave);
    world.spawnTimer = 0.4;
    world.waveState = 'fighting';
    world.banner = `WAVE ${wave}`;
    world.bannerTimer = 1.6;
  }

  function updatePlayer(dt, input, events) {
    const player = world.player;
    if (!player.alive) return;
    const accel = 2400;
    player.vx += input.moveX * accel * dt;
    player.vy += input.moveY * accel * dt;
    const drag = Math.exp(-6 * dt);
    player.vx *= drag;
    player.vy *= drag;
    const speed = Math.hypot(player.vx, player.vy);
    const max = PLAYER.speed;
    if (speed > max) {
      player.vx = (player.vx / speed) * max;
      player.vy = (player.vy / speed) * max;
    }
    player.x = Math.max(player.radius, Math.min(FIELD.width - player.radius, player.x + player.vx * dt));
    player.y = Math.max(player.radius, Math.min(FIELD.height - player.radius, player.y + player.vy * dt));
    player.thrust = Math.min(1, speed / max);
    const dx = input.aimX - player.x;
    const dy = input.aimY - player.y;
    if (dx * dx + dy * dy > 4) player.angle = Math.atan2(dy, dx);
    if (player.invulnerable > 0) player.invulnerable -= dt;
    if (player.rapid > 0) player.rapid -= dt;
    if (player.spread > 0) player.spread -= dt;

    player.fireCooldown -= dt;
    if (input.firing && player.fireCooldown <= 0) {
      player.fireCooldown = player.rapid > 0 ? PLAYER.rapidFireInterval : PLAYER.fireInterval;
      const angles = player.spread > 0 ? [-0.16, 0, 0.16] : [0];
      for (const offset of angles) {
        const a = player.angle + offset;
        world.bullets.push({
          x: player.x + Math.cos(a) * (player.radius + 6),
          y: player.y + Math.sin(a) * (player.radius + 6),
          vx: Math.cos(a) * PLAYER.bulletSpeed + player.vx * 0.4,
          vy: Math.sin(a) * PLAYER.bulletSpeed + player.vy * 0.4,
          radius: PLAYER.bulletRadius,
          life: 1.1,
        });
      }
      burst(player.x + Math.cos(player.angle) * (player.radius + 6), player.y + Math.sin(player.angle) * (player.radius + 6), '#9bf6ff', 2, 60);
      events.push(EVENT_SHOOT);
    }
    if (player.thrust > 0.25) {
      const back = player.angle + Math.PI;
      world.particles.push({
        x: player.x + Math.cos(back) * player.radius,
        y: player.y + Math.sin(back) * player.radius,
        vx: Math.cos(back) * 90 + range(rng, -20, 20),
        vy: Math.sin(back) * 90 + range(rng, -20, 20),
        life: 0.28,
        maxLife: 0.28,
        size: range(rng, 1.5, 3),
        color: '#ff9f1c',
        drag: 0.94,
      });
    }
  }

  function updateEnemies(dt, events) {
    const player = world.player;
    for (let i = world.enemies.length - 1; i >= 0; i -= 1) {
      const e = world.enemies[i];
      e.t += dt;
      if (e.flash > 0) e.flash -= dt;
      const dx = player.x - e.x;
      const dy = player.y - e.y;
      const d = Math.hypot(dx, dy) || 1;
      const nx = dx / d;
      const ny = dy / d;
      if (e.kind === 'chaser' || e.kind === 'mini') {
        e.vx += nx * e.speed * 2.4 * dt;
        e.vy += ny * e.speed * 2.4 * dt;
      } else if (e.kind === 'weaver') {
        const px = -ny * Math.sin(e.t * 3.2);
        const py = nx * Math.sin(e.t * 3.2);
        e.vx += (nx * e.speed + px * e.speed * 0.9) * 2 * dt;
        e.vy += (ny * e.speed + py * e.speed * 0.9) * 2 * dt;
      } else if (e.kind === 'splitter') {
        e.vx += nx * e.speed * 1.6 * dt;
        e.vy += ny * e.speed * 1.6 * dt;
      } else if (e.kind === 'shooter') {
        const want = d > 280 ? 1 : d < 210 ? -1 : 0;
        e.vx += (nx * want * e.speed + -ny * 40 * Math.sin(e.t * 1.4)) * 2 * dt;
        e.vy += (ny * want * e.speed + nx * 40 * Math.sin(e.t * 1.4)) * 2 * dt;
        e.shootCooldown -= dt;
        if (e.shootCooldown <= 0 && d < 520 && player.alive) {
          e.shootCooldown = ENEMY.shootInterval * range(rng, 0.85, 1.2);
          world.orbs.push({
            x: e.x + nx * (e.radius + 8),
            y: e.y + ny * (e.radius + 8),
            vx: nx * ENEMY.orbSpeed,
            vy: ny * ENEMY.orbSpeed,
            radius: ENEMY.orbRadius,
            life: 4,
          });
          burst(e.x + nx * (e.radius + 8), e.y + ny * (e.radius + 8), '#ff4040', 3, 50);
        }
      }
      const es = Math.hypot(e.vx, e.vy);
      if (es > e.speed) {
        e.vx = (e.vx / es) * e.speed;
        e.vy = (e.vy / es) * e.speed;
      }
      e.vx *= Math.exp(-1.2 * dt);
      e.vy *= Math.exp(-1.2 * dt);
      e.x += e.vx * dt;
      e.y += e.vy * dt;
      e.x = Math.max(-40, Math.min(FIELD.width + 40, e.x));
      e.y = Math.max(-40, Math.min(FIELD.height + 40, e.y));

      // Touching the player hurts.
      if (player.alive && dist2(e.x, e.y, player.x, player.y) < (e.radius + player.radius - 2) ** 2) {
        const ev = killEnemy(e, i);
        events.push(ev);
        hurtPlayer(events);
        if (world.state === 'over') return;
      }
    }
  }

  function updateBullets(dt, events) {
    for (let i = world.bullets.length - 1; i >= 0; i -= 1) {
      const b = world.bullets[i];
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      b.life -= dt;
      if (b.life <= 0 || b.x < -20 || b.x > FIELD.width + 20 || b.y < -20 || b.y > FIELD.height + 20) {
        world.bullets.splice(i, 1);
        continue;
      }
      for (let j = world.enemies.length - 1; j >= 0; j -= 1) {
        const e = world.enemies[j];
        const rr = e.radius + b.radius;
        if (dist2(b.x, b.y, e.x, e.y) < rr * rr) {
          world.bullets.splice(i, 1);
          e.hp -= 1;
          e.flash = 0.09;
          burst(b.x, b.y, '#ffffff', 4, 140);
          if (e.hp <= 0) events.push(killEnemy(e, j));
          break;
        }
      }
    }
    for (let i = world.orbs.length - 1; i >= 0; i -= 1) {
      const o = world.orbs[i];
      o.x += o.vx * dt;
      o.y += o.vy * dt;
      o.life -= dt;
      if (o.life <= 0 || o.x < -20 || o.x > FIELD.width + 20 || o.y < -20 || o.y > FIELD.height + 20) {
        world.orbs.splice(i, 1);
        continue;
      }
      const player = world.player;
      if (player.alive && dist2(o.x, o.y, player.x, player.y) < (o.radius + player.radius - 2) ** 2) {
        world.orbs.splice(i, 1);
        burst(o.x, o.y, '#ff4040', 8, 180);
        hurtPlayer(events);
        if (world.state === 'over') return;
        // hurtPlayer clears the orb list when a life is lost, so the loop
        // must stop here: its indices are stale from this point on.
        break;
      }
    }
  }

  function updatePowerups(dt, events) {
    const player = world.player;
    for (let i = world.powerups.length - 1; i >= 0; i -= 1) {
      const p = world.powerups[i];
      p.t += dt;
      p.life -= dt;
      if (p.life <= 0) {
        world.powerups.splice(i, 1);
        continue;
      }
      if (player.alive && dist2(p.x, p.y, player.x, player.y) < (p.radius + player.radius + 4) ** 2) {
        world.powerups.splice(i, 1);
        if (p.kind === 'shield') {
          player.shield = true;
          addText(player.x, player.y - 24, 'SHIELD UP', '#4cc9f0', 16);
        } else if (p.kind === 'rapid') {
          player.rapid = POWERUP.rapidSeconds;
          addText(player.x, player.y - 24, 'RAPID FIRE', '#ffd166', 16);
        } else {
          player.spread = POWERUP.spreadSeconds;
          addText(player.x, player.y - 24, 'SPREAD SHOT', '#ff70a6', 16);
        }
        burst(p.x, p.y, '#ffffff', 10, 160);
        events.push(EVENT_PICKUP);
      }
    }
  }

  function updateParticles(dt) {
    for (let i = world.particles.length - 1; i >= 0; i -= 1) {
      const p = world.particles[i];
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vx *= p.drag;
      p.vy *= p.drag;
      p.life -= dt;
      if (p.life <= 0) world.particles.splice(i, 1);
    }
    for (let i = world.texts.length - 1; i >= 0; i -= 1) {
      const t = world.texts[i];
      t.y += t.vy * dt;
      t.life -= dt;
      if (t.life <= 0) world.texts.splice(i, 1);
    }
  }

  function updateSpawning(dt) {
    if (world.waveState === 'break') {
      world.breakTimer -= dt;
      if (world.breakTimer <= 0) {
        startWave(world.wave + 1);
        return [EVENT_WAVE_START];
      }
      return [];
    }
    if (world.spawnQueue.length > 0) {
      world.spawnTimer -= dt;
      if (world.spawnTimer <= 0) {
        world.spawnTimer = WAVES.spawnInterval;
        spawnEnemy(world.spawnQueue.shift());
      }
    } else if (world.enemies.length === 0 && world.player.alive) {
      const bonus = WAVES.clearBonus * world.wave;
      world.score += bonus;
      addText(FIELD.width / 2, FIELD.height / 2 - 60, `WAVE BONUS +${bonus}`, '#ffd166', 20);
      world.waveState = 'break';
      world.breakTimer = WAVES.breakSeconds;
      world.banner = 'WAVE CLEAR';
      world.bannerTimer = 1.6;
      return [EVENT_WAVE_CLEAR];
    }
    return [];
  }

  resetPlayer();
  startWave(1);
  world.state = 'title';
  world.demo = true;

  world.startGame = function startGame() {
    world.score = 0;
    world.wave = 1;
    world.lives = PLAYER.maxLives;
    world.combo = 0;
    world.comboTimer = 0;
    world.multiplier = 1;
    world.kills = 0;
    world.newBest = false;
    world.bullets.length = 0;
    world.enemies.length = 0;
    world.orbs.length = 0;
    world.particles.length = 0;
    world.texts.length = 0;
    world.powerups.length = 0;
    world.shake = 0;
    resetPlayer();
    startWave(1);
    world.state = 'playing';
    world.demo = false;
  };

  world.toTitle = function toTitle() {
    world.state = 'title';
    world.demo = true;
    world.bullets.length = 0;
    world.orbs.length = 0;
    world.powerups.length = 0;
    resetPlayer();
    startWave(1);
  };

  /** Advance the world by dt seconds. Returns sound events for this step. */
  world.step = function step(dt, input) {
    const events = [];
    world.time += dt;
    if (world.bannerTimer > 0) world.bannerTimer -= dt;
    if (world.shake > 0) world.shake = Math.max(0, world.shake - dt * 1.4);
    if (world.comboTimer > 0) {
      world.comboTimer -= dt;
      if (world.comboTimer <= 0) {
        world.combo = 0;
        world.multiplier = 1;
      }
    }
    if (world.state === 'paused' || world.state === 'over') {
      updateParticles(dt);
      return events;
    }
    updatePlayer(dt, input, events);
    updateEnemies(dt, events);
    if (world.state === 'over') {
      updateParticles(dt);
      return events;
    }
    updateBullets(dt, events);
    if (world.state === 'over') {
      updateParticles(dt);
      return events;
    }
    updatePowerups(dt, events);
    updateParticles(dt);
    events.push(...updateSpawning(dt));
    return events;
  };

  return world;
}
