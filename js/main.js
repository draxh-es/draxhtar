/* ==========================================================================
   MAIN — gate, HUD, particles, achievements, reveals, dialogs, the raven,
   and a few secrets.
   ========================================================================== */
const CONFIG = {
  email: 'chisaiomer@gmail.com', // ← where the raven delivers letters
  roles: ['Embedded Software Engineer', 'C Wizard', 'CAN Bus Whisperer', 'Bug Slayer', 'Register Tamer (self-taught)'],
};

const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const R = Math.random;
const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
const finePointer = matchMedia('(pointer: fine)').matches;
const root = document.documentElement;

const store = {
  get(k, d) { try { const v = localStorage.getItem('dx:' + k); return v == null ? d : JSON.parse(v); } catch { return d; } },
  set(k, v) { try { localStorage.setItem('dx:' + k, JSON.stringify(v)); } catch { /* private mode */ } },
};

function shake(ms = 400) {
  if (reduce) return;
  root.classList.add('quake');
  clearTimeout(shake.t);
  shake.t = setTimeout(() => root.classList.remove('quake'), ms);
}

/* ---------- cursor: a pixel sword ---------- */
if (finePointer) {
  const sword = renderSprite(SPRITES.sword, { outline: '#140c1c', scale: 2 }).toDataURL();
  const gold = renderSprite(SPRITES.sword, { outline: '#140c1c', scale: 2, map: { W: '#fff6c2', S: '#ffd95a' } }).toDataURL();
  root.style.setProperty('--cursor', `url(${sword}) 2 2, auto`);
  root.style.setProperty('--cursor-hover', `url(${gold}) 2 2, pointer`);
}

/* ==========================================================================
   FX overlay — low-res full-screen canvas for particles and flying actors
   ========================================================================== */
const FX = (() => {
  const c = $('#fx'), g = c.getContext('2d');
  const PX = 3;
  let w = 0, h = 0, parts = [], actors = [], dirty = false, last = performance.now();
  const FIRE = ['#c83737', '#ff8a1e', '#ffd95a', '#fff6c2'];

  function resize() {
    w = c.width = Math.ceil(innerWidth / PX);
    h = c.height = Math.ceil(innerHeight / PX);
    g.imageSmoothingEnabled = false;
  }
  resize();
  addEventListener('resize', resize);

  function spark(x, y, o = {}) {
    const n = reduce ? Math.ceil((o.n || 16) / 4) : (o.n || 16);
    const colors = o.colors || ['#fff6c2', '#ffd95a', '#ff8a1e'];
    const speed = o.speed || 70, life = o.life || 0.6;
    for (let i = 0; i < n; i++) {
      const a = o.angle != null ? o.angle + (R() - 0.5) * (o.spread || 1) : R() * Math.PI * 2;
      const s = speed * (0.35 + R() * 0.8);
      parts.push({
        x: x / PX, y: y / PX, vx: Math.cos(a) * s, vy: Math.sin(a) * s - (o.lift ?? speed * 0.3),
        g: o.gravity ?? 140, life: life * (0.6 + R() * 0.6), max: life,
        color: colors[i % colors.length], size: o.size || 1, fire: !!o.fire,
      });
    }
  }

  function loop(now) {
    requestAnimationFrame(loop);
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    if (!parts.length && !actors.length) {
      if (dirty) { g.clearRect(0, 0, w, h); dirty = false; }
      return;
    }
    dirty = true;
    g.clearRect(0, 0, w, h);
    actors = actors.filter(a => a.update(dt, g) !== false);
    parts = parts.filter(p => {
      p.life -= dt;
      p.vy += p.g * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      const k = Math.max(0, p.life / p.max);
      g.globalAlpha = Math.ceil(Math.min(1, k * 1.5) * 4) / 4; // stepped fade
      g.fillStyle = p.fire ? FIRE[Math.min(3, Math.floor(k * 4))] : p.color;
      g.fillRect(Math.round(p.x), Math.round(p.y), p.size, p.size);
      return p.life > 0 && p.y < h + 10;
    });
    g.globalAlpha = 1;
  }
  requestAnimationFrame(loop);

  return { spark, add: a => actors.push(a), parts, PX, get w() { return w; }, get h() { return h; } };
})();

