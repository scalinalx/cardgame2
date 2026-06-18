/* =====================================================================
 * THE MARAUDERS — game engine   (engine.js)
 * ---------------------------------------------------------------------
 * Pure rules. No DOM, no rendering, no globals beyond the export. The
 * whole game is a plain state object + verbs that mutate it, so it can be
 * driven by the UI in the browser OR fuzzed headlessly under Node.
 *
 * VERBS (everything the UI calls):
 *   Game.create(scenario)        -> new game
 *   g.activeChar()               -> whose turn it is
 *   g.reachable(char)            -> Map "x,y" -> path[]   (move targets)
 *   g.moveTo(char, x, y)         -> walk (returns the path for animation)
 *   g.spellTargets(char, spell)  -> [{x,y,...}]           (cast targets)
 *   g.cast(char, spell, x, y)    -> resolve a spell
 *   g.canEndTurn(char) / g.endTurn()
 *   g.computeVisible()           -> recompute fog (visible + explored)
 *
 * The engine never reads the clock or randomness it can't reproduce; the
 * only RNG is a small seeded generator (handy later for shifting areas).
 * ===================================================================== */
(function (root) {
  'use strict';

  const data = (typeof module !== 'undefined' && module.exports)
    ? require('./data.js')
    : root.MAR.data;
  const { CONFIG, TILES, MARKERS, SPELLS } = data;

  const key = (x, y) => x + ',' + y;
  const DIRS = [[1, 0], [-1, 0], [0, 1], [0, -1]];

  /* tiny seeded RNG (mulberry32) — deterministic, for future shifting maps */
  function rng(seed) {
    let a = seed >>> 0;
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  class Game {
    constructor(scenario, opts) {
      opts = opts || {};
      this.scenario = scenario;
      this.rand = rng(opts.seed || 1);
      this.W = scenario.grid[0].length;
      this.H = scenario.grid.length;
      this.tiles = [];           // tiles[y][x] = single-char tile code
      this.chars = [];
      this.patrols = [];
      this.item = null;          // {x,y, name, glyph, held:false, carrier:null}
      this.log = [];
      this.status = 'play';      // 'play' | 'won' | 'lost'
      this.alarm = false;        // raised when the Cup is taken — the flee begins
      this.housePoints = CONFIG.startHousePoints;
      this.turn = 1;             // world round counter
      this.activeIdx = 0;
      this.explored = new Set(); // tiles ever seen
      this.visible = new Set();  // tiles lit right now

      this._parse(scenario);
      this.loot = (scenario.loot || []).map(L => ({ ...L, taken: false }));
      this.treasures = 0;
      this.visitedRooms = new Set();
      const home = this.roomAt(this.chars[0].x, this.chars[0].y);
      if (home) this.visitedRooms.add(home.name);        // no fanfare for the spawn room
      this._beginTurn();
      this.computeVisible();
    }

    /* ---- world construction ------------------------------------------ */
    _parse(scn) {
      const charDefs = scn.party.slice();
      let ci = 0, pi = 0;
      for (let y = 0; y < this.H; y++) {
        const row = [];
        for (let x = 0; x < this.W; x++) {
          let ch = scn.grid[y][x];
          if (MARKERS[ch]) {
            if (MARKERS[ch] === 'char') {
              const def = charDefs[ci++] || { id: 'c' + ci, name: 'Student', house: 'Gryffindor', spells: [] };
              this.chars.push({ ...def, x, y, down: false, moves: 0, acted: false, idx: this.chars.length });
            } else if (MARKERS[ch] === 'patrol') {
              const pd = (scn.patrols && scn.patrols[pi]) || { name: 'Patrol', route: [[x, y]] };
              this.patrols.push({
                ...pd, x, y, leg: 0, idx: pi++,
                facing: { dx: 0, dy: 1 }, alerted: false, alertTimer: 0, lastSeen: null,
                dormant: !!pd.dormant || ch === 'p', startDormant: !!pd.dormant || ch === 'p',
                sight: CONFIG.patrolSight
              });
            } else if (MARKERS[ch] === 'item') {
              this.item = { x, y, homeX: x, homeY: y, name: scn.item.name, glyph: scn.item.glyph, held: false, carrier: null };
            }
            ch = '.'; // markers stand on floor
          }
          row.push(ch);
        }
        this.tiles.push(row);
      }
      this.startPos = this.chars.map(c => ({ x: c.x, y: c.y }));
    }

    /* ---- tile helpers ------------------------------------------------- */
    inBounds(x, y) { return x >= 0 && y >= 0 && x < this.W && y < this.H; }
    tileAt(x, y) { return this.inBounds(x, y) ? this.tiles[y][x] : '#'; }
    def(x, y) { return TILES[this.tileAt(x, y)] || TILES['#']; }
    isWalk(x, y) { return this.def(x, y).walk; }
    isOpaque(x, y) { return this.def(x, y).opaque; }
    charAt(x, y) { return this.chars.find(c => !c.down && c.x === x && c.y === y) || null; }
    patrolAt(x, y) { return this.patrols.find(p => p.x === x && p.y === y) || null; }
    blocked(x, y) { return !this.isWalk(x, y) || !!this.charAt(x, y) || !!this.patrolAt(x, y); }

    activeChar() { return this.chars[this.activeIdx]; }

    /* ---- turn lifecycle ----------------------------------------------- */
    _beginTurn() {
      const c = this.activeChar();
      if (!c) return;
      if (c.down) { this._advance(); return; }   // skip downed students
      c.moves = CONFIG.movesPerTurn;
      c.acted = false;
      c.lumos = false;
    }

    canEndTurn() { return this.status === 'play'; }

    endTurn() {
      if (this.status !== 'play') return;
      this._advance();
    }

    _advance() {
      const n = this.chars.length;
      let next = this.activeIdx;
      for (let i = 0; i < n; i++) {
        next = (next + 1) % n;
        if (next === 0) { this._worldPhase(); if (this.status !== 'play') return; }
        if (!this.chars[next].down) break;
      }
      this.activeIdx = next;
      this._beginTurn();
      this.computeVisible();
    }

    /* ---- movement ----------------------------------------------------- */
    // BFS of tiles reachable within the char's remaining moves.
    // Teammates are PASS-THROUGH (squeeze past a friend in a corridor) but
    // you can't END a move on their tile. Patrols always block.
    reachable(char) {
      char = char || this.activeChar();
      const out = new Map();
      if (!char || char.moves <= 0) return out;
      const seen = new Set([key(char.x, char.y)]);
      let frontier = [{ x: char.x, y: char.y, path: [] }];
      let steps = 0;
      while (frontier.length && steps < char.moves) {
        steps++;
        const next = [];
        for (const node of frontier) {
          for (const [dx, dy] of DIRS) {
            const nx = node.x + dx, ny = node.y + dy, k = key(nx, ny);
            if (seen.has(k) || !this.isWalk(nx, ny) || this.patrolAt(nx, ny)) continue;
            seen.add(k);
            const path = node.path.concat([{ x: nx, y: ny }]);
            if (!this.charAt(nx, ny)) out.set(k, path);   // can't STOP on a teammate
            next.push({ x: nx, y: ny, path });
          }
        }
        frontier = next;
      }
      return out;
    }

    moveTo(char, x, y) {
      char = char || this.activeChar();
      const path = this.reachable(char).get(key(x, y));
      if (!path) return null;
      char.moves -= path.length;
      char.x = x; char.y = y;
      this._afterArrive(char);
      this.computeVisible();
      this._checkWin();
      return path;
    }

    // which named room is this tile in? (null = the corridors)
    roomAt(x, y) {
      for (const r of (this.scenario.rooms || [])) if (x >= r.x && x < r.x + r.w && y >= r.y && y < r.y + r.h) return r;
      return null;
    }

    // pick up the cup just by walking onto it; pocket any treasure underfoot
    _afterArrive(char) {
      const room = this.roomAt(char.x, char.y);
      if (room && !this.visitedRooms.has(room.name)) {
        this.visitedRooms.add(room.name);
        this._say(char.name + ' slips into ' + room.name + '.');
      }
      for (const L of this.loot) {
        if (!L.taken && L.x === char.x && L.y === char.y) {
          L.taken = true; this.treasures++;
          this._say(char.name + ' finds ' + L.name + '!');
        }
      }
      if (this.item && !this.item.held && char.x === this.item.x && char.y === this.item.y) {
        this.item.held = true; this.item.carrier = char.id;
        this._say(char.name + ' takes ' + this.item.name + '!');
        this._raiseAlarm();
      }
      if (this.item && this.item.held && this.item.carrier === char.id) {
        this.item.x = char.x; this.item.y = char.y;
      }
    }

    // taking the Cup wakes the whole castle: every patrol rouses, quickens and
    // hunts. This turns the careful sneak-in into a frantic flee back out.
    _raiseAlarm() {
      if (this.alarm) return;
      this.alarm = true;
      this._say('You seize ' + this.item.name + ' — the castle wakes. RUN!');
      for (const p of this.patrols) { p.dormant = false; p.alerted = true; p.alertTimer = 999; p.sight = CONFIG.patrolSight + 2; p.lastSeen = null; }
    }

    // a fresh start after a catch: the castle settles, guards return to their
    // posts. House Points are the budget — no death spirals.
    _calmAlarm() {
      this.alarm = false;
      for (const p of this.patrols) { p.alerted = false; p.alertTimer = 0; p.lastSeen = null; p.sight = CONFIG.patrolSight; p.dormant = p.startDormant; }
    }

    /* ---- spells ------------------------------------------------------- */
    knows(char, spell) { return char.spells && char.spells.indexOf(spell) >= 0; }

    // Valid targets for a spell, as [{x,y, extra...}]. UI highlights these.
    spellTargets(char, spellId) {
      char = char || this.activeChar();
      const spell = SPELLS[spellId];
      if (!spell || char.acted || !this.knows(char, spellId)) return [];
      if (spell.target === 'self') return [{ x: char.x, y: char.y }];

      if (spell.target === 'ally') {            // Wingardium: pick an adjacent friend
        return this.chars
          .filter(o => o !== char && !o.down && Math.abs(o.x - char.x) + Math.abs(o.y - char.y) === 1)
          .map(o => ({ x: o.x, y: o.y, ally: o.id }));
      }

      // tile/adjacent transform spells
      const range = spell.target === 'adj' ? CONFIG.spellRange : (CONFIG[spell.range] || 1);
      const want = spell.transforms ? Object.keys(spell.transforms) : [];
      const out = [];
      for (let dy = -range; dy <= range; dy++) {
        for (let dx = -range; dx <= range; dx++) {
          const dist = Math.abs(dx) + Math.abs(dy);
          if (dist === 0 || dist > range) continue;
          const tx = char.x + dx, ty = char.y + dy;
          const kind = this.def(tx, ty).kind;
          if (want.indexOf(kind) >= 0 && this._clearLine(char.x, char.y, tx, ty, true)) {
            out.push({ x: tx, y: ty });
          }
        }
      }
      return out;
    }

    // landing tiles when floating `ally` with Wingardium (straight lines over gaps)
    flingTargets(char, ally) {
      const out = [];
      const R = CONFIG.flingRange;
      for (const [dx, dy] of DIRS) {
        for (let n = 1; n <= R; n++) {
          const tx = ally.x + dx * n, ty = ally.y + dy * n;
          if (!this.inBounds(tx, ty)) break;
          if (this.def(tx, ty).kind === 'wall') break;       // walls stop the flight
          if (this.isWalk(tx, ty) && !this.blocked(tx, ty)) out.push({ x: tx, y: ty });
        }
      }
      return out;
    }

    cast(char, spellId, x, y, opt) {
      char = char || this.activeChar();
      const spell = SPELLS[spellId];
      if (!spell || char.acted || this.status !== 'play' || !this.knows(char, spellId)) return false;

      if (spellId === 'lumos') {
        char.lumos = true;
        char.acted = true;
        this._say(char.name + ' casts Lumos — the dark draws back.');
        this.computeVisible();
        return true;
      }

      if (spell.target === 'ally') {
        // two-step in UI: first the ally tile, then a landing tile (opt.to)
        const ally = this.chars.find(o => o.x === x && o.y === y && !o.down && o !== char);
        if (!ally || !opt || !opt.to) return false;
        const land = this.flingTargets(char, ally).find(t => t.x === opt.to.x && t.y === opt.to.y);
        if (!land) return false;
        ally.x = land.x; ally.y = land.y;
        char.acted = true;
        this._say(char.name + ' floats ' + ally.name + ' across the gap.');
        this._afterArrive(ally);
        this.computeVisible(); this._checkWin();
        return true;
      }

      // transform spells
      const t = this.spellTargets(char, spellId).find(p => p.x === x && p.y === y);
      if (!t) return false;
      const kind = this.def(x, y).kind;
      const becomes = spell.transforms[kind];
      const codeMap = { floor: '.' };
      this.tiles[y][x] = codeMap[becomes] || '.';
      char.acted = true;
      this._say(char.name + ' casts ' + spell.name + '.');
      this.computeVisible();
      return true;
    }

    /* ---- stealth: what a patrol can see ------------------------------- */
    _dist(a, b) { return Math.abs(a.x - b.x) + Math.abs(a.y - b.y); }
    _dirToward(p, t) {
      const dx = t.x - p.x, dy = t.y - p.y;
      return Math.abs(dx) >= Math.abs(dy) ? { dx: Math.sign(dx) || p.facing.dx, dy: 0 } : { dx: 0, dy: Math.sign(dy) || p.facing.dy };
    }
    // can patrol p see student c right now? a forward cone + clear line of
    // sight; an adjacent or Lumos-lit student is seen from any direction.
    patrolSees(p, c) {
      if (p.dormant || c.down || c.shaken) return false;   // just-caught students get a breather
      const d = this._dist(p, c);
      if (d === 0) return true;
      if (d > p.sight) return false;
      if (!this._clearLine(p.x, p.y, c.x, c.y, false)) return false;
      if (d === 1 || c.lumos) return true;
      const ox = c.x - p.x, oy = c.y - p.y, len = Math.hypot(ox, oy) || 1;
      return (ox * p.facing.dx + oy * p.facing.dy) / len >= 0.35;     // ~110° cone
    }
    // the tiles a patrol is watching right now (UI draws these as danger)
    visionTiles(p) {
      const out = [];
      if (p.dormant) return out;
      for (let y = p.y - p.sight; y <= p.y + p.sight; y++) for (let x = p.x - p.sight; x <= p.x + p.sight; x++) {
        if (!this.inBounds(x, y)) continue;
        const d = Math.abs(x - p.x) + Math.abs(y - p.y);
        if (d === 0 || d > p.sight || !this._clearLine(p.x, p.y, x, y, false)) continue;
        if (d === 1) { out.push(key(x, y)); continue; }
        const ox = x - p.x, oy = y - p.y, len = Math.hypot(ox, oy) || 1;
        if ((ox * p.facing.dx + oy * p.facing.dy) / len >= 0.35) out.push(key(x, y));
      }
      return out;
    }

    /* ---- world phase (patrols + hazards) ------------------------------ */
    _worldPhase() {
      this.turn++;
      for (const c of this.chars) if (c.shaken) c.shaken--;
      for (const p of this.patrols) this._stepPatrol(p);
      this._checkCaught();
    }

    _stepPatrol(p) {
      if (p.dormant) return;
      const spot = () => this.chars.filter(c => this.patrolSees(p, c)).sort((a, b) => this._dist(p, a) - this._dist(p, b))[0];
      let seen = spot();
      if (seen) { if (!p.alerted) this._say(p.name + ' spots ' + seen.name + '!'); p.alerted = true; p.alertTimer = 3; p.lastSeen = { x: seen.x, y: seen.y }; p.facing = this._dirToward(p, seen); }
      else if (p.alerted) { p.alertTimer--; if (p.alertTimer <= 0) { p.alerted = false; p.lastSeen = null; this._say(p.name + ' loses the trail.'); } }

      const steps = p.alerted ? 2 : 1;                 // alerted patrols move faster
      for (let s = 0; s < steps; s++) {
        let goal;
        if (p.alerted && p.lastSeen) goal = p.lastSeen;
        else { const wp = p.route[p.leg % p.route.length]; goal = { x: wp[0], y: wp[1] }; if (p.x === goal.x && p.y === goal.y) { p.leg++; const w = p.route[p.leg % p.route.length]; goal = { x: w[0], y: w[1] }; } }
        const bx = p.x, by = p.y;
        this._stepToward(p, goal);
        if (p.x !== bx || p.y !== by) p.facing = { dx: Math.sign(p.x - bx), dy: Math.sign(p.y - by) };
        seen = spot();
        if (seen) { p.alerted = true; p.alertTimer = 3; p.lastSeen = { x: seen.x, y: seen.y }; p.facing = this._dirToward(p, seen); }
        if (p.alerted && p.lastSeen && p.x === p.lastSeen.x && p.y === p.lastSeen.y) break;
      }
    }

    _stepToward(p, goal) {
      const opts = DIRS
        .map(([dx, dy]) => ({ x: p.x + dx, y: p.y + dy }))
        .filter(t => this.isWalk(t.x, t.y) && !this.patrolAt(t.x, t.y))
        .sort((a, b) => (Math.abs(a.x - goal.x) + Math.abs(a.y - goal.y)) - (Math.abs(b.x - goal.x) + Math.abs(b.y - goal.y)));
      if (opts.length && (Math.abs(opts[0].x - goal.x) + Math.abs(opts[0].y - goal.y)) <
        (Math.abs(p.x - goal.x) + Math.abs(p.y - goal.y))) { p.x = opts[0].x; p.y = opts[0].y; }
    }

    _checkCaught() {
      for (const p of this.patrols) {
        if (p.dormant) continue;
        for (const c of this.chars) {
          if (this.status !== 'play') return;
          if (c.down || c.shaken) continue;            // no spawn-camping a marched-off student
          if (Math.abs(c.x - p.x) + Math.abs(c.y - p.y) <= 1) this._catch(c, p);
        }
      }
    }

    _catch(c, p) {
      if (this.status !== 'play') return;
      this.housePoints = Math.max(0, this.housePoints - 1);
      this._say(p.name + ' catches ' + c.name + '! (−1 House Point)');
      // sent back to the entrance; the Cup returns to its spot (so a guard
      // can't camp it where you were caught) and the castle settles again.
      if (this.item && this.item.held && this.item.carrier === c.id) {
        this.item.held = false; this.item.carrier = null;
        this.item.x = this.item.homeX; this.item.y = this.item.homeY;
        this._calmAlarm();
      }
      const s = this.startPos[c.idx] || this.startPos[0];
      const spot = this._freeNear(s.x, s.y, c);            // never land on a teammate
      c.x = spot.x; c.y = spot.y;
      c.shaken = 2;                                        // patrols ignore them while they sneak back in
      if (this.housePoints <= 0) { this.status = 'lost'; this._say('Out of House Points — the run is over.'); }
    }

    // nearest walkable, unoccupied tile to (x,y) — used when sending a
    // caught student back so they never stack on a teammate.
    _freeNear(x, y, self) {
      const seen = new Set([key(x, y)]); let fr = [[x, y]];
      while (fr.length) {
        const nf = [];
        for (const [cx, cy] of fr) {
          const occ = this.chars.find(o => o !== self && !o.down && o.x === cx && o.y === cy);
          if (this.isWalk(cx, cy) && !occ && !this.patrolAt(cx, cy)) return { x: cx, y: cy };
          for (const [dx, dy] of DIRS) {
            const nx = cx + dx, ny = cy + dy, k = key(nx, ny);
            if (this.inBounds(nx, ny) && !seen.has(k)) { seen.add(k); nf.push([nx, ny]); }
          }
        }
        fr = nf;
      }
      return { x, y };
    }

    /* ---- visibility / fog --------------------------------------------- */
    computeVisible() {
      const vis = new Set();
      for (const c of this.chars) {
        if (c.down) continue;
        const r = c.lumos ? CONFIG.lumosRadius : CONFIG.lightRadius;
        this._castLight(c.x, c.y, r, vis);
      }
      // torches glow on their own
      for (let y = 0; y < this.H; y++)
        for (let x = 0; x < this.W; x++)
          if (this.def(x, y).light) this._castLight(x, y, this.def(x, y).light, vis);
      // reveal the walls/doors that hem in what we can see — an opaque tile
      // blocks its own light, so otherwise rooms would look like floating
      // platforms and doorways would be invisible until you stood on them.
      const border = [];
      for (const k of vis) {
        const [x, y] = k.split(',').map(Number);
        for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
          if (!dx && !dy) continue;
          if (this.inBounds(x + dx, y + dy) && this.isOpaque(x + dx, y + dy)) border.push(key(x + dx, y + dy));
        }
      }
      for (const k of border) vis.add(k);
      this.visible = vis;
      for (const k of vis) this.explored.add(k);
      // danger overlay: the tiles each patrol is watching, for the UI
      this.patrolVision = this.patrols.map(p => ({ tiles: this.visionTiles(p), alerted: p.alerted, dormant: p.dormant, facing: { dx: p.facing.dx, dy: p.facing.dy }, x: p.x, y: p.y }));
      this.danger = new Set();
      for (const pv of this.patrolVision) if (!pv.dormant) for (const k of pv.tiles) this.danger.add(k);
    }

    // Ambient guidance only — objective + danger, never "do X in this order".
    // Discovery (what's interactable, what a spell does) is left to the world
    // and the spellbook. Pure → unit-testable.
    hint() {
      if (this.status === 'won') return { text: 'Quest complete — well run.' };
      if (this.status === 'lost') return { text: 'Caught for good.' };

      let danger = null;
      for (const p of this.patrols) for (const c of this.chars) {
        if (p.dormant || c.down) continue;
        if (Math.abs(c.x - p.x) + Math.abs(c.y - p.y) <= 2 && this._clearLine(p.x, p.y, c.x, c.y, false)) danger = p.name;
      }

      if (this.alarm && this.item && this.item.held)
        return { text: 'The castle is awake — follow the Marauder\'s Map trail home!', danger: true, urgent: true };
      if (danger)
        return { text: '⚠ ' + danger + ' is close — break line of sight!', danger: true, urgent: true };
      if (this.item && this.item.held)
        return { text: 'Slip back to the glowing way out with ' + this.item.name + '.' };
      if (this.item && !this.explored.has(key(this.item.x, this.item.y)))
        return { text: 'Somewhere in the dark waits ' + this.item.name + '. Find it.' };
      return { text: 'Take ' + this.item.name + ' — then get out.' };
    }

    _castLight(cx, cy, r, out) {
      for (let y = cy - r; y <= cy + r; y++) {
        for (let x = cx - r; x <= cx + r; x++) {
          if (!this.inBounds(x, y)) continue;
          if ((x - cx) * (x - cx) + (y - cy) * (y - cy) > r * r) continue;
          if (this._clearLine(cx, cy, x, y, false)) out.add(key(x, y));
        }
      }
    }

    // Bresenham line-of-sight. If `inclusive`, the endpoint may be opaque
    // (used so a spell can "see" the door/wall it targets).
    _clearLine(x0, y0, x1, y1, inclusive) {
      let dx = Math.abs(x1 - x0), dy = Math.abs(y1 - y0);
      let sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1, err = dx - dy;
      let x = x0, y = y0;
      while (true) {
        if (!(x === x0 && y === y0)) {
          const last = (x === x1 && y === y1);
          if (this.isOpaque(x, y) && !(last && inclusive)) return false;
          if (last) return true;
        }
        if (x === x1 && y === y1) return true;
        const e2 = 2 * err;
        if (e2 > -dy) { err -= dy; x += sx; }
        if (e2 < dx) { err += dx; y += sy; }
      }
    }

    /* ---- win / log ---------------------------------------------------- */
    _checkWin() {
      if (this.status !== 'play') return;
      if (this.item && this.item.held) {
        const carrier = this.chars.find(c => c.id === this.item.carrier);
        if (carrier && this.def(carrier.x, carrier.y).kind === 'exit') {
          this.status = 'won';
          this._say('You slip back into the light with ' + this.item.name + '. Quest complete!');
        }
      }
    }

    _say(msg) { this.log.push({ turn: this.turn, msg }); }

    /* ---- serialisation (save/resume later) ---------------------------- */
    snapshot() {
      return JSON.parse(JSON.stringify({
        tiles: this.tiles, chars: this.chars, patrols: this.patrols, item: this.item,
        housePoints: this.housePoints, turn: this.turn, activeIdx: this.activeIdx,
        status: this.status, explored: [...this.explored]
      }));
    }
  }

  const engine = { Game, create: (scn, opts) => new Game(scn, opts), key, DIRS };

  root.MAR = root.MAR || {};
  root.MAR.engine = engine;
  if (typeof module !== 'undefined' && module.exports) module.exports = engine;

})(typeof window !== 'undefined' ? window : globalThis);
