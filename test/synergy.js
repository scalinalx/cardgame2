/* Synergy audit: proves "when you do X, Y happens" actually fires — both the
 * engine trigger plumbing and that each card/faction is wired correctly. */
const { Game } = require('../js/engine.js');
const data = require('../js/data.js');

const fails = [];
const eq = (name, got, exp) => { if (got !== exp) fails.push(`${name}: got ${got}, expected ${exp}`); };
const ok = (name, cond) => { if (!cond) fails.push(`${name}: not wired`); };

function ready(seed) {
  const g = new Game({ seed });
  g.beginFactionDraft();
  g.chooseFaction(0, g.factionOptions[0][0]);
  g.chooseFaction(1, g.factionOptions[1][0]);
  g.chooseSecretGoal(0, g.players[0].secretOptions[0]);
  g.chooseSecretGoal(1, g.players[1].secretOptions[0]);
  g.resolveResearch(0, []); g.resolveResearch(1, []);
  return g;
}

/* ---------- A. trigger plumbing ---------- */
{ const g = ready(1), p = g.players[g.turn]; p.triggers = [];
  p.triggers.push({ uid: 901, srcUid: -1, type: 'onPlayTag', tag: 'creature', effect: [{ gain: { gold: 5 } }] });
  const b = p.res.gold;
  g._fireTriggers(p, 'onPlayTag', { tag: 'creature' }); eq('onPlayTag fires on match', p.res.gold, b + 5);
  g._fireTriggers(p, 'onPlayTag', { tag: 'magic' });    eq('onPlayTag ignores non-match', p.res.gold, b + 5);
}
{ const g = ready(2), p = g.players[g.turn]; p.triggers = [];
  p.triggers.push({ uid: 902, srcUid: -1, type: 'onRaiseGlobal', param: 'sorcery', effect: [{ gain: { mercury: 1 } }] });
  const m = p.res.mercury, rn = p.renown;
  g.raiseGlobal(p, 'sorcery', 1); eq('onRaiseGlobal(sorcery) fires', p.res.mercury, m + 1); eq('raise grants renown', p.renown, rn + 1);
  const m2 = p.res.mercury; g.raiseGlobal(p, 'realm', 1); eq('onRaiseGlobal param-specific ignores other', p.res.mercury, m2);
}
{ const g = ready(3), p = g.players[g.turn]; p.triggers = [];
  p.triggers.push({ uid: 903, srcUid: -1, type: 'onDiscard', effect: [{ gain: { recruits: 1 } }] });
  p.hand.push('sawmill'); const r = p.res.recruits, gold = p.res.gold;
  g.sellCard(g.turn, 'sawmill'); eq('onDiscard fires on sell', p.res.recruits, r + 1); eq('sell pays 2 gold', p.res.gold, gold + 2);
}
{ const g = ready(4), p = g.players[g.turn]; p.triggers = []; // store on the trigger's SOURCE card
  const entry = { uid: 5000, id: 'vampire_mansion', store: 0, usedAction: false }; p.tableau.push(entry);
  p.triggers.push({ uid: 5001, srcUid: 5000, type: 'onDiscard', effect: [{ store: 1 }] });
  p.hand.push('sawmill'); g.sellCard(g.turn, 'sawmill'); eq('store accrues on source card', entry.store, 1);
}
{ const g = ready(5), p = g.players[g.turn]; p.triggers = []; // a card's own trigger must not fire from its own play
  p.triggers.push({ uid: 42, srcUid: 42, type: 'onPlayTag', tag: 'creature', effect: [{ gain: { gold: 9 } }] });
  const b = p.res.gold; g._fireTriggers(p, 'onPlayTag', { tag: 'creature', excludeUid: 42 }); eq('self-exclusion', p.res.gold, b);
}