/* coin that pops out of something, Mario style */
const coinSprite = renderSprite(SPRITES.coin, { outline: '#140c1c' });
function coinPop(x, y) {
  let xx = x / FX.PX, yy = y / FX.PX, vy = -170, t = 0;
  FX.add({
    update(dt, g) {
      t += dt; vy += 520 * dt; yy += vy * dt;
      g.save();
      g.translate(Math.round(xx), Math.round(yy));
      g.scale(Math.max(0.2, Math.abs(Math.cos(t * 16))), 1);
      g.drawImage(coinSprite, -5, -5);
      g.restore();
      if (t > 0.5) { FX.spark(xx * FX.PX, yy * FX.PX, { n: 10, speed: 60, colors: ['#ffe27a', '#fff'] }); return false; }
    },
  });
}

/* ---------- global sparks, ember trail, UI sounds ---------- */
addEventListener('pointerdown', e => FX.spark(e.clientX, e.clientY, { n: 14 }));
if (finePointer && !reduce) {
  let lastTrail = 0;
  addEventListener('mousemove', e => {
    const now = performance.now();
    if (now - lastTrail < 28) return;
    lastTrail = now;
    FX.spark(e.clientX, e.clientY, { n: 1, speed: 12, gravity: -30, lift: 4, life: 0.7, colors: [R() < 0.5 ? '#ff8a1e' : '#ffd95a'] });
  }, { passive: true });
}
let hovered = null;
document.addEventListener('mouseover', e => {
  const el = e.target.closest('a, button');
  if (el && el !== hovered) Chip.sfx.hover();
  hovered = el;
});
document.addEventListener('click', e => { if (e.target.closest('a, button')) Chip.sfx.click(); });

/* ==========================================================================
   TORCHES — tiny procedural flames, redrawn at a choppy 12fps
   ========================================================================== */
(() => {
  const torches = $$('canvas.torch').map(c => ({ c, g: c.getContext('2d'), seed: R() * 100, vis: false }));
  const io = new IntersectionObserver(es => es.forEach(e => {
    const t = torches.find(t => t.c === e.target);
    if (t) t.vis = e.isIntersecting;
  }));
  torches.forEach(t => io.observe(t.c));

  function draw(t, time) {
    const g = t.g;
    g.clearRect(0, 0, 10, 22);
    g.fillStyle = '#5f6a85'; g.fillRect(2, 12, 6, 2);
    g.fillStyle = '#3f2312'; g.fillRect(4, 13, 2, 9);
    g.fillStyle = '#6b3e1e'; g.fillRect(4, 13, 1, 9);
    for (let y = 0; y < 13; y++) {
      const k = y / 12;
      const hw = Math.max(0, Math.round(Math.sin(k * Math.PI * 0.92) * 3.2 + (R() * 1.4 - 0.7)));
      const cx = 5 + Math.round(Math.sin(time * 9 + y * 0.7 + t.seed) * (1 - k) * 1.3);
      for (let x = cx - hw; x < cx + hw; x++) {
        const d = Math.abs(x + 0.5 - cx) / Math.max(1, hw);
        g.fillStyle = d < 0.4 && k > 0.45 ? '#fff6c2' : d < 0.75 && k > 0.2 ? '#ffd95a' : k < 0.35 ? '#c83737' : '#ff8a1e';
        g.fillRect(x, y, 1, 1);
      }
    }
  }
  torches.forEach(t => draw(t, 0));
  let acc = 0, last = performance.now();
  (function loop(now) {
    requestAnimationFrame(loop);
    acc += now - last; last = now;
    if (acc < 83) return;
    acc = 0;
    torches.forEach(t => t.vis && draw(t, now / 1000));
  })(last);
})();

/* ==========================================================================
   ACHIEVEMENTS + TOASTS
   ========================================================================== */
