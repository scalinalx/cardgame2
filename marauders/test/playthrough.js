/* =====================================================================
 * THE MARAUDERS — full playthrough bot
 * ---------------------------------------------------------------------
 *   node test/playthrough.js [seed]     play one dungeon, log every step
 *   node test/playthrough.js --batch N  play N generated dungeons, summary
 *
 * Plays like a real player: route the active student toward the goal
 * (Cup, then the way out), prefer tiles no patrol is watching, end turn.
 * Proves whole generated dungeons are completable, not just unit-tested.
 * ===================================================================== */
'use strict';
const data = require('../js/data.js');
const { Game } = require('../js/engine.js');
const DIRS = [[1, 0], [-1, 0], [0, 1], [0, -1]];
const key = (x, y) => x + ',' + y;

function run(seed, verbose) {
  const scn = data.generate(seed);
  const g = new Game(scn, { seed });
  let exit = null;
  for (let y = 0; y < g.H && !exit; y++) for (let x = 0; x < g.W; x++) if (g.def(x, y).kind === 'exit') { exit = { x, y }; break; }
  const exitSide = DIRS.map(([dx, dy]) => ({ x: exit.x + dx, y: exit.y + dy })).find(t => g.isWalk(t.x, t.y));

  const log = [];
  let cur = 0;
  const drain = () => { while (cur < g.log.length) log.push('      · ' + g.log[cur++].msg); };

  const goal = () => {
    const c = g.activeChar();
    if (!g.item.held) {
      // only the CLOSEST student runs for the Cup; the other waits near home
      const ds = g.chars.filter(o => !o.down).map(o => ({ o, d: Math.abs(o.x - g.item.x) + Math.abs(o.y - g.item.y) }));
      ds.sort((a, b) => a.d - b.d);
      return (ds[0].o === c) ? { x: g.item.x, y: g.item.y } : exitSide;
    }
    return (g.item.carrier === c.id) ? exit : exitSide;   // non-carrier waits BESIDE the exit
  };
  const isGoal = (x, y) => { const t = goal(); return x === t.x && y === t.y; };
  const dGoal = (x, y) => { const t = goal(); return Math.abs(x - t.x) + Math.abs(y - t.y); };

  const routeWith = (sx, sy, patrolsBlock) => {
    const seen = new Set([key(sx, sy)]);
    let fr = [{ x: sx, y: sy, path: [] }];
    while (fr.length) {
      const nf = [];
      for (const n of fr) {
        if (isGoal(n.x, n.y)) return n.path;
        for (const [dx, dy] of DIRS) {
          const nx = n.x + dx, ny = n.y + dy, k = key(nx, ny);
          if (seen.has(k)) continue;
          if (!g.isWalk(nx, ny)) continue;           // teammates are pass-through, like the engine
          if (patrolsBlock && g.patrolAt(nx, ny)) continue;
          seen.add(k); nf.push({ x: nx, y: ny, path: n.path.concat([{ x: nx, y: ny }]) });
        }
      }
      fr = nf;
    }
    return null;
  };
  // patrols move every round — if one stands on the only corridor, plan
  // through its tile anyway and stop short of it (a human would shadow it)
  const route = (sx, sy) => routeWith(sx, sy, true) || routeWith(sx, sy, false);
  const danger = (x, y) => {
    for (const p of g.patrols) {
      if (p.dormant) continue;
      if (Math.abs(p.x - x) + Math.abs(p.y - y) <= 1) return true;
      if (g.patrolSees(p, { x, y, down: false, lumos: false })) return true;
    }
    return false;
  };

  log.push('START seed ' + seed + '  team ' + g.chars.map(c => c.name + '@' + c.x + ',' + c.y).join(' ') +
    '  Cup@' + g.item.x + ',' + g.item.y + '  Exit@' + exit.x + ',' + exit.y +
    '  patrols ' + g.patrols.map(p => p.name + (p.dormant ? '(asleep)' : '') + '@' + p.x + ',' + p.y).join(' '));

  let safety = 320;
  while (g.status === 'play' && safety-- > 0) {
    const c = g.activeChar();
    const before = c.x + ',' + c.y;
    const path = route(c.x, c.y);
    const reach = g.reachable(c);

    let dest = null, note = '';
    if (path) for (let i = path.length - 1; i >= 0; i--) { if (reach.has(key(path[i].x, path[i].y))) { dest = path[i]; break; } }
    if (dest && danger(dest.x, dest.y)) {
      let best = null, bd = 1e9;
      for (const k of reach.keys()) { const [x, y] = k.split(',').map(Number); if (danger(x, y)) continue; const d = dGoal(x, y); if (d < bd) { bd = d; best = { x, y }; } }
      if (best && bd < dGoal(c.x, c.y)) { dest = best; note = ' (detour)'; }
      else if (g.alarm && g.item.held && g.item.carrier === c.id) note = ' (pressing through danger)';  // only a fleeing carrier gambles
      else if (!danger(c.x, c.y)) { dest = null; note = ' (waits for the patrol to pass)'; }
      else { dest = null; }                                   // in danger with no good move: retreat below
    }

    let action;
    if (!dest && danger(c.x, c.y)) {                  // standing in danger: retreat, don't freeze
      let best = null, bd = -1;
      for (const k of reach.keys()) {
        const [x, y] = k.split(',').map(Number);
        if (danger(x, y)) continue;
        const d = Math.min(...g.patrols.filter(p => !p.dormant).map(p => Math.abs(p.x - x) + Math.abs(p.y - y)));
        if (d > bd) { bd = d; best = { x, y }; }
      }
      if (best) { dest = best; note = ' (retreats)'; }
    }
    if (dest && (dest.x !== c.x || dest.y !== c.y)) { g.moveTo(c, dest.x, dest.y); action = 'moves ' + before + ' → ' + c.x + ',' + c.y + note; }
    else if (!path) action = 'NO ROUTE — stuck';
    else action = 'waits';

    log.push('R' + g.turn + ' ' + c.name + ': ' + action + '  | HP ' + g.housePoints + (g.alarm ? ' ALARM' : '') +
      ' | ' + g.patrols.map(p => p.name[0] + (p.dormant ? 'z' : (p.alerted ? '!' : '')) + p.x + ',' + p.y).join(' '));
    drain();
    if (g.status !== 'play') break;
    g.endTurn();
    drain();
  }
  log.push('FINAL seed ' + seed + ': ' + g.status.toUpperCase() + ' after ' + g.turn + ' rounds, ' +
    g.housePoints + ' ⭐ left, treasures ' + g.treasures + '/' + g.loot.length);
  if (verbose) console.log(log.join('\n'));
  return { seed, status: g.status, rounds: g.turn, hp: g.housePoints, treasures: g.treasures, lootTotal: g.loot.length };
}

/* ---- CLI ---------------------------------------------------------------- */
const args = process.argv.slice(2);
if (args[0] === '--batch') {
  const n = parseInt(args[1], 10) || 12;
  const results = [];
  for (let s = 1; s <= n; s++) results.push(run(s, false));
  let wins = 0;
  for (const r of results) {
    if (r.status === 'won') wins++;
    console.log('seed ' + String(r.seed).padStart(3) + '  ' + r.status.toUpperCase().padEnd(5) +
      '  rounds ' + String(r.rounds).padStart(3) + '  ⭐' + r.hp + '  ✨' + r.treasures + '/' + r.lootTotal);
  }
  console.log('\n' + wins + '/' + n + ' dungeons won by the bot');
  process.exit(wins >= Math.ceil(n * 0.5) ? 0 : 1);   // most dungeons must be winnable
} else {
  const seed = parseInt(args[0], 10) || 7;
  const r = run(seed, true);
  process.exit(r.status === 'won' ? 0 : 1);
}
