/* =====================================================================
 * THE MARAUDERS — a co-op turn-based Hogwarts exploration RPG   (data.js)
 * ---------------------------------------------------------------------
 * 1–4 friends (hot-seat, one screen) explore the castle's dungeons —
 * which REARRANGE THEMSELVES every run. Find the House Cup hidden deep
 * in the dark, pocket what treasure you dare, slip back out unseen.
 *
 * No build step, no dependencies. This file is DATA + the DUNGEON
 * GENERATOR — both pure and Node-requireable, so tests can sweep seeds
 * and prove every generated dungeon is fair and winnable on foot.
 * The rules live in engine.js; rendering lives in ui.js.
 * ===================================================================== */
(function (root) {
  'use strict';

  /* ---- tuning knobs (kept few & named, per the anti-arithmetic rule) -- */
  const CONFIG = {
    movesPerTurn: 6,       // tiles a student may walk per turn
    lightRadius: 6,        // how far a student's torch reveals
    lumosRadius: 10,       // Lumos widens that for a turn
    revelioRange: 3,       // how far Revelio can uncover a secret
    spellRange: 1,         // default reach for "adjacent" spells
    flingRange: 3,         // how far Wingardium can float an ally
    startHousePoints: 3,   // ⭐ — the team's shared "lives"; 0 = caught
    patrolSight: 4,        // tiles a patrol can see down a clear line
    tileW: 96, tileH: 48   // isometric tile footprint (px)
  };

  /* ---- tile vocabulary -------------------------------------------------
   * walk   = can a student stand here
   * opaque = does it block line-of-sight (and thus light)
   * Markers ('1'..'4','P','p','K') are converted to floor on load; the
   * engine records the entity it spawned.                                */
  const TILES = {
    '#': { name: 'wall',           walk: false, opaque: true,  kind: 'wall'   },
    '.': { name: 'floor',          walk: true,  opaque: false, kind: 'floor'  },
    't': { name: 'torch',          walk: true,  opaque: false, kind: 'floor', light: 3 },
    'E': { name: 'way out',        walk: true,  opaque: false, kind: 'exit'   },
    'D': { name: 'locked door',    walk: false, opaque: true,  kind: 'door'   },
    'R': { name: 'fallen rubble',  walk: false, opaque: true,  kind: 'rubble' },
    'C': { name: 'chasm',          walk: false, opaque: false, kind: 'chasm'  },
    'B': { name: 'broken bridge',  walk: false, opaque: false, kind: 'bridge' },
    'S': { name: 'cracked wall',   walk: false, opaque: true,  kind: 'secret' }
  };
  const MARKERS = { '1': 'char', '2': 'char', '3': 'char', '4': 'char', 'P': 'patrol', 'p': 'patrol', 'K': 'item' };

  /* ---- the spellbook ---------------------------------------------------
   * Spells are mostly DECLARATIVE: "turn an adjacent tile of type X into
   * floor". The engine resolves `transforms`; only lumos/wingardium need
   * bespoke handling. target: 'self' | 'adj' | 'ally' | 'tile'.          */
  const SPELLS = {
    lumos:      { name: 'Lumos',      glyph: '✦', color: '#ffe08a', target: 'self',
                  desc: 'Kindle bright light — see far this turn (but the light betrays you to patrols).' },
    revelio:    { name: 'Revelio',    glyph: '◈', color: '#b98cff', target: 'tile', range: 'revelioRange',
                  transforms: { secret: 'floor' },
                  desc: 'Uncover a nearby cracked wall, exposing a hidden chamber.' },
    alohomora:  { name: 'Alohomora',  glyph: '⚷', color: '#ffd166', target: 'adj',
                  transforms: { door: 'floor' },
                  desc: 'Unlock an adjacent locked door — a shortcut through the middle of things.' },
    reparo:     { name: 'Reparo',     glyph: '⟁', color: '#7ee0c0', target: 'adj',
                  transforms: { bridge: 'floor' },
                  desc: 'Mend an adjacent broken bridge so the team can cross.' },
    reducto:    { name: 'Reducto',    glyph: '✸', color: '#ff8a5c', target: 'adj',
                  transforms: { rubble: 'floor' },
                  desc: 'Blast apart an adjacent pile of rubble blocking a passage.' },
    wingardium: { name: 'Wingardium', glyph: '↟', color: '#8ad3ff', target: 'ally',
                  desc: 'Levitate an adjacent friend and float them over the ground — even over a patrol.' }
  };

  /* ---- the four houses (flavour + token colour; NOT a stat system) ---- */
  const HOUSES = {
    Gryffindor: { color: '#b3261e', trim: '#e8b923', crest: '🦁' },
    Ravenclaw:  { color: '#1f3a93', trim: '#b08d57', crest: '🦅' },
    Hufflepuff: { color: '#e0a800', trim: '#2b2b2b', crest: '🦡' },
    Slytherin:  { color: '#1e6f4c', trim: '#c0c0c0', crest: '🐍' }
  };

  /* =====================================================================
   * DUNGEON GENERATOR — the dungeons rearrange themselves every night.
   * ---------------------------------------------------------------------
   * Rooms + a spanning tree of open corridors (so EVERYTHING needed is
   * reachable on foot, no spell ever required), then:
   *   · extra corridors gated by doors/rubble  = optional spell shortcuts
   *   · secret pockets behind cracked walls    = Revelio discoveries
   *   · treasure scattered through the rooms   = reasons to wander
   *   · patrol routes BFS'd along real paths   = stealth that fits the map
   * Pure & deterministic per seed (no Date/Math.random) so tests can
   * sweep seeds and prove fairness.
   * ===================================================================== */
  function mulberry(seed) { let a = seed >>> 0; return function () { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

  const GEN = { W: 34, H: 24, rooms: 8, minDepth: 18 };

  function generate(seed) {
    for (let a = 0; a < 40; a++) {
      const scn = tryGen((((seed >>> 0) || 1) + a * 7919) >>> 0);
      if (scn) { scn.seed = seed >>> 0; return scn; }
    }
    throw new Error('dungeon generation failed (seed ' + seed + ')');
  }

  function tryGen(s) {
    const rnd = mulberry(s);
    const W = GEN.W, H = GEN.H;
    const grid = Array.from({ length: H }, () => Array(W).fill('#'));
    const at = (x, y) => (x >= 0 && y >= 0 && x < W && y < H) ? grid[y][x] : '#';
    const put = (x, y, c) => { grid[y][x] = c; };
    const WALKC = '.tEK12Pp';
    const walk = (x, y) => WALKC.indexOf(at(x, y)) >= 0;
    const DIRS4 = [[1, 0], [-1, 0], [0, 1], [0, -1]];

    /* rooms */
    const rooms = [];
    for (let t = 0; t < 260 && rooms.length < GEN.rooms; t++) {
      const w = 4 + Math.floor(rnd() * 4), h = 3 + Math.floor(rnd() * 3);
      const x = 1 + Math.floor(rnd() * (W - w - 2)), y = 1 + Math.floor(rnd() * (H - h - 2));
      if (rooms.some(r => x < r.x + r.w + 1 && r.x < x + w + 1 && y < r.y + r.h + 1 && r.y < y + h + 1)) continue;
      rooms.push({ x, y, w, h, cx: x + (w >> 1), cy: y + (h >> 1) });
    }
    if (rooms.length < 6) return null;
    for (const r of rooms) for (let y = r.y; y < r.y + r.h; y++) for (let x = r.x; x < r.x + r.w; x++) put(x, y, '.');

    /* spanning-tree corridors: everything reachable on foot, always */
    const carve = (x1, y1, x2, y2, rec) => {
      let x = x1, y = y1;
      const step = () => { if (at(x, y) === '#') { put(x, y, '.'); if (rec) rec.push([x, y]); } };
      if (rnd() < 0.5) { while (x !== x2) { x += Math.sign(x2 - x); step(); } while (y !== y2) { y += Math.sign(y2 - y); step(); } }
      else { while (y !== y2) { y += Math.sign(y2 - y); step(); } while (x !== x2) { x += Math.sign(x2 - x); step(); } }
    };
    for (let i = 1; i < rooms.length; i++) { const a = rooms[i], b = rooms[Math.floor(rnd() * i)]; carve(a.cx, a.cy, b.cx, b.cy, null); }

    /* EXTRA corridors get a gate — doors/rubble are optional shortcuts only */
    let doors = 0, rubbles = 0;
    for (let e = 0; e < 10 && (doors < 1 || rubbles < 1 || doors + rubbles < 3); e++) {
      const a = rooms[Math.floor(rnd() * rooms.length)], b = rooms[Math.floor(rnd() * rooms.length)];
      if (a === b) continue;
      const rec = [];
      carve(a.cx, a.cy, b.cx, b.cy, rec);
      if (rec.length < 3) continue;
      const m = rec[Math.floor(rec.length / 2)];
      const gch = (doors <= rubbles) ? 'D' : 'R';
      put(m[0], m[1], gch);
      if (gch === 'D') doors++; else rubbles++;
    }
    if (doors < 1 || rubbles < 1) return null;

    /* entrance (the way out is the way in) + students */
    rooms.sort((p, q) => (p.cx + p.cy) - (q.cx + q.cy));
    const er = rooms[0];
    put(er.cx, er.cy, 'E');
    const spots = [];
    for (const [dx, dy] of DIRS4) if (spots.length < 2 && '.t'.indexOf(at(er.cx + dx, er.cy + dy)) >= 0) spots.push([er.cx + dx, er.cy + dy]);
    if (spots.length < 2) return null;
    put(spots[0][0], spots[0][1], '1');
    put(spots[1][0], spots[1][1], '2');

    /* BFS over walk-only tiles (doors/rubble/secrets count as walls) */
    const bfs = (sx, sy, block) => {
      const dist = Array.from({ length: H }, () => Array(W).fill(null));
      dist[sy][sx] = 0; let fr = [[sx, sy]];
      while (fr.length) {
        const nf = [];
        for (const [x, y] of fr) for (const [dx, dy] of DIRS4) {
          const nx = x + dx, ny = y + dy;
          if (ny < 0 || ny >= H || nx < 0 || nx >= W || dist[ny][nx] !== null) continue;
          if (!walk(nx, ny) || (block && block(nx, ny))) continue;
          dist[ny][nx] = dist[y][x] + 1; nf.push([nx, ny]);
        }
        fr = nf;
      }
      return dist;
    };

    /* the Cup goes in the deepest room */
    let d0 = bfs(er.cx, er.cy);
    let cupRoom = null;
    for (const r of rooms.slice(1)) { const d = d0[r.cy][r.cx]; if (d != null && (!cupRoom || d > cupRoom.d)) cupRoom = { r, d }; }
    if (!cupRoom || cupRoom.d < GEN.minDepth) return null;
    put(cupRoom.r.cx, cupRoom.r.cy, 'K');

    /* secret pockets behind cracked walls, treasure inside (Revelio finds) */
    const loot = [];
    const SPECIALS = ['an enchanted locket', 'a vial of Felix Felicis', 'a goblin-made dagger', 'a Chocolate Frog card'];
    let secrets = 0;
    for (let t = 0; t < 90 && secrets < 2; t++) {
      const r = rooms[1 + Math.floor(rnd() * (rooms.length - 1))];
      const side = Math.floor(rnd() * 4);
      let c, pk, rect;
      if (side === 0) { const y = r.y + Math.floor(rnd() * r.h); c = [r.x - 1, y]; pk = [r.x - 3, y]; rect = [r.x - 5, y - 2, r.x - 1, y + 2]; }
      else if (side === 1) { const y = r.y + Math.floor(rnd() * r.h); c = [r.x + r.w, y]; pk = [r.x + r.w + 2, y]; rect = [r.x + r.w, y - 2, r.x + r.w + 4, y + 2]; }
      else if (side === 2) { const x = r.x + Math.floor(rnd() * r.w); c = [x, r.y - 1]; pk = [x, r.y - 3]; rect = [x - 2, r.y - 5, x + 2, r.y - 1]; }
      else { const x = r.x + Math.floor(rnd() * r.w); c = [x, r.y + r.h]; pk = [x, r.y + r.h + 2]; rect = [x - 2, r.y + r.h, x + 2, r.y + r.h + 4]; }
      if (rect[0] < 0 || rect[1] < 0 || rect[2] > W - 1 || rect[3] > H - 1) continue;
      let solid = true;
      for (let y = rect[1]; y <= rect[3] && solid; y++) for (let x = rect[0]; x <= rect[2]; x++) if (at(x, y) !== '#') { solid = false; break; }
      if (!solid) continue;
      for (let y = pk[1] - 1; y <= pk[1] + 1; y++) for (let x = pk[0] - 1; x <= pk[0] + 1; x++) put(x, y, '.');
      put(c[0], c[1], 'S');
      loot.push({ x: pk[0], y: pk[1], glyph: '✨', name: SPECIALS[secrets % SPECIALS.length], secret: true });
      secrets++;
    }
    if (secrets < 1) return null;

    /* pillars for cover in larger rooms (never the entrance room) */
    for (const r of rooms.slice(1)) {
      if (r.w >= 5 && r.h >= 4 && rnd() < 0.8) {
        const x = r.x + 1 + Math.floor(rnd() * (r.w - 2)), y = r.y + 1 + Math.floor(rnd() * (r.h - 2));
        if (at(x, y) === '.') put(x, y, '#');
      }
    }

    /* torches keep rooms readable */
    for (const r of rooms) {
      for (let k = 0; k < 3; k++) {
        const x = r.x + Math.floor(rnd() * r.w), y = r.y + Math.floor(rnd() * r.h);
        if (at(x, y) === '.') { put(x, y, 't'); break; }
      }
    }

    /* scattered galleons — reasons to poke into side rooms */
    let commons = 0;
    for (let t = 0; t < 80 && commons < 4; t++) {
      const r = rooms[1 + Math.floor(rnd() * (rooms.length - 1))];
      const x = r.x + Math.floor(rnd() * r.w), y = r.y + Math.floor(rnd() * r.h);
      if (at(x, y) !== '.') continue;
      if (loot.some(L => L.x === x && L.y === y)) continue;
      loot.push({ x, y, glyph: '💰', name: 'a pouch of Galleons' });
      commons++;
    }
    if (commons < 2) return null;

    /* patrols: routes are real BFS paths between rooms, so they prowl the
     * actual corridors. Mrs Norris is awake; Filch sleeps until the alarm. */
    const others = rooms.slice(1).filter(r => r !== cupRoom.r);
    if (others.length < 3) return null;
    const blockEK = (x, y) => at(x, y) === 'E' || at(x, y) === 'K';
    const routePath = (ra, rb) => {
      if (!walk(ra.cx, ra.cy) || blockEK(ra.cx, ra.cy)) return null;
      const dist = bfs(ra.cx, ra.cy, blockEK);
      if (dist[rb.cy] == null || dist[rb.cy][rb.cx] == null || dist[rb.cy][rb.cx] === 0) return null;
      let x = rb.cx, y = rb.cy; const path = [[x, y]];
      let guard = W * H;
      while (dist[y][x] > 0 && guard-- > 0) {
        for (const [dx, dy] of DIRS4) {
          const nx = x + dx, ny = y + dy;
          if (ny >= 0 && ny < H && nx >= 0 && nx < W && dist[ny][nx] != null && dist[ny][nx] === dist[y][x] - 1) { x = nx; y = ny; path.push([x, y]); break; }
        }
      }
      path.reverse();
      const thin = path.filter((_, i) => i % 2 === 0);
      const last = path[path.length - 1];
      if (thin[thin.length - 1][0] !== last[0] || thin[thin.length - 1][1] !== last[1]) thin.push(last);
      return thin;
    };
    const rA = others[Math.floor(rnd() * others.length)];
    let rB = others[Math.floor(rnd() * others.length)];
    if (rB === rA) rB = others[(others.indexOf(rA) + 1) % others.length];
    const pNorris = routePath(rA, rB);
    const pFilch = routePath(others[0] === rA ? others[1] : others[0], others[2] === rA || others[2] === rB ? others[others.length - 1] : others[2]);
    if (!pNorris || !pFilch) return null;
    if (pNorris[0][0] === pFilch[0][0] && pNorris[0][1] === pFilch[0][1]) return null;
    const defs = [
      { name: 'Mrs Norris', route: pNorris },
      { name: 'Filch', route: pFilch, dormant: true }
    ];
    for (const d of defs) { const [x, y] = d.route[0]; if (!walk(x, y) || 'EK12'.indexOf(at(x, y)) >= 0) return null; }
    put(defs[0].route[0][0], defs[0].route[0][1], 'P');
    put(defs[1].route[0][0], defs[1].route[0][1], 'p');
    /* engine assigns patrol defs in grid SCAN ORDER — sort to match */
    defs.sort((p, q) => (p.route[0][1] * W + p.route[0][0]) - (q.route[0][1] * W + q.route[0][0]));

    /* name the rooms & dress the set — this is what makes it HOGWARTS, not
     * a generic maze. Props are pure set-dressing (never block anything). */
    const THEMES = [
      { name: 'the Potions Store',     props: ['cauldron', 'bottles', 'web'] },
      { name: 'the Forgotten Library', props: ['books', 'books', 'candles'] },
      { name: 'the Old Armoury',       props: ['armor', 'barrel', 'web'] },
      { name: 'the Wine Cellar',       props: ['barrel', 'barrel', 'bottles'] },
      { name: 'the Chamber of Echoes', props: ['moonbeam', 'web', 'candles'] },
      { name: 'the Alchemy Lab',       props: ['cauldron', 'bottles', 'candles'] },
      { name: 'the Owlery Undercroft', props: ['web', 'barrel', 'moonbeam'] },
      { name: 'the Broom Cupboard',    props: ['barrel', 'web'] }
    ];
    const themePool = THEMES.slice();
    const props = [];
    const usedProp = new Set();
    const propSpot = (r) => {
      for (let t = 0; t < 30; t++) {
        const x = r.x + Math.floor(rnd() * r.w), y = r.y + Math.floor(rnd() * r.h);
        if (at(x, y) !== '.') continue;
        if (!(y === r.y || x === r.x)) continue;          // hug the back walls (draw-order safe)
        const k2 = x + ',' + y;
        if (usedProp.has(k2) || loot.some(L => L.x === x && L.y === y)) continue;
        usedProp.add(k2); return { x, y };
      }
      return null;
    };
    const dress = (r, plist) => {
      for (const type of plist) {
        if (type === 'banner') { const x = r.x + 1 + Math.floor(rnd() * Math.max(1, r.w - 2)); if (at(x, r.y - 1) === '#') props.push({ x, y: r.y - 1, type, h: Math.floor(rnd() * 4) }); }
        else if (type === 'moonbeam') props.push({ x: r.cx, y: r.cy, type });
        else { const s = propSpot(r); if (s) props.push({ x: s.x, y: s.y, type }); }
      }
    };
    er.name = 'the Cellar Stair';
    dress(er, ['candles', 'barrel', 'banner']);
    cupRoom.r.name = 'the Trophy Vault';
    dress(cupRoom.r, ['candles', 'banner', 'banner', 'web']);
    for (const r of rooms) {
      if (r.name) continue;
      const th = themePool.length ? themePool.splice(Math.floor(rnd() * themePool.length), 1)[0] : { name: 'the Undercroft', props: ['barrel', 'web'] };
      r.name = th.name;
      dress(r, th.props.concat(rnd() < 0.4 ? ['banner'] : []));
    }

    /* final fairness proof: everything needed reachable ON FOOT */
    d0 = bfs(er.cx, er.cy);
    if (d0[cupRoom.r.cy][cupRoom.r.cx] == null) return null;
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      if (at(x, y) === 'S') {
        const open = DIRS4.some(([dx, dy]) => (y + dy) >= 0 && (y + dy) < H && d0[y + dy][x + dx] != null);
        if (!open) return null;
      }
    }
    for (const L of loot) if (!L.secret && d0[L.y][L.x] == null) return null;

    return {
      id: 'dungeon', title: 'The Dungeon Run',
      brief: 'The dungeons rearrange themselves every night — no two runs are alike. Somewhere deep ' +
             'in the dark waits the House Cup. Find it, pocket what treasure you dare, and slip back ' +
             'out before the castle catches you.',
      objective: 'Find the House Cup, then escape the way you came.',
      grid: grid.map(r => r.join('')),
      patrols: defs,
      item: { name: 'the House Cup', glyph: '🏆' },
      loot,
      rooms: rooms.map(r => ({ x: r.x, y: r.y, w: r.w, h: r.h, name: r.name })),
      props,
      party: [
        { id: 'gry', name: 'Robin', house: 'Gryffindor', spells: ['lumos', 'reducto', 'wingardium'] },
        { id: 'rav', name: 'Maya',  house: 'Ravenclaw',  spells: ['lumos', 'alohomora', 'revelio'] }
      ]
    };
  }

  /* a deterministic default (seed 7) so tests & first load are stable;
   * main.js generates a FRESH random dungeon for every run */
  const scenarios = { dungeon: generate(7) };

  const data = { CONFIG, TILES, MARKERS, SPELLS, HOUSES, scenarios, generate };

  /* dual export: browser global + Node require (so tests can run headless) */
  root.MAR = root.MAR || {};
  root.MAR.data = data;
  if (typeof module !== 'undefined' && module.exports) module.exports = data;

})(typeof window !== 'undefined' ? window : globalThis);
