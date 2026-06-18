/* Sensible-bot balance read for the region-funnel melee model.
 * Deploy defenders where foes are massing (prefer the gate/court chokepoints),
 * blast the most-advanced foe, heal/shield when hurt, drain morale.
 * Usage: node test/balance.js [gamesPerCell] [difficulty]                */
const { Game } = require('../js/engine.js');
const data = require('../js/data.js');
const HOUSES = Object.keys(data.HOUSES);
const PLAY = data.REGIONS.filter(r => r.side === 'play').map(r => r.id);

function has(c, k) { return (c.onPlay || []).concat(c.onDeploy || []).some(f => f[k]); }
function hotRegion(g) { // region with the most-advanced / most foes
  let best = 'gate', bs = -1;
  PLAY.forEach(rid => { const s = g.foesIn(rid).reduce((x, f) => x + f.hp + f.step * 3, 0); if (s > bs) { bs = s; best = rid; } });
  return best;
}
function score(c, g, p) {
  const foes = g.foes.length, hurt = g.castleHp < 0.6 * g.castleMax;
  const nearGate = g.foes.some(f => f.step >= 2);          // foes in court/gate → breach risk
  if (c.intangible) return 13;                              // a free permanent chipper — always field it
  if (c.type === 'ally') return 10;
  if (has(c, 'summon')) return 9;
  if (has(c, 'castleHeal') && hurt) return 11;
  if (has(c, 'castleShield')) return nearGate ? 10.5 : (hurt ? 9 : 1); // shield BEFORE the breach lands
  if (has(c, 'freeze') || has(c, 'freezeLane') || has(c, 'control') || has(c, 'push')) return foes ? (nearGate ? 8.5 : 7.5) : 0.5;
  if (has(c, 'execute')) return foes ? 8 : 0.5;
  if (has(c, 'damage') || has(c, 'globalDamage') || has(c, 'perSpellDamage')) return foes ? 7 : 0.5;
  if (has(c, 'morale')) return 5;
  if (has(c, 'heal') && g.allies.some(a => a.ownerIdx === p.idx && a.hp < a.maxHp)) return 6;
  if (has(c, 'draw') || has(c, 'mana')) return 2;
  return 3;
}
function turn(g, idx) {
  let G = 0;
  while (!g.over && G++ < 40) {
    const p = g.players[idx];
    const pl = g.listActions(idx).filter(a => a.kind === 'play').map(a => ({ a, s: score(a.card, g, p) })).sort((x, y) => y.s - x.s);
    const usePow = !p.powerUsed && g.house(p).power.cost <= p.mana;
    const bp = pl[0];
    if (usePow && (!bp || bp.s < 8)) { const n = g.powerNeeds(idx), o = {}; if (n.region) o.region = hotRegion(g); if (n.enemy) { const e = g._mostThreatening(); if (e) o.enemyUid = e.uid; } if (g.useHousePower(idx, o).ok) continue; }
    if (!bp) break;
    const c = bp.a.card, n = g.needsTargets(c), o = {};
    // deploy defenders to the gate/court chokepoints unless a ground is hot
    if (n.region) o.region = (c.type === 'ally') ? (g.foesIn('court').length || g.foesIn('gate').length ? (g.foesIn('gate').length ? 'gate' : 'court') : hotRegion(g)) : hotRegion(g);
    if (n.enemy) { const e = g._mostThreatening(); if (e) o.enemyUid = e.uid; }
    if (n.ally) { const a = g._lowestAlly(idx); if (a) o.allyUid = a.uid; }
    if (!g.playCard(idx, bp.a.uid, o).ok) break;
  }
}
function run(seed, houses, diff) {
  const g = new Game({ seed, difficulty: diff, players: houses.map((h, i) => ({ name: 'P' + i, house: h })) });
  let lo = 100, r = 0;
  while (!g.over && r++ < 80) { for (let i = 0; i < houses.length && !g.over; i++) { turn(g, i); g.endTurn(i); } lo = Math.min(lo, g.castleHp); }
  return { win: g.over === 'win', lo, rounds: g.round };
}
const N = parseInt(process.argv[2] || '150', 10);
const diff = process.argv[3] || 'standard';
console.log(`Sensible-bot · difficulty=${diff} · ${N} games/cell`);
for (const np of [1, 2]) {
  console.log(`=== ${np}P ===`);
  for (const h of HOUSES) {
    let w = 0, danger = 0, mw = [], rr = [];
    for (let s = 1; s <= N; s++) { const houses = []; for (let i = 0; i < np; i++) houses.push(h); const r = run(s, houses, diff); if (r.win) w++; if (r.lo < 60) danger++; mw.push(r.lo); rr.push(r.rounds); }
    console.log(`  ${h.padEnd(11)} win ${(100 * w / N).toFixed(0).padStart(3)}%  · wards<60 ${(100 * danger / N).toFixed(0).padStart(3)}%  · avg-low ${Math.round(mw.reduce((a, b) => a + b) / N)}  · rounds ${(rr.reduce((a, b) => a + b) / N).toFixed(1)}`);
  }
}