/* ---------- B. data wiring (cards) ---------- */
const cardTrig = id => (data.cardById(id).effects || []).filter(o => o.addTrigger).map(o => o.addTrigger);
ok('Adventurers Guild: play Creature → Gold', cardTrig('adventurers_guild').some(t => t.type === 'onPlayTag' && t.tag === 'creature'));
ok('Bracada Bazaar: play Magic → Gold', cardTrig('bracada_bazaar').some(t => t.type === 'onPlayTag' && t.tag === 'magic'));
ok('Cornucopia: play Wealth → Gold', cardTrig('art_cornucopia').some(t => t.type === 'onPlayTag' && t.tag === 'wealth'));
ok('Great Library: raise any → draw', cardTrig('great_library').some(t => t.type === 'onRaiseGlobal' && !t.param));
ok("Spellbinder's Hat: raise Sorcery → draw", cardTrig('art_spellbinders_hat').some(t => t.type === 'onRaiseGlobal' && t.param === 'sorcery'));
ok('Orb of Fire: raise Sorcery → Mercury', cardTrig('art_orb_of_fire').some(t => t.type === 'onRaiseGlobal' && t.param === 'sorcery'));
ok('Cloak of the Undead King: discard → Recruit', cardTrig('art_cloak_undead_king').some(t => t.type === 'onDiscard'));
ok('Vampire Mansion: discard → store', cardTrig('vampire_mansion').some(t => t.type === 'onDiscard'));
ok('Lich Tower: play Undead → Mercury', cardTrig('lich_tower').some(t => t.type === 'onPlayTag' && t.tag === 'undead'));

/* ---------- B2. data wiring (faction passives) ---------- */
const facTrig = id => (data.factionById(id).triggers || []);
ok('Stronghold: play Might → Gold', facTrig('stronghold').some(t => t.type === 'onPlayTag' && t.tag === 'might'));
ok('Inferno: raise Sorcery → Gold', facTrig('inferno').some(t => t.type === 'onRaiseGlobal' && t.param === 'sorcery'));
ok('Necropolis: discard → Recruit', facTrig('necropolis').some(t => t.type === 'onDiscard'));
ok('Conflux: raise Sorcery → draw', facTrig('conflux').some(t => t.type === 'onRaiseGlobal' && t.param === 'sorcery'));
ok('Fortress: play Beast → Recruit', facTrig('fortress').some(t => t.type === 'onPlayTag' && t.tag === 'beast'));

/* ---------- C. end-to-end integration ---------- */
{ const g = ready(7), idx = g.turn, p = g.players[idx]; // Adventurers Guild fires when a Creature is played
  const entry = { uid: 8000, id: 'adventurers_guild', store: 0, usedAction: false }; p.tableau.push(entry);
  g.applyEffects(p, data.cardById('adventurers_guild').effects, { card: entry, playingUid: 8000 });
  p.triggers = p.triggers.filter(t => t.srcUid === 8000); // isolate from faction passives
  p.res.gold = 60; p.hand.push('pikeman_barracks');
  const cost = g.effectiveCost(p, data.cardById('pikeman_barracks')), before = p.res.gold;
  g.playCard(idx, 'pikeman_barracks');
  eq('E2E: Guild +2 Gold on creature play', p.res.gold, before - cost + 2);
}
{ const g = ready(8), idx = g.turn, p = g.players[idx]; // Great Library draws when a track is raised
  const entry = { uid: 8100, id: 'great_library', store: 0, usedAction: false }; p.tableau.push(entry);
  g.applyEffects(p, data.cardById('great_library').effects, { card: entry, playingUid: 8100 });
  p.triggers = p.triggers.filter(t => t.srcUid === 8100);
  const hand = p.hand.length; g.raiseGlobal(p, 'realm', 1);
  eq('E2E: Library draws on raise', p.hand.length, hand + 1);
}
{ const g = ready(9), idx = g.turn, p = g.players[idx]; // prodPerTag scales with tags in play (Faerie Dragon)
  // give two dragon-tag cards + the scaler, all in tableau, then apply scaler effect
  for (const id of ['red_dragon_cave', 'gold_dragon_vault']) p.tableau.push({ uid: 8200 + Math.floor(Math.random ? 0 : 0), id, store: 0 });
  const e = { uid: 8299, id: 'faerie_dragon_glade', store: 0 }; p.tableau.push(e);
  const m = p.prod.mercury;
  g.applyEffects(p, data.cardById('faerie_dragon_glade').effects, { card: e, playingUid: 8299 });
  eq('prodPerTag: +1 Mercury prod per Dragon tag (3 dragons)', p.prod.mercury, m + 3);
}

if (fails.length) { console.log('SYNERGY FAILURES:\n' + fails.join('\n')); process.exit(1); }
console.log('SYNERGY AUDIT: all 25 trigger/synergy checks passed ✔');
