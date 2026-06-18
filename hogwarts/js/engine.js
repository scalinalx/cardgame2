/* =====================================================================
 * THE BATTLE OF HOGWARTS — engine.js   (region-funnel melee model)
 * Pure, DOM-free rules engine (also runs under Node for headless fuzzing).
 * 1- or 2-player CO-OP defence of Hogwarts.
 *
 * THE FIELD — a funnel. Enemies muster in the FOREST and march:
 *   step 0 forest → 1 one of three GROUNDS → 2 COURTYARD → 3 GATE → ≥4 BREACH.
 * Allies are deployed into any play region; foes that share a region FIGHT
 * the allies there — a melee, resolved simultaneously, BOTH sides take harm
 * and may die. (This is the key difference from a tower-defence volley: your
 * units are not ranged snipers — they trade blows and can fall.)
 *
 * A ROUND: each player takes a turn, then Voldemort's army resolves —
 *   ADVANCE (march + breach) → MELEE (combat) → MUSTER (new foes emerge).
 * Win: Dark-Army Morale < 30%.  Lose: Hogwarts' Wards < 30%.
 * ===================================================================== */
(function (global) {
  'use strict';

  const data = (typeof require !== 'undefined') ? require('./data.js')
    : (global.HW && global.HW.data);
  const { CONFIG, REGIONS, GROUNDS, HOUSES, HOUSE_DECKS, cardById } = data;
  const PLAY_REGIONS = REGIONS.filter(r => r.side === 'play').map(r => r.id);

  function mulberry32(a) {
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function intentOf(def) {
    if (def.siege) return 'SMASH';
    if (def.dementor) return 'DRAIN';
    if (def.ranged || def.armorPierce || def.healOnHit || def.boss) return 'STRIKE';
    return def.atk >= 4 ? 'STRIKE' : 'ADVANCE';
  }

  class Game {
    constructor(opts = {}) {
      this.seed = (opts.seed != null) ? (opts.seed | 0) : (Math.floor(Math.random() * 2 ** 31) | 0);
      this.rng = mulberry32(this.seed);
      this.uid = 1;
      this.cfg = Object.assign({}, CONFIG);
      this.difficulty = opts.difficulty || 'standard';
      this.diff = (this.cfg.DIFFICULTIES && this.cfg.DIFFICULTIES[this.difficulty]) || this.cfg.DIFFICULTIES.standard;

      const specs = opts.players || [{ name: 'Player 1', house: 'gryffindor' }];
      this.numPlayers = specs.length;
      this.players = specs.map((s, i) => this._mkPlayer(i, s.name || ('Player ' + (i + 1)), s.house));

      this.castleMax = this.cfg.castleHp; this.castleHp = this.castleMax;
      this.moraleMax = this.cfg.moraleStart; this.morale = this.moraleMax;
      this.castleLose = Math.floor(this.castleMax * this.cfg.castleLosePct);
      this.moraleWin = Math.floor(this.moraleMax * this.cfg.moraleWinPct);

      this.allies = [];   // {uid,id,name,ownerIdx,region,hp,maxHp,atk,...flags}
      this.foes = [];     // {uid,id,name,step,lane,hp,maxHp,atk,intent,...flags}
      this.enchants = [];
      this.lifted = [];

      this.round = 1; this.turn = 0; this.phase = 'player'; this.over = null;
      this.pendingShield = 0; this.castleShieldThisTurn = 0;
      this.log = []; this.bossesSpawned = {};

      this.waveCap = Math.round(this.cfg.waveMax * this.numPlayers * (this.numPlayers > 1 ? 2.2 : 1) * this.diff.capMult);

      // Opening force already on the field, then the first muster preview.
      const n = Math.round(this.cfg.startForce * (this.numPlayers > 1 ? 1.8 : 1) * this.diff.waveMult);
      for (let i = 0; i < n; i++) {
        const def = this._weighted(this._pool());
        const step = this.rng() < 0.5 ? 1 : 0;
        this._spawn(def, step);
      }
      this.queue = this._rollWave();
      this._startPlayerTurn(0);
    }

    /* ---------------- setup / players ---------------------------- */
    _mkPlayer(idx, name, house) {
      return {
        idx, name, house,
        deck: this._shuffle((HOUSE_DECKS[house] || HOUSE_DECKS.gryffindor).slice()),
        hand: [], discard: [], mana: 0, manaBase: 0, powerUsed: false,
        spellsThisTurn: 0, witCount: 0, costReduce: 0, costReduceOne: 0, loyaltySaveUsed: false,
        loyaltySavesLeft: 4,
      };
    }
    _shuffle(a) { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(this.rng() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }
    _nextUid() { return this.uid++; }
    log_(msg, kind) { this.log.push({ round: this.round, msg, kind: kind || 'info' }); }
    house(p) { return HOUSES[p.house]; }

    /* ---------------- region queries ----------------------------- */
    regionOfFoe(f) {
      if (f.step <= 0) return 'forest';
      if (f.step === 1) return GROUNDS[f.lane];
      if (f.step === 2) return 'court';
      return 'gate'; // step 3 (>=4 breaches and is removed)
    }
    foesIn(rid) { return this.foes.filter(f => this.regionOfFoe(f) === rid); }
    alliesIn(rid) { return this.allies.filter(a => a.region === rid); }
    allEnemies() { return this.foes; }        // back-compat alias
    allAllies() { return this.allies; }
    mostAdvancedIn(rid) { const fs = this.foesIn(rid); return fs.length ? fs.reduce((b, f) => f.step > b.step ? f : b) : null; }
    spellPowerOf(idx) { return this.allies.filter(a => a.ownerIdx === idx).reduce((s, a) => s + (a.spellPower || 0), 0); }

    /* ---------------- spawning / waves --------------------------- */
    _pool() { return data.ENEMIES.filter(e => !e.boss && e.minTurn <= this.round); }
    _weighted(pool) {
      const total = pool.reduce((s, e) => s + (e.weight || 1), 0);
      let r = this.rng() * total;
      for (const e of pool) { r -= (e.weight || 1); if (r <= 0) return e; }
      return pool[pool.length - 1];
    }
    _waveSize() {
      let size = this.cfg.waveBase + Math.floor((this.round - 1) / this.cfg.waveGrowEvery);
      if (this.numPlayers > 1) size = Math.round(size * this.numPlayers * 1.6);
      size = Math.round(size * this.diff.waveMult);
      return Math.min(Math.max(1, size), this.waveCap);
    }
    // Pre-roll the next muster (templates) so the UI can telegraph it.
    _rollWave() {
      const out = [];
      const boss = this.cfg.bossSchedule.find(b => b.turn === this.round + 1 && !this.bossesSpawned[b.id]);
      if (boss) out.push(cardById(boss.id));
      const size = this._waveSize();
      const pool = this._pool();
      for (let i = 0; i < size; i++) out.push(this._weighted(pool));
      return out;
    }
    _spawn(def, step) {
      const lane = Math.floor(this.rng() * GROUNDS.length);
      const sm = this.diff.statMult;
      const hpBonus = def.boss ? 0 : Math.floor((this.round - 1) / this.cfg.enemyHpRampEvery * sm);
      // ATK-ramp is deliberately small & CAPPED: escalation should come from bigger,
      // tankier waves — not from hits that one-shot the fragile Houses' defenders
      // (that was the main cause of wild per-House divergence on Hard/Legendary).
      const atkEvery = this.numPlayers > 1 ? 5 : 7;
      const atkOn = this.numPlayers > 1 || this.difficulty !== 'standard';
      const atkBonus = (def.boss || !atkOn) ? 0 : Math.min(2, Math.floor((this.round - 1) / atkEvery * Math.min(sm, 1.2)));
      let hp = def.hp + hpBonus;
      let bm = this.diff.bossHp;
      if (def.boss) { if (this.numPlayers > 1) bm *= (def.finalBoss ? 2.6 : 2.5); hp = Math.round(hp * bm); }
      const f = {
        uid: this._nextUid(), id: def.id, name: def.name, step: step == null ? 0 : step, lane,
        hp, maxHp: hp, atk: def.atk + atkBonus, intent: intentOf(def),
        speed: def.speed || 1, morale: def.morale,
        boss: !!def.boss, siege: !!def.siege, breach: (def.breach != null ? def.breach : null),
        dementor: !!def.dementor, healOnHit: def.healOnHit || 0, armorPierce: !!def.armorPierce,
        immuneFreeze: !!def.immuneFreeze, immuneControl: !!def.immuneControl, immuneExecute: !!def.immuneExecute,
        reanimate: def.reanimate || null, reanimated: false, frozen: false, noHeal: false,
        justArrived: true, tags: def.tags || [],
      };
      this.foes.push(f); return f;
    }
    _mkAlly(card, ownerIdx, region) {
      let maxHp = card.hp;
      return {
        uid: this._nextUid(), id: card.id, name: card.name, ownerIdx, region,
        hp: maxHp, maxHp, atk: card.atk, tempAtk: 0,
        guard: card.guard || 0, lash: !!card.lash, loyal: !!card.loyal,
        intangible: !!card.intangible, chip: card.chip || 0, spellPower: card.spellPower || 0,
        invuln: false, tags: card.tags || [],
      };
    }

    /* ---------------- the player's turn -------------------------- */
    _startPlayerTurn(idx) {
      this.turn = idx; this.phase = 'player';
      const p = this.players[idx];
      p.spellsThisTurn = 0; p.witCount = 0; p.costReduce = 0; p.costReduceOne = 0;
      p.powerUsed = false; p.loyaltySaveUsed = false;
      const ramp = Math.min(this.cfg.manaMax, this.cfg.baseMana + Math.floor((this.round - 1) / this.cfg.manaRampEvery));
      const dementors = this.foes.filter(f => f.dementor && f.step >= this.cfg.gateStep).length;
      p.manaBase = ramp; p.mana = Math.max(1, ramp - dementors);
      if (dementors) this.log_(`${p.name} feels the Dementors' chill — ${dementors} less Mana.`, 'bad');
      this._fireTriggers('turnStart', idx);
      this._drawUp(p);
      this.log_(`${p.name}'s turn (${this.house(p).name}). Mana ${p.mana}.`, 'turn');
    }
    _drawUp(p) { while (p.hand.length < this.cfg.handSize && (p.deck.length || p.discard.length)) this._draw(p, 1); }
    _draw(p, n) {
      for (let i = 0; i < n; i++) {
        if (!p.deck.length) { if (!p.discard.length) return; p.deck = this._shuffle(p.discard); p.discard = []; }
        p.hand.push({ uid: this._nextUid(), id: p.deck.pop() });
      }
    }
    effectiveCost(p, card) { return Math.max(0, card.cost - p.costReduce - p.costReduceOne); }
    needsTargets(card) {
      const r = {};
      if (card.type === 'ally') r.region = true;
      if (card.target === 'enemy') r.enemy = true;
      else if (card.target === 'lane') r.region = true;
      else if (card.target === 'ally') r.ally = true;
      return r;
    }
    _deriveNeeds(effects) {
      const r = {};
      (effects || []).forEach(fx => {
        const k = Object.keys(fx)[0], v = fx[k] || {};
        if (['damage', 'weaken', 'freeze', 'execute', 'control', 'redirect', 'lift'].includes(k) && (v.target === 'pick' || v.target === undefined)) {
          if (k !== 'damage' || v.target === 'pick') r.enemy = true;
        }
        if (k === 'push' && v.target === 'pick') r.enemy = true;
        if (k === 'push' && v.target === 'lane') r.region = true;
        if (k === 'freezeLane' || k === 'summon' || (k === 'damage' && v.target === 'lane')) r.region = true;
        if (k === 'heal' && (!v.target || v.target === 'pick')) r.ally = true;
      });
      return r;
    }
    powerNeeds(idx) { return this._deriveNeeds(this.house(this.players[idx]).power.effect); }

    listActions(idx) {
      const p = this.players[idx]; const acts = [];
      p.hand.forEach(h => { const c = cardById(h.id); if (this.effectiveCost(p, c) <= p.mana) acts.push({ kind: 'play', uid: h.uid, card: c }); });
      const pw = this.house(p).power;
      if (!p.powerUsed && pw.cost <= p.mana) acts.push({ kind: 'power' });
      acts.push({ kind: 'end' });
      return acts;
    }

    playCard(idx, handUid, opts = {}) {
      if (this.over || this.phase !== 'player' || this.turn !== idx) return { ok: false, error: 'not your turn' };
      const p = this.players[idx];
      const hi = p.hand.findIndex(h => h.uid === handUid);
      if (hi < 0) return { ok: false, error: 'not in hand' };
      const card = cardById(p.hand[hi].id);
      const cost = this.effectiveCost(p, card);
      if (cost > p.mana) return { ok: false, error: 'not enough Mana' };
      const region = opts.region || (this.needsTargets(card).region ? this._autoRegion(card) : null);

      p.mana -= cost; if (p.costReduceOne) p.costReduceOne = 0; p.hand.splice(hi, 1);
      const ctx = { ownerIdx: idx, region, isSpell: card.type === 'spell',
        targetFoe: opts.enemyUid ? this._foeByUid(opts.enemyUid) : null,
        targetAlly: opts.allyUid ? this._allyByUid(opts.allyUid) : null };

      if (card.type === 'ally') {
        const a = this._mkAlly(card, idx, region); this.allies.push(a); ctx.sourceAlly = a;
        this.log_(`${p.name} deploys ${card.name} to ${this._rname(region)}.`, 'play');
        if (card.onDeploy) this.applyEffects(card.onDeploy, ctx);
      } else if (card.type === 'enchant') {
        this.enchants.push({ uid: this._nextUid(), id: card.id, ownerIdx: idx, boundRegion: region || null });
        this.log_(`${p.name} casts ${card.name}.`, 'play');
        if (card.onPlay) this.applyEffects(card.onPlay, ctx);
      } else {
        p.spellsThisTurn++; this.log_(`${p.name} casts ${card.name}.`, 'play');
        if (card.onPlay) this.applyEffects(card.onPlay, ctx);
        p.discard.push(card.id); this._wit(idx);
      }
      this._checkEnd();
      return { ok: true };
    }

    useHousePower(idx, opts = {}) {
      if (this.over || this.phase !== 'player' || this.turn !== idx) return { ok: false, error: 'not your turn' };
      const p = this.players[idx]; const pw = this.house(p).power;
      if (p.powerUsed) return { ok: false, error: 'used' };
      if (pw.cost > p.mana) return { ok: false, error: 'not enough Mana' };
      p.mana -= pw.cost; p.powerUsed = true;
      const ctx = { ownerIdx: idx, isSpell: true,
        region: opts.region || (this._deriveNeeds(pw.effect).region ? this._autoRegion(null) : null),
        targetFoe: opts.enemyUid ? this._foeByUid(opts.enemyUid) : null };
      this.log_(`${p.name} invokes ${pw.name}!`, 'play');
      this.applyEffects(pw.effect, ctx); this._checkEnd();
      return { ok: true };
    }

    _wit(idx) {
      const p = this.players[idx]; if (p.house !== 'ravenclaw') return;
      p.witCount++;
      if (p.witCount % 2 === 0) {
        this.log_(`${p.name}'s Wit flares — draw + a bolt of insight!`, 'good');
        this._draw(p, 1);
        const e = this._mostThreatening(); if (e) this._damageFoe(e, 3, { ownerIdx: idx, bySpell: true });
      }
    }

    endTurn(idx, optsArg = {}) {
      if (this.over || this.phase !== 'player' || this.turn !== idx) return { ok: false, error: 'not your turn' };
      this.log_(`${this.players[idx].name} ends their turn.`, 'turn');
      if (idx + 1 < this.numPlayers) { this._startPlayerTurn(idx + 1); return { ok: true, voldemort: false }; }
      if (optsArg.stepped) return { ok: true, voldemort: true, stepped: true };
      this._voldemortTurn();
      return { ok: true, voldemort: true };
    }

    /* ================= VOLDEMORT'S TURN (stepped) ================ */
    static get V_BEATS() {
      return {
        advance: { title: 'The Horde Advances', icon: '👣', flavor: 'The dark tide surges down the grounds toward the gate.' },
        melee:   { title: 'Battle is Joined',  icon: '⚔', flavor: 'Wherever your defenders meet the horde, blood is shed on both sides.' },
        muster:  { title: 'Out of the Darkness', icon: '🌫', flavor: 'Fresh horrors emerge from the Forbidden Forest.' },
      };
    }
    voldemortStepKeys() { return ['advance', 'melee', 'muster']; }

    voldemortBegin() {
      this.phase = 'voldemort';
      this.log_('— Voldemort\'s forces stir —', 'vold');
      this.castleShieldThisTurn = this.pendingShield; this.pendingShield = 0;
      this._fireTriggers('castleShield');
    }

    voldemortStep(key) {
      const start = this.log.length; const w0 = this.castleHp, m0 = this.morale;
      if (key === 'advance') {
        // persistent enchant effects (Creeping Venom chip, Devil's Snare) act first
        this._fireTriggers('volley');
        this.foes.forEach(f => { if (f.frozen) { f.frozen = false; } else f.step += f.speed; });
        // breaches: anything past the gate hammers the Wards
        this.foes.slice().forEach(f => { if (f.step > this.cfg.gateStep) this._breach(f); });
        if (this.castleHp === w0 && this.log.length === start) this.log_('The gate holds — nothing breaks through yet.', 'info');
      } else if (key === 'melee') {
        PLAY_REGIONS.forEach(rid => this._combat(rid));
        if (this.log.length === start) this.log_('An uneasy quiet — no blades meet this turn.', 'info');
      } else if (key === 'muster') {
        this.foes.forEach(f => { f.justArrived = false; });
        this._muster();
      }
      const meta = Game.V_BEATS[key];
      return { key, title: meta.title, icon: meta.icon, flavor: meta.flavor, lines: this.log.slice(start), wards: this.castleHp - w0, morale: this.morale - m0 };
    }

    voldemortFinish() {
      this._tickLifted();
      this.allies.forEach(a => { a.tempAtk = 0; a.invuln = false; });
      this._checkEnd();
      if (!this.over) { this.round++; this._startPlayerTurn(0); } else { this.phase = 'over'; }
    }
    _voldemortTurn() {
      this.voldemortBegin();
      for (const k of this.voldemortStepKeys()) { if (this.over) break; this.voldemortStep(k); }
      this.voldemortFinish();
    }

    _muster() {
      // scheduled boss that is due THIS round (queue pre-rolled bosses for round+1,
      // so also catch any due exactly now that weren't queued).
      this.cfg.bossSchedule.forEach(b => {
        if (b.turn === this.round && !this.bossesSpawned[b.id]) {
          this.bossesSpawned[b.id] = true; const f = this._spawn(cardById(b.id), 0);
          this.log_(`☠ ${f.name} emerges from the forest!`, 'boss');
        }
      });
      let n = 0;
      this.queue.forEach(def => {
        if (def.boss) { if (this.bossesSpawned[def.id]) return; this.bossesSpawned[def.id] = true; this.log_(`☠ ${def.name} emerges from the forest!`, 'boss'); }
        this._spawn(def, 0); n++;
      });
      this.log_(`The horde swells — ${n} foe${n !== 1 ? 's' : ''} pour from the trees.`, 'vold');
      this.queue = this._rollWave();
    }

    /* ---- breach & melee ----------------------------------------- */
    _breach(f) {
      let dmg = (f.breach != null) ? f.breach : f.atk * (f.siege ? 2 : 1);
      if (this.castleShieldThisTurn > 0) { const a = Math.min(this.castleShieldThisTurn, dmg); this.castleShieldThisTurn -= a; dmg -= a; }
      this._removeFoe(f);
      if (dmg <= 0) { this.log_(`The Wards turn aside ${f.name}'s assault.`, 'good'); return; }
      this.castleHp = Math.max(0, this.castleHp - dmg);
      this.morale = Math.min(this.moraleMax, this.morale + this.cfg.breachMoraleGain);
      this.log_(`${f.name} breaches the Gate — Wards −${dmg} (now ${this.castleHp}/${this.castleMax}).`, 'bad');
      this._checkEnd();
    }

    _effectiveAtk(a) {
      let atk = a.atk + (a.tempAtk || 0);
      if (a.loyal) { const others = this.alliesIn(a.region).length - 1; atk += Math.min(3, others); }
      if (this.players[a.ownerIdx] && this.players[a.ownerIdx].house === 'gryffindor') atk += 1; // Valour (always)
      return Math.max(0, atk);
    }

    // Simultaneous melee in one region: both sides strike, both can fall.
    _combat(rid) {
      const allies = this.alliesIn(rid);
      const foes = this.foesIn(rid);
      if (!foes.length || !allies.length) return;
      const guard = allies.reduce((s, a) => s + (a.guard || 0), 0);
      const fightTargets = allies.filter(a => !a.intangible); // who foes can actually hit

      // allies → foes (round-robin focus, + lash, + chip)
      allies.forEach((a, i) => {
        if (!foes.length) return;
        this._damageFoe(foes[i % foes.length], this._effectiveAtk(a), { ownerIdx: a.ownerIdx, bySpell: false });
        if (a.lash && foes.length > 1) this._damageFoe(foes[(i + 1) % foes.length], a.atk, { ownerIdx: a.ownerIdx, bySpell: false });
        if (a.chip) { const t = this.mostAdvancedIn(rid); if (t) this._damageFoe(t, a.chip, { ownerIdx: a.ownerIdx, bySpell: false }); }
      });
      // foes → allies (simultaneous: a dying foe still strikes)
      foes.forEach((f, i) => {
        const pool = f.armorPierce ? allies.filter(a => !a.intangible) : fightTargets;
        if (!pool.length) return;
        let dmg = f.atk; if (!f.armorPierce) dmg = Math.max(0, dmg - guard);
        const tgt = f.armorPierce ? pool.reduce((b, a) => a.hp < b.hp ? a : b) : pool[i % pool.length];
        if (tgt.invuln) dmg = 0;
        if (dmg > 0) { tgt.hp -= dmg; if (f.healOnHit) f.hp = Math.min(f.maxHp, f.hp + f.healOnHit); }
      });
      this.log_(`Battle rages at ${this._rname(rid)}.`, 'melee');
      // Foe deaths were resolved as damage landed (simultaneous: a felled foe still
      // struck above). Now clear any allies that fell in the exchange.
      this.allies.filter(a => a.region === rid && a.hp <= 0).slice().forEach(a => this._slayAlly(a));
    }

    _slayAlly(a) {
      const owner = this.players[a.ownerIdx];
      if (owner.house === 'hufflepuff' && !owner.loyaltySaveUsed && owner.loyaltySavesLeft > 0) { owner.loyaltySaveUsed = true; owner.loyaltySavesLeft--; a.hp = 1; this.log_(`Loyalty! ${a.name} refuses to fall (1 HP).`, 'good'); return; }
      const i = this.allies.indexOf(a); if (i >= 0) this.allies.splice(i, 1);
      this.log_(`${a.name} falls.`, 'bad');
      const card = cardById(a.id);
      if (card && card.triggers) card.triggers.filter(t => t.when === 'slain').forEach(t => this.applyEffects(t.effect, { ownerIdx: a.ownerIdx, region: a.region, sourceAlly: a }));
    }

    /* ================= EFFECT ENGINE ============================= */
    applyEffects(effects, ctx) { (effects || []).forEach(fx => { if (!this.over) this._applyOne(fx, ctx); }); }
    _applyOne(fx, ctx) {
      const key = Object.keys(fx)[0]; const v = fx[key] || {}; const owner = this.players[ctx.ownerIdx];
      switch (key) {
        case 'damage': return this._fxDamage(v, ctx);
        case 'splash': return this._fxSplash(v, ctx);
        case 'globalDamage': return this.foes.slice().forEach(f => this._damageFoe(f, v.n, ctx));
        case 'perSpellDamage': { const n = v.n * Math.max(1, owner.spellsThisTurn); return this.foes.slice().forEach(f => this._damageFoe(f, n, { ownerIdx: ctx.ownerIdx, bySpell: true })); }
        case 'morale': return this._drainMorale(v.n, 'Their resolve wavers');
        case 'push': return this._fxOnFoes(v, ctx, f => { f.step = Math.max(0, f.step - v.n); });
        case 'weaken': return this._fxOnFoes(v, ctx, f => { f.atk = Math.max(0, f.atk - v.n); });
        case 'freeze': return this._fxFreeze(v, ctx);
        case 'freezeLane': { const rid = v.boundLane ? ctx.boundRegion : ctx.region; if (rid) this.foesIn(rid).forEach(f => { if (!f.immuneFreeze) f.frozen = true; }); return; }
        case 'execute': return this._fxExecute(v, ctx);
        case 'control': return this._fxControl(v, ctx);
        case 'redirect': return this._fxRedirect(v, ctx);
        case 'lift': return this._fxLift(v, ctx);
        case 'heal': return this._fxHeal(v, ctx);
        case 'buff': return this._fxBuff(v, ctx);
        case 'swarmBuff': return this._fxSwarm(v, ctx);
        case 'invuln': return this._fxInvuln(v, ctx);
        case 'castleHeal': return void (this.castleHp = Math.min(this.castleMax, this.castleHp + v.n));
        case 'castleShield': { if (this.phase === 'voldemort') this.castleShieldThisTurn += v.n; else this.pendingShield += v.n; return; }
        case 'mana': return void (owner.mana += v.n);
        case 'draw': return this._draw(owner, v.n);
        case 'discard': { for (let i = 0; i < v.n && owner.hand.length; i++) owner.discard.push(owner.hand.pop().id); return; }
        case 'costReduce': { if (v.oneCard) owner.costReduceOne = v.n; else owner.costReduce += v.n; return; }
        case 'summon': return this._fxSummon(v, ctx);
        case 'laneAttack': return; // (no card uses it in this model)
        case 'returnToHand': { if (ctx.sourceAlly) { owner.hand.push({ uid: this._nextUid(), id: ctx.sourceAlly.id }); this.log_(`${ctx.sourceAlly.name} is reborn from the ashes.`, 'good'); } return; }
        default: return;
      }
    }
    _fxOnFoes(v, ctx, fn) {
      let list = [];
      if (v.target === 'lane') list = this.foesIn(v.boundLane ? ctx.boundRegion : ctx.region).slice();
      else if (v.target === 'all') list = this.foes.slice();
      else if (v.target === 'front') { const e = this.mostAdvancedIn(ctx.region); if (e) list = [e]; }
      else { const e = ctx.targetFoe || this._mostThreatening(); if (e) list = [e]; }
      list.forEach(fn);
    }
    _fxDamage(v, ctx) {
      const sp = ctx.isSpell ? this.spellPowerOf(ctx.ownerIdx) : 0; const n = v.n + sp;
      let list = [];
      if (v.target === 'lane') list = this.foesIn(v.boundLane ? ctx.boundRegion : ctx.region).slice();
      else if (v.target === 'all') list = this.foes.slice();
      else if (v.target === 'front') { const e = this.mostAdvancedIn(ctx.region || this._hottestRegion()); if (e) list = [e]; }
      else if (v.target === 'back') {
        if (v.allLanes) list = GROUNDS.map(g => { const fs = this.foesIn(g); return fs.length ? fs.reduce((b, f) => f.step < b.step ? f : b) : null; }).filter(Boolean);
        else { const fs = this.foes.slice().sort((a, b) => a.step - b.step); if (fs[0]) list = [fs[0]]; }
      } else { const e = ctx.targetFoe || this._mostThreatening(); if (e) { list = [e]; ctx.lastFoe = e; } }
      list.forEach(f => { const killed = this._damageFoe(f, n, { ownerIdx: ctx.ownerIdx, bySpell: ctx.isSpell, noHeal: v.noHeal }); if (killed && v.moraleOnKill) this._drainMorale(v.moraleOnKill, 'A telling blow'); });
    }
    _fxSplash(v, ctx) {
      const e = ctx.lastFoe; if (!e) return; const rid = this.regionOfFoe(e);
      this.foesIn(rid).filter(x => x !== e).slice(0, 2).forEach(x => this._damageFoe(x, v.n, { ownerIdx: ctx.ownerIdx, bySpell: ctx.isSpell }));
    }
    _fxFreeze(v, ctx) {
      let e;
      if (v.target === 'behind') { const t = ctx.lastFoe || ctx.targetFoe; if (!t) return; const rid = this.regionOfFoe(t); e = this.foesIn(rid).filter(x => x !== t)[0]; }
      else { e = ctx.targetFoe || this._mostThreatening(); ctx.lastFoe = e; }
      if (e && !e.immuneFreeze) { e.frozen = true; this.log_(`${e.name} is frozen.`, 'good'); }
    }
    _fxExecute(v, ctx) { const e = ctx.targetFoe || this._executeTarget(v.maxHp); if (e && !e.immuneExecute && e.hp <= v.maxHp) { this.log_(`${e.name} is destroyed outright.`, 'good'); this._slay(e, { ownerIdx: ctx.ownerIdx, bySpell: true }); } }
    _fxControl(v, ctx) {
      const e = ctx.targetFoe || this._mostThreatening();
      if (!e || e.immuneControl) { if (e) this.log_(`${e.name} resists the curse.`, 'bad'); return; }
      const rid = this.regionOfFoe(e); this._removeFoe(e);
      this.allies.push({ uid: e.uid, id: 'controlled', name: e.name + ' (Imperiused)', ownerIdx: ctx.ownerIdx, region: rid === 'forest' ? 'gate' : rid, hp: e.hp, maxHp: e.maxHp, atk: e.atk, tempAtk: 0, guard: 0, lash: false, loyal: false, intangible: false, chip: 0, spellPower: 0, invuln: false, tags: e.tags });
      this.log_(`${e.name} is seized by Imperio — it fights for you now!`, 'good');
    }
    _fxRedirect(v, ctx) {
      const e = ctx.targetFoe || this._mostThreatening(); if (!e) return;
      const rid = this.regionOfFoe(e); const other = this.foesIn(rid).filter(x => x !== e)[0];
      if (other) { this._damageFoe(other, e.atk, { ownerIdx: ctx.ownerIdx, bySpell: true }); this.log_(`${e.name} is Confunded and turns on its own!`, 'good'); }
      if (!e.immuneFreeze) e.frozen = true;
    }
    _fxLift(v, ctx) { const e = ctx.targetFoe || this._mostThreatening(); if (!e) return; this._removeFoe(e); this.lifted.push({ foe: e, timer: v.turns || 1 }); this.log_(`${e.name} is hoisted into the air (Levicorpus).`, 'good'); }
    _tickLifted() { this.lifted = this.lifted.filter(x => { x.timer--; if (x.timer > 0) return true; x.foe.step = 0; x.foe.frozen = false; this.foes.push(x.foe); this.log_(`${x.foe.name} crashes back down at the treeline.`, 'vold'); return false; }); }
    _fxHeal(v, ctx) {
      const mine = this.allies.filter(a => a.ownerIdx === ctx.ownerIdx); let list = [];
      if (v.target === 'all') list = mine;
      else if (v.target === 'lane') list = mine.filter(a => a.region === ctx.region);
      else if (v.target === 'self') list = ctx.sourceAlly ? [ctx.sourceAlly] : [];
      else if (v.target === 'lowest') { const a = this._lowestAlly(ctx.ownerIdx); if (a) list = [a]; }
      else { const a = ctx.targetAlly || this._lowestAlly(ctx.ownerIdx); if (a) list = [a]; }
      list.forEach(a => { a.hp = Math.min(a.maxHp, a.hp + v.n); });
    }
    _fxBuff(v, ctx) {
      const mine = this.allies.filter(a => a.ownerIdx === ctx.ownerIdx);
      let list = v.target === 'lane' ? mine.filter(a => a.region === ctx.region) : v.target === 'all' ? mine : (ctx.targetAlly ? [ctx.targetAlly] : mine);
      list.forEach(a => { if (v.duration === 'perm') { if (v.hp) { a.maxHp += v.hp; a.hp += v.hp; } if (v.atk) a.atk += v.atk; } else if (v.atk) a.tempAtk = (a.tempAtk || 0) + v.atk; });
    }
    _fxSwarm(v, ctx) { const mine = this.alliesIn(ctx.region).filter(a => a.ownerIdx === ctx.ownerIdx); const n = mine.length; mine.forEach(a => { a.tempAtk = (a.tempAtk || 0) + n; }); }
    _fxInvuln(v, ctx) { const mine = this.allies.filter(a => a.ownerIdx === ctx.ownerIdx); let list = v.target === 'lane' ? mine.filter(a => a.region === ctx.region) : v.target === 'all' ? mine : (ctx.targetAlly ? [ctx.targetAlly] : mine); list.forEach(a => { a.invuln = true; }); }
    _fxSummon(v, ctx) { const rid = ctx.region || this._hottestRegion(); const card = cardById(v.id); for (let i = 0; i < v.count; i++) this.allies.push(this._mkAlly(card, ctx.ownerIdx, rid)); this.log_(`${this.players[ctx.ownerIdx].name} summons ${v.count}× ${card.name} to ${this._rname(rid)}.`, 'play'); }

    /* ---- damage / slay plumbing -------------------------------- */
    _damageFoe(f, n, ctx) {
      if (n <= 0 || !f) return false;
      if (ctx && ctx.noHeal) f.noHeal = true;
      f.hp -= n;
      if (f.hp <= 0) return this._slay(f, ctx || {});
      return false;
    }
    _removeFoe(f) { const i = this.foes.indexOf(f); if (i >= 0) this.foes.splice(i, 1); }
    _slay(f, ctx) {
      if (f.reanimate && !f.reanimated) { f.reanimated = true; f.hp = f.reanimate.hp; f.step = 0; f.frozen = false; this.log_(`${f.name} rises again!`, 'vold'); return false; }
      this._removeFoe(f);
      let drain = f.morale;
      if (ctx.bySpell && this.players[ctx.ownerIdx] && this.players[ctx.ownerIdx].house === 'slytherin') drain += 1; // Cunning
      this._drainMorale(drain, `${f.name} is slain`);
      return true;
    }
    _drainMorale(n, label) { if (n <= 0) return; this.morale = Math.max(0, this.morale - n); if (label) this.log_(`${label} — Dark Morale −${n} (now ${this.morale}/${this.moraleMax}).`, 'good'); this._checkEnd(); }

    /* ---- triggers ----------------------------------------------- */
    _fireTriggers(when, onlyOwner) {
      this.enchants.forEach(en => {
        if (onlyOwner != null && en.ownerIdx !== onlyOwner) return;
        const card = cardById(en.id);
        (card.triggers || []).filter(t => t.when === when).forEach(t => this.applyEffects(t.effect, { ownerIdx: en.ownerIdx, region: en.boundRegion, boundRegion: en.boundRegion }));
      });
      this.allies.forEach(a => {
        if (onlyOwner != null && a.ownerIdx !== onlyOwner) return;
        const card = cardById(a.id); if (!card || !card.triggers) return;
        card.triggers.filter(t => t.when === when).forEach(t => this.applyEffects(t.effect, { ownerIdx: a.ownerIdx, region: a.region, sourceAlly: a }));
      });
    }

    /* ---- targeting helpers ------------------------------------- */
    _foeByUid(uid) { return this.foes.find(f => f.uid === uid) || null; }
    _allyByUid(uid) { return this.allies.find(a => a.uid === uid) || null; }
    _mostThreatening() { if (!this.foes.length) return null; return this.foes.reduce((b, f) => (f.step > b.step || (f.step === b.step && f.hp > b.hp)) ? f : b); }
    _executeTarget(maxHp) { const es = this.foes.filter(f => !f.immuneExecute && f.hp <= maxHp); if (!es.length) return null; return es.reduce((b, f) => f.hp > b.hp ? f : b); }
    _lowestAlly(idx) { const as = this.allies.filter(a => a.ownerIdx === idx && a.hp < a.maxHp); if (!as.length) return null; return as.reduce((b, a) => (a.maxHp - a.hp) > (b.maxHp - b.hp) ? a : b); }
    _hottestRegion() { let best = 'gate', bs = -1; PLAY_REGIONS.forEach(rid => { const s = this.foesIn(rid).reduce((x, f) => x + f.hp + f.step * 2, 0); if (s > bs) { bs = s; best = rid; } }); return best; }
    _autoRegion(card) { return this._hottestRegion(); }
    _rname(id) { const r = REGIONS.find(x => x.id === id); return r ? r.short : id; }

    /* ---- fog-of-war forecast (the muster preview) -------------- */
    forecast() {
      const boss = this.queue.find(t => t.boss);
      return { size: this.queue.filter(t => !t.boss).length, queue: this.queue, bossNow: boss || null };
    }

    /* ---- end conditions ---------------------------------------- */
    _checkEnd() {
      if (this.over) return;
      if (this.morale < this.moraleWin) { this.over = 'win'; this.log_('★ The Dark Army breaks and scatters — HOGWARTS STANDS! ★', 'win'); }
      else if (this.castleHp < this.castleLose) { this.over = 'lose'; this.log_('☠ The Wards shatter — Hogwarts has fallen. ☠', 'lose'); }
    }

    snapshot() {
      return { round: this.round, turn: this.turn, phase: this.phase, over: this.over, castle: this.castleHp, morale: this.morale,
        regions: REGIONS.map(r => ({ id: r.id, foes: this.foesIn(r.id).length, allies: this.alliesIn(r.id).length })) };
    }
  }

  const ENGINE = { Game, mulberry32 };
  if (typeof module !== 'undefined' && module.exports) module.exports = ENGINE;
  global.HW = global.HW || {};
  global.HW.engine = ENGINE;
})(typeof globalThis !== 'undefined' ? globalThis : this);
