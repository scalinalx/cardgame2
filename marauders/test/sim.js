/* =====================================================================
 * THE MARAUDERS — headless tests   (node test/sim.js [N])
 * ---------------------------------------------------------------------
 *   A) FUZZ      random legal actions across several generated dungeons;
 *                assert invariants hold and the engine never crashes.
 *   B) FAIRNESS  for a sweep of seeds: the Cup AND the way home are
 *                reachable ON FOOT (no spell ever required), every secret
 *                is openable from a reachable tile, every common treasure
 *                is collectable — so no generated dungeon can dead-end.
 *   C) VERBS     spells transform their targets (features found by scan,
 *                since every dungeon is different); alarm/win/catch flow.
 * ===================================================================== */
'use strict';
const data = require('../js/data.js');
const { Game } = require('../js/engine.js');
const { scenarios, SPELLS, CONFIG, generate } = data;

let failures = 0;
const ok = (cond, msg) => { if (!cond) { failures++; console.error('  ✗ ' + msg); } };
const key = (x, y) => x + ',' + y;
const DIRS = [[1, 0], [-1, 0], [0, 1], [0, -1]];

/* small deterministic RNG for the test driver */
function rng(seed) { let a = seed >>> 0; return () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const pick = (rnd, arr) => arr[Math.floor(rnd() * arr.length)];

/* ---- A) FUZZ --------------------------------------------------------- */
function fuzz(scn, games, label) {
  for (let gi = 0; gi < games; gi++) {
    const rnd = rng(gi + 1);
    const g = new Game(scn, { seed: gi + 1 });
    let steps = 700;                       // plenty to exercise; termination not required
    while (g.status === 'play' && steps-- > 0) {
      const c = g.activeChar();
      const moves = [...g.reachable(c).keys()];
      const spells = (c.spells || []).filter(s => s === 'lumos' || g.spellTargets(c, s).length);
      const choice = rnd();
      if (choice < 0.45 && moves.length) {
        const [x, y] = pick(rnd, moves).split(',').map(Number);
        g.moveTo(c, x, y);
      } else if (choice < 0.75 && spells.length) {
        const s = pick(rnd, spells);
        if (SPELLS[s].target === 'ally') {
          const allyT = pick(rnd, g.spellTargets(c, s));
          const ally = g.chars.find(o => o.x === allyT.x && o.y === allyT.y);
          const lands = g.flingTargets(c, ally);
          if (lands.length) g.cast(c, s, allyT.x, allyT.y, { to: pick(rnd, lands) });
          else g.endTurn();
        } else {
          const t = s === 'lumos' ? { x: c.x, y: c.y } : pick(rnd, g.spellTargets(c, s));
          g.cast(c, s, t.x, t.y);
        }
      } else {
        g.endTurn();
      }

      /* ---- invariants ---- */
      ok(['play', 'won', 'lost'].includes(g.status), 'status valid');
      ok(g.housePoints >= 0 && g.housePoints <= CONFIG.startHousePoints, 'house points in range');
      for (const ch of g.chars) ok(ch.down || g.isWalk(ch.x, ch.y), ch.name + ' stands on walkable tile');
      const occ = {};
      for (const ch of g.chars) { if (ch.down) continue; ok(!occ[key(ch.x, ch.y)], 'no two students share a tile'); occ[key(ch.x, ch.y)] = 1; }
      for (const k of g.visible) ok(g.explored.has(k), 'visible ⊆ explored');
      ok(g.treasures === g.loot.filter(L => L.taken).length, 'treasure count matches taken loot');
    }
  }
  console.log('  fuzz[' + label + ']: ' + games + ' games ran clean');
}

/* ---- B) FAIRNESS across seeds ----------------------------------------- */
function fairness(scn, label) {
  const g = new Game(scn);
  const passable = (x, y) => g.def(x, y).walk;       // ON FOOT: doors/rubble/secrets = walls
  const bfs = (sx, sy) => {
    const seen = new Set([key(sx, sy)]);
    let fr = [[sx, sy]];
    while (fr.length) {
      const nf = [];
      for (const [x, y] of fr) for (const [dx, dy] of DIRS) {
        const nx = x + dx, ny = y + dy, k = key(nx, ny);
        if (!g.inBounds(nx, ny) || seen.has(k) || !passable(nx, ny)) continue;
        seen.add(k); nf.push([nx, ny]);
      }
      fr = nf;
    }
    return seen;
  };
  const start = g.chars[0];
  const reach = bfs(start.x, start.y);
  ok(reach.has(key(g.item.x, g.item.y)), label + ': the Cup is reachable ON FOOT');
  let exit = null;
  for (let y = 0; y < g.H; y++) for (let x = 0; x < g.W; x++) if (g.def(x, y).kind === 'exit') exit = { x, y };
  ok(exit && reach.has(key(exit.x, exit.y)), label + ': the way out is reachable ON FOOT');
  for (let y = 0; y < g.H; y++) for (let x = 0; x < g.W; x++) {
    if (g.def(x, y).kind === 'secret') {
      const open = DIRS.some(([dx, dy]) => reach.has(key(x + dx, y + dy)));
      ok(open, label + ': secret wall at ' + x + ',' + y + ' is openable from a reachable tile');
    }
  }
  for (const L of g.loot) if (!L.secret) ok(reach.has(key(L.x, L.y)), label + ': treasure at ' + L.x + ',' + L.y + ' is collectable');
  ok(g.patrols.length >= 2, label + ': at least two patrols');
  ok(g.patrols.some(p => p.dormant), label + ': one patrol starts dormant (the alarm threat)');
}

/* ---- C) VERBS (features located by scan — every dungeon differs) ------ */
function findWithNeighbor(g, kind) {
  for (let y = 0; y < g.H; y++) for (let x = 0; x < g.W; x++) {
    if (g.def(x, y).kind !== kind) continue;
    for (const [dx, dy] of DIRS) if (g.isWalk(x + dx, y + dy) && !g.charAt(x + dx, y + dy) && !g.patrolAt(x + dx, y + dy)) return { x, y, nx: x + dx, ny: y + dy };
  }
  return null;
}
function verbs() {
  const scn = scenarios.dungeon;

  // alohomora: door -> floor (Maya)
  let g = new Game(scn);
  let f = findWithNeighbor(g, 'door');
  ok(!!f, 'generated dungeon contains a reachable door');
  if (f) {
    const maya = g.chars.find(c => c.id === 'rav');
    maya.x = f.nx; maya.y = f.ny; maya.acted = false;
    ok(g.cast(maya, 'alohomora', f.x, f.y), 'Alohomora casts on the door');
    ok(g.def(f.x, f.y).kind === 'floor', 'door -> floor after Alohomora');
  }

  // reducto: rubble -> floor (Robin)
  g = new Game(scn);
  f = findWithNeighbor(g, 'rubble');
  ok(!!f, 'generated dungeon contains reachable rubble');
  if (f) {
    const robin = g.chars.find(c => c.id === 'gry');
    robin.x = f.nx; robin.y = f.ny; robin.acted = false;
    ok(g.cast(robin, 'reducto', f.x, f.y), 'Reducto casts on the rubble');
    ok(g.def(f.x, f.y).kind === 'floor', 'rubble -> floor after Reducto');
  }

  // revelio: secret -> floor (Maya)
  g = new Game(scn);
  f = findWithNeighbor(g, 'secret');
  ok(!!f, 'generated dungeon contains a secret wall');
  if (f) {
    const maya = g.chars.find(c => c.id === 'rav');
    maya.x = f.nx; maya.y = f.ny; maya.acted = false;
    ok(g.cast(maya, 'revelio', f.x, f.y), 'Revelio casts on the cracked wall');
    ok(g.def(f.x, f.y).kind === 'floor', 'secret -> floor after Revelio');
  }

  // lumos widens the lit area (open arena so radius matters)
  g = new Game(scn);
  for (let y = 0; y < g.H; y++) for (let x = 0; x < g.W; x++) g.tiles[y][x] = '.';
  g.chars[1].down = true;
  const r2 = g.chars[0]; r2.x = 15; r2.y = 12; r2.acted = false;
  g.computeVisible();
  const before = g.visible.size;
  g.cast(r2, 'lumos', r2.x, r2.y);
  ok(g.visible.size > before, 'Lumos reveals more of the dark');

  // wingardium floats an adjacent ally (same arena)
  g = new Game(scn);
  for (let y = 0; y < g.H; y++) for (let x = 0; x < g.W; x++) g.tiles[y][x] = '.';
  const a = g.chars[0], b = g.chars[1];
  a.x = 15; a.y = 12; b.x = 16; b.y = 12; a.acted = false;
  g.computeVisible();
  const lands = g.flingTargets(a, b);
  ok(lands.length > 0, 'Wingardium offers landing tiles');
  ok(g.cast(a, 'wingardium', 16, 12, { to: lands[0] }), 'Wingardium floats the ally');
  ok(b.x === lands[0].x && b.y === lands[0].y, 'ally arrives at the landing tile');

  // treasure: walking onto loot collects it
  g = new Game(scn);
  const L0 = g.loot.find(L => !L.secret);
  ok(!!L0, 'a common treasure exists');
  if (L0) {
    const c0 = g.chars[0]; c0.x = L0.x; c0.y = L0.y; g._afterArrive(c0);
    ok(L0.taken && g.treasures === 1, 'walking onto treasure collects it');
  }

  // the heist: pickup raises the alarm, exit with the Cup wins
  g = new Game(scn);
  const carrier = g.chars[0];
  carrier.x = g.item.x; carrier.y = g.item.y; g._afterArrive(carrier);
  ok(g.item.held && g.item.carrier === carrier.id, 'walking onto the Cup picks it up');
  ok(g.alarm === true, 'taking the Cup raises the alarm');
  ok(g.patrols.every(p => !p.dormant && p.alerted), 'the alarm wakes and alerts every patrol');
  let exit = null;
  for (let y = 0; y < g.H; y++) for (let x = 0; x < g.W; x++) if (g.def(x, y).kind === 'exit') exit = { x, y };
  carrier.x = exit.x; carrier.y = exit.y; g.item.x = exit.x; g.item.y = exit.y;
  g._checkWin();
  ok(g.status === 'won', 'reaching the way out with the Cup wins');

  // getting caught: −1 ⭐, sent back, Cup returns home, castle settles
  g = new Game(scn);
  const victim = g.chars[0]; const hp0 = g.housePoints;
  victim.x = g.item.x; victim.y = g.item.y; g._afterArrive(victim);    // alarm on
  g._catch(victim, g.patrols[0]);
  ok(g.housePoints === hp0 - 1, 'getting caught costs a House Point');
  ok(victim.x === g.startPos[0].x && victim.y === g.startPos[0].y, 'caught student is sent back to start');
  ok(!g.item.held && g.item.x === g.item.homeX && g.item.y === g.item.homeY, 'the Cup returns to its spot');
  ok(g.alarm === false && g.patrols.some(p => p.dormant), 'the castle settles after a catch (fresh attempt)');

  // stealth cone: sees ahead, not behind (open arena)
  g = new Game(scn);
  for (let y = 0; y < g.H; y++) for (let x = 0; x < g.W; x++) g.tiles[y][x] = '.';
  const pat = g.patrols[0]; pat.dormant = false; pat.x = 15; pat.y = 10; pat.facing = { dx: 0, dy: 1 }; pat.sight = 4;
  const sneak = g.chars[0];
  sneak.x = 15; sneak.y = 12; ok(g.patrolSees(pat, sneak), 'patrol sees a student in its cone');
  sneak.x = 15; sneak.y = 8; ok(!g.patrolSees(pat, sneak), 'patrol cannot see a student behind it');

  // hint() is ambient: objective + danger only, never prescriptive
  g = new Game(scn);
  const h0 = g.hint();
  ok(/Cup/.test(h0.text) && !/cast/i.test(h0.text), 'hint states the objective without prescribing spells');
  g.patrols[0].dormant = false;
  g.patrols[0].x = g.chars[0].x + 1; g.patrols[0].y = g.chars[0].y;
  ok(g.hint().danger === true, 'hint warns when a patrol is close');
}

/* ---- run ------------------------------------------------------------- */
const N = parseInt(process.argv[2], 10) || 40;
console.log('THE MARAUDERS — tests\n');
console.log('A) fuzz invariants (random play on generated dungeons)');
fuzz(scenarios.dungeon, N, 'seed 7');
fuzz(generate(101), Math.max(10, N >> 2), 'seed 101');
fuzz(generate(202), Math.max(10, N >> 2), 'seed 202');
console.log('B) fairness sweep (every dungeon winnable on foot)');
for (let s = 1; s <= 30; s++) fairness(generate(s), 'seed ' + s);
fairness(scenarios.dungeon, 'seed 7');
console.log('  30+1 seeds: cup/exit/secrets/treasure all reachable');
console.log('C) spell verbs, treasure, heist, catch & stealth');
verbs();

console.log('\n' + (failures ? '✗ ' + failures + ' assertion(s) FAILED' : '✓ all green'));
process.exit(failures ? 1 : 0);
