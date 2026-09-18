// All drawing. The look is a golden-hour silhouette battlefield: dark shapes,
// coloured accents, layered parallax. Everything is vector — no image assets to
// load, which keeps the offline install tiny.

import { TOWER, AMMO } from './config.js';
import { clamp, lerp } from './util.js';
import { unitBoxes } from './world.js';

const SKY = [
  [0.00, '#1a2547'],
  [0.38, '#46527f'],
  [0.66, '#9c6f88'],
  [0.84, '#e0906a'],
  [1.00, '#f6c877'],
];

const INK = '#141a2b';
const INK_SOFT = '#1e2740';

export class Renderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d', { alpha: false });
    this.bg = document.createElement('canvas');
    this.bgKey = '';
    this.clouds = [];
    this.time = 0;
  }

  resize(cssW, cssH, dpr) {
    this.cssW = cssW;
    this.cssH = cssH;
    this.dpr = dpr;
    this.canvas.width = Math.round(cssW * dpr);
    this.canvas.height = Math.round(cssH * dpr);
    this.canvas.style.width = cssW + 'px';
    this.canvas.style.height = cssH + 'px';
  }

  // ---- background ---------------------------------------------------------
  buildBackground(w, h, groundY) {
    const key = `${Math.round(w)}x${Math.round(h)}x${Math.round(groundY)}`;
    if (this.bgKey === key) return;
    this.bgKey = key;
    const c = this.bg;
    c.width = Math.round(w);
    c.height = Math.round(h);
    const g = c.getContext('2d');

    const sky = g.createLinearGradient(0, 0, 0, groundY);
    for (const [stop, col] of SKY) sky.addColorStop(stop, col);
    g.fillStyle = sky;
    g.fillRect(0, 0, w, groundY + 2);

    // Sun low over the enemy horizon.
    const sunX = w * 0.74;
    const sunY = groundY - h * 0.055 - 26;
    const glow = g.createRadialGradient(sunX, sunY, 6, sunX, sunY, Math.max(w, h) * 0.34);
    glow.addColorStop(0, 'rgba(255,233,178,0.95)');
    glow.addColorStop(0.18, 'rgba(255,196,120,0.42)');
    glow.addColorStop(1, 'rgba(255,170,110,0)');
    g.fillStyle = glow;
    g.fillRect(0, 0, w, groundY + 2);
    g.fillStyle = '#ffeec2';
    g.beginPath();
    g.arc(sunX, sunY, Math.min(w, h) * 0.055, 0, Math.PI * 2);
    g.fill();

    // Three parallax ridges, each darker and closer.
    ridge(g, w, groundY, groundY - h * 0.20, '#3d4a72', 7, 11);
    ridge(g, w, groundY, groundY - h * 0.13, '#2c3760', 5, 23);
    ridge(g, w, groundY, groundY - h * 0.07, '#222b4c', 4, 41);

    // Treeline just behind the field.
    g.fillStyle = '#1b2340';
    for (let x = -20; x < w + 20; x += 17) {
      const hh = 16 + Math.abs(Math.sin(x * 0.37)) * 26;
      g.beginPath();
      g.moveTo(x, groundY + 2);
      g.lineTo(x + 8, groundY - hh);
      g.lineTo(x + 16, groundY + 2);
      g.closePath();
      g.fill();
    }

    // Ground.
    const dirt = g.createLinearGradient(0, groundY, 0, h);
    dirt.addColorStop(0, '#2e3350');
    dirt.addColorStop(0.12, '#232840');
    dirt.addColorStop(1, '#161a2c');
    g.fillStyle = dirt;
    g.fillRect(0, groundY, w, h - groundY);
    g.strokeStyle = 'rgba(255,208,150,0.30)';
    g.lineWidth = 2;
    g.beginPath();
    g.moveTo(0, groundY + 1);
    g.lineTo(w, groundY + 1);
    g.stroke();

    g.strokeStyle = 'rgba(255,255,255,0.05)';
    g.lineWidth = 1;
    for (let i = 0; i < 90; i++) {
      const x = (i * 97.3) % w;
      const y = groundY + 6 + ((i * 53.7) % Math.max(10, h - groundY - 6));
      g.beginPath();
      g.moveTo(x, y);
      g.lineTo(x + 10 + (i % 7), y);
      g.stroke();
    }

    if (!this.clouds.length) {
      for (let i = 0; i < 7; i++) {
        this.clouds.push({
          x: Math.random(), y: 0.08 + Math.random() * 0.4,
          s: 0.5 + Math.random() * 1.1, v: 0.0016 + Math.random() * 0.004,
        });
      }
    }
  }

  // ---- frame --------------------------------------------------------------
  draw(world, aim, dt) {
    const ctx = this.ctx;
    const { viewW, viewH, groundY } = world;
    const scale = this.cssW / viewW;
    this.time += dt;

    this.buildBackground(viewW, viewH, groundY);

    ctx.save();
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.scale(scale, scale);

    const shake = world.shake;
    if (shake > 0.2) {
      ctx.translate((Math.random() - 0.5) * shake, (Math.random() - 0.5) * shake);
    }

    ctx.drawImage(this.bg, 0, 0);
    this.drawClouds(ctx, viewW, viewH, groundY, dt);

    for (const s of world.stuck) this.drawStuckArrow(ctx, s);
    for (const c of world.corpses) this.drawCorpse(ctx, c);

    this.drawTower(ctx, world);

    // Back to front so closer units overlap correctly.
    const order = [...world.units].sort((a, b) => a.height - b.height);
    for (const u of order) this.drawUnit(ctx, u);

    this.drawArcher(ctx, world, aim);

    for (const p of world.hostile) this.drawHostile(ctx, p);
    for (const a of world.arrows) this.drawArrow(ctx, a);

    this.drawParticles(ctx, world);
    if (aim && aim.active) this.drawAimGuide(ctx, world, aim);
    this.drawCoins(ctx, world);
    this.drawFloaters(ctx, world);

    ctx.restore();
  }

  drawClouds(ctx, w, h, groundY, dt) {
    ctx.save();
    ctx.fillStyle = 'rgba(255,225,200,0.16)';
    for (const c of this.clouds) {
      c.x += c.v * dt;
      if (c.x > 1.25) c.x = -0.25;
      const x = c.x * w;
      const y = c.y * groundY * 0.72;
      const s = c.s * Math.min(w * 0.055, 58);
      ctx.beginPath();
      ctx.ellipse(x, y, s * 1.9, s * 0.42, 0, 0, Math.PI * 2);
      ctx.ellipse(x + s * 0.8, y - s * 0.2, s * 1.1, s * 0.38, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  // ---- keep ---------------------------------------------------------------
  drawTower(ctx, world) {
    const x = world.towerX;
    const y = world.towerTop;
    const w = TOWER.width;
    const h = TOWER.height;
    const ground = world.groundY;

    ctx.save();
    // Shadow on the dirt.
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.beginPath();
    ctx.ellipse(x + w / 2, ground + 4, w * 0.8, 9, 0, 0, Math.PI * 2);
    ctx.fill();

    const body = ctx.createLinearGradient(x, 0, x + w, 0);
    body.addColorStop(0, '#2b3350');
    body.addColorStop(0.55, '#1c2338');
    body.addColorStop(1, '#141a2b');
    ctx.fillStyle = body;
    ctx.fillRect(x, y, w, ground - y + 2);

    // Crenellations.
    ctx.fillStyle = '#323b5c';
    for (let i = 0; i < 5; i++) {
      const bx = x - 6 + i * ((w + 12) / 5);
      ctx.fillRect(bx, y - 18, (w + 12) / 5 - 5, 18);
    }
    ctx.fillStyle = '#242c46';
    ctx.fillRect(x - 8, y, w + 16, 10);

    // Stonework.
    ctx.strokeStyle = 'rgba(255,255,255,0.055)';
    ctx.lineWidth = 1;
    for (let row = 0; row < 9; row++) {
      const ry = y + 16 + row * 21;
      if (ry > ground) break;
      ctx.beginPath();
      ctx.moveTo(x, ry);
      ctx.lineTo(x + w, ry);
      ctx.stroke();
    }

    // Warm window.
    ctx.fillStyle = 'rgba(255,196,110,0.9)';
    ctx.fillRect(x + w * 0.36, y + 62, 14, 22);
    ctx.fillStyle = 'rgba(255,196,110,0.25)';
    ctx.fillRect(x + w * 0.36 - 5, y + 57, 24, 32);

    // Banner.
    const sway = Math.sin(this.time * 1.7) * 3;
    ctx.fillStyle = '#4ea8de';
    ctx.beginPath();
    ctx.moveTo(x + w * 0.5 - 12, y - 18);
    ctx.lineTo(x + w * 0.5 + 12 + sway, y - 26);
    ctx.lineTo(x + w * 0.5 + 12 + sway, y - 56);
    ctx.lineTo(x + w * 0.5 - 12, y - 48);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = '#8d9bb8';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(x + w * 0.5 - 13, y - 62);
    ctx.lineTo(x + w * 0.5 - 13, y - 4);
    ctx.stroke();

    if (world.tower.flash > 0) {
      ctx.fillStyle = `rgba(255,90,90,${world.tower.flash * 0.35})`;
      ctx.fillRect(x - 8, y - 18, w + 16, ground - y + 20);
    }
    ctx.restore();
  }

  drawArcher(ctx, world, aim) {
    const { x, y } = world.archer;
    const h = 64;
    const angle = aim ? aim.angle : -0.45;
    const draw = aim && aim.active ? aim.power : 0;

    ctx.save();
    ctx.translate(x, y);

    // Body.
    ctx.strokeStyle = INK;
    ctx.lineCap = 'round';
    ctx.lineWidth = h * 0.13;
    ctx.beginPath();
    ctx.moveTo(-4, -h * 0.02);
    ctx.lineTo(-2, -h * 0.34);
    ctx.moveTo(6, -h * 0.02);
    ctx.lineTo(2, -h * 0.34);
    ctx.stroke();

    ctx.lineWidth = h * 0.2;
    ctx.beginPath();
    ctx.moveTo(0, -h * 0.32);
    ctx.lineTo(1, -h * 0.68);
    ctx.stroke();

    ctx.fillStyle = INK;
    ctx.beginPath();
    ctx.arc(2, -h * 0.79, h * 0.115, 0, Math.PI * 2);
    ctx.fill();
    // Hood.
    ctx.beginPath();
    ctx.moveTo(-6, -h * 0.74);
    ctx.quadraticCurveTo(-2, -h * 0.95, 9, -h * 0.82);
    ctx.quadraticCurveTo(2, -h * 0.78, -6, -h * 0.74);
    ctx.fill();
    ctx.fillStyle = '#4ea8de';
    ctx.fillRect(-5, -h * 0.66, 11, 5);

    // Arms + bow, rotated to the aim.
    ctx.save();
    ctx.translate(2, -h * 0.6);
    ctx.rotate(angle);
    const pull = draw * 16;

    ctx.strokeStyle = '#c9a26b';
    ctx.lineWidth = 3.5;
    ctx.beginPath();
    ctx.arc(22, 0, 21, -2.0, 2.0);
    ctx.stroke();

    ctx.strokeStyle = 'rgba(240,240,240,0.85)';
    ctx.lineWidth = 1.4;
    const bx = 22 + Math.cos(-2.0) * 21;
    const by = Math.sin(-2.0) * 21;
    const bx2 = 22 + Math.cos(2.0) * 21;
    const by2 = Math.sin(2.0) * 21;
    ctx.beginPath();
    ctx.moveTo(bx, by);
    ctx.lineTo(14 - pull, 0);
    ctx.lineTo(bx2, by2);
    ctx.stroke();

    if (draw > 0) {
      ctx.strokeStyle = '#e9d9b8';
      ctx.lineWidth = 2.4;
      ctx.beginPath();
      ctx.moveTo(14 - pull, 0);
      ctx.lineTo(40 - pull, 0);
      ctx.stroke();
      ctx.fillStyle = '#dfe6f2';
      ctx.beginPath();
      ctx.moveTo(46 - pull, 0);
      ctx.lineTo(38 - pull, -3);
      ctx.lineTo(38 - pull, 3);
      ctx.closePath();
      ctx.fill();
    }

    ctx.strokeStyle = INK;
    ctx.lineWidth = h * 0.1;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(18, 0);
    ctx.moveTo(0, 2);
    ctx.lineTo(14 - pull, 0);
    ctx.stroke();
    ctx.restore();
    ctx.restore();
  }

  // ---- units --------------------------------------------------------------
  drawUnit(ctx, u) {
    ctx.save();
    const h = u.height;
    const top = u.y - h;

    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.beginPath();
    ctx.ellipse(u.x, u.y + 2, h * 0.3, h * 0.07, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.translate(u.x, u.y);
    ctx.scale(u.facing, 1);

    const frozen = u.slowT > 0;
    const ink = frozen ? '#2b4a68' : INK;

    switch (u.kind) {
      case 'rider': this.drawRider(ctx, u, h, ink); break;
      case 'siege': this.drawSiege(ctx, u, h, ink); break;
      case 'boss': this.drawBoss(ctx, u, h, ink); break;
      default: this.drawFoot(ctx, u, h, ink); break;
    }

    // Arrows still lodged in the body.
    for (const s of u.stuckArrows) {
      ctx.save();
      ctx.translate(s.dx, s.dy);
      ctx.rotate(u.facing === -1 ? Math.PI - s.angle : s.angle);
      ctx.strokeStyle = s.color;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(-16, 0);
      ctx.lineTo(2, 0);
      ctx.stroke();
      ctx.restore();
    }

    ctx.restore();

    if (u.hitFlash > 0) {
      ctx.save();
      ctx.globalAlpha = clamp(u.hitFlash, 0, 1) * 0.55;
      ctx.globalCompositeOperation = 'lighter';
      const b = unitBoxes(u);
      ctx.fillStyle = '#ffffff';
      for (const z of ['head', 'torso', 'legs']) {
        if (!b[z]) continue;
        ctx.fillRect(b[z][0], b[z][1], b[z][2] - b[z][0], b[z][3] - b[z][1]);
      }
      ctx.restore();
    }

    if (u.burnT > 0) {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.fillStyle = `rgba(255,140,50,${0.1 + Math.random() * 0.1})`;
      ctx.beginPath();
      ctx.ellipse(u.x, u.y - h * 0.5, h * 0.3, h * 0.6, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    if (u.hp < u.maxHp && !u.boss) this.drawHpBar(ctx, u, top);
  }

  drawHpBar(ctx, u, top) {
    const w = Math.max(22, u.height * 0.44);
    const x = u.x - w / 2;
    const y = top - 9;
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.fillRect(x - 1, y - 1, w + 2, 5);
    ctx.fillStyle = u.team === 'ally' ? '#4ea8de' : '#e0553f';
    ctx.fillRect(x, y, w * clamp(u.hp / u.maxHp, 0, 1), 3);
  }

  // Shared limb rig: one walk phase drives legs, arms and a body bob.
  limbs(ctx, u, h, ink, weapon) {
    const swing = u.state === 'walk' ? Math.sin(u.walk) : Math.sin(this.time * 2) * 0.12;
    const bob = u.state === 'walk' ? Math.abs(Math.cos(u.walk)) * h * 0.02 : 0;
    const hipY = -h * 0.42 - bob;
    const shoulderY = -h * 0.72 - bob;

    ctx.strokeStyle = ink;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    // Legs.
    ctx.lineWidth = h * 0.1;
    ctx.beginPath();
    ctx.moveTo(0, hipY);
    ctx.lineTo(swing * h * 0.22, 0);
    ctx.moveTo(0, hipY);
    ctx.lineTo(-swing * h * 0.22, 0);
    ctx.stroke();

    // Torso.
    ctx.lineWidth = h * 0.24;
    ctx.beginPath();
    ctx.moveTo(0, hipY + h * 0.02);
    ctx.lineTo(0, shoulderY);
    ctx.stroke();

    // Head.
    ctx.fillStyle = ink;
    ctx.beginPath();
    ctx.arc(0, shoulderY - h * 0.12, h * 0.105, 0, Math.PI * 2);
    ctx.fill();

    // Weapon arm.
    const strike = u.recoil > 0 ? (1 - u.recoil) : 1;
    ctx.save();
    ctx.translate(0, shoulderY + h * 0.03);
    ctx.rotate(lerp(-0.9, 0.35, strike) + (u.state === 'walk' ? swing * 0.2 : 0));
    ctx.strokeStyle = ink;
    ctx.lineWidth = h * 0.085;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(h * 0.26, 0);
    ctx.stroke();
    if (weapon) weapon(ctx, h);
    ctx.restore();

    return { shoulderY, hipY, bob };
  }

  drawFoot(ctx, u, h, ink) {
    const tint = u.tint;
    const isArcher = u.kind === 'archer';
    const isShield = u.kind === 'shield';

    const rig = this.limbs(ctx, u, h, ink, (c) => {
      c.strokeStyle = tint;
      c.lineWidth = h * 0.05;
      if (isArcher) {
        c.beginPath();
        c.arc(h * 0.3, 0, h * 0.18, -1.9, 1.9);
        c.stroke();
      } else if (u.kind === 'runner') {
        c.beginPath();
        c.moveTo(h * 0.24, 0);
        c.lineTo(h * 0.5, -h * 0.06);
        c.stroke();
      } else {
        // Sword.
        c.strokeStyle = '#cfd6e4';
        c.lineWidth = h * 0.055;
        c.beginPath();
        c.moveTo(h * 0.24, 0);
        c.lineTo(h * 0.58, -h * 0.16);
        c.stroke();
        c.strokeStyle = tint;
        c.lineWidth = h * 0.045;
        c.beginPath();
        c.moveTo(h * 0.2, h * 0.05);
        c.lineTo(h * 0.3, -h * 0.05);
        c.stroke();
      }
    });

    // Helmet plume in the unit colour — the main read at a glance.
    ctx.fillStyle = tint;
    ctx.beginPath();
    ctx.moveTo(-h * 0.02, rig.shoulderY - h * 0.2);
    ctx.quadraticCurveTo(h * 0.14, rig.shoulderY - h * 0.3, h * 0.02, rig.shoulderY - h * 0.1);
    ctx.quadraticCurveTo(-h * 0.06, rig.shoulderY - h * 0.16, -h * 0.02, rig.shoulderY - h * 0.2);
    ctx.fill();

    if (isShield) {
      ctx.save();
      ctx.fillStyle = tint;
      ctx.strokeStyle = 'rgba(255,255,255,0.35)';
      ctx.lineWidth = 2;
      const sx = h * 0.26;
      ctx.beginPath();
      ctx.moveTo(sx, -h * 0.86);
      ctx.lineTo(sx + h * 0.16, -h * 0.8);
      ctx.lineTo(sx + h * 0.16, -h * 0.4);
      ctx.quadraticCurveTo(sx + h * 0.08, -h * 0.2, sx, -h * 0.28);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.restore();
    }
  }

  drawRider(ctx, u, h, ink) {
    const gallop = Math.sin(u.walk * 1.4);
    ctx.save();
    // Horse.
    ctx.fillStyle = ink;
    ctx.beginPath();
    ctx.ellipse(-h * 0.04, -h * 0.34, h * 0.34, h * 0.16, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = ink;
    ctx.lineWidth = h * 0.06;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(-h * 0.2, -h * 0.28);
    ctx.lineTo(-h * 0.2 + gallop * h * 0.14, 0);
    ctx.moveTo(h * 0.16, -h * 0.28);
    ctx.lineTo(h * 0.16 - gallop * h * 0.14, 0);
    ctx.moveTo(-h * 0.1, -h * 0.3);
    ctx.lineTo(-h * 0.1 - gallop * h * 0.1, 0);
    ctx.moveTo(h * 0.24, -h * 0.3);
    ctx.lineTo(h * 0.24 + gallop * h * 0.1, 0);
    ctx.stroke();
    // Neck and head.
    ctx.lineWidth = h * 0.12;
    ctx.beginPath();
    ctx.moveTo(h * 0.24, -h * 0.4);
    ctx.lineTo(h * 0.4, -h * 0.56);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(h * 0.38, -h * 0.58);
    ctx.lineTo(h * 0.52, -h * 0.56);
    ctx.lineTo(h * 0.38, -h * 0.5);
    ctx.closePath();
    ctx.fill();
    // Tail.
    ctx.lineWidth = h * 0.05;
    ctx.beginPath();
    ctx.moveTo(-h * 0.36, -h * 0.42);
    ctx.quadraticCurveTo(-h * 0.5, -h * 0.34, -h * 0.46, -h * 0.16);
    ctx.stroke();

    // Rider.
    ctx.lineWidth = h * 0.15;
    ctx.beginPath();
    ctx.moveTo(-h * 0.02, -h * 0.44);
    ctx.lineTo(h * 0.02, -h * 0.74);
    ctx.stroke();
    ctx.fillStyle = ink;
    ctx.beginPath();
    ctx.arc(h * 0.03, -h * 0.82, h * 0.085, 0, Math.PI * 2);
    ctx.fill();
    // Lance.
    ctx.strokeStyle = u.tint;
    ctx.lineWidth = h * 0.035;
    ctx.beginPath();
    ctx.moveTo(-h * 0.12, -h * 0.62);
    ctx.lineTo(h * 0.62, -h * 0.5);
    ctx.stroke();
    ctx.fillStyle = u.tint;
    ctx.beginPath();
    ctx.moveTo(-h * 0.06, -h * 0.64);
    ctx.lineTo(-h * 0.22, -h * 0.68);
    ctx.lineTo(-h * 0.08, -h * 0.56);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  drawSiege(ctx, u, h, ink) {
    const load = clamp(1 - u.attackTimer / u.attackTime, 0, 1);
    ctx.save();
    ctx.strokeStyle = ink;
    ctx.fillStyle = ink;
    ctx.lineWidth = h * 0.07;
    ctx.lineCap = 'round';

    // Frame.
    ctx.beginPath();
    ctx.moveTo(-h * 0.3, -h * 0.16);
    ctx.lineTo(h * 0.28, -h * 0.16);
    ctx.lineTo(h * 0.16, -h * 0.5);
    ctx.lineTo(-h * 0.18, -h * 0.5);
    ctx.closePath();
    ctx.stroke();
    ctx.fillStyle = '#2a3148';
    ctx.fill();

    // Wheels.
    ctx.fillStyle = ink;
    for (const wx of [-h * 0.22, h * 0.2]) {
      ctx.beginPath();
      ctx.arc(wx, -h * 0.13, h * 0.14, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = u.tint;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(wx, -h * 0.13, h * 0.08, 0, Math.PI * 2);
      ctx.stroke();
    }

    // Throwing arm winds back as it reloads.
    ctx.save();
    ctx.translate(-h * 0.02, -h * 0.5);
    ctx.rotate(lerp(-2.4, -0.7, load));
    ctx.strokeStyle = u.tint;
    ctx.lineWidth = h * 0.07;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(h * 0.5, 0);
    ctx.stroke();
    ctx.fillStyle = '#6f7686';
    ctx.beginPath();
    ctx.arc(h * 0.54, 0, h * 0.1, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    ctx.restore();
  }

  drawBoss(ctx, u, h, ink) {
    const rig = this.limbs(ctx, u, h, ink, (c) => {
      c.strokeStyle = '#d8dde8';
      c.lineWidth = h * 0.05;
      c.beginPath();
      c.moveTo(h * 0.24, 0);
      c.lineTo(h * 0.72, -h * 0.2);
      c.stroke();
      c.fillStyle = u.tint;
      c.beginPath();
      c.moveTo(h * 0.5, -h * 0.12);
      c.lineTo(h * 0.76, -h * 0.24);
      c.lineTo(h * 0.58, -h * 0.02);
      c.closePath();
      c.fill();
    });

    // Cape.
    ctx.save();
    ctx.fillStyle = u.tint;
    ctx.globalAlpha = 0.9;
    const flap = Math.sin(this.time * 3) * h * 0.04;
    ctx.beginPath();
    ctx.moveTo(-h * 0.04, rig.shoulderY);
    ctx.quadraticCurveTo(-h * 0.34 + flap, rig.shoulderY + h * 0.3, -h * 0.22, -h * 0.02);
    ctx.lineTo(h * 0.02, -h * 0.05);
    ctx.closePath();
    ctx.fill();
    ctx.restore();

    // Horns.
    ctx.strokeStyle = u.tint;
    ctx.lineWidth = h * 0.035;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(-h * 0.07, rig.shoulderY - h * 0.16);
    ctx.quadraticCurveTo(-h * 0.16, rig.shoulderY - h * 0.3, -h * 0.05, rig.shoulderY - h * 0.28);
    ctx.moveTo(h * 0.07, rig.shoulderY - h * 0.16);
    ctx.quadraticCurveTo(h * 0.16, rig.shoulderY - h * 0.3, h * 0.05, rig.shoulderY - h * 0.28);
    ctx.stroke();
  }

  drawCorpse(ctx, c) {
    ctx.save();
    ctx.globalAlpha = clamp(c.life / 1.6, 0, 1) * 0.85;
    ctx.translate(c.x, c.y);
    ctx.rotate(c.angle);
    ctx.scale(c.facing, 1);
    ctx.strokeStyle = INK_SOFT;
    ctx.lineCap = 'round';
    ctx.lineWidth = c.height * 0.2;
    ctx.beginPath();
    ctx.moveTo(0, -c.height * 0.12);
    ctx.lineTo(0, -c.height * 0.66);
    ctx.stroke();
    ctx.lineWidth = c.height * 0.09;
    ctx.beginPath();
    ctx.moveTo(0, -c.height * 0.14);
    ctx.lineTo(c.height * 0.2, 0);
    ctx.moveTo(0, -c.height * 0.14);
    ctx.lineTo(-c.height * 0.16, -c.height * 0.02);
    ctx.stroke();
    ctx.fillStyle = INK_SOFT;
    ctx.beginPath();
    ctx.arc(0, -c.height * 0.76, c.height * 0.1, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = c.tint;
    ctx.globalAlpha *= 0.7;
    ctx.fillRect(-c.height * 0.06, -c.height * 0.56, c.height * 0.12, c.height * 0.06);
    ctx.restore();
  }

  // ---- projectiles --------------------------------------------------------
  drawArrow(ctx, a) {
    const angle = Math.atan2(a.vy, a.vx);
    const col = AMMO[a.ammo].color;

    if (a.trail.length > 3) {
      ctx.save();
      ctx.strokeStyle = col;
      ctx.globalAlpha = 0.28;
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(a.trail[0], a.trail[1]);
      for (let i = 2; i < a.trail.length; i += 2) ctx.lineTo(a.trail[i], a.trail[i + 1]);
      ctx.stroke();
      ctx.restore();
    }

    ctx.save();
    ctx.translate(a.x, a.y);
    ctx.rotate(angle);
    if (a.ammo !== 'normal') {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.fillStyle = col;
      ctx.globalAlpha = 0.35;
      ctx.beginPath();
      ctx.arc(0, 0, 9, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
    ctx.strokeStyle = '#e9d9b8';
    ctx.lineWidth = 2.2;
    ctx.beginPath();
    ctx.moveTo(-22, 0);
    ctx.lineTo(6, 0);
    ctx.stroke();
    ctx.fillStyle = col;
    ctx.beginPath();
    ctx.moveTo(12, 0);
    ctx.lineTo(4, -3.4);
    ctx.lineTo(4, 3.4);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = 'rgba(230,235,245,0.9)';
    ctx.beginPath();
    ctx.moveTo(-22, 0);
    ctx.lineTo(-15, -4);
    ctx.lineTo(-12, 0);
    ctx.lineTo(-15, 4);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  drawStuckArrow(ctx, s) {
    ctx.save();
    ctx.globalAlpha = clamp(s.life / 2.5, 0, 1) * 0.8;
    ctx.translate(s.x, s.y);
    ctx.rotate(clamp(s.angle, 0.45, 1.4)); // always leaning into the dirt
    ctx.strokeStyle = s.color;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(-22, 0);
    ctx.lineTo(0, 0);
    ctx.stroke();
    ctx.restore();
  }

  drawHostile(ctx, p) {
    ctx.save();
    ctx.translate(p.x, p.y);
    if (p.kind === 'boulder') {
      ctx.rotate(p.spin);
      ctx.fillStyle = '#6a6f80';
      ctx.beginPath();
      ctx.arc(0, 0, 9, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#4c5364';
      ctx.beginPath();
      ctx.arc(3, -2, 4, 0, Math.PI * 2);
      ctx.fill();
    } else {
      ctx.rotate(Math.atan2(p.vy, p.vx));
      ctx.strokeStyle = '#d98a6a';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(-14, 0);
      ctx.lineTo(6, 0);
      ctx.stroke();
    }
    ctx.restore();
  }

  drawParticles(ctx, world) {
    ctx.save();
    for (const p of world.particles) {
      const a = clamp(p.t / p.life, 0, 1);
      if (p.kind === 'blast') {
        ctx.globalCompositeOperation = 'lighter';
        ctx.globalAlpha = a * 0.7;
        const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, Math.max(1, p.r));
        g.addColorStop(0, 'rgba(255,240,200,0.9)');
        g.addColorStop(0.5, 'rgba(255,150,60,0.5)');
        g.addColorStop(1, 'rgba(255,90,40,0)');
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(p.x, p.y, Math.max(1, p.r), 0, Math.PI * 2);
        ctx.fill();
        ctx.globalCompositeOperation = 'source-over';
        continue;
      }
      ctx.globalAlpha = a;
      ctx.fillStyle = p.color;
      ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
    }
    ctx.restore();
  }

  drawCoins(ctx, world) {
    ctx.save();
    for (const c of world.coins) {
      ctx.globalAlpha = clamp(c.life, 0, 1);
      const w = Math.abs(Math.cos(c.life * 9)) * 7 + 2;
      ctx.fillStyle = '#ffd166';
      ctx.beginPath();
      ctx.ellipse(c.x, c.y, w * 0.5, 7, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#c9972f';
      ctx.beginPath();
      ctx.ellipse(c.x, c.y, w * 0.28, 4, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  drawFloaters(ctx, world) {
    ctx.save();
    ctx.textAlign = 'center';
    ctx.lineJoin = 'round';
    for (const f of world.floaters) {
      ctx.globalAlpha = clamp(f.life * 1.6, 0, 1);
      ctx.font = `800 ${f.size}px ui-rounded, "Avenir Next", system-ui, sans-serif`;
      ctx.lineWidth = 4;
      ctx.strokeStyle = 'rgba(8,10,18,0.85)';
      ctx.strokeText(f.text, f.x, f.y);
      ctx.fillStyle = f.color;
      ctx.fillText(f.text, f.x, f.y);
    }
    ctx.restore();
  }

  drawAimGuide(ctx, world, aim) {
    const pts = world.predict(aim.angle, aim.power, aim.guideTime);
    ctx.save();
    ctx.fillStyle = 'rgba(255,255,255,0.75)';
    for (let i = 0; i < pts.length; i += 3) {
      const t = i / pts.length;
      ctx.globalAlpha = 0.75 * (1 - t);
      ctx.beginPath();
      ctx.arc(pts[i].x, pts[i].y, 2.6 - t * 1.2, 0, Math.PI * 2);
      ctx.fill();
    }

    // Power ring at the bow.
    const { x, y } = world.bow;
    ctx.globalAlpha = 0.9;
    ctx.lineWidth = 4;
    ctx.strokeStyle = 'rgba(255,255,255,0.18)';
    ctx.beginPath();
    ctx.arc(x, y, 30, 0, Math.PI * 2);
    ctx.stroke();
    ctx.strokeStyle = aim.power > 0.92 ? '#ffd166' : '#8ef1c0';
    ctx.beginPath();
    ctx.arc(x, y, 30, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * aim.power);
    ctx.stroke();
    ctx.restore();
  }
}

function ridge(g, w, groundY, peakY, color, steps, seed) {
  g.fillStyle = color;
  g.beginPath();
  g.moveTo(-10, groundY + 2);
  const span = w + 20;
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const x = -10 + span * t;
    const n = Math.sin(t * 9.1 + seed) * 0.5 + Math.sin(t * 21.7 + seed * 1.7) * 0.28 + Math.sin(t * 3.3 + seed * 0.4) * 0.5;
    const y = lerp(groundY, peakY, 0.55 + n * 0.45);
    g.lineTo(x, y);
  }
  g.lineTo(w + 10, groundY + 2);
  g.closePath();
  g.fill();
}