const ACH = [
  ['start', 'A HERO APPEARS', 'Pressed start. The quest begins.'],
  ['tale', 'LORE KEEPER', "Read the hero's tale."],
  ['skills', 'SKILL CHECK', 'Inspected the skill tree.'],
  ['quests', 'QUEST GIVER', 'Opened the quest log.'],
  ['tower', 'THE LAST TOWER', 'Reached the raven tower.'],
  ['lore', 'BOOKWORM', 'Read the lore of a quest.'],
  ['raven', 'RAVEN MASTER', 'Sent a raven to the tower.'],
  ['storm', 'STORM CALLER', 'Summoned 5 lightning bolts.'],
  ['bonk', 'LETTER BONKER', 'Bonked every letter of the name.'],
  ['coins', 'BIG SPENDER', 'Inserted 10 coins.'],
  ['bard', "BARD'S EAR", 'Turned on the music.'],
  ['crt', 'TUBE TINKERER', 'Fiddled with the CRT.'],
  ['rage', 'DRAGON RAGE', 'Entered the ancient code.'],
];
const unlocked = new Set(store.get('ach', []));
const trophyIcon = renderSprite(SPRITES.crown, { outline: '#140c1c', scale: 3 });
let toastChain = Promise.resolve();

function updateTrophies() { $('#trophy-count').textContent = `${unlocked.size}/${ACH.length}`; }
updateTrophies();

function unlock(id) {
  if (unlocked.has(id)) return;
  const a = ACH.find(a => a[0] === id);
  if (!a) return;
  unlocked.add(id);
  store.set('ach', [...unlocked]);
  updateTrophies();
  toastChain = toastChain.then(() => showToast(a));
}

function showToast([, title, desc]) {
  return new Promise(done => {
    const el = document.createElement('div');
    el.className = 'toast';
    const icon = document.createElement('canvas');
    icon.width = trophyIcon.width; icon.height = trophyIcon.height;
    icon.getContext('2d').drawImage(trophyIcon, 0, 0);
    el.append(icon);
    el.insertAdjacentHTML('beforeend', `<div><b>ACHIEVEMENT UNLOCKED</b><span></span><small></small></div>`);
    $('span', el).textContent = title;
    $('small', el).textContent = desc;
    $('#toasts').append(el);
    Chip.sfx.achievement();
    setTimeout(() => {
      el.classList.add('out');
      setTimeout(() => { el.remove(); done(); }, 400);
    }, 2800);
  });
}

/* ==========================================================================
   DIALOG — RPG text box with typewriter
   ========================================================================== */
const Dialog = (() => {
  const el = $('#dialog'), box = $('.dialog-box', el);
  const nameEl = $('.dialog-name', el), textEl = $('.dialog-text', el), actionsEl = $('.dialog-actions', el);
  paintSprite($('.dialog-portrait', el), SPRITES.knight, { scale: 4, outline: '#140c1c' });
  let timer = null, full = '', lastFocus = null;

  function finish() {
    clearInterval(timer); timer = null;
    textEl.textContent = full;
    el.classList.remove('typing');
  }
  function type(text) {
    full = text; textEl.textContent = '';
    if (reduce) return finish();
    let i = 0;
    el.classList.add('typing');
    clearInterval(timer);
    timer = setInterval(() => {
      i++;
      textEl.textContent = full.slice(0, i);
      if (i % 2) Chip.sfx.blip();
      if (i >= full.length) finish();
    }, 20);
  }
  function open({ name, text, html, actions = [{ label: 'CLOSE' }] }) {
    lastFocus = document.activeElement;
    nameEl.textContent = name;
    actionsEl.innerHTML = '';
    actions.forEach(a => {
      const b = document.createElement(a.href ? 'a' : 'button');
      b.className = 'px-btn small' + (a.gold ? ' gold' : '');
      b.textContent = a.label;
      if (a.href) { b.href = a.href; b.target = '_blank'; b.rel = 'noopener'; } else b.type = 'button';
      b.addEventListener('click', () => { a.onClick?.(); if (!a.href) close(); });
      actionsEl.append(b);
    });
    el.hidden = false;
    requestAnimationFrame(() => el.classList.add('show'));
    if (html != null) { clearInterval(timer); textEl.innerHTML = html; el.classList.remove('typing'); } else type(text);
    actionsEl.lastElementChild?.focus({ preventScroll: true });
  }
  function close() {
    if (el.hidden) return;
    finish();
    el.classList.remove('show');
    setTimeout(() => { el.hidden = true; }, 200);
    lastFocus?.focus?.({ preventScroll: true });
  }
  el.addEventListener('click', e => {
    if (e.target === el) close();
    else if (timer && !e.target.closest('a, button')) finish();
  });
  addEventListener('keydown', e => {
    if (el.hidden) return;
    if (e.key === 'Escape') close();
    else if ((e.key === 'Enter' || e.key === ' ') && timer) { e.preventDefault(); finish(); }
  });
  box.addEventListener('keydown', e => {
    if (e.key !== 'Tab') return;
    const f = $$('a, button', actionsEl);
    if (!f.length) return;
    if (e.shiftKey && document.activeElement === f[0]) { e.preventDefault(); f[f.length - 1].focus(); }
    else if (!e.shiftKey && document.activeElement === f[f.length - 1]) { e.preventDefault(); f[0].focus(); }
  });
  return { open, close };
})();

