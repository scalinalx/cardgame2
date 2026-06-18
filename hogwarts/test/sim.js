/* Headless fuzz: play many random complete games, assert invariants.
 * Region-funnel melee model.  Usage: node test/sim.js [count]            */
const { Game } = require('../js/engine.js');
const data = require('../js/data.js');
const HOUSES = Object.keys(data.HOUSES);
const PLAY = data.REGIONS.filter(r => r.side === 'play').map(r => r.id);

function botRng(seed) { let a = seed | 0; return function () { a |= 0; a = (a + 0x9E3779B9) | 0; let t = Math.imul(a ^ (a >>> 16), 0x45d9f3b); t ^= t >>> 16; return (t >>> 0) / 4294967296; }; }
function pick(rng, arr) { return arr[Math.floor(rng() * arr.length)]; }

function invariants(g, tag) {
  if (g.castleHp < 0 || g.castleHp > g.castleMax) throw new Error(`${tag}: castle ${g.castleHp}`);
  if (g.morale < 0 || g.morale > g.moraleMax) throw new Error(`${tag}: morale ${g.morale}`);
  for (const p of g.players) { if (p.mana < 0 || !Number.isFinite(p.mana)) throw new Error(`${tag}: ${p.name} mana ${p.mana}`); }
  for (const a of g.allies) { if (a.hp > a.maxHp) throw new Error(`${tag}: ally ${a.name} hp>${a.maxHp}`); if (a.ownerIdx == null) throw new Error(`${tag}: ally no owner`); if (!PLAY.includes(a.region)) throw new Error(`${tag}: ally bad region ${a.region}`); }
  for (const f of g.foes) { if (f.hp <= 0) throw new Error(`${tag}: dead foe on board ${f.name}`); if (f.step < 0 || f.step > g.cfg.gateStep + 1) throw new Error(`${tag}: foe step ${f.step}`); }
}

function playTurn(g, idx, rng) {
  let guard = 0;
  while (!g.over && guard++ < 40) {
    const acts = g.listActions(idx).filter(a => a.kind !== 'end');
    if (!acts.length) break;
    const act = pick(rng, acts);
    if (act.kind === 'power') {
      const need = g.powerNeeds(idx); const o = {};
      if (need.region) o.region = pick(rng, PLAY);
      if (need.enemy) { const f = g.foes; if (f.length) o.enemyUid = pick(rng, f).uid; }
      if (!g.useHousePower(idx, o).ok) break;
    } else {
      const card = act.card; const need = g.needsTargets(card); const o = {};
      if (need.region) o.region = pick(rng, PLAY);
      if (need.enemy) { if (g.foes.length) o.enemyUid = pick(rng, g.foes).uid; }
      if (need.ally) { const as = g.allies.filter(a => a.ownerIdx === idx); if (as.length) o.allyUid = pick(rng, as).uid; }
      if (!g.playCard(idx, act.uid, o).ok) break;
    }
  }
}

function runGame(seed, nPlayers, diff) {
  const rng = botRng(seed * 2654435761);
  const players = []; for (let i = 0; i < nPlayers; i++) players.push({ name: 'P' + (i + 1), house: pick(rng, HOUSES) });
  const g = new Game({ seed, players, difficulty: diff });
  let rounds = 0;
  while (!g.over && rounds < 80) {
    for (let i = 0; i < nPlayers && !g.over; i++) {
      playTurn(g, i, rng); invariants(g, `seed ${seed} r${g.round} p${i} pre`);
      g.endTurn(i); invariants(g, `seed ${seed} r${g.round} p${i} post`);
    }
    rounds++;
  }
  if (!g.over) throw new Error(`seed ${seed}: unfinished in ${rounds} (ward ${g.castleHp}, morale ${g.morale})`);
  return { result: g.over, rounds: g.round };
}

const N = parseInt(process.argv[2] || '500', 10);
const diffs = ['standard', 'hard', 'legendary'];
let wins = 0, losses = 0; const rh = [];
for (let s = 1; s <= N; s++) {
  const np = 1 + (s % 2);
  const diff = diffs[s % 3];
  const r = runGame(s, np, diff);
  if (r.result === 'win') wins++; else losses++; rh.push(r.rounds);
}
const avg = (rh.reduce((a, b) => a + b, 0) / rh.length).toFixed(1);
console.log(`✓ ${N} games OK (mixed 1p/2p · all difficulties). wins ${wins} (${(100 * wins / N).toFixed(0)}%) · losses ${losses} · avg ${avg} rounds.`);
