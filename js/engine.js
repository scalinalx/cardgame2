/* =====================================================================
 * CONQUEST OF ERATHIA — engine.js
 * Pure game-rules engine (no DOM). Drives a 2-player hotseat match.
 * ===================================================================== */
(function (global) {
  'use strict';

  const data = (typeof require !== 'undefined') ? require('./data.js')
    : (global.HK && global.HK.data);
  const { RES, CARDS, FACTIONS, MILESTONES, AWARDS, SECRET_GOALS, FACTION_CARDS, CARD_FACTION, MAP, WONDER_VP,
    QUESTS, QUEST_BOARD_SIZE, cardById, factionById, goalById, questById } = data;

  function mulberry32(a) {
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  const STANDARD = {
    mageTower: { name: 'Build Mage Guild', cost: 11, blurb: '+1 Mercury production' },
    channel:   { name: 'Study Sorcery', cost: 14, blurb: '+1 Sorcery (Renown +1)' },
    conquer:   { name: 'Clear a Region', cost: 18, blurb: '+1 Frontier, +2 Gold plunder, flag a region' },
    settle:    { name: 'Found Town', cost: 23, blurb: '+1 Realm, raise a town (Renown +1, 1 VP)' },
    town:      { name: 'Flag a Mine', cost: 14, blurb: "+1 production of the hex's resource, claim a mine" },
  };
  const AWARD_COSTS = [8, 14, 20];
  const MILESTONE_COST = 8;
  const SELL_PRICE = 2;
  const RESEARCH_BUY = 3;
  const MAX_GENS = 40;
  // Wood/Crystal are NOT spent per card. They are standing-discount tracks (Ares-style):
  // your Wood production = "Sawmill" level (cheapens Building cards); Crystal production =
  // "Mana Vault" level (cheapens Magic cards). Discount = rate × level, applied in
  // effectiveCost(). The tracks grow only from "+X production" sources, never accumulate as stock.
  const SAWMILL_RATE = 2; // Gold off each Building card per Sawmill (Wood) level — TUNING KNOB
  const MANA_RATE = 2;    // Gold off each Magic card per Mana Vault (Crystal) level — TUNING KNOB
  const QUEST_RENOWN = 1; // every completed Adventure also grants this much Renown — TUNING KNOB
  // Shared pool of scoring counters per player, across ALL "store a counter" cards combined.
  // Caps the per-counter VP engine (e.g. 20 counters → at most 10 VP at the usual 1-per-2 rate).
  const COUNTER_BUDGET = 20; // TUNING KNOB

  function emptyRes() { return { gold: 0, wood: 0, ore: 0, crystal: 0, recruits: 0, mercury: 0 }; }

  class Game {
    constructor(opts = {}) {
      this.seed = (opts.seed != null) ? (opts.seed | 0) : (Math.floor(Math.random() * 2 ** 31) | 0);
      this.rng = mulberry32(this.seed);
      this.uid = 0;
      this.gen = 1;
      this.params = { realm: 0, sorcery: 0, frontier: 0 };
      this.proclamation = null;
      const names = opts.names || ['Player 1', 'Player 2'];
      this.players = [this._mkPlayer(0, names[0]), this._mkPlayer(1, names[1])];
      // Public deck = every card NOT owned by a Town.
      this.deck = this._shuffle(CARDS.filter(c => !CARD_FACTION[c.id]).map(c => c.id));
      this.discard = [];
      this._genMap();
      // Roll a D12 for first player: 1–6 → Player 1, 7–12 → Player 2.
      const roll = 1 + Math.floor(this.rng() * 12);
      this.firstRoll = { value: roll, player: roll <= 6 ? 0 : 1 };
      this.finalWeek = null; // set when a Wonder completes → the last week to play
      this.questDeck = this._shuffle(QUESTS.map(q => q.id));
      this.questBoard = [];
      this._fillQuests();
      this.starter = this.firstRoll.player;
      this.turn = this.starter;
      this.passed = [false, false];
      this.phase = 'setup-roll';
      this.milestones = MILESTONES.map(m => ({ id: m.id, claimedBy: null }));
      this.awards = AWARDS.map(a => ({ id: a.id, fundedBy: null, order: 0 }));
      this.milestonesClaimedCount = 0;
      this.awardsFundedCount = 0;
      this.logLines = [];
      this.over = false;
      this.finalScores = null;
      this.undoStack = [];
      // Deal disjoint faction options (3 each).
      const pool = this._shuffle(FACTIONS.map(f => f.id));
      this.factionOptions = [pool.slice(0, 3), pool.slice(3, 6)];
    }

    // After the first-player roll is shown, open the faction draft.
    beginFactionDraft() {
      if (this.phase !== 'setup-roll') return { ok: false, reason: 'Not at the roll' };
      this.phase = 'setup-faction';
      return { ok: true };
    }

    _mkPlayer(idx, name) {
      return {
        idx, name, faction: null,
        res: emptyRes(), prod: emptyRes(), renown: 20,
        hand: [], tableau: [], triggers: [],
        tiles: { town: 0, mine: 0, region: 0 },
        eventVP: 0, countersUsed: 0,
        settlementCost: 8,
        discounts: {},
        factionActionDef: null,
        factionActionUsed: false,
        protect: false,
        factionDeck: [], factionDiscard: [],
        secretGoal: null, secretOptions: [],
        wonderStage: 0, wonderComplete: false,
        pendingResearch: [],
        researchDone: false,
      };
    }

    /* --------------------------- the map ------------------------------ */
    _genMap() {
      const R = MAP.radius;
      const pick = arr => arr[Math.floor(this.rng() * arr.length)];
      const hexes = {}; const order = [];
      for (let q = -R; q <= R; q++) {
        for (let r = Math.max(-R, -q - R); r <= Math.min(R, -q + R); r++) {
          const id = q + ',' + r;
          hexes[id] = { id, q, r, terrain: pick(MAP.terrains), bonus: pick(MAP.bonusPool), mine: pick(MAP.minePool), tile: null };
          order.push(id);
        }
      }
      this.map = { radius: R, hexes, order };
    }
    hexNeighbors(id) {
      const [q, r] = id.split(',').map(Number);
      const dirs = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, -1], [-1, 1]];
      const out = [];
      for (const [dq, dr] of dirs) { const nid = (q + dq) + ',' + (r + dr); if (this.map.hexes[nid]) out.push(nid); }
      return out;
    }
    emptyHexes() { return this.map.order.filter(id => !this.map.hexes[id].tile); }

    /* ----------------------------- RNG -------------------------------- */
    _shuffle(arr) {
      const a = arr.slice();
      for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(this.rng() * (i + 1));
        [a[i], a[j]] = [a[j], a[i]];
      }
      return a;
    }

    log(msg) { this.logLines.push(msg); if (this.logLines.length > 400) this.logLines.shift(); }

    /* ---------------------------- helpers ----------------------------- */
    current() { return this.players[this.turn]; }
    other(p) { return this.players[1 - p.idx]; }
    tagCount(p, tag) {
      let n = 0;
      for (const e of p.tableau) { const c = cardById(e.id); if (c.tags && c.tags.includes(tag)) n++; }
      return n;
    }
    allMaxed() {
      return this.params.realm >= data.GLOBALS.realm.max &&
        this.params.sorcery >= data.GLOBALS.sorcery.max &&
        this.params.frontier >= data.GLOBALS.frontier.max;
    }

    /* --------------------------- card draw ---------------------------- */
    _drawPublic() {
      if (this.deck.length === 0) {
        if (this.discard.length === 0) return null;
        this.deck = this._shuffle(this.discard); this.discard = [];
      }
      return this.deck.pop();
    }
    _drawFaction(p) {
      if (p.factionDeck.length === 0) {
        if (p.factionDiscard.length === 0) return null;
        p.factionDeck = this._shuffle(p.factionDiscard); p.factionDiscard = [];
      }
      return p.factionDeck.pop();
    }
    draw(p, n) {
      const got = [];
      for (let i = 0; i < n; i++) { const id = this._drawPublic(); if (id == null) break; p.hand.push(id); got.push(id); }
      return got;
    }
    // silent = true → does not fire onDiscard triggers (e.g. research discards).
    // Town-signature cards return to their owner's private pile, never the shared deck.
    discardCard(p, id, silent) {
      if (CARD_FACTION[id] === p.faction) p.factionDiscard.push(id); else this.discard.push(id);
      if (!silent) this._fireTriggers(p, 'onDiscard', {});
    }

    // Place a Town / Mine / Region on an empty hex and apply its bonuses.
    _placeTile(p, type, hexId) {
      const hex = this.map.hexes[hexId];
      if (!hex || hex.tile) return false;
      hex.tile = { type, owner: p.idx };
      p.tiles[type] = (p.tiles[type] || 0) + 1;
      let adjRegions = 0;
      for (const nid of this.hexNeighbors(hexId)) { const t = this.map.hexes[nid].tile; if (t && t.type === 'region') adjRegions++; }
      if (adjRegions) p.res.gold += 2 * adjRegions; // plunder near cleared land
      if (hex.bonus) this.applyEffects(p, [hex.bonus], {});
      if (type === 'mine') this.changeProd(p, hex.mine || 'gold', 1);
      return true;
    }

    /* --------------------------- production --------------------------- */
    changeProd(p, res, v) {
      let nv = p.prod[res] + v;
      const floor = (res === 'gold') ? -5 : 0;
      if (nv < floor) nv = floor;
      p.prod[res] = nv;
    }

    /* ----------------------- effect interpreter ----------------------- */
    applyEffects(p, effects, ctx) {
      ctx = ctx || {};
      for (const op of effects) this._applyOp(p, op, ctx);
    }
    _applyOp(p, op, ctx) {
      if (op.gain) for (const k in op.gain) p.res[k] = Math.max(0, p.res[k] + op.gain[k]);
      if (op.prod) for (const k in op.prod) this.changeProd(p, k, op.prod[k]);
      if (op.global) for (const param in op.global) this.raiseGlobal(p, param, op.global[param], ctx);
      if (op.renown != null) p.renown = Math.max(0, p.renown + op.renown);
      if (op.draw) this.draw(p, op.draw);
      if (op.vpNow) p.eventVP += op.vpNow;
      if (op.store != null && ctx.card && op.store > 0) {
        // counters come from the player's shared, capped pool (COUNTER_BUDGET total)
        const add = Math.min(op.store, Math.max(0, COUNTER_BUDGET - (p.countersUsed || 0)));
        if (add > 0) { ctx.card.store = (ctx.card.store || 0) + add; p.countersUsed = (p.countersUsed || 0) + add; }
      }
      if (op.gainPerTag) {
        const n = Math.floor(this.tagCount(p, op.gainPerTag.tag) / (op.gainPerTag.per || 1));
        p.res[op.gainPerTag.res] = Math.max(0, p.res[op.gainPerTag.res] + n);
      }
      if (op.prodPerTag) {
        const n = Math.floor(this.tagCount(p, op.prodPerTag.tag) / (op.prodPerTag.per || 1));
        this.changeProd(p, op.prodPerTag.res, n);
      }
      if (op.gainPerTile) { // one-time gain scaled by tiles you hold (town|mine|region)
        const n = Math.floor((p.tiles[op.gainPerTile.tile] || 0) / (op.gainPerTile.per || 1)) * (op.gainPerTile.mult || 1);
        p.res[op.gainPerTile.res] = Math.max(0, p.res[op.gainPerTile.res] + n);
      }
      if (op.addTrigger) {
        const t = op.addTrigger;
        p.triggers.push({ uid: ++this.uid, srcUid: ctx.card ? ctx.card.uid : -1, type: t.type, tag: t.tag, param: t.param, effect: t.effect });
      }
      if (op.addAction && ctx.card) {
        ctx.card.action = { cost: op.addAction.cost, effect: op.addAction.effect, desc: op.addAction.desc };
      }
      if (op.attackProd) {
        const opp = this.other(p);
        if (!opp.protect) this.changeProd(opp, op.attackProd.res, -op.attackProd.n);
      }
      if (op.attackRes) {
        const opp = this.other(p);
        if (!opp.protect) opp.res[op.attackRes.res] = Math.max(0, opp.res[op.attackRes.res] - op.attackRes.n);
      }
    }

    raiseGlobal(p, param, steps, ctx) {
      ctx = ctx || {};
      const max = data.GLOBALS[param].max;
      let actual = 0;
      for (let i = 0; i < steps; i++) { if (this.params[param] < max) { this.params[param]++; actual++; } }
      if (actual > 0) {
        p.renown += actual;
        if (param === 'frontier') p.res.gold += 2 * actual; // plunder from cleared regions
        this._fireTriggers(p, 'onRaiseGlobal', { param, excludeUid: ctx.playingUid });
      }
      return actual;
    }

    _fireTriggers(p, type, { param, tag, excludeUid } = {}) {
      for (const t of p.triggers.slice()) {
        if (t.type !== type) continue;
        if (type === 'onRaiseGlobal' && t.param && t.param !== param) continue;
        if (type === 'onPlayTag' && t.tag !== tag) continue;
        if (excludeUid != null && t.srcUid === excludeUid) continue;
        const src = t.srcUid > 0 ? p.tableau.find(e => e.uid === t.srcUid) : null;
        this.applyEffects(p, t.effect, { card: src, playingUid: excludeUid });
      }
    }

    /* --------------------------- payment ------------------------------ */
    effectiveCost(p, card) {
      let cost = card.cost;
      const d = p.discounts || {};
      for (const tag in d) if (card.tags && card.tags.includes(tag)) cost -= d[tag];
      // Standing discount tracks (never spent): Sawmill cheapens Building, Mana Vault cheapens Magic.
      if (card.tags && card.tags.includes('building')) cost -= SAWMILL_RATE * (p.prod.wood || 0);
      if (card.tags && card.tags.includes('magic')) cost -= MANA_RATE * (p.prod.crystal || 0);
      return Math.max(0, cost);
    }
    // Returns the breakdown of how a card's price was reduced (for UI transparency).
    costBreakdown(p, card) {
      const out = { base: card.cost, parts: [], final: this.effectiveCost(p, card) };
      const d = p.discounts || {};
      for (const tag in d) if (card.tags && card.tags.includes(tag) && d[tag]) out.parts.push({ src: 'faction ' + tag, amt: d[tag] });
      if (card.tags && card.tags.includes('building') && p.prod.wood) out.parts.push({ src: 'Sawmill ' + p.prod.wood, amt: SAWMILL_RATE * p.prod.wood });
      if (card.tags && card.tags.includes('magic') && p.prod.crystal) out.parts.push({ src: 'Mana Vault ' + p.prod.crystal, amt: MANA_RATE * p.prod.crystal });
      return out;
    }
    canAfford(p, card) {
      return p.res.gold >= this.effectiveCost(p, card);
    }
    _pay(p, card) {
      const cost = this.effectiveCost(p, card);
      if (p.res.gold < cost) return false;
      p.res.gold -= cost;
      return true;
    }

    /* ------------------------- requirements --------------------------- */
    _reqOk(p, r) {
      if (!r) return { ok: true };
      const g = this.params;
      const fail = m => ({ ok: false, reason: m });
      if (r.realmMin != null && g.realm < r.realmMin) return fail(`Needs Realm ${r.realmMin}+`);
      if (r.realmMax != null && g.realm > r.realmMax) return fail(`Needs Realm ${r.realmMax} or less`);
      if (r.sorceryMin != null && g.sorcery < r.sorceryMin) return fail(`Needs Sorcery ${r.sorceryMin}+`);
      if (r.sorceryMax != null && g.sorcery > r.sorceryMax) return fail(`Needs Sorcery ${r.sorceryMax} or less`);
      if (r.frontierMin != null && g.frontier < r.frontierMin) return fail(`Needs Frontier ${r.frontierMin}+`);
      if (r.frontierMax != null && g.frontier > r.frontierMax) return fail(`Needs Frontier ${r.frontierMax} or less`);
      if (r.tags) for (const tag in r.tags) if (this.tagCount(p, tag) < r.tags[tag]) return fail(`Needs ${r.tags[tag]} ${tag} tag(s)`);
      if (r.prod) for (const k in r.prod) if (p.prod[k] < r.prod[k]) {
        const lbl = k === 'wood' ? `Sawmill ${r.prod[k]}+` : k === 'crystal' ? `Mana Vault ${r.prod[k]}+` : `${r.prod[k]} ${k} production`;
        return fail(`Needs ${lbl}`);
      }
      return { ok: true };
    }
    reqMet(p, card) { return this._reqOk(p, card.req); }

    /* ----------------------------- wonders ---------------------------- */
    wonderDef(p) { const f = factionById(p.faction); return f && f.wonder; }
    nextWonderStage(p) {
      const w = this.wonderDef(p);
      if (!w || p.wonderStage >= w.stages.length) return null;
      return w.stages[p.wonderStage];
    }
    canBuildWonder(p) {
      const st = this.nextWonderStage(p);
      if (!st) return { ok: false, reason: 'Wonder complete' };
      if (!this._reqOk(p, st.req).ok) return this._reqOk(p, st.req);
      if (!this._canPayCost(p, st.cost)) return { ok: false, reason: 'Cannot pay' };
      return { ok: true };
    }
    buildWonderStage(idx) {
      if (!this._ensureTurn(idx)) return { ok: false, reason: 'Not your turn' };
      const p = this.players[idx];
      const st = this.nextWonderStage(p);
      if (!st) return { ok: false, reason: 'Wonder already complete' };
      const chk = this.canBuildWonder(p);
      if (!chk.ok) return chk;
      this._saveUndo();
      this._payCost(p, st.cost);
      this.applyEffects(p, st.reward, { playingUid: -2 });
      p.wonderStage++;
      const w = this.wonderDef(p);
      this.log(`${p.name} builds ${st.name} — ${w.name} (stage ${p.wonderStage}/${w.stages.length}).`);
      if (p.wonderStage >= w.stages.length) {
        p.wonderComplete = true;
        // The Wonder's final "Forever" boon (and its production rewards) get ONE full
        // week to run: completion schedules the LAST week, which is the NEXT one.
        // (If the tracks are already maxed, that end-trigger still ends it this week.)
        this.finalWeek = this.gen + 1;
        this.log(`✦ ${p.name} has completed ${w.name}! The conquest will end after next week — its power runs one last week.`);
      }
      return { ok: true };
    }

    /* ----------------------------- the Forge -------------------------- */
    // Ore identity: smelt Ore into Recruits (arm your host).
    forge(idx) {
      if (!this._ensureTurn(idx)) return { ok: false, reason: 'Not your turn' };
      const p = this.players[idx];
      if (p.res.ore < 2) return { ok: false, reason: 'Need 2 Ore' };
      this._saveUndo();
      p.res.ore -= 2; p.res.recruits += 3;
      this.log(`${p.name} works the Forge: 2 Ore → 3 Recruits.`);
      return { ok: true };
    }

    /* --------------------------- transmutation ------------------------ */
    // Mercury identity: the Alchemist turns quicksilver into any resource.
    transmute(idx, toRes) {
      if (!this._ensureTurn(idx)) return { ok: false, reason: 'Not your turn' };
      const p = this.players[idx];
      if (!['gold', 'ore', 'recruits'].includes(toRes)) return { ok: false, reason: 'Bad target' };
      if (p.res.mercury < 2) return { ok: false, reason: 'Need 2 Mercury' };
      this._saveUndo();
      p.res.mercury -= 2; p.res[toRes] += 2;
      this.log(`${p.name} transmutes 2 Mercury → 2 ${toRes}.`);
      return { ok: true };
    }

    /* ----------------------------- adventures ------------------------- */
    _fillQuests() { while (this.questBoard.length < QUEST_BOARD_SIZE && this.questDeck.length) this.questBoard.push(this.questDeck.pop()); }
    canCompleteQuest(p, q) {
      if (!q) return { ok: false, reason: 'No quest' };
      const r = this._reqOk(p, q.req); if (!r.ok) return r;
      if (!this._canPayCost(p, q.cost)) return { ok: false, reason: 'Cannot pay' };
      return { ok: true };
    }
    completeQuest(idx, questId) {
      if (!this._ensureTurn(idx)) return { ok: false, reason: 'Not your turn' };
      const p = this.players[idx];
      if (!this.questBoard.includes(questId)) return { ok: false, reason: 'Not on the board' };
      const q = questById(questId);
      const chk = this.canCompleteQuest(p, q);
      if (!chk.ok) return chk;
      this._saveUndo();
      this._payCost(p, q.cost);
      this.applyEffects(p, q.reward, { playingUid: -3 });
      p.renown += QUEST_RENOWN; // every completed Adventure builds your legend (Renown = income + Glory)
      this.questBoard.splice(this.questBoard.indexOf(questId), 1);
      this._fillQuests();
      this.log(`${p.name} completes the Adventure: ${q.name} (+${QUEST_RENOWN} Renown).`);
      return { ok: true };
    }

    canPlay(p, card) {
      if (CARD_FACTION[card.id] && CARD_FACTION[card.id] !== p.faction)
        return { ok: false, reason: 'Only the ' + factionById(CARD_FACTION[card.id]).name + ' can field this' };
      const r = this.reqMet(p, card);
      if (!r.ok) return r;
      if (!this.canAfford(p, card)) return { ok: false, reason: 'Cannot afford' };
      return { ok: true };
    }

    /* =========================== SETUP =============================== */
    chooseFaction(idx, factionId) {
      if (this.phase !== 'setup-faction') return { ok: false, reason: 'Not in faction phase' };
      if (!this.factionOptions[idx].includes(factionId)) return { ok: false, reason: 'Not an option' };
      const p = this.players[idx];
      if (p.faction) return { ok: false, reason: 'Already chosen' };
      const f = factionById(factionId);
      p.faction = factionId;
      if (f.start.res) for (const k in f.start.res) p.res[k] += f.start.res[k];
      if (f.start.prod) for (const k in f.start.prod) this.changeProd(p, k, f.start.prod[k]);
      if (f.settlementCost) p.settlementCost = f.settlementCost;
      p.discounts = f.discounts || {};
      p.factionActionDef = f.action || null;
      p.factionDeck = this._shuffle((FACTION_CARDS[factionId] || []).slice());
      p.factionDiscard = [];
      (f.triggers || []).forEach(t => p.triggers.push({ uid: ++this.uid, srcUid: -1, type: t.type, tag: t.tag, param: t.param, effect: t.effect }));
      this.log(`${p.name} leads the ${f.name}.`);
      if (this.players.every(pl => pl.faction)) this._dealSecretGoals();
      return { ok: true };
    }

    // Each lord is offered two secret objectives and drafts one.
    _dealSecretGoals() {
      const pool = this._shuffle(SECRET_GOALS.map(g => g.id));
      this.players[0].secretOptions = pool.slice(0, 2);
      this.players[1].secretOptions = pool.slice(2, 4);
      this.phase = 'setup-goal';
    }
    chooseSecretGoal(idx, goalId) {
      if (this.phase !== 'setup-goal') return { ok: false, reason: 'Not in objective phase' };
      const p = this.players[idx];
      if (p.secretGoal) return { ok: false, reason: 'Already chosen' };
      if (!p.secretOptions.includes(goalId)) return { ok: false, reason: 'Not an option' };
      p.secretGoal = goalId;
      if (this.players.every(pl => pl.secretGoal)) this._startResearch(8, 2);
      return { ok: true };
    }

    _startResearch(nPub, nFac) {
      this.phase = 'research';
      this._proclaim();
      for (const p of this.players) {
        const dealt = [];
        for (let i = 0; i < nPub; i++) { const id = this._drawPublic(); if (id != null) dealt.push(id); }
        for (let i = 0; i < nFac; i++) { const id = this._drawFaction(p); if (id != null) dealt.push(id); }
        p.pendingResearch = dealt;
        p.researchDone = false;
      }
    }

    // "Astrologers proclaim the Week of the ..." — a symmetric weekly boon.
    _proclaim() {
      const list = data.PROCLAMATIONS;
      const proc = list[Math.floor(this.rng() * list.length)];
      this.proclamation = { name: proc.name, text: proc.text };
      for (const p of this.players) if (proc.effect && proc.effect.length) this.applyEffects(p, proc.effect, {});
      this.log(`☄️ Astrologers proclaim the ${proc.name}.`);
    }

    resolveResearch(idx, keptIds) {
      if (this.phase !== 'research') return { ok: false, reason: 'Not research phase' };
      const p = this.players[idx];
      if (p.researchDone) return { ok: false, reason: 'Already done' };
      keptIds = keptIds || [];
      for (const id of keptIds) if (!p.pendingResearch.includes(id)) return { ok: false, reason: 'Invalid card kept' };
      const cost = keptIds.length * RESEARCH_BUY;
      if (p.res.gold < cost) return { ok: false, reason: 'Not enough Gold to buy' };
      p.res.gold -= cost;
      for (const id of p.pendingResearch) {
        if (keptIds.includes(id)) p.hand.push(id);
        else this.discardCard(p, id, true);
      }
      this.log(`${p.name} keeps ${keptIds.length} card(s) for ${cost} Gold.`);
      p.pendingResearch = [];
      p.researchDone = true;
      if (this.players.every(pl => pl.researchDone)) this._beginActionPhase();
      return { ok: true };
    }

    _beginActionPhase() {
      this.phase = 'action';
      this.turn = this.starter;
      this.passed = [false, false];
      this.undoStack = [];
      this.log(`— Generation ${this.gen}: action phase —`);
    }

    /* ======================== ACTION PHASE ========================== */
    _ensureTurn(idx) {
      if (this.phase !== 'action') return false;
      if (idx !== this.turn) return false;
      if (this.passed[idx]) return false;
      return true;
    }

    // A turn may contain many actions. The player ends it explicitly.
    endTurn(idx) {
      if (this.phase !== 'action' || idx !== this.turn || this.passed[idx]) return { ok: false, reason: 'Not your turn' };
      const other = 1 - idx;
      this.undoStack = [];
      if (!this.passed[other]) this.turn = other; // else opponent is out — keep going
      this.log(`${this.players[idx].name} ends their turn.`);
      return { ok: true };
    }

    playCard(idx, cardId, plan) {
      if (!this._ensureTurn(idx)) return { ok: false, reason: 'Not your turn' };
      const p = this.players[idx];
      if (!p.hand.includes(cardId)) return { ok: false, reason: 'Not in hand' };
      const card = cardById(cardId);
      const chk = this.canPlay(p, card);
      if (!chk.ok) return chk;
      this._saveUndo();
      if (!this._pay(p, card)) { this.undoStack.pop(); return { ok: false, reason: 'Payment failed' }; }
      p.hand.splice(p.hand.indexOf(cardId), 1);
      let entry = null;
      if (card.type !== 'event') {
        entry = { uid: ++this.uid, id: card.id, store: 0, usedAction: false };
        p.tableau.push(entry);
        if (card.protect) p.protect = true;
      }
      const ctx = { card: entry, played: card, playingUid: entry ? entry.uid : -1 };
      if (card.effects) this.applyEffects(p, card.effects, ctx);
      for (const tag of (card.tags || [])) this._fireTriggers(p, 'onPlayTag', { tag, excludeUid: ctx.playingUid });
      if (card.type === 'event') this.discard.push(card.id);
      this.log(`${p.name} plays ${card.name}.`);
      return { ok: true };
    }

    useCardAction(idx, uid) {
      if (!this._ensureTurn(idx)) return { ok: false, reason: 'Not your turn' };
      const p = this.players[idx];
      const entry = p.tableau.find(e => e.uid === uid);
      if (!entry || !entry.action) return { ok: false, reason: 'No action' };
      if (entry.usedAction) return { ok: false, reason: 'Already used' };
      if (!this._canPayCost(p, entry.action.cost)) return { ok: false, reason: 'Cannot pay' };
      this._saveUndo();
      this._payCost(p, entry.action.cost);
      this.applyEffects(p, entry.action.effect, { card: entry, playingUid: entry.uid });
      entry.usedAction = true;
      this.log(`${p.name} uses ${cardById(entry.id).name}.`);
      return { ok: true };
    }

    useFactionAction(idx) {
      if (!this._ensureTurn(idx)) return { ok: false, reason: 'Not your turn' };
      const p = this.players[idx];
      if (!p.factionActionDef) return { ok: false, reason: 'No faction action' };
      if (p.factionActionUsed) return { ok: false, reason: 'Already used' };
      if (!this._canPayCost(p, p.factionActionDef.cost)) return { ok: false, reason: 'Cannot pay' };
      this._saveUndo();
      this._payCost(p, p.factionActionDef.cost);
      this.applyEffects(p, p.factionActionDef.effect, { playingUid: -1 });
      p.factionActionUsed = true;
      this.log(`${p.name} uses their town ability.`);
      return { ok: true };
    }

    _canPayCost(p, cost) { for (const k in cost) if (p.res[k] < cost[k]) return false; return true; }
    _payCost(p, cost) { for (const k in cost) p.res[k] -= cost[k]; }

    standardProject(idx, key, hexId) {
      if (!this._ensureTurn(idx)) return { ok: false, reason: 'Not your turn' };
      const p = this.players[idx];
      const sp = STANDARD[key];
      if (!sp) return { ok: false, reason: 'Unknown project' };
      if (p.res.gold < sp.cost) return { ok: false, reason: 'Not enough Gold' };
      const needsHex = (key === 'conquer' || key === 'settle' || key === 'town');
      if (needsHex && (!hexId || !this.map.hexes[hexId] || this.map.hexes[hexId].tile))
        return { ok: false, reason: 'Choose an empty hex on the map' };
      this._saveUndo();
      p.res.gold -= sp.cost;
      switch (key) {
        case 'mageTower': this.changeProd(p, 'mercury', 1); break;
        case 'channel': this.applyEffects(p, [{ global: { sorcery: 1 } }], {}); break;
        case 'conquer': this._placeTile(p, 'region', hexId); this.applyEffects(p, [{ global: { frontier: 1 } }], {}); break;
        case 'settle': this._placeTile(p, 'town', hexId); this.applyEffects(p, [{ global: { realm: 1 } }], {}); break;
        case 'town': this._placeTile(p, 'mine', hexId); break;
      }
      this.log(`${p.name} — ${sp.name}.`);
      return { ok: true };
    }

    convertRecruits(idx, hexId) {
      if (!this._ensureTurn(idx)) return { ok: false, reason: 'Not your turn' };
      const p = this.players[idx];
      if (p.res.recruits < p.settlementCost) return { ok: false, reason: 'Not enough Recruits' };
      if (!hexId || !this.map.hexes[hexId] || this.map.hexes[hexId].tile)
        return { ok: false, reason: 'Choose an empty hex on the map' };
      this._saveUndo();
      p.res.recruits -= p.settlementCost;
      this._placeTile(p, 'town', hexId);
      this.applyEffects(p, [{ global: { realm: 1 } }], {});
      this.log(`${p.name} musters ${p.settlementCost} Recruits to raise a Town.`);
      return { ok: true };
    }
    convertMercury(idx) {
      if (!this._ensureTurn(idx)) return { ok: false, reason: 'Not your turn' };
      const p = this.players[idx];
      if (p.res.mercury < 8) return { ok: false, reason: 'Not enough Mercury' };
      this._saveUndo();
      p.res.mercury -= 8;
      this.applyEffects(p, [{ global: { sorcery: 1 } }], {});
      this.log(`${p.name} channels 8 Mercury into Sorcery.`);
      return { ok: true };
    }

    sellCard(idx, cardId) {
      if (!this._ensureTurn(idx)) return { ok: false, reason: 'Not your turn' };
      const p = this.players[idx];
      if (!p.hand.includes(cardId)) return { ok: false, reason: 'Not in hand' };
      this._saveUndo();
      p.hand.splice(p.hand.indexOf(cardId), 1);
      p.res.gold += SELL_PRICE;
      this.discardCard(p, cardId, false);
      this.log(`${p.name} discards ${cardById(cardId).name} (salvage ${SELL_PRICE} Gold).`);
      return { ok: true };
    }

    milestoneAvailable(p, id) {
      const st = this.milestones.find(m => m.id === id);
      if (!st || st.claimedBy != null) return false;
      if (this.milestonesClaimedCount >= 3) return false;
      const def = MILESTONES.find(m => m.id === id);
      return def.check(this, p);
    }
    claimMilestone(idx, id) {
      if (!this._ensureTurn(idx)) return { ok: false, reason: 'Not your turn' };
      const p = this.players[idx];
      if (!this.milestoneAvailable(p, id)) return { ok: false, reason: 'Not claimable' };
      if (p.res.gold < MILESTONE_COST) return { ok: false, reason: 'Not enough Gold' };
      this._saveUndo();
      p.res.gold -= MILESTONE_COST;
      const st = this.milestones.find(m => m.id === id);
      st.claimedBy = idx;
      this.milestonesClaimedCount++;
      this.log(`${p.name} claims the ${MILESTONES.find(m => m.id === id).name} milestone!`);
      return { ok: true };
    }

    awardFundCost() { return AWARD_COSTS[Math.min(this.awardsFundedCount, AWARD_COSTS.length - 1)]; }
    awardAvailable(id) {
      const st = this.awards.find(a => a.id === id);
      return st && st.fundedBy == null && this.awardsFundedCount < 3;
    }
    fundAward(idx, id) {
      if (!this._ensureTurn(idx)) return { ok: false, reason: 'Not your turn' };
      const p = this.players[idx];
      if (!this.awardAvailable(id)) return { ok: false, reason: 'Not fundable' };
      const cost = this.awardFundCost();
      if (p.res.gold < cost) return { ok: false, reason: 'Not enough Gold' };
      this._saveUndo();
      p.res.gold -= cost;
      const st = this.awards.find(a => a.id === id);
      st.fundedBy = idx;
      st.order = ++this.awardsFundedCount;
      this.log(`${p.name} funds the ${AWARDS.find(a => a.id === id).name} award for ${cost} Gold.`);
      return { ok: true };
    }

    pass(idx) {
      if (!this._ensureTurn(idx)) return { ok: false, reason: 'Not your turn' };
      this.passed[idx] = true;
      this.undoStack = [];
      this.log(`${this.players[idx].name} passes for the generation.`);
      if (this.passed[0] && this.passed[1]) { this._endGeneration(); return { ok: true }; }
      this.turn = 1 - idx;
      return { ok: true };
    }

    /* ------------------------ end of generation ----------------------- */
    _endGeneration() {
      // Production
      for (const p of this.players) {
        p.res.gold = Math.max(0, p.res.gold + p.renown + p.prod.gold);
        // Wood/Crystal are discount tracks, not income — they don't accumulate as stock.
        for (const k of ['ore', 'recruits', 'mercury']) p.res[k] = Math.max(0, p.res[k] + p.prod[k]);
      }
      this.log(`— Generation ${this.gen} production collected —`);
      // reset per-gen flags
      for (const p of this.players) {
        p.factionActionUsed = false;
        for (const e of p.tableau) e.usedAction = false;
      }
      this.passed = [false, false];
      const wonderEnd = this.finalWeek != null && this.gen >= this.finalWeek;
      if (this.allMaxed() || wonderEnd || this.gen >= MAX_GENS) { this._finalize(); return; }
      this.gen++;
      this.starter = 1 - this.starter;
      this._startResearch(3, 1);
    }

    /* ---------------------------- scoring ----------------------------- */
    cardVP(p, entry) {
      const c = cardById(entry.id);
      const v = c.vp;
      if (v == null) return 0;
      if (typeof v === 'number') return v;
      if (v.perStore) return Math.floor((entry.store || 0) / v.perStore);
      if (v.perTag) return Math.floor(this.tagCount(p, v.perTag.tag) / v.perTag.per);
      if (v.perTile) return Math.floor((p.tiles[v.perTile.tile] || 0) / (v.perTile.per || 1));
      return 0;
    }
    // End-game Glory from the map: Towns 1 each; Mines 1 + 1 per adjacent Town.
    mapVP(p) {
      let v = 0;
      for (const id of this.map.order) {
        const t = this.map.hexes[id].tile;
        if (!t || t.owner !== p.idx) continue;
        if (t.type === 'town') v += 1;
        else if (t.type === 'mine') {
          v += 1;
          for (const nid of this.hexNeighbors(id)) { const nt = this.map.hexes[nid].tile; if (nt && nt.type === 'town') v += 1; }
        }
      }
      return v;
    }

    _finalize() {
      // Final muster: leftover Recruits raise Towns on any empty hexes (no Renown).
      for (const p of this.players) {
        while (p.res.recruits >= p.settlementCost) {
          const empties = this.emptyHexes();
          if (!empties.length) break;
          p.res.recruits -= p.settlementCost;
          this._placeTile(p, 'town', empties[Math.floor(this.rng() * empties.length)]);
        }
      }
      const scores = this.players.map(p => {
        let cards = 0;
        for (const e of p.tableau) cards += this.cardVP(p, e);
        const tiles = this.mapVP(p);
        let milestones = 0;
        for (const m of this.milestones) if (m.claimedBy === p.idx) milestones += 5;
        const sg = goalById(p.secretGoal);
        const secret = (sg && sg.check(this, p)) ? sg.vp : 0;
        const wonder = p.wonderComplete ? WONDER_VP : 0;
        return { idx: p.idx, name: p.name, renown: p.renown, cards, events: p.eventVP, tiles, milestones, awards: 0, secret, wonder, total: 0 };
      });
      // awards
      for (const st of this.awards) {
        if (st.fundedBy == null) continue;
        const def = AWARDS.find(a => a.id === st.id);
        const s0 = def.score(this, this.players[0]);
        const s1 = def.score(this, this.players[1]);
        if (s0 === s1) { scores[0].awards += 5; scores[1].awards += 5; }
        else if (s0 > s1) { scores[0].awards += 5; scores[1].awards += 2; }
        else { scores[1].awards += 5; scores[0].awards += 2; }
      }
      for (const s of scores) s.total = s.renown + s.cards + s.events + s.tiles + s.milestones + s.awards + s.secret + s.wonder;
      let winner;
      if (scores[0].total > scores[1].total) winner = 0;
      else if (scores[1].total > scores[0].total) winner = 1;
      else winner = this.players[0].res.gold >= this.players[1].res.gold ? 0 : 1; // tiebreak: gold
      this.finalScores = scores;
      this.winner = winner;
      this.over = true;
      this.phase = 'end';
      this.log(`=== Game over! Winner: ${this.players[winner].name} (${scores[winner].total} Glory) ===`);
    }

    /* ----------------------------- undo ------------------------------- */
    _snapshot() {
      return structuredClone({
        uid: this.uid, gen: this.gen, params: this.params, players: this.players,
        deck: this.deck, discard: this.discard, map: this.map, starter: this.starter, turn: this.turn,
        passed: this.passed, phase: this.phase, milestones: this.milestones, awards: this.awards,
        milestonesClaimedCount: this.milestonesClaimedCount, awardsFundedCount: this.awardsFundedCount,
        finalWeek: this.finalWeek, questDeck: this.questDeck, questBoard: this.questBoard, logLen: this.logLines.length,
      });
    }
    _saveUndo() {
      this.undoStack.push(this._snapshot());
      if (this.undoStack.length > 60) this.undoStack.shift();
    }
    canUndo() { return this.phase === 'action' && this.undoStack.length > 0; }
    undo() {
      if (!this.canUndo()) return false;
      const s = this.undoStack.pop();
      this.uid = s.uid; this.gen = s.gen; this.params = s.params; this.players = s.players;
      this.deck = s.deck; this.discard = s.discard; this.map = s.map; this.starter = s.starter; this.turn = s.turn;
      this.passed = s.passed; this.phase = s.phase; this.milestones = s.milestones; this.awards = s.awards;
      this.milestonesClaimedCount = s.milestonesClaimedCount; this.awardsFundedCount = s.awardsFundedCount;
      this.finalWeek = s.finalWeek; this.questDeck = s.questDeck; this.questBoard = s.questBoard;
      this.logLines.length = Math.min(this.logLines.length, s.logLen);
      this.log('(undo)');
      return true;
    }

    /* ----------------------- available actions ------------------------ */
    availableActions(idx) {
      const acts = [];
      if (!this._ensureTurn(idx)) return acts;
      const p = this.players[idx];
      for (const id of p.hand) { const c = cardById(id); if (this.canPlay(p, c).ok) acts.push({ kind: 'play', cardId: id }); }
      for (const e of p.tableau) if (e.action && !e.usedAction && this._canPayCost(p, e.action.cost)) acts.push({ kind: 'cardAction', uid: e.uid });
      if (p.factionActionDef && !p.factionActionUsed && this._canPayCost(p, p.factionActionDef.cost)) acts.push({ kind: 'factionAction' });
      const hasHex = this.emptyHexes().length > 0;
      for (const key in STANDARD) {
        if (p.res.gold < STANDARD[key].cost) continue;
        if ((key === 'conquer' || key === 'settle' || key === 'town') && !hasHex) continue;
        acts.push({ kind: 'standard', key });
      }
      if (p.res.recruits >= p.settlementCost && hasHex) acts.push({ kind: 'convertRecruits' });
      if (p.res.mercury >= 8) acts.push({ kind: 'convertMercury' });
      for (const m of this.milestones) if (this.milestoneAvailable(p, m.id) && p.res.gold >= MILESTONE_COST) acts.push({ kind: 'milestone', id: m.id });
      if (this.awardsFundedCount < 3) for (const a of this.awards) if (this.awardAvailable(a.id) && p.res.gold >= this.awardFundCost()) acts.push({ kind: 'award', id: a.id });
      if (this.canBuildWonder(p).ok) acts.push({ kind: 'wonder' });
      if (p.res.ore >= 2) acts.push({ kind: 'forge' });
      if (p.res.mercury >= 2) acts.push({ kind: 'transmute', toRes: 'gold' });
      for (const qid of this.questBoard) if (this.canCompleteQuest(p, questById(qid)).ok) acts.push({ kind: 'quest', id: qid });
      for (const id of p.hand) acts.push({ kind: 'sell', cardId: id });
      acts.push({ kind: 'pass' });
      return acts;
    }

    perform(idx, desc) {
      switch (desc.kind) {
        case 'play': return this.playCard(idx, desc.cardId, desc.plan);
        case 'cardAction': return this.useCardAction(idx, desc.uid);
        case 'factionAction': return this.useFactionAction(idx);
        case 'standard': return this.standardProject(idx, desc.key, desc.hexId);
        case 'convertRecruits': return this.convertRecruits(idx, desc.hexId);
        case 'convertMercury': return this.convertMercury(idx);
        case 'milestone': return this.claimMilestone(idx, desc.id);
        case 'award': return this.fundAward(idx, desc.id);
        case 'wonder': return this.buildWonderStage(idx);
        case 'forge': return this.forge(idx);
        case 'transmute': return this.transmute(idx, desc.toRes || 'gold');
        case 'quest': return this.completeQuest(idx, desc.id);
        case 'sell': return this.sellCard(idx, desc.cardId);
        case 'pass': return this.pass(idx);
      }
      return { ok: false, reason: 'Unknown action' };
    }
  }

  const API = { Game, STANDARD, AWARD_COSTS, MILESTONE_COST, SELL_PRICE, RESEARCH_BUY, SAWMILL_RATE, MANA_RATE, COUNTER_BUDGET };
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
  global.HK = Object.assign(global.HK || {}, { engine: API });
})(typeof window !== 'undefined' ? window : globalThis);
