/* ==========================================================================
   SCENE — the hero's living pixel landscape, rendered at low resolution and
   upscaled with nearest-neighbour. Dithered dusk sky, moon, parallax
   mountains, a castle with flickering windows and waving flags, bats,
   embers, shooting stars, a roaming dragon, and lightning on click.
   ========================================================================== */
const Scene = (() => {
  const canvas = document.getElementById('scene');
  const hero = document.getElementById('hero');
  const ctx = canvas.getContext('2d');
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;

  const SKY = ['#06030d', '#0b0619', '#120a28', '#1b0e3a', '#26124a', '#341656', '#4a1b60', '#652264', '#862d63', '#a83c5e', '#c95454', '#e8744a'];
  const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map(v => (v + 0.5) / 16);

  let PX = 4, W = 0, H = 0, M = 0, groundY = 0, U = 1;
  let sky, far, mid, near;
  let moon = { x: 0, y: 0, r: 0 };
  let windows = [], flags = [];
  let stars = [], clouds = [], embers = [], bats = [], fire = [], shooting = [], bolts = [];
  let dragon = null, dragonTimer = 3.5, batTimer = 5, shootTimer = 2.5;
  let flash = 0, t = 0, mx = 0, tmx = 0, scrollOff = 0;
  let visible = true, running = false, last = 0, hasMouse = false;

  const dragonBody = renderSprite(SPRITES.dragon);
  const dragonWing = renderSprite(SPRITES.wing);
  const dragonWingBack = renderSprite(SPRITES.wing, { map: { R: '#7a1f2b', r: '#4a1020', p: '#2c1030' } });
  const batFrames = SPRITES.bat.map(f => renderSprite(f, { map: { N: '#0a0610' } }));

  /* ---------- helpers ---------- */
  function rng(seed) {
    return () => {
      seed = (seed + 0x6D2B79F5) | 0;
      let x = Math.imul(seed ^ (seed >>> 15), 1 | seed);
      x = (x + Math.imul(x ^ (x >>> 7), 61 | x)) ^ x;
      return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
    };
  }
  const R = Math.random;
  const hex = h => { const n = parseInt(h.slice(1), 16); return [n >> 16, (n >> 8) & 255, n & 255]; };
  function layer(w, h) {
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    return [c, c.getContext('2d')];
  }
  function noise1(rand, len) {
    const pts = Array.from({ length: len + 2 }, rand);
    return x => {
      const i = Math.floor(x), f = x - i, u = (1 - Math.cos(f * Math.PI)) / 2;
      return pts[i % pts.length] * (1 - u) + pts[(i + 1) % pts.length] * u;
    };
  }
  // Bresenham — keeps lightning crisp on the pixel grid
  function pixLine(g, x0, y0, x1, y1, s = 1) {
    x0 |= 0; y0 |= 0; x1 |= 0; y1 |= 0;
    const dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0);
    const sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
    let err = dx + dy;
    for (;;) {
      g.fillRect(x0 - (s >> 1), y0 - (s >> 1), s, s);
      if (x0 === x1 && y0 === y1) break;
      const e2 = 2 * err;
      if (e2 >= dy) { err += dy; x0 += sx; }
      if (e2 <= dx) { err += dx; y0 += sy; }
    }
  }

  /* ---------- static layers ---------- */
  function buildSky() {
    const [c, g] = layer(W, H);
    const img = g.createImageData(W, H);
    const cols = SKY.map(hex), n = cols.length - 1;
    for (let y = 0; y < H; y++) {
      const base = Math.pow(Math.min(1, y / groundY), 1.35) * n;
      for (let x = 0; x < W; x++) {
        const dx = x - moon.x, dy = y - moon.y;
        const glow = Math.max(0, 1 - Math.sqrt(dx * dx + dy * dy) / (moon.r * 5));
        let v = Math.min(n, base + glow * glow * 3.2);
        let i = Math.floor(v);
        if (v - i > BAYER[(y & 3) * 4 + (x & 3)]) i = Math.min(n, i + 1);
        const p = (y * W + x) * 4, cc = cols[i];
        img.data[p] = cc[0]; img.data[p + 1] = cc[1]; img.data[p + 2] = cc[2]; img.data[p + 3] = 255;
      }
    }
    g.putImageData(img, 0, 0);

    // moon with shaded limb and craters
    const { x: mxp, y: myp, r } = moon;
    const craters = [[-0.3, -0.2, 0.2], [0.28, 0.3, 0.15], [0.1, -0.5, 0.1], [-0.42, 0.38, 0.12], [0.45, -0.15, 0.08]];
    for (let j = -r; j <= r; j++) {
      for (let i = -r; i <= r; i++) {
        if (i * i + j * j > r * r) continue;
        let col = '#f8ebc6';
        if ((i - r * 0.32) ** 2 + (j + r * 0.32) ** 2 > r * r * 1.05) col = '#d7bd88';
        for (const [cx, cy, cr] of craters) {
          const d = (i - cx * r) ** 2 + (j - cy * r) ** 2, rr = (cr * r) ** 2;
          if (d < rr) col = d < rr * 0.45 ? '#c9ab74' : '#e4cf9c';
        }
        g.fillStyle = col;
        g.fillRect(mxp + i, myp + j, 1, 1);
      }
    }
    sky = c;
  }

  function ridgeLayer(seed, base, amp, detail, colors, extra) {
    const LW = W + M * 2;
    const [c, g] = layer(LW, H);
    const rand = rng(seed);
    const n1 = noise1(rand, 256), n2 = noise1(rand, 1024);
    const tops = [];
    for (let x = 0; x < LW; x++) {
      tops[x] = Math.round(base - n1(x / (W * 0.16)) * amp - n2(x / (W * 0.035)) * detail);
    }
    if (extra?.shape) extra.shape(tops, LW);
    for (let x = 0; x < LW; x++) {
      g.fillStyle = colors.body;
      g.fillRect(x, tops[x], 1, H - tops[x]);
      if (colors.snow && tops[x] < colors.snowLine) {
        g.fillStyle = colors.snow;
        g.fillRect(x, tops[x], 1, 2 + ((x * 7) % 3));
      }
      if (colors.rim && x < LW - 1 && tops[x + 1] > tops[x]) {
        g.fillStyle = colors.rim;
        g.fillRect(x, tops[x], 1, Math.min(4, tops[x + 1] - tops[x] + 1));
      }
    }
    if (extra?.draw) extra.draw(g, tops, LW);
    return c;
  }

  function drawCastle(g, cx, by) {
    const u = U;
    const C = '#130a20', RIM = '#3d2a5e', ROOF = '#2c0f26', ROOF_LIT = '#5e2342';
    windows = []; flags = [];
    const rect = (x, y, w, h, col = C) => { g.fillStyle = col; g.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h)); };
    const merlons = (x, y, w) => { for (let i = 0; i + 2 * u <= w; i += 3 * u) rect(x + i, y - 2 * u, 2 * u, 2 * u); };
    const block = (x, w, h, crenel = true) => {
      rect(x, by - h, w, h);
      rect(x + w - u, by - h, u, h, RIM);
      if (crenel) merlons(x, by - h, w);
    };
    const roof = (x, w, h) => {
      const rh = Math.round(w * 1.4), top = by - h - rh;
      for (let r = 0; r < rh; r++) {
        const half = Math.max(1, Math.round((w / 2 + u) * (r + 1) / rh));
        rect(x + w / 2 - half, top + r, half, 1, ROOF);
        rect(x + w / 2, top + r, half, 1, ROOF_LIT);
      }
      const ax = Math.round(x + w / 2), pole = 6 * u;
      rect(ax, top - pole, 1, pole, '#6a7590');
      flags.push({ x: ax + 1, y: top - pole, w: 5 * u + 1, h: 2 * u + 1 });
    };
    const win = (x, y) => windows.push({ x: Math.round(x), y: Math.round(y), w: u, h: 2 * u, p: R() * 10, on: R() > 0.25 });

    // curtain wall
    block(cx - 27 * u, 54 * u, 22 * u);
    // towers (x offset, width, height, roofed?)
    const towers = [[-35, 9, 38, true], [-21, 8, 50, true], [-12, 24, 42, false], [-4, 8, 64, true], [13, 8, 50, true], [26, 9, 38, true]];
    for (const [ox, w, h, roofed] of towers) {
      const x = cx + ox * u;
      block(x, w * u, h * u, !roofed);
      if (roofed) roof(x, w * u, h * u);
      for (let k = 0; k < (h > 45 ? 3 : 2); k++) win(x + (w * u) / 2 - u / 2, by - h * u + 7 * u + k * 9 * u);
    }
    // keep windows
    for (let k = 0; k < 4; k++) win(cx - 9 * u + k * 6 * u, by - 34 * u);
    // gate with portcullis
    const gw = 7 * u, gh = 11 * u, gx = cx - gw / 2 + 0.5;
    for (let r = 0; r < gh; r++) {
      const inset = r < 3 * u ? Math.round((3 * u - r) * 0.8) : 0;
      rect(gx + inset, by - gh + r, gw - inset * 2, 1, '#05030a');
    }
    for (let i = u; i < gw; i += 2 * u) rect(gx + i, by - gh + 2 * u, 1, gh - 2 * u, '#2a2238');
  }

  function buildLayers() {
    far = ridgeLayer(7, groundY * 0.74, H * 0.2, H * 0.05,
      { body: '#24143c', rim: '#4b3270', snow: '#9c8cc4', snowLine: groundY * 0.5 });

    const castleX = M + Math.round(W * (W * PX < 760 ? 0.5 : 0.72));
    const castleBase = Math.round(groundY * 0.9);
    mid = ridgeLayer(21, groundY * 0.95, H * 0.07, H * 0.015,
      { body: '#160c27', rim: '#2e1d4a' },
      {
        shape(tops) {
          const half = 44 * U, ramp = 30 * U;
          const x0 = Math.max(0, castleX - half - ramp), x1 = Math.min(tops.length - 1, castleX + half + ramp);
          for (let x = x0; x <= x1; x++) {
            const d = Math.abs(x - castleX);
            const k = d <= half ? 1 : 1 - (d - half) / ramp;
            tops[x] = Math.round(tops[x] * (1 - k) + castleBase * k);
          }
        },
        draw(g) { drawCastle(g, castleX, castleBase); },
      });

    near = ridgeLayer(99, groundY + H * 0.03, H * 0.035, H * 0.01, { body: '#08050f' }, {
      draw(g, tops, LW) {
        const rand = rng(5);
        g.fillStyle = '#08050f';
        const count = Math.round(LW / 7);
        for (let i = 0; i < count; i++) {
          const x = Math.round(rand() * LW);
          const edge = Math.abs(x - LW / 2) / (LW / 2); // 0 centre … 1 edge
          if (rand() > edge * 1.3 + 0.08) continue;
          const h = Math.round((12 + rand() * 26) * (H / 220) * (0.6 + edge * 0.7));
          const base = tops[Math.min(LW - 1, x)] + 2;
          const tier = Math.max(3, Math.ceil(h / 3));
          for (let r = 0; r < h; r++) {
            const hw = Math.round(0.5 + (r % tier) * 0.55 + r * 0.14);
            g.fillRect(x - hw, base - h + r, hw * 2 + 1, 1);
          }
        }
      },
    });
  }

  function seedParticles() {
    stars = [];
    const n = Math.round((W * groundY) / 140);
    for (let i = 0; i < n; i++) {
      const x = Math.floor(R() * W), y = Math.floor(Math.pow(R(), 1.6) * groundY * 0.7);
      if ((x - moon.x) ** 2 + (y - moon.y) ** 2 < (moon.r * 2.2) ** 2) continue;
      stars.push({ x, y, p: R() * 6.28, s: 0.6 + R() * 2.5, big: R() < 0.06 });
    }
    clouds = [];
    for (let i = 0; i < 6; i++) clouds.push(makeCloud(R() * W));
    embers = [];
  }

  function makeCloud(x) {
    const parts = [], len = 3 + Math.floor(R() * 4);
    let cx = 0;
    for (let i = 0; i < len; i++) {
      const w = Math.round((10 + R() * 18) * U), h = Math.round((3 + R() * 5) * U);
      parts.push({ dx: cx, dy: -h, w, h });
      cx += Math.round(w * (0.4 + R() * 0.3));
    }
    return { x, y: Math.round(groundY * (0.12 + R() * 0.35)), v: 1.5 + R() * 3, parts, width: cx + 30 };
  }

  /* ---------- actors ---------- */
  function spawnDragon(breathe = false) {
    const dir = R() < 0.5 ? 1 : -1;
    dragon = {
      dir, x: dir > 0 ? -40 : W + 40,
      y: groundY * (0.18 + R() * 0.25),
      speed: Math.max(40, W / (7 + R() * 3)),
      t: 0, fire: 0, fireAt: breathe ? 0.6 : 1.2 + R() * 2.5,
    };
    if (breathe) Chip.sfx.roar();
  }

  function updateDragon(dt) {
    const d = dragon;
    d.t += dt;
    d.x += d.dir * d.speed * dt;
    const yy = d.y + Math.sin(d.t * 2.2) * 4;
    if (d.fireAt > 0 && d.t > d.fireAt && d.x > 10 && d.x < W - 10) {
      d.fire = 0.9; d.fireAt = -1;
      Chip.sfx.fire();
    }
    if (d.fire > 0) {
      d.fire -= dt;
      for (let i = 0; i < 6; i++) {
        fire.push({
          x: d.x + 13 * d.dir, y: yy - 2,
          vx: d.dir * (50 + R() * 50) + d.dir * d.speed * 0.5, vy: 10 + R() * 30 - 12,
          life: 0.35 + R() * 0.4, max: 0.75,
        });
      }
    }
    if ((d.dir > 0 && d.x > W + 50) || (d.dir < 0 && d.x < -50)) {
      dragon = null;
      dragonTimer = 9 + R() * 10;
    }
    return yy;
  }

  function drawDragon(yy) {
    const d = dragon;
    ctx.save();
    ctx.translate(Math.round(d.x), Math.round(yy));
    ctx.scale(d.dir, 1);
    const flap = Math.sin(d.t * 10);
    ctx.save(); ctx.translate(2, -1); ctx.scale(1, Math.sin(d.t * 10 + 0.5)); ctx.drawImage(dragonWingBack, -14, -9); ctx.restore();
    ctx.drawImage(dragonBody, -14, -6);
    ctx.save(); ctx.translate(-1, 0); ctx.scale(1, flap); ctx.drawImage(dragonWing, -14, -9); ctx.restore();
    ctx.restore();
  }

  function spawnBats() {
    const n = 3 + Math.floor(R() * 5), y = groundY * (0.35 + R() * 0.25);
    const dir = R() < 0.5 ? 1 : -1;
    for (let i = 0; i < n; i++) {
      bats.push({
        x: dir > 0 ? -10 - i * 9 - R() * 8 : W + 10 + i * 9 + R() * 8,
        y: y + (R() - 0.5) * 20, vx: dir * (30 + R() * 25), p: R() * 6, a: 3 + R() * 6,
      });
    }
  }

  function lightning(clientX) {
    const rect = canvas.getBoundingClientRect();
    const x0 = clientX != null ? (clientX - rect.left) / PX : R() * W;
    const segs = [];
    const branch = (x, y, len, spread, depth) => {
      for (let i = 0; i < len && y < groundY; i++) {
        const nx = x + (R() - 0.5) * spread, ny = y + 2 + R() * 5;
        segs.push([x, y, nx, ny, depth]);
        if (depth === 0 && R() < 0.12) branch(nx, ny, 6 + R() * 12, spread * 1.4, 1);
        x = nx; y = ny;
      }
      return x;
    };
    branch(x0 + (R() - 0.5) * 30, 0, 200, 9, 0);
    bolts.push({ segs, life: 0.4 });
    flash = reduce ? 0.35 : 1;
    setTimeout(() => Chip.sfx.thunder(), 60);
    if (!dragon && R() < 0.35) spawnDragon(true);
  }

  /* ---------- frame ---------- */
  function frame(now) {
    if (!running) return;
    requestAnimationFrame(frame);
    const dt = Math.min(0.05, (now - last) / 1000 || 0);
    last = now;
    t += dt;

    if (!hasMouse) tmx = Math.sin(t * 0.25) * 0.35;
    mx += (tmx - mx) * Math.min(1, dt * 3);
    scrollOff = Math.min(H, (window.scrollY || 0) / PX);

    const farX = Math.round(-M - mx * M * 0.3), midX = Math.round(-M - mx * M * 0.6), nearX = Math.round(-M - mx * M);
    const skyY = Math.round(scrollOff * 0.6), farY = Math.round(scrollOff * 0.45), midY = Math.round(scrollOff * 0.3);

    ctx.fillStyle = SKY[0];
    ctx.fillRect(0, 0, W, H);
    ctx.drawImage(sky, 0, skyY);

    // stars
    for (const s of stars) {
      const b = (Math.sin(t * s.s + s.p) + 1) / 2;
      if (b < 0.15) continue;
      ctx.fillStyle = b > 0.8 ? '#ffffff' : b > 0.45 ? '#c9b8ff' : '#6f5aa8';
      const y = s.y + skyY;
      ctx.fillRect(s.x, y, 1, 1);
      if (s.big && b > 0.7) {
        ctx.fillStyle = '#8f7cd0';
        ctx.fillRect(s.x - 1, y, 1, 1); ctx.fillRect(s.x + 1, y, 1, 1);
        ctx.fillRect(s.x, y - 1, 1, 1); ctx.fillRect(s.x, y + 1, 1, 1);
      }
    }

    // shooting stars
    if ((shootTimer -= dt) < 0) {
      shootTimer = 3 + R() * 6;
      shooting.push({ x: R() * W * 0.8, y: R() * groundY * 0.3, vx: 90 + R() * 80, vy: 30 + R() * 30, life: 0.7 });
    }
    shooting = shooting.filter(s => {
      s.x += s.vx * dt; s.y += s.vy * dt; s.life -= dt;
      for (let i = 0; i < 8; i++) {
        ctx.globalAlpha = Math.max(0, s.life) * (1 - i / 8);
        ctx.fillStyle = i < 2 ? '#fff' : '#b9a6ff';
        ctx.fillRect(Math.round(s.x - s.vx * i * 0.012), Math.round(s.y - s.vy * i * 0.012) + skyY, 1, 1);
      }
      ctx.globalAlpha = 1;
      return s.life > 0;
    });

    // lightning flash lights up the sky behind the silhouettes
    if (flash > 0) {
      ctx.fillStyle = `rgba(210,200,255,${flash * 0.55})`;
      ctx.fillRect(0, 0, W, H);
    }

    // clouds
    for (const c of clouds) {
      c.x += c.v * dt;
      if (c.x > W + 10) Object.assign(c, makeCloud(-c.width));
      for (const p of c.parts) {
        const x = Math.round(c.x + p.dx), y = c.y + p.dy + skyY;
        ctx.fillStyle = '#2a1844';
        ctx.fillRect(x, y, p.w, p.h);
        ctx.fillStyle = '#4b2f6e';
        ctx.fillRect(x + 1, y, p.w - 2, 1);
      }
    }

    ctx.drawImage(far, farX, farY);

    // bolts drawn between far & mid so the castle stays in front
    bolts = bolts.filter(b => {
      b.life -= dt;
      const on = b.life > 0.25 || Math.floor(b.life * 30) % 2 === 0;
      if (on) {
        for (const [x0, y0, x1, y1, d] of b.segs) {
          ctx.fillStyle = '#7d63d6';
          pixLine(ctx, x0, y0 + skyY, x1, y1 + skyY, d ? 1 : 3);
        }
        ctx.fillStyle = '#ffffff';
        for (const [x0, y0, x1, y1] of b.segs) pixLine(ctx, x0, y0 + skyY, x1, y1 + skyY, 1);
      }
      return b.life > 0;
    });

    // castle layer + live windows + flags
    ctx.drawImage(mid, midX, midY);
    for (const w of windows) {
      if (R() < 0.002) w.on = !w.on;
      if (!w.on) continue;
      const f = Math.sin(t * 9 + w.p) + Math.sin(t * 23 + w.p * 3);
      ctx.fillStyle = f > 1.2 ? '#fff1a8' : f > -0.8 ? '#ffc94a' : '#ff8a2e';
      ctx.fillRect(w.x + midX, w.y + midY, w.w, w.h);
    }
    for (const f of flags) {
      for (let i = 0; i < f.w; i++) {
        const dy = Math.round(Math.sin(t * 7 - i * 0.9) * (i / f.w) * 1.6);
        ctx.fillStyle = i === f.w - 1 ? '#7a1f2b' : '#c83737';
        ctx.fillRect(f.x + i + midX, f.y + dy + midY, 1, f.h - (i === f.w - 1 ? 1 : 0));
      }
    }

    // bats
    if ((batTimer -= dt) < 0) { batTimer = 7 + R() * 9; spawnBats(); }
    bats = bats.filter(b => {
      b.x += b.vx * dt;
      const fr = batFrames[Math.floor(t * 12 + b.p) % 2];
      ctx.save();
      ctx.translate(Math.round(b.x), Math.round(b.y + Math.sin(t * 5 + b.p) * b.a) + midY);
      if (b.vx < 0) ctx.scale(-1, 1);
      ctx.drawImage(fr, -3, -2);
      ctx.restore();
      return b.x > -40 && b.x < W + 40;
    });

    // dragon
    if (!dragon && (dragonTimer -= dt) < 0) spawnDragon();
    if (dragon) drawDragon(updateDragon(dt));
    fire = fire.filter(p => {
      p.life -= dt;
      p.x += p.vx * dt; p.y += p.vy * dt; p.vy -= 20 * dt;
      const k = p.life / p.max;
      ctx.fillStyle = k > 0.75 ? '#fff6c2' : k > 0.5 ? '#ffd95a' : k > 0.25 ? '#ff8a1e' : '#c83737';
      const s = k > 0.5 ? 2 : 1;
      ctx.fillRect(Math.round(p.x), Math.round(p.y), s, s);
      return p.life > 0;
    });

    // fog — thin drifting wisps
    ctx.fillStyle = '#d7b6f0';
    for (let i = 0; i < 4; i++) {
      const fy = Math.round(groundY * (0.84 + i * 0.04)) + midY;
      ctx.globalAlpha = 0.035 + i * 0.012;
      for (let x = -60; x < W + 60; x += 26) {
        const ox = ((x + t * (5 + i * 3)) % (W + 120)) - 60;
        const h = 1 + Math.round((Math.sin(x * 0.17 + i * 2) + 1) * 0.8);
        ctx.fillRect(Math.round(ox), fy - h, 18 + ((x * 7) % 14), h);
      }
    }
    ctx.globalAlpha = 1;

    ctx.drawImage(near, nearX, 0);

    // embers rising from the forest
    if (embers.length < 70 && R() < dt * 18) {
      embers.push({ x: R() * W, y: H + 2, vy: 8 + R() * 16, p: R() * 6, life: 4 + R() * 5 });
    }
    embers = embers.filter(e => {
      e.y -= e.vy * dt; e.life -= dt;
      const x = Math.round(e.x + Math.sin(t * 1.5 + e.p) * 6);
      if (Math.sin(t * 13 + e.p * 5) > -0.4) {
        ctx.globalAlpha = Math.min(1, e.life / 2);
        ctx.fillStyle = e.p > 3 ? '#ffb347' : '#ff6a2a';
        ctx.fillRect(x, Math.round(e.y), 1, 1);
      }
      ctx.globalAlpha = 1;
      return e.life > 0 && e.y > -4;
    });

    if (flash > 0) {
      ctx.fillStyle = `rgba(255,255,255,${flash * 0.18})`;
      ctx.fillRect(0, 0, W, H);
      flash = Math.max(0, flash - dt * 3);
    }
  }

  /* ---------- lifecycle ---------- */
  function resize() {
    PX = innerWidth < 700 ? 3 : 4;
    W = Math.ceil(hero.clientWidth / PX);
    H = Math.ceil(hero.clientHeight / PX);
    canvas.width = W; canvas.height = H;
    ctx.imageSmoothingEnabled = false;
    M = Math.ceil(W * 0.06);
    U = Math.max(1, Math.round(H / 230));
    groundY = Math.round(H * 0.84);
    moon = { x: Math.round(W * (W < 250 ? 0.78 : 0.8)), y: Math.round(groundY * 0.24), r: Math.max(8, Math.round(Math.min(W, H) * 0.07)) };
    buildSky();
    buildLayers();
    seedParticles();
  }

  function start() {
    if (running) return;
    running = true;
    last = performance.now();
    requestAnimationFrame(frame);
  }
  function stop() { running = false; }

  let rt;
  addEventListener('resize', () => { clearTimeout(rt); rt = setTimeout(resize, 150); });
  addEventListener('mousemove', e => { hasMouse = true; tmx = (e.clientX / innerWidth) * 2 - 1; }, { passive: true });
  new IntersectionObserver(([e]) => {
    visible = e.isIntersecting;
    if (visible && !document.hidden) start(); else stop();
  }).observe(hero);
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) stop(); else if (visible) start();
  });

  resize();
  start();

  return { lightning, spawnDragon: () => { if (!dragon) spawnDragon(true); } };
})();
