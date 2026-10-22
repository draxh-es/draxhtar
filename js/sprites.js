/* ==========================================================================
   SPRITES — every piece of pixel art on the site lives here as text.
   One character = one pixel. '.' is transparent, other chars use PALETTE.
   ========================================================================== */
const PALETTE = {
  K: '#140c1c', // outline / ink
  N: '#1e1428', // raven / bat black
  W: '#f4f0e6', // white
  S: '#a8b5c8', // steel
  s: '#5f6a85', // steel shadow
  G: '#e8b83a', // gold
  g: '#9c6a1c', // gold shadow
  Y: '#ffe27a', // bright yellow
  B: '#6b3e1e', // wood / leather
  b: '#3f2312', // dark wood
  R: '#c83737', // red
  r: '#7a1f2b', // dark red
  O: '#ff8a1e', // orange
  U: '#3a5bbf', // blue
  u: '#22336e', // dark blue
  P: '#a066e0', // purple
  p: '#5a2f8f', // dark purple
  E: '#4fd08a', // emerald
  e: '#23704a', // dark emerald
  T: '#e8d5a3', // parchment
  t: '#b89a62', // parchment shadow
};

const SPRITES = {
  sword: [
    'W.............',
    '.WS...........',
    '..WS..........',
    '...WS.........',
    '....WS........',
    '.....WS.......',
    '......WS......',
    '.......WS..G..',
    '........WSGg..',
    '.........GG...',
    '........GgBB..',
    '.......G...BB.',
    '............GG',
    '............GG',
  ],
  knight: [
    '.......RRR......',
    '......RR........',
    '....SSSSSSSS....',
    '...SWWSSSSSSs...',
    '...SWSSSSSSSs...',
    '...SKKKKKKKKs...',
    '...SSSSSSSSSs...',
    '....sSSSSSSs....',
    '..SSUUUUUUUUSS..',
    '.SWSUUUGGUUUSWS.',
    '.SSsUGGGGGGUsSS.',
    '.SS.UUUGGUUU.SS.',
    '.WW.UUUGGUUU.WW.',
    '....BBBGgBBB....',
    '....SSS..SSS....',
    '....SSs..SSs....',
    '....sSs..sSs....',
    '...KKKK..KKKK...',
  ],
  dragon: [
    '.....................RR.....',
    '....................RRRR....',
    '...................RRRRRRR..',
    '..........r.r.r....RYRRRRRRR',
    '.........rRrRrRr..RRRRRrrr..',
    '........RRRRRRRRRRRRRr......',
    '......RRRRRRRRRRRRRRRr......',
    'R...RRRRRGGGGGGGGRRr........',
    'RR.RRRRGGGGGGGGGRRr.........',
    '.RRRRr..rRRr..rRRr..........',
    '..rr....rR....rR............',
    '........RR....RR............',
  ],
  wing: [
    'R.............',
    'rR............',
    'rrRR..........',
    '.rrRRR........',
    '.rprRRRR......',
    '..rpprRRRR....',
    '..rppprrRRRR..',
    '...rpppprrRRRR',
    '...rrrrrrrrrrR',
  ],
  bat: [
    [
      'N.....N',
      'NN.N.NN',
      '.NNRNN.',
      '..N.N..',
    ],
    [
      '.......',
      '..NRN..',
      'NNNNNNN',
      'N.N.N.N',
    ],
  ],
  raven: [
    [
      '....N.......',
      '....NN......',
      '.....NN.....',
      '.....NNN.NN.',
      'NN.NNNNNNNWG',
      '.NNNNNNNNN..',
      '...NNNNN....',
      '............',
      '............',
    ],
    [
      '............',
      '............',
      '............',
      '.........NN.',
      'NN.NNNNNNNWG',
      '.NNNNNNNNN..',
      '....NNNN....',
      '.....NNN....',
      '......N.....',
    ],
  ],
  shield: [
    'SSSSSSSSSS',
    'SUUUGGUUUS',
    'SUUUGGUUUS',
    'SGGGGGGGGS',
    'SUUUGGUUUS',
    'SUUUGGUUUS',
    '.SUUGGUUS.',
    '.SUUGGUUS.',
    '..SUGGUS..',
    '...SGGS...',
    '....SS....',
  ],
  potion: [
    '...BBB...',
    '...SWS...',
    '...SWS...',
    '..SWWSS..',
    '.SEEEEES.',
    'SEWEEEEES',
    'SEWEEEEES',
    'SEEEEEEeS',
    'SEEEEEeeS',
    '.SeeeeeS.',
    '..SSSSS..',
  ],
  scroll: [
    '.bTTTTTTTb.',
    'bBTTTTTTTBb',
    '.tTKKKKKTt.',
    '.tTTTTTTTt.',
    '.tTKKKKTTt.',
    '.tTTTTTTTt.',
    '.tTKKKKKTt.',
    'bBTTTTTTTBb',
    '.bTTTTTTTb.',
  ],
  gem: [
    '..PPPPP..',
    '.PWPPPpP.',
    'PWPPPPPpp',
    'pPPPPPPpp',
    '.pPPPPpp.',
    '..pPPpp..',
    '...ppp...',
    '....p....',
  ],
  book: [
    'RRRRRRRRR.',
    'RGRRRRRRRT',
    'RRRGGGRRRT',
    'RRRGRGRRRT',
    'RRRGGGRRRT',
    'RRRRRRRRRT',
    'RRRRRRRRRT',
    'RRRRRRRRRT',
    'rrrrrrrrrT',
    '.TTTTTTTTT',
  ],
  crown: [
    'Y....Y....Y',
    'GG..GRG..GG',
    'GGG.GGG.GGG',
    'GGGGGGGGGGG',
    'GRGGUGGGEGG',
    'GGGGGGGGGGG',
    'ggggggggggg',
  ],
  coin: [
    '..GGGG..',
    '.GYYYYg.',
    'GYWYYYYg',
    'GYWGgYYg',
    'GYYGgYYg',
    'GYYYYYYg',
    '.gYYYYg.',
    '..gggg..',
  ],
};

