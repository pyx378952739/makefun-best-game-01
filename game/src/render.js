// NEON VOID — rendering. Everything is drawn on one canvas: the starfield,
// the ships, the HUD and the title / pause / game-over screens, so a
// screenshot always shows the whole game. Glow is baked into offscreen
// sprites once, then blitted, which keeps the frame cheap.
import { FIELD } from './config.js';

const TAU = Math.PI * 2;

function makeSprite(size, draw) {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  ctx.translate(size / 2, size / 2);
  draw(ctx, size);
  return canvas;
}

function glowCircle(ctx, radius, color, inner = '#ffffff') {
  const g = ctx.createRadialGradient(0, 0, 0, 0, 0, radius);
  g.addColorStop(0, inner);
  g.addColorStop(0.35, color);
  g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(0, 0, radius, 0, TAU);
  ctx.fill();
}

export function createRenderer(canvas) {
  const ctx = canvas.getContext('2d');
  const W = FIELD.width;
  const H = FIELD.height;

  // --- Baked sprites -------------------------------------------------------
  const shipSprite = makeSprite(72, (c) => {
    glowCircle(c, 34, 'rgba(0,245,212,0.55)');
    c.rotate(0);
    c.fillStyle = '#00f5d4';
    c.strokeStyle = '#e8fffb';
    c.lineWidth = 1.5;
    c.beginPath();
    c.moveTo(20, 0);
    c.lineTo(-12, -11);
    c.lineTo(-6, 0);
    c.lineTo(-12, 11);
    c.closePath();
    c.fill();
    c.stroke();
    c.fillStyle = '#062a26';
    c.beginPath();
    c.arc(4, 0, 4.5, 0, TAU);
    c.fill();
  });

  const enemySprites = {};
  // Build each sprite directly with a radial gradient glow behind the shape.
  function spriteWithGlow(size, glow, shape) {
    return makeSprite(size, (c) => {
      const g = c.createRadialGradient(0, 0, 0, 0, 0, size / 2);
      g.addColorStop(0, glow);
      g.addColorStop(1, 'rgba(0,0,0,0)');
      c.fillStyle = g;
      c.beginPath();
      c.arc(0, 0, size / 2, 0, TAU);
      c.fill();
      shape(c);
    });
  }
  enemySprites.chaser = spriteWithGlow(84, 'rgba(255,45,120,0.45)', (c) => {
    c.fillStyle = '#ff2d78';
    c.strokeStyle = '#ffd7e6';
    c.lineWidth = 1.5;
    c.beginPath();
    c.moveTo(15, 0);
    c.lineTo(-11, -12);
    c.lineTo(-5, 0);
    c.lineTo(-11, 12);
    c.closePath();
    c.fill();
    c.stroke();
  });
  enemySprites.weaver = spriteWithGlow(84, 'rgba(255,159,28,0.45)', (c) => {
    c.fillStyle = '#ff9f1c';
    c.strokeStyle = '#ffedc2';
    c.lineWidth = 1.5;
    c.beginPath();
    c.moveTo(0, -14);
    c.lineTo(13, 0);
    c.lineTo(0, 14);
    c.lineTo(-13, 0);
    c.closePath();
    c.fill();
    c.stroke();
    c.fillStyle = '#7a3c00';
    c.beginPath();
    c.arc(0, 0, 4, 0, TAU);
    c.fill();
  });
  enemySprites.splitter = spriteWithGlow(96, 'rgba(181,55,242,0.45)', (c) => {
    c.fillStyle = '#b537f2';
    c.strokeStyle = '#ecd9ff';
    c.lineWidth = 1.5;
    c.beginPath();
    for (let i = 0; i < 6; i += 1) {
      const a = (i / 6) * TAU - Math.PI / 2;
      const x = Math.cos(a) * 17;
      const y = Math.sin(a) * 17;
      if (i === 0) c.moveTo(x, y);
      else c.lineTo(x, y);
    }
    c.closePath();
    c.fill();
    c.stroke();
    c.fillStyle = '#3d0a5e';
    c.beginPath();
    c.arc(0, 0, 6, 0, TAU);
    c.fill();
  });
  enemySprites.mini = spriteWithGlow(64, 'rgba(255,93,162,0.5)', (c) => {
    c.fillStyle = '#ff5da2';
    c.beginPath();
    c.arc(0, 0, 8, 0, TAU);
    c.fill();
    c.fillStyle = '#fff';
    c.beginPath();
    c.arc(0, 0, 3, 0, TAU);
    c.fill();
  });
  enemySprites.shooter = spriteWithGlow(88, 'rgba(255,64,64,0.45)', (c) => {
    c.fillStyle = '#ff4040';
    c.strokeStyle = '#ffd2d2';
    c.lineWidth = 1.5;
    c.fillRect(-12, -12, 24, 24);
    c.strokeRect(-12, -12, 24, 24);
    c.fillStyle = '#5e0a0a';
    c.beginPath();
    c.arc(0, 0, 5, 0, TAU);
    c.fill();
  });
  const bulletSprite = spriteWithGlow(48, 'rgba(155,246,255,0.6)', (c) => {
    c.fillStyle = '#d9fbff';
    c.beginPath();
    c.ellipse(0, 0, 9, 3.2, 0, 0, TAU);
    c.fill();
  });
  const orbSprite = spriteWithGlow(56, 'rgba(255,64,64,0.6)', (c) => {
    c.fillStyle = '#ff6b6b';
    c.beginPath();
    c.arc(0, 0, 6, 0, TAU);
    c.fill();
    c.fillStyle = '#fff';
    c.beginPath();
    c.arc(0, 0, 2.5, 0, TAU);
    c.fill();
  });
  const powerSprites = {
    shield: spriteWithGlow(72, 'rgba(76,201,240,0.55)', (c) => {
      c.strokeStyle = '#4cc9f0';
      c.lineWidth = 2.5;
      c.beginPath();
      c.arc(0, 0, 12, 0, TAU);
      c.stroke();
      c.fillStyle = '#4cc9f0';
      c.font = 'bold 15px system-ui, sans-serif';
      c.textAlign = 'center';
      c.textBaseline = 'middle';
      c.fillText('S', 0, 1);
    }),
    rapid: spriteWithGlow(72, 'rgba(255,209,102,0.55)', (c) => {
      c.strokeStyle = '#ffd166';
      c.lineWidth = 2.5;
      c.beginPath();
      c.arc(0, 0, 12, 0, TAU);
      c.stroke();
      c.fillStyle = '#ffd166';
      c.beginPath();
      c.moveTo(2, -10);
      c.lineTo(-5, 1);
      c.lineTo(0, 1);
      c.lineTo(-2, 10);
      c.lineTo(6, -1);
      c.lineTo(1, -1);
      c.closePath();
      c.fill();
    }),
    spread: spriteWithGlow(72, 'rgba(255,112,166,0.55)', (c) => {
      c.strokeStyle = '#ff70a6';
      c.lineWidth = 2.5;
      c.beginPath();
      c.arc(0, 0, 12, 0, TAU);
      c.stroke();
      c.fillStyle = '#ff70a6';
      for (const a of [-0.5, 0, 0.5]) {
        c.beginPath();
        c.arc(Math.sin(a) * 7, -Math.cos(a) * 7, 2.6, 0, TAU);
        c.fill();
      }
    }),
  };

  // Nebula backdrop, baked once.
  const nebula = document.createElement('canvas');
  nebula.width = W;
  nebula.height = H;
  {
    const n = nebula.getContext('2d');
    const blobs = [
      [220, 140, 260, 'rgba(64,40,160,0.20)'],
      [760, 420, 300, 'rgba(16,90,110,0.18)'],
      [560, 110, 200, 'rgba(150,30,90,0.13)'],
      [120, 480, 220, 'rgba(20,60,140,0.15)'],
    ];
    for (const [x, y, r, color] of blobs) {
      const g = n.createRadialGradient(x, y, 0, x, y, r);
      g.addColorStop(0, color);
      g.addColorStop(1, 'rgba(0,0,0,0)');
      n.fillStyle = g;
      n.fillRect(0, 0, W, H);
    }
  }

  function drawBackground(world) {
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, '#070716');
    g.addColorStop(0.55, '#0a0a26');
    g.addColorStop(1, '#12082a');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
    ctx.drawImage(nebula, 0, 0);
    for (const s of world.stars) {
      const twinkle = 0.55 + 0.45 * Math.sin(world.time * s.speed + s.phase);
      ctx.globalAlpha = twinkle * (0.5 + s.layer * 0.2);
      ctx.fillStyle = '#dfe9ff';
      ctx.fillRect(s.x, s.y, s.size, s.size);
    }
    ctx.globalAlpha = 1;
  }

  function drawPlayer(world) {
    const p = world.player;
    if (!p.alive) return;
    if (p.invulnerable > 0 && Math.floor(world.time * 14) % 2 === 0 && world.state === 'playing') {
      ctx.globalAlpha = 0.35; // blink while invulnerable
    }
    // Engine flame.
    if (p.thrust > 0.2) {
      const back = p.angle + Math.PI;
      const len = 14 + Math.random() * 10 * p.thrust;
      const gx = p.x + Math.cos(back) * 14;
      const gy = p.y + Math.sin(back) * 14;
      const grad = ctx.createLinearGradient(gx, gy, gx + Math.cos(back) * len, gy + Math.sin(back) * len);
      grad.addColorStop(0, 'rgba(255,190,80,0.9)');
      grad.addColorStop(1, 'rgba(255,80,40,0)');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.moveTo(gx + Math.cos(p.angle + Math.PI / 2) * 4, gy + Math.sin(p.angle + Math.PI / 2) * 4);
      ctx.lineTo(gx + Math.cos(back) * len, gy + Math.sin(back) * len);
      ctx.lineTo(gx + Math.cos(p.angle - Math.PI / 2) * 4, gy + Math.sin(p.angle - Math.PI / 2) * 4);
      ctx.closePath();
      ctx.fill();
    }
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate(p.angle);
    ctx.drawImage(shipSprite, -36, -36);
    ctx.restore();
    if (p.shield) {
      ctx.strokeStyle = 'rgba(76,201,240,0.85)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.radius + 9 + Math.sin(world.time * 5) * 1.5, 0, TAU);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }

  function drawEnemies(world) {
    for (const e of world.enemies) {
      const sprite = enemySprites[e.kind];
      const size = sprite.width;
      ctx.save();
      ctx.translate(e.x, e.y);
      if (e.kind === 'chaser' || e.kind === 'mini') {
        const p = world.player;
        ctx.rotate(Math.atan2(p.y - e.y, p.x - e.x));
      } else if (e.kind === 'weaver') {
        ctx.rotate(Math.sin(e.t * 3.2) * 0.5);
      } else if (e.kind === 'splitter') {
        ctx.rotate(e.t * 0.8);
      }
      ctx.drawImage(sprite, -size / 2, -size / 2);
      ctx.restore();
      if (e.flash > 0) {
        ctx.globalAlpha = 0.7;
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(e.x, e.y, e.radius, 0, TAU);
        ctx.fill();
        ctx.globalAlpha = 1;
      }
      if (e.maxHp > 1) {
        const w = e.radius * 2;
        ctx.fillStyle = 'rgba(255,255,255,0.25)';
        ctx.fillRect(e.x - e.radius, e.y - e.radius - 9, w, 3);
        ctx.fillStyle = '#ff5d8f';
        ctx.fillRect(e.x - e.radius, e.y - e.radius - 9, w * (e.hp / e.maxHp), 3);
      }
    }
  }

  function drawBullets(world) {
    for (const b of world.bullets) {
      ctx.save();
      ctx.translate(b.x, b.y);
      ctx.rotate(Math.atan2(b.vy, b.vx));
      ctx.drawImage(bulletSprite, -24, -24);
      ctx.restore();
    }
    for (const o of world.orbs) {
      ctx.drawImage(orbSprite, o.x - 28, o.y - 28);
    }
  }

  function drawPowerups(world) {
    for (const p of world.powerups) {
      const blink = p.life < 2 ? (Math.floor(world.time * 8) % 2 === 0 ? 0.35 : 1) : 1;
      ctx.globalAlpha = blink;
      const bob = Math.sin(p.t * 3) * 3;
      ctx.drawImage(powerSprites[p.kind], p.x - 36, p.y - 36 + bob);
      ctx.globalAlpha = 1;
    }
  }

  function drawParticles(world) {
    for (const p of world.particles) {
      ctx.globalAlpha = Math.max(0, p.life / p.maxLife);
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, TAU);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    for (const t of world.texts) {
      ctx.globalAlpha = Math.max(0, t.life / t.maxLife);
      ctx.font = `bold ${t.size}px system-ui, sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = t.color;
      ctx.fillText(t.text, t.x, t.y);
    }
    ctx.globalAlpha = 1;
  }

  function drawHud(world) {
    ctx.textBaseline = 'alphabetic';
    ctx.fillStyle = 'rgba(4,6,20,0.55)';
    ctx.fillRect(0, 0, W, 46);
    ctx.fillStyle = '#e8f6ff';
    ctx.font = 'bold 20px system-ui, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(`SCORE ${world.score.toLocaleString('en-US')}`, 16, 30);
    ctx.font = '13px system-ui, sans-serif';
    ctx.fillStyle = '#8fa8c8';
    ctx.fillText(`BEST ${Math.max(world.best, world.score).toLocaleString('en-US')}`, 16, 44);
    ctx.textAlign = 'center';
    ctx.fillStyle = '#ffd166';
    ctx.font = 'bold 17px system-ui, sans-serif';
    ctx.fillText(`WAVE ${world.wave}`, W / 2, 29);
    if (world.multiplier > 1) {
      ctx.fillStyle = '#ff70a6';
      ctx.font = 'bold 15px system-ui, sans-serif';
      ctx.fillText(`COMBO x${world.multiplier}`, W / 2, 44 - 2);
    }
    ctx.textAlign = 'right';
    for (let i = 0; i < world.lives; i += 1) {
      ctx.save();
      ctx.translate(W - 24 - i * 30, 23);
      ctx.rotate(-Math.PI / 2);
      ctx.drawImage(shipSprite, -18, -18, 36, 36);
      ctx.restore();
    }
    // Active power-up timers.
    const p = world.player;
    let barY = 56;
    ctx.textAlign = 'right';
    if (p.rapid > 0) {
      ctx.fillStyle = 'rgba(255,209,102,0.9)';
      ctx.font = 'bold 12px system-ui, sans-serif';
      ctx.fillText(`RAPID ${p.rapid.toFixed(0)}s`, W - 16, barY);
      barY += 15;
    }
    if (p.spread > 0) {
      ctx.fillStyle = 'rgba(255,112,166,0.9)';
      ctx.font = 'bold 12px system-ui, sans-serif';
      ctx.fillText(`SPREAD ${p.spread.toFixed(0)}s`, W - 16, barY);
      barY += 15;
    }
    if (p.shield) {
      ctx.fillStyle = 'rgba(76,201,240,0.9)';
      ctx.font = 'bold 12px system-ui, sans-serif';
      ctx.fillText('SHIELD', W - 16, barY);
    }
    ctx.textAlign = 'left';
    ctx.fillStyle = 'rgba(143,168,200,0.85)';
    ctx.font = '12px system-ui, sans-serif';
    ctx.fillText('WASD move  ·  Mouse aim  ·  Click / Space shoot  ·  P pause  ·  M mute', 16, H - 12);
  }

  function drawBanner(world) {
    if (world.bannerTimer <= 0 || !world.banner) return;
    const alpha = Math.min(1, world.bannerTimer);
    ctx.globalAlpha = alpha;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = 'bold 44px system-ui, sans-serif';
    ctx.fillStyle = '#ffffff';
    ctx.shadowColor = '#00f5d4';
    ctx.shadowBlur = 24;
    ctx.fillText(world.banner, W / 2, H / 2 - 40);
    ctx.shadowBlur = 0;
    ctx.globalAlpha = 1;
  }

  function panel(x, y, w, h) {
    ctx.fillStyle = 'rgba(5,8,26,0.72)';
    ctx.strokeStyle = 'rgba(0,245,212,0.35)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, 14);
    ctx.fill();
    ctx.stroke();
  }

  function drawTitle(world) {
    drawBackground(world);
    // Demo dogfight behind the panel.
    drawEnemies(world);
    drawBullets(world);
    drawParticles(world);
    ctx.fillStyle = 'rgba(4,6,20,0.45)';
    ctx.fillRect(0, 0, W, H);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const grad = ctx.createLinearGradient(W / 2 - 220, 0, W / 2 + 220, 0);
    grad.addColorStop(0, '#00f5d4');
    grad.addColorStop(0.5, '#9bf6ff');
    grad.addColorStop(1, '#ff70a6');
    ctx.font = 'bold 84px system-ui, sans-serif';
    ctx.fillStyle = grad;
    ctx.shadowColor = '#00f5d4';
    ctx.shadowBlur = 30;
    ctx.fillText('NEON VOID', W / 2, 150);
    ctx.shadowBlur = 0;
    ctx.font = '20px system-ui, sans-serif';
    ctx.fillStyle = '#c8d8f0';
    ctx.fillText('Survive the swarm. Chain kills. Chase the combo.', W / 2, 205);
    panel(W / 2 - 250, 250, 500, 168);
    ctx.fillStyle = '#e8f6ff';
    ctx.font = 'bold 16px system-ui, sans-serif';
    ctx.fillText('HOW TO PLAY', W / 2, 282);
    ctx.font = '15px system-ui, sans-serif';
    ctx.fillStyle = '#b8c8e0';
    const lines = [
      'WASD / Arrow keys — fly your ship',
      'Mouse — aim    ·    Click / Space — fire',
      'Destroy enemies to build your combo multiplier',
      'Grab S shield, lightning rapid fire, triple spread',
      'Survive every wave. 3 lives. No mercy.',
    ];
    lines.forEach((line, i) => ctx.fillText(line, W / 2, 312 + i * 24));
    const pulse = 0.8 + 0.2 * Math.sin(world.time * 4);
    ctx.globalAlpha = pulse;
    ctx.font = 'bold 22px system-ui, sans-serif';
    ctx.fillStyle = '#ffd166';
    ctx.fillText('CLICK OR PRESS ENTER TO START', W / 2, 470);
    ctx.globalAlpha = 1;
    ctx.font = '13px system-ui, sans-serif';
    ctx.fillStyle = '#8fa8c8';
    ctx.fillText(`BEST ${world.best.toLocaleString('en-US')}`, W / 2, 510);
  }

  function drawPaused() {
    ctx.fillStyle = 'rgba(4,6,20,0.6)';
    ctx.fillRect(0, 0, W, H);
    panel(W / 2 - 190, H / 2 - 90, 380, 180);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = 'bold 40px system-ui, sans-serif';
    ctx.fillStyle = '#e8f6ff';
    ctx.fillText('PAUSED', W / 2, H / 2 - 38);
    ctx.font = '16px system-ui, sans-serif';
    ctx.fillStyle = '#b8c8e0';
    ctx.fillText('P or Esc — resume', W / 2, H / 2 + 12);
    ctx.fillText('R — restart from wave 1', W / 2, H / 2 + 38);
  }

  function drawGameOver(world) {
    drawBackground(world);
    drawParticles(world);
    ctx.fillStyle = 'rgba(4,6,20,0.55)';
    ctx.fillRect(0, 0, W, H);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = 'bold 64px system-ui, sans-serif';
    ctx.fillStyle = '#ff5d8f';
    ctx.shadowColor = '#ff2d78';
    ctx.shadowBlur = 26;
    ctx.fillText('GAME OVER', W / 2, 150);
    ctx.shadowBlur = 0;
    panel(W / 2 - 230, 210, 460, 190);
    ctx.fillStyle = '#8fa8c8';
    ctx.font = '15px system-ui, sans-serif';
    ctx.fillText('FINAL SCORE', W / 2, 240);
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 46px system-ui, sans-serif';
    ctx.fillText(world.score.toLocaleString('en-US'), W / 2, 282);
    ctx.fillStyle = '#ffd166';
    ctx.font = 'bold 17px system-ui, sans-serif';
    ctx.fillText(`WAVE ${world.wave}  ·  ${world.kills} KILLS`, W / 2, 326);
    if (world.newBest) {
      ctx.fillStyle = '#00f5d4';
      ctx.font = 'bold 18px system-ui, sans-serif';
      ctx.fillText('★ NEW BEST ★', W / 2, 362);
    } else {
      ctx.fillStyle = '#8fa8c8';
      ctx.font = '15px system-ui, sans-serif';
      ctx.fillText(`BEST ${world.best.toLocaleString('en-US')}`, W / 2, 362);
    }
    const pulse = 0.8 + 0.2 * Math.sin(world.time * 4);
    ctx.globalAlpha = pulse;
    ctx.font = 'bold 22px system-ui, sans-serif';
    ctx.fillStyle = '#ffd166';
    ctx.fillText('PRESS R OR CLICK TO PLAY AGAIN', W / 2, 452);
    ctx.globalAlpha = 1;
  }

  function draw(world) {
    ctx.save();
    if (world.shake > 0) {
      const s = world.shake * world.shake * 13;
      ctx.translate((Math.random() - 0.5) * s, (Math.random() - 0.5) * s);
    }
    if (world.state === 'title') {
      drawTitle(world);
      ctx.restore();
      return;
    }
    if (world.state === 'over') {
      drawGameOver(world);
      ctx.restore();
      return;
    }
    drawBackground(world);
    drawPowerups(world);
    drawPlayer(world);
    drawEnemies(world);
    drawBullets(world);
    drawParticles(world);
    drawHud(world);
    drawBanner(world);
    if (world.state === 'paused') drawPaused();
    ctx.restore();
  }

  return { draw };
}
