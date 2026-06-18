/* Headless fuzz test: play many random complete games, check invariants. */
const { Game } = require('../js/engine.js');
const data = require('../js/data.js');

function pick(rng, arr) { return arr[Math.floor(rng() * arr.length)]; }

// deterministic-ish per-game rng for the bot (separate from engine rng)
function botRng(seed) {
  let a = seed | 0;
  return function () { a |= 0; a = (a + 0x9E3779B9) | 0; let t = Math.imul(a ^ (a >>> 16), 0x45d9f3b); t ^= t >>> 16; return (t >>> 0) / 4294967296; };
}

function checkInvariants(g, tag) {
  for (const p of g.players) {
    for (const k of data.RES) {
      if (p.res[k] < 0) throw new Error(`${tag}: ${p.name} negative ${k}=${p.res[k]}`);
      if (!Number.isFinite(p.res[k])) throw new Error(`${tag}: ${p.name} non-finite ${k}`);
    }
    if (p.renown < 0) throw new Error(`${tag}: negative renown`);
  }
  for (const k in g.params) {
    if (g.params[k] < 0 || g.params[k] > data.GLOBALS[k].max) throw new Error(`${tag}: param ${k}=${g.params[k]} out of range`);
  }
}

function actionScore(desc) {
  // bias the bot toward progressing the game and building an engine
  switch (desc.kind) {
    case 'play': return 6;
    case 'standard':
      if (desc.key === 'channel' || desc.key === 'conquer' || desc.key === 'settle') return 7;
      return 3;
    case 'convertRecruits': return 7;
    case 'convertMercury': return 7;
    case 'cardAction': return 5;
    case 'factionAction': return 5;
    case 'milestone': return 8;
    case 'award': return 4;
    case 'wonder': return 6;
    case 'quest': return 6;
    case 'forge': return 4;
    case 'transmute': return 3;
    case 'sell': return 0.2;
    case 'pass': return 0.05;
  }
  return 1;
}

function playGame(seed) {
  const g = new Game({ seed, names: ['Bot A', 'Bot B'] });
  const brng = botRng(seed * 2654435761 + 12345);

  // first-player roll, then choose factions, then draft a secret objective
  g.beginFactionDraft();
  for (let i = 0; i < 2; i++) g.chooseFaction(i, pick(brng, g.factionOptions[i]));
  for (let i = 0; i < 2; i++) g.chooseSecretGoal(i, pick(brng, g.players[i].secretOptions));
  if (g.phase !== 'research') throw new Error('expected research after goal draft');

  let guard = 0;
  while (!g.over) {
    if (++guard > 200000) throw new Error('runaway loop');
    if (g.phase === 'research') {
      for (let i = 0; i < 2; i++) {
        if (g.players[i].researchDone) continue;
        const p = g.players[i];
        const affordable = Math.floor(p.res.gold / 3);
        const keepN = Math.min(p.pendingResearch.length, affordable, 2 + Math.floor(brng() * 3));
        const shuffled = p.pendingResearch.slice().sort(() => brng() - 0.5);
        g.resolveResearch(i, shuffled.slice(0, keepN));
      }
      checkInvariants(g, `gen${g.gen}-research`);
      continue;
    }
    if (g.phase === 'action') {
      const idx = g.turn;
      // A full turn: take several beneficial actions, then end-turn or pass.
      let took = 0;
      while (true) {
        const acts = g.availableActions(idx).filter(a => a.kind !== 'pass' && a.kind !== 'sell');
        if (acts.length === 0) break;
        if (took >= 1 && brng() < 0.3) break;   // sometimes yield to opponent
        if (took >= 8) break;
        const weights = acts.map(actionScore);
        const total = weights.reduce((a, b) => a + b, 0);
        let r = brng() * total, chosen = acts[acts.length - 1];
        for (let k = 0; k < acts.length; k++) { r -= weights[k]; if (r <= 0) { chosen = acts[k]; break; } }
        // placement actions need a target hex
        if (chosen.kind === 'convertRecruits' || (chosen.kind === 'standard' && ['conquer', 'settle', 'town'].includes(chosen.key))) {
          const empties = g.emptyHexes();
          chosen.hexId = empties[Math.floor(brng() * empties.length)];
        }
        const res = g.perform(idx, chosen);
        if (!res.ok) throw new Error(`action failed: ${chosen.kind} -> ${res.reason}`);
        checkInvariants(g, `gen${g.gen}-action`);
        took++;
      }
      // a turn with no action means the player has nothing to do → pass out
      if (took === 0 || brng() < 0.35) g.pass(idx);
      else g.endTurn(idx);
      checkInvariants(g, `gen${g.gen}-endturn`);
      continue;
    }
    throw new Error('unexpected phase ' + g.phase);
  }
  if (!g.finalScores) throw new Error('no final scores');
  for (const s of g.finalScores) if (!Number.isFinite(s.total)) throw new Error('bad score');
  return g;
}

let N = parseInt(process.argv[2] || '500', 10);
let endedByMax = 0, endedByParams = 0, gensSum = 0, undoTested = false;
const winMargins = [];
for (let s = 1; s <= N; s++) {
  const g = playGame(s);
  gensSum += g.gen;
  if (g.allMaxed()) endedByParams++; else endedByMax++;
  winMargins.push(Math.abs(g.finalScores[0].total - g.finalScores[1].total));
}

// quick undo sanity test
{
  const g = new Game({ seed: 42 });
  g.beginFactionDraft();
  g.chooseFaction(0, g.factionOptions[0][0]);
  g.chooseFaction(1, g.factionOptions[1][0]);
  g.chooseSecretGoal(0, g.players[0].secretOptions[0]);
  g.chooseSecretGoal(1, g.players[1].secretOptions[0]);
  g.resolveResearch(0, []);
  g.resolveResearch(1, []);
  const before = JSON.stringify({ p: g.players, params: g.params });
  const idx = g.turn;
  g.standardProject(idx, g.players[idx].res.gold >= 14 ? 'channel' : 'mageTower');
  if (!g.canUndo()) throw new Error('expected undo available');
  g.undo();
  const after = JSON.stringify({ p: g.players, params: g.params });
  if (before !== after) throw new Error('undo did not restore state exactly');
  undoTested = true;
}

console.log(`Ran ${N} games. avg gens=${(gensSum / N).toFixed(1)} | ended by all-maxed=${endedByParams} by gen-cap=${endedByMax}`);
console.log(`avg win margin=${(winMargins.reduce((a, b) => a + b, 0) / N).toFixed(1)} | undo test=${undoTested ? 'OK' : 'FAIL'}`);
console.log('ALL INVARIANTS PASSED ✔');