$('#btn-trophy').addEventListener('click', () => {
  const items = ACH.map(([id, t, d]) => unlocked.has(id)
    ? `<li><b>★ ${t}</b>${d}</li>`
    : `<li class="locked"><b>? ? ?</b>Keep exploring…</li>`).join('');
  Dialog.open({ name: `ACHIEVEMENTS ${unlocked.size}/${ACH.length}`, html: `<ul class="ach-list">${items}</ul>` });
});

/* ==========================================================================
   HUD — toggles, XP bar, levels
   ========================================================================== */
const btnSfx = $('#btn-sfx'), btnBgm = $('#btn-bgm'), btnCrt = $('#btn-crt');
Chip.sfxOn = store.get('sfx', true);
btnSfx.classList.toggle('on', Chip.sfxOn);
if (!store.get('crt', true)) { root.classList.add('no-crt'); btnCrt.classList.remove('on'); }

btnSfx.addEventListener('click', () => {
  Chip.unlock();
  Chip.sfxOn = !Chip.sfxOn;
  btnSfx.classList.toggle('on', Chip.sfxOn);
  store.set('sfx', Chip.sfxOn);
});
btnBgm.addEventListener('click', () => {
  Chip.unlock();
  Chip.setMusic(!Chip.musicOn);
  btnBgm.classList.toggle('on', Chip.musicOn);
  store.set('bgm', Chip.musicOn);
  if (Chip.musicOn) unlock('bard');
});
btnCrt.addEventListener('click', () => {
  const on = root.classList.toggle('no-crt');
  btnCrt.classList.toggle('on', !on);
  store.set('crt', !on);
  unlock('crt');
});

const xpFill = $('#xp');
function onScroll() {
  const max = root.scrollHeight - innerHeight;
  xpFill.style.width = (max > 0 ? Math.min(1, scrollY / max) * 100 : 0) + '%';
}
addEventListener('scroll', onScroll, { passive: true });
onScroll();

const SECTIONS = [
  ['hero', null, 'THE LEGEND BEGINS'],
  ['tale', 'tale', "THE HERO'S TALE"],
  ['skills', 'skills', 'SKILL TREE'],
  ['quests', 'quests', 'QUEST LOG'],
  ['raven', 'tower', 'THE RAVEN TOWER'],
];
let level = 1, started = false;
const lvEl = $('#lv');