/* Render a sprite to a new canvas.
   opts.scale   — integer upscale
   opts.outline — colour of a 1px outline drawn around opaque pixels (or null)
   opts.map     — per-char palette overrides, e.g. recolouring the sword blade */
function renderSprite(rows, opts = {}) {
  const scale = opts.scale || 1;
  const pad = opts.outline ? 1 : 0;
  const pal = Object.assign({}, PALETTE, opts.map);
  const w = rows[0].length + pad * 2;
  const h = rows.length + pad * 2;
  const c = document.createElement('canvas');
  c.width = w * scale;
  c.height = h * scale;
  const g = c.getContext('2d');
  const solid = (x, y) => y >= 0 && y < rows.length && x >= 0 && x < rows[0].length && rows[y][x] !== '.';

  if (opts.outline) {
    g.fillStyle = opts.outline;
    for (let y = -1; y <= rows.length; y++) {
      for (let x = -1; x <= rows[0].length; x++) {
        if (solid(x, y)) continue;
        if (solid(x + 1, y) || solid(x - 1, y) || solid(x, y + 1) || solid(x, y - 1)) {
          g.fillRect((x + pad) * scale, (y + pad) * scale, scale, scale);
        }
      }
    }
  }
  rows.forEach((row, y) => {
    for (let x = 0; x < row.length; x++) {
      const ch = row[x];
      if (ch === '.') continue;
      g.fillStyle = pal[ch] || '#ff00ff';
      g.fillRect((x + pad) * scale, (y + pad) * scale, scale, scale);
    }
  });
  return c;
}

/* Draw a sprite into an existing canvas, scaled to fit, centred. */
function paintSprite(canvas, rows, opts = {}) {
  const src = renderSprite(rows, { outline: opts.outline || null, map: opts.map });
  const scale = opts.scale || 4;
  canvas.width = src.width * scale;
  canvas.height = src.height * scale;
  const g = canvas.getContext('2d');
  g.imageSmoothingEnabled = false;
  g.drawImage(src, 0, 0, canvas.width, canvas.height);
  return canvas;
}