const secIO = new IntersectionObserver(entries => {
  entries.forEach(e => {
    if (!e.isIntersecting || !started) return;
    const idx = SECTIONS.findIndex(s => s[0] === e.target.id);
    $$('.hud-nav a').forEach(a => a.toggleAttribute('aria-current', a.hash === '#' + e.target.id));
    if (idx + 1 > level) {
      level = idx + 1;
      lvEl.textContent = level;
    }
    if (SECTIONS[idx][1]) unlock(SECTIONS[idx][1]);
  });
}, { rootMargin: '-45% 0px -45% 0px' });

/* ==========================================================================
   GATE — PRESS START
   ========================================================================== */
paintSprite($('#gate-crest'), SPRITES.shield, { scale: 7, outline: '#140c1c' });

function startGame() {
  if (started) return;
  started = true;
  const gate = $('#gate');
  Chip.unlock();
  Chip.sfx.start();
  setTimeout(() => Chip.sfx.door(), 300);
  if (store.get('bgm', false)) {
    setTimeout(() => { Chip.setMusic(true); btnBgm.classList.add('on'); }, 1200);
  }
  gate.classList.add('open');
  document.body.classList.remove('locked');
  shake(1300);
  for (let i = 0; i < 6; i++) {
    setTimeout(() => FX.spark(innerWidth / 2 + (R() - 0.5) * 60, innerHeight - 10,
      { n: 20, speed: 110, gravity: 60, colors: ['#6b3e1e', '#9c6a1c', '#b89a62'] }), 300 + i * 120);
  }
  setTimeout(() => {
    gate.remove();
    unlock('start');
    SECTIONS.forEach(([id]) => secIO.observe(document.getElementById(id)));
  }, 1900);
  removeEventListener('keydown', gateKey);
}
function gateKey(e) {
  if (e.metaKey || e.ctrlKey || e.altKey) return;
  if (e.key.length > 1 && !['Enter', 'Escape', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) return;
  e.preventDefault();
  startGame();
}
if (new URLSearchParams(location.search).has('nogate')) {
  started = true;
  $('#gate').remove();
  document.body.classList.remove('locked');
  SECTIONS.forEach(([id]) => secIO.observe(document.getElementById(id)));
} else {
  $('#gate').addEventListener('click', startGame);
  addEventListener('keydown', gateKey);
  $('.gate-start').focus({ preventScroll: true });
}

/* ==========================================================================
   HERO — bouncing title, role typer, lightning
   ========================================================================== */
(() => {
  const title = $('.hero-title');
  const letters = [...title.textContent].map((ch, i) => {
    const s = document.createElement('span');
    s.className = 'ch';
    s.textContent = ch;
    s.style.setProperty('--i', i);
    s.setAttribute('aria-hidden', 'true');
    return s;
  });
  title.textContent = '';
  title.append(...letters);

  const bonked = new Set();
  const bonk = s => {
    if (s.classList.contains('bonk')) return;
    s.classList.add('bonk');
    Chip.sfx.jump();
    const r = s.getBoundingClientRect();
    setTimeout(() => { coinPop(r.left + r.width / 2, r.top); Chip.sfx.coin(); }, 120);
    setTimeout(() => s.classList.remove('bonk'), 460);
    bonked.add(s);
    if (bonked.size === letters.length) unlock('bonk');
  };
  letters.forEach(s => {
    s.addEventListener('click', () => bonk(s));
    if (finePointer) s.addEventListener('mouseenter', () => bonk(s));
  });

  // occasional chromatic glitch on a random letter
  if (!reduce) {
    setInterval(() => {
      const s = letters[Math.floor(R() * letters.length)];
      s.classList.add('glitch');
      setTimeout(() => s.classList.remove('glitch'), 160);
    }, 1900);
  }

  // typewriter roles
  const roleEl = $('#role');
  let ri = 0;
  const wait = ms => new Promise(r => setTimeout(r, ms));
  (async function cycle() {
    for (;;) {
      const text = CONFIG.roles[ri++ % CONFIG.roles.length];
      for (let i = 1; i <= text.length; i++) { roleEl.textContent = text.slice(0, i); await wait(55); }
      await wait(1700);
      for (let i = text.length; i >= 0; i--) { roleEl.textContent = text.slice(0, i); await wait(25); }
      await wait(300);
    }
  })();

  if (!finePointer) $('.hero-hint').textContent = 'tap the sky to summon lightning';

  let storms = 0;
  $('#hero').addEventListener('click', e => {
    if (e.target.closest('a, button, .ch')) return;
    Scene.lightning(e.clientX);
    shake(350);
    if (++storms >= 5) unlock('storm');
  });
})();

/* ==========================================================================
   REVEALS + SECTION BITS
   ========================================================================== */
$$('.split').forEach(el => {
  const text = el.textContent;
  el.textContent = '';
  el.setAttribute('aria-label', text);
  [...text].forEach((ch, i) => {
    const s = document.createElement('span');
    s.textContent = ch === ' ' ? ' ' : ch;
    s.style.setProperty('--i', i);
    s.setAttribute('aria-hidden', 'true');
    el.append(s);
  });
});

paintSprite($('#avatar'), SPRITES.knight, { scale: 8, outline: '#140c1c' });

$$('.skill').forEach(sk => {
  const rows = SPRITES[sk.dataset.icon];
  const scale = Math.max(2, Math.floor(56 / Math.max(rows.length, rows[0].length)));
  paintSprite($('.skill-icon', sk), rows, { scale: Math.min(5, scale), outline: '#140c1c' });
  const lv = +sk.dataset.lv, segs = $('.segs', sk);
  for (let k = 0; k < 10; k++) {
    const i = document.createElement('i');
    i.style.setProperty('--k', k);
    if (k < lv) i.className = 'lit';
    segs.append(i);
  }
  const num = document.createElement('b');
  num.textContent = 'LV 0';
  segs.append(num);
  sk.addEventListener('mouseenter', () => {
    const r = $('.skill-icon', sk).getBoundingClientRect();
    FX.spark(r.left + r.width / 2, r.top + r.height / 2, { n: 10, speed: 60, colors: ['#ffe27a', '#a066e0', '#fff'] });
  });
});

function countUp(el, to) {
  let n = 0;
  const id = setInterval(() => {
    el.textContent = `LV ${++n}`;
    if (n >= to) clearInterval(id);
  }, 110);
}

const revealIO = new IntersectionObserver(entries => {
  entries.forEach(e => {
    if (!e.isIntersecting) return;
    const el = e.target;
    el.classList.add('in');
    revealIO.unobserve(el);
    if (el.classList.contains('skill')) {
      setTimeout(() => countUp($('.segs b', el), +el.dataset.lv), 300 + (+getComputedStyle(el).getPropertyValue('--d') || 0) * 100);
    }
  });
}, { threshold: 0.15 });
$$('[data-reveal], .sec-title').forEach(el => revealIO.observe(el));

/* ==========================================================================
   QUESTS — 3D tilt, glare, lore dialogs, legendary sparkles
   ========================================================================== */
$$('.quest').forEach(q => {
  if (finePointer && !reduce) {
    q.addEventListener('mousemove', e => {
      const r = q.getBoundingClientRect();
      const px = (e.clientX - r.left) / r.width, py = (e.clientY - r.top) / r.height;
      q.style.setProperty('--rx', ((0.5 - py) * 18).toFixed(2) + 'deg');
      q.style.setProperty('--ry', ((px - 0.5) * 18).toFixed(2) + 'deg');
      q.style.setProperty('--gx', (px * 100).toFixed(1) + '%');
      q.style.setProperty('--gy', (py * 100).toFixed(1) + '%');
    });
    q.addEventListener('mouseleave', () => {
      q.style.setProperty('--rx', '0deg');
      q.style.setProperty('--ry', '0deg');
    });
  }
  $('.lore-btn', q).addEventListener('click', () => {
    const src = $('a[href]', $('.quest-btns', q));
    Dialog.open({
      name: $('h3', q).textContent.toUpperCase(),
      text: $('.lore', q).textContent.trim(),
      actions: [{ label: 'SOURCE ↗', href: src.href }, { label: 'CLOSE', gold: true }],
    });
    unlock('lore');
  });
});

if (!reduce) {
  const legend = $$('.quest.legendary');
  setInterval(() => {
    legend.forEach(q => {
      const r = q.getBoundingClientRect();
      if (r.bottom < 0 || r.top > innerHeight) return;
      const edge = R() * 4 | 0;
      const x = edge % 2 ? (edge === 1 ? r.right : r.left) : r.left + R() * r.width;
      const y = edge % 2 ? r.top + R() * r.height : (edge === 0 ? r.top : r.bottom);
      FX.spark(x, y, { n: 3, speed: 30, gravity: -20, colors: ['#ffe27a', '#fff', '#ff9a1e'], life: 0.8 });
    });
  }, 220);
}

/* ==========================================================================
   SEND A RAVEN
   ========================================================================== */
const ravenFrames = SPRITES.raven.map(f => renderSprite(f, { outline: '#9a86e0', scale: 3 }));
const ease = k => 1 - Math.pow(1 - k, 3);

function ravenFly(tx, ty, done) {
  const P = FX.PX;
  tx /= P; ty /= P;
  const sx = -40, sy = ty - 60, ex = FX.w + 60, ey = -60;
  let t = 0, picked = false;
  Chip.sfx.whoosh();
  FX.add({
    update(dt, g) {
      t += dt;
      let x, y, carry = false;
      if (t < 1) {
        const k = ease(t);
        x = sx + (tx - sx) * k; y = sy + (ty - sy) * k - Math.sin(k * Math.PI) * 25;
      } else if (t < 1.35) {
        x = tx; y = ty + Math.sin((t - 1) * 30) * 2;
        carry = t > 1.15;
        if (!picked) {
          picked = true;
          FX.spark(tx * P, ty * P, { n: 18, speed: 70, gravity: 40, colors: ['#1e1428', '#9a86e0', '#e8d5a3'] });
          Chip.sfx.coin();
        }
      } else {
        const k = Math.min(1, (t - 1.35) / 1.2);
        x = tx + (ex - tx) * k * k; y = ty + (ey - ty) * k * k - Math.sin(k * Math.PI) * 30;
        carry = true;
        if (k >= 1) { done(); return false; }
        if (R() < 0.3) FX.spark(x * P, y * P, { n: 1, speed: 20, gravity: 50, colors: ['#9a86e0'] });
      }
      const fr = ravenFrames[Math.floor(t * 10) % 2];
      const rx = Math.round(x), ry = Math.round(y);
      if (carry) {
        g.fillStyle = '#140c1c'; g.fillRect(rx - 8, ry + 8, 16, 11);
        g.fillStyle = '#e8d5a3'; g.fillRect(rx - 7, ry + 9, 14, 9);
        g.fillStyle = '#b89a62'; g.fillRect(rx - 7, ry + 9, 14, 1);
        g.fillStyle = '#c83737'; g.fillRect(rx - 1, ry + 12, 3, 3);
      }
      g.drawImage(fr, rx - fr.width / 2, ry - fr.height / 2);
    },
  });
}

(() => {
  const form = $('#letter');
  form.addEventListener('submit', e => {
    e.preventDefault();
    const data = new FormData(form);
    const name = data.get('name').trim(), email = data.get('email').trim(), msg = data.get('message').trim();
    if (!name || !msg || !form.checkValidity()) {
      form.classList.add('invalid', 'shake-x');
      Chip.sfx.error();
      setTimeout(() => form.classList.remove('shake-x'), 450);
      return;
    }
    form.classList.remove('invalid');
    form.classList.add('stamped');
    Chip.sfx.jump();
    setTimeout(() => form.classList.add('sealed'), 450);
    const r = form.getBoundingClientRect();
    setTimeout(() => ravenFly(r.left + r.width / 2, r.top + r.height / 2, () => {
      const subject = encodeURIComponent(`A raven from ${name}`);
      const body = encodeURIComponent(`${msg}\n\n— ${name} <${email}>`);
      location.href = `mailto:${CONFIG.email}?subject=${subject}&body=${body}`;
      unlock('raven');
      Dialog.open({
        name: 'THE RAVEN HAS FLOWN',
        text: `Your letter is on its way, ${name}! Your mail scroll should have opened. If it did not, send your words directly to ${CONFIG.email}.`,
      });
      setTimeout(() => { form.reset(); form.classList.remove('stamped', 'sealed'); }, 600);
    }), 1100);
  });
})();

/* ==========================================================================
   FOOTER — insert coin
   ========================================================================== */
paintSprite($('#coin-icon'), SPRITES.coin, { scale: 5, outline: '#140c1c' });
$('#year').textContent = new Date().getFullYear();
let coins = 0;
$('#coin').addEventListener('click', e => {
  const r = e.currentTarget.getBoundingClientRect();
  coinPop(r.left + r.width / 2, r.top);
  Chip.sfx.coin();
  $('#coins').textContent = ++coins;
  if (coins === 10) unlock('coins');
});

/* ==========================================================================
   ↑ ↑ ↓ ↓ ← → ← → B A  —  DRAGON RAGE
   ========================================================================== */
(() => {
  const CODE = ['ArrowUp', 'ArrowUp', 'ArrowDown', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'ArrowLeft', 'ArrowRight', 'b', 'a'];
  let pos = 0, raging = false;
  addEventListener('keydown', e => {
    const k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
    pos = k === CODE[pos] ? pos + 1 : k === CODE[0] ? 1 : 0;
    if (pos === CODE.length) { pos = 0; rage(); }
  });
  $('.secret').addEventListener('click', rage);

  const body = renderSprite(SPRITES.dragon, { outline: '#140c1c' });
  const wing = renderSprite(SPRITES.wing, { outline: '#140c1c' });
  const wingBack = renderSprite(SPRITES.wing, { outline: '#140c1c', map: { R: '#7a1f2b', r: '#4a1020', p: '#2c1030' } });

  function rage() {
    if (raging) return;
    raging = true;
    unlock('rage');
    Chip.unlock();
    Chip.sfx.roar();
    setTimeout(() => Chip.sfx.roar(), 1500);
    shake(3600);
    Scene.spawnDragon();
    const flash = $('#flash');
    flash.classList.add('burn');
    const S = Math.max(3, Math.round(FX.w / 100));
    let t = 0, x = -30 * S, fireSfx = 0;
    const y0 = FX.h * 0.42, speed = (FX.w + 60 * S) / 3.6;
    FX.add({
      update(dt, g) {
        t += dt;
        x += speed * dt;
        const y = y0 + Math.sin(t * 3) * 3 * S;
        const flap = Math.sin(t * 9);
        // fire stream from the mouth
        const mx = x + 15 * S, my = y - 1 * S;
        for (let i = 0; i < (reduce ? 3 : 14); i++) {
          FX.parts.push({
            x: mx, y: my, vx: 140 + R() * 160, vy: (R() - 0.25) * 110, g: -40,
            life: 0.4 + R() * 0.6, max: 1, size: 1 + (R() * 3 | 0), fire: true,
          });
        }
        if (!reduce && R() < 0.5) {
          FX.parts.push({ x: R() * FX.w, y: FX.h + 2, vx: (R() - 0.5) * 20, vy: -40 - R() * 60, g: 0, life: 2, max: 2, size: 1, fire: true });
        }
        if ((fireSfx -= dt) < 0) { fireSfx = 0.6; Chip.sfx.fire(); }

        g.save();
        g.translate(Math.round(x), Math.round(y));
        g.scale(S, S);
        g.save(); g.translate(2, -1); g.scale(1, Math.sin(t * 9 + 0.5)); g.drawImage(wingBack, -15, -10); g.restore();
        g.drawImage(body, -15, -7);
        g.save(); g.translate(-1, 0); g.scale(1, flap); g.drawImage(wing, -15, -10); g.restore();
        g.restore();

        if (x > FX.w + 40 * S) {
          raging = false;
          flash.classList.remove('burn');
          return false;
        }
      },
    });
  }
})();
