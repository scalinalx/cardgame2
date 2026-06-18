/* =====================================================================
 * THE BATTLE OF HOGWARTS — ui.js   (region-funnel melee model)
 * DOM rendering + interaction over the painterly map. No rules here.
 * ===================================================================== */
(function (global) {
  'use strict';
  const data = global.HW.data;
  const { Game } = global.HW.engine;
  const { HOUSES, REGIONS, GROUNDS, TAGS, cardById } = data;
  const DIFFICULTIES = data.CONFIG.DIFFICULTIES;
  const PLAY = REGIONS.filter(r => r.side === 'play').map(r => r.id);

  const $ = s => document.querySelector(s);
  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const INTENT_C = { STRIKE: '#b23b2e', DRAIN: '#3f7d8c', ADVANCE: '#4a6a30', SMASH: '#8a5a2a' };

  // painterly Hogwarts grounds (ported from the prototype; valid SVG attrs)
  const MAP_SVG = `
  <svg class="map" viewBox="0 0 880 600" preserveAspectRatio="xMidYMid slice">
    <defs>
      <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#2e1f5e"/><stop offset="40%" stop-color="#7b3f86"/><stop offset="74%" stop-color="#d8654a"/><stop offset="100%" stop-color="#f0a85e"/></linearGradient>
      <radialGradient id="sun" cx="50%" cy="50%" r="50%"><stop offset="0%" stop-color="#ffe7ad"/><stop offset="40%" stop-color="#ffd58a" stop-opacity="0.6"/><stop offset="100%" stop-color="#ffd58a" stop-opacity="0"/></radialGradient>
      <linearGradient id="h1" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#4c7a48"/><stop offset="100%" stop-color="#3a6238"/></linearGradient>
      <linearGradient id="h2" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#5d934f"/><stop offset="100%" stop-color="#3f6e3a"/></linearGradient>
      <linearGradient id="h3" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#6fa64f"/><stop offset="100%" stop-color="#477a3a"/></linearGradient>
      <linearGradient id="lake" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#6fd6d0"/><stop offset="55%" stop-color="#2fb0bd"/><stop offset="100%" stop-color="#1d7f93"/></linearGradient>
      <linearGradient id="rock" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#3f4a3c"/><stop offset="100%" stop-color="#26301f"/></linearGradient>
      <linearGradient id="cas" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#7d8a86"/><stop offset="100%" stop-color="#46524d"/></linearGradient>
      <linearGradient id="roof" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#2f6f64"/><stop offset="100%" stop-color="#1d4a44"/></linearGradient>
      <linearGradient id="fst" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#1f3a22"/><stop offset="100%" stop-color="#13261a"/></linearGradient>
    </defs>
    <rect x="0" y="0" width="880" height="260" fill="url(#sky)"/>
    <circle cx="150" cy="120" r="95" fill="url(#sun)"/><circle cx="150" cy="120" r="34" fill="#ffe7ad" opacity="0.9"/>
    <path fill="#3c5e6e" opacity="0.7" d="M0,190 C120,150 220,176 340,150 C470,122 560,168 700,142 C800,124 870,160 880,140 L880,230 L0,230 Z"/>
    <path fill="url(#h1)" d="M0,232 C140,196 250,222 380,196 C520,170 620,212 760,188 C840,174 870,202 880,190 L880,300 L0,300 Z"/>
    <path fill="url(#h2)" d="M0,300 C150,266 280,296 420,272 C560,250 660,290 800,266 C860,252 880,278 880,270 L880,420 L0,420 Z"/>
    <path fill="none" stroke="#8fc06a" stroke-width="3" opacity="0.4" d="M0,300 C150,266 280,296 420,272 C560,250 660,290 800,266 C860,252 880,278 880,270"/>
    <path fill="url(#h3)" d="M0,430 C170,392 300,430 470,408 C610,388 730,438 880,410 L880,600 L0,600 Z"/>
    <path fill="url(#lake)" d="M250,400 C232,366 300,352 366,362 C420,340 478,346 516,368 C596,360 622,402 606,444 C618,490 536,520 442,514 C356,520 286,498 276,458 C266,432 250,418 250,400 Z"/>
    <g stroke="rgba(255,255,255,.3)" stroke-width="2" fill="none"><path d="M286,418 C322,410 360,424 398,416"/><path d="M300,452 C344,444 392,458 438,450"/></g>
    <ellipse cx="440" cy="500" rx="120" ry="34" fill="#1d7f93" opacity="0.5"/>
    <path fill="url(#rock)" d="M392,500 C388,452 398,406 418,378 C438,404 444,388 456,382 C474,396 482,440 492,474 C498,494 492,508 472,512 C436,520 410,514 392,500 Z"/>
    <g stroke="#eafcff" stroke-width="3" opacity="0.65" stroke-linecap="round"><path d="M420,462 L418,500"/><path d="M460,468 L462,504"/></g>
    <g stroke="#2c3531" stroke-width="1.4">
      <rect x="402" y="312" width="18" height="92" fill="url(#cas)"/>
      <rect x="466" y="290" width="20" height="114" fill="url(#cas)"/>
      <rect x="424" y="338" width="42" height="68" fill="url(#cas)"/>
      <rect x="486" y="354" width="18" height="52" fill="url(#cas)"/>
    </g>
    <g fill="url(#roof)"><polygon points="411,286 400,312 422,312"/><polygon points="476,262 464,290 488,290"/><polygon points="445,310 422,338 468,338"/><polygon points="495,330 484,354 506,354"/></g>
    <g fill="#f6cf78"><rect x="432" y="352" width="6" height="12" rx="1.5"/><rect x="444" y="352" width="6" height="12" rx="1.5"/><rect x="456" y="352" width="6" height="12" rx="1.5"/><rect x="438" y="376" width="6" height="12" rx="1.5"/><rect x="450" y="376" width="6" height="12" rx="1.5"/><rect x="472" y="312" width="5" height="10" rx="1.5"/><rect x="472" y="340" width="5" height="10" rx="1.5"/></g>
    <path fill="url(#fst)" d="M0,150 C120,130 280,158 440,140 C600,122 740,156 880,138 L880,210 C740,228 600,200 440,214 C280,228 120,200 0,210 Z"/>
    <g fill="#0e1d12"><circle cx="80" cy="172" r="12"/><circle cx="170" cy="160" r="10"/><circle cx="280" cy="178" r="13"/><circle cx="400" cy="162" r="11"/><circle cx="520" cy="180" r="13"/><circle cx="640" cy="160" r="11"/><circle cx="760" cy="178" r="12"/><circle cx="840" cy="162" r="10"/></g>
    <g fill="none" stroke="#cdb487" stroke-width="7" opacity="0.55" stroke-linecap="round"><path d="M440,200 C420,280 360,300 440,360 C520,420 440,470 442,500"/><path d="M170,260 C220,320 320,330 380,380"/><path d="M720,260 C660,320 560,330 500,380"/></g>
  </svg>`;

  const UI = {
    game: null,
    setup: { count: 1, difficulty: 'standard', players: [{ name: '', house: 'gryffindor' }, { name: '', house: 'ravenclaw' }] },
    pending: null, inspect: null, vBeat: null, freshFrom: 0, scaleBound: false,

    init() {
      this.screen = $('#screen'); this.overlay = $('#overlay');
      this.screen.addEventListener('click', e => this._onClick(e));
      document.addEventListener('keydown', e => { if (e.key === 'Escape' && this.pending) { this.pending = null; this.renderGame(); } });
      this.renderTitle();
    },

    /* ================= TITLE ===================================== */
    renderTitle() {
      this.screen.innerHTML = `
        <div class="page"><div class="title-wrap">
          <div class="title-crest">🏰</div>
          <div class="title-sub">The Last Stand</div>
          <h1>The Battle of Hogwarts</h1>
          <p class="title-blurb">Voldemort's army musters at the treeline and marches on the castle. Choose your House, raise defenders across the grounds, and hold the funnel to the Great Gate — repel the Dark Lord and break his army's will before the Wards fall.</p>
          <div class="title-actions"><button class="btn primary" data-action="to-setup">⚔ Begin a New Battle</button></div>
          <div class="title-rules">
            <h3>How it works</h3>
            <ul>
              <li><b>Co-op melee defence.</b> 1 or 2 allied players. Each turn you act, then <b>Voldemort's army advances, fights, and musters anew</b>.</li>
              <li><b>The funnel.</b> Foes march from the Forest → one of three Grounds → the Courtyard → the Great Gate. <b>Deploy Allies</b> into any region — where your units meet the horde they <b>trade blows</b> (both take damage, both can fall). <b>Cast Spells</b> to blast, freeze, control, heal, or repair the Wards.</li>
              <li><b>Telegraphs.</b> Each foe shows its <b>intent</b>; the top bar previews who is <b>mustering</b> next.</li>
              <li><b>Win</b> if Dark-Army <b>Morale</b> falls below 30% — slay the rank-and-file, but it's repelling the <b>named champions</b> that truly breaks them.</li>
              <li><b>Lose</b> if Hogwarts' <b>Wards</b> fall below 30%. Kill siege units before they reach the gate.</li>
            </ul>
          </div>
        </div></div>`;
    },

    /* ================= SETUP ==================================== */
    renderSetup() {
      const s = this.setup;
      const houseCard = (pi, hid) => { const h = HOUSES[hid]; return `
        <div class="house-card ${s.players[pi].house === hid ? 'sel' : ''}" data-house="${hid}" data-pi="${pi}" style="--hc1:${h.color}33;--hc2:${h.color2}">
          <div class="hc-top"><span class="crestico">${h.crest}</span><div><div class="hc-name">${h.name}</div><div class="hc-motto">${h.motto}</div></div></div>
          <div class="hc-id">${esc(h.identity)}</div>
          <div class="hc-pp"><b>Passive.</b> ${esc(h.passive.text.replace(/^[^:]+:\s*/, ''))}</div>
          <div class="hc-pp" style="margin-top:4px"><b>Power (${h.power.cost}⚡).</b> ${esc(h.power.desc)}</div>
        </div>`; };
      const playerPick = pi => `
        <div class="player-pick"><h3>🧙 Player ${pi + 1}</h3>
          <input class="name-input" data-name="${pi}" placeholder="Name (optional)" value="${esc(s.players[pi].name)}" />
          <div class="house-grid">${Object.keys(HOUSES).map(h => houseCard(pi, h)).join('')}</div></div>`;
      this.screen.innerHTML = `
        <div class="page"><div class="setup">
          <h2>Prepare the Defence</h2>
          <div class="step-label">How many defenders, then a House for each.</div>
          <div class="count-toggle">
            <button class="btn ${s.count === 1 ? 'sel' : ''}" data-count="1">🧙 Solo (1 player)</button>
            <button class="btn ${s.count === 2 ? 'sel' : ''}" data-count="2">🧙🧙 Allied (2 players)</button>
          </div>
          <div class="step-label" style="margin:4px 0 8px">Difficulty${s.count === 2 ? ' — two strong players should try Hard or Legendary' : ''}</div>
          <div class="count-toggle diff-toggle">${Object.values(DIFFICULTIES).map(d => `<button class="btn ${s.difficulty === d.id ? 'sel' : ''}" data-diff="${d.id}">${esc(d.name)}</button>`).join('')}</div>
          <div class="step-label" style="color:var(--gold);min-height:18px">${esc(DIFFICULTIES[s.difficulty].blurb)}</div>
          <div class="players-setup">${playerPick(0)}${s.count === 2 ? playerPick(1) : ''}</div>
          <div class="setup-go"><button class="btn" data-action="to-title">◀ Back</button>
            <button class="btn primary" data-action="begin" style="margin-left:10px">Begin the Battle ⚔</button></div>
        </div></div>`;
      this.screen.querySelectorAll('[data-name]').forEach(inp => inp.addEventListener('input', e => { this.setup.players[+e.target.dataset.name].name = e.target.value; }));
    },

    beginGame() {
      const s = this.setup; const specs = [];
      for (let i = 0; i < s.count; i++) specs.push({ name: s.players[i].name.trim() || ('Player ' + (i + 1)), house: s.players[i].house });
      this.game = new Game({ players: specs, difficulty: s.difficulty });
      this.pending = null; this.vBeat = null; this.inspect = null; this.freshFrom = this.game.log.length;
      if (!this.scaleBound) { window.addEventListener('resize', () => this._fitScale()); this.scaleBound = true; }
      if (s.count === 2) this._handoff(0, () => this.renderGame()); else this.renderGame();
    },

    _fitScale() { const app = $('.app'); if (!app) return; const vw = window.innerWidth, vh = window.innerHeight; app.style.transform = `translate(-50%,-50%) scale(${Math.min(vw / 1380, vh / 860, 1.4)})`; },

    /* ================= GAME ===================================== */
    renderGame() {
      const g = this.game;
      this.screen.innerHTML = `<div class="viewport"><div class="app">
        ${this._top()}
        ${this._leftRail()}
        ${this._boardEl()}
        ${this._rightRail()}
        ${this._tray()}
      </div></div>`;
      this._fitScale();
      const log = $('.log'); if (log) log.scrollTop = 0;
    },

    _top() {
      const g = this.game;
      const wPct = Math.max(0, Math.round(100 * g.castleHp / g.castleMax));
      const mPct = Math.max(0, Math.round(100 * g.morale / g.moraleMax));
      const f = g.forecast();
      const q = f.queue.slice(0, 6).map(t => `<div class="qfig ${t.boss ? 'boss' : ''}" title="${esc(t.name)}">${t.boss ? '☠' : ''}<div class="a">${t.atk}</div></div>`).join('');
      const diffName = (g.diff && g.diff.name) || 'Standard';
      return `<div class="top">
        <div class="faction"><div class="sigil dark">DARK<br>LORD</div>
          <div class="meter"><div class="r"><span class="lab" style="color:#8fd06a">DARK ARMY MORALE</span><span class="val" style="color:#8fd06a">${mPct}%</span></div>
            <div class="bar"><span class="morale-fill" style="width:${mPct}%"></span><span class="th" style="left:30%"></span></div></div></div>
        <div class="muster"><div class="turn-pill">ROUND ${g.round} · ${esc(diffName)}${g.numPlayers > 1 ? ' · 2P' : ''}${this.vBeat ? " · VOLDEMORT'S TURN" : ' · YOUR MOVE'}</div>
          <div class="q"><span class="ql">Mustering ▸</span>${q || '<span class="ql">—</span>'}</div></div>
        <div class="faction right"><div class="meter"><div class="r"><span class="lab" style="color:#f4d27a">HOGWARTS WARDS</span><span class="val" style="color:#f4d27a">${wPct}%</span></div>
            <div class="bar"><span class="ward-fill" style="width:${wPct}%"></span><span class="th" style="left:30%"></span></div></div>
          <div class="sigil hog">H</div></div>
      </div>`;
    },

    _leftRail() {
      const g = this.game;
      const ph = this.vBeat ? this.vBeat.key : 'play';
      const phaseCell = (k, lab) => `<div class="phase ${(ph === k || (ph === 'play' && k === 'play')) ? 'on' : ''}">${lab}</div>`;
      const logHtml = g.log.slice().reverse().slice(0, 40).map((l, i) => `<div class="e ${l.kind} ${(g.log.length - 1 - i) >= this.freshFrom ? '' : ''}"><i></i><span>${esc(l.msg)}</span></div>`).join('');
      return `<div class="rail left">
        <h3>Phase</h3>
        <div class="phases">${this.vBeat ? `<div class="phase ${ph === 'advance' ? 'on' : ''}">March</div><div class="phase ${ph === 'melee' ? 'on' : ''}">Melee</div><div class="phase ${ph === 'muster' ? 'on' : ''}">Muster</div>` : '<div class="phase on">Deploy</div><div class="phase on">Cast</div><div class="phase">Resolve</div>'}</div>
        <div class="divider"></div>
        <h3>The Field</h3>
        <div class="legend"><div class="li"><i class="lg-you"></i>Your forces</div><div class="li"><i class="lg-foe"></i>The Dark Army</div></div>
        <div class="divider"></div>
        <h3>Battle Log</h3>
        <div class="log">${logHtml}</div>
      </div>`;
    },

    _boardEl() {
      const g = this.game;
      const hordeNear = g.foes.filter(f => f.step <= 1).length + (g.queue ? g.queue.length : 0);
      const regions = REGIONS.map(r => this._region(r)).join('');
      let hint = '';
      if (this.pending && !this.vBeat) {
        const n = this.pending.needs;
        const t = n.region ? (this.pending.card && this.pending.card.type === 'ally' ? 'Deploy — tap a region of the grounds' : 'Choose a region') : n.enemy ? 'Cast — tap a foe' : n.ally ? 'Tap one of your allies' : '';
        if (t) hint = `<div class="hint"><span>${t}</span><button data-action="cancel">Cancel</button></div>`;
      }
      return `<div class="board">
        ${MAP_SVG}
        <div class="forestdark" style="opacity:${Math.min(.7, 0.18 + hordeNear * 0.04)}"></div>
        <div class="vig"></div>
        <div class="march" style="left:46%;top:26%"><span>▼</span></div>
        <div class="march" style="left:30%;top:54%"><span>▼</span></div>
        <div class="march" style="left:66%;top:54%"><span>▼</span></div>
        <div class="march" style="left:48%;top:74%"><span>▼</span></div>
        ${regions}
        ${hint}
        ${this.vBeat ? this._voldCaption() : ''}
      </div>`;
    },

    _region(r) {
      const g = this.game;
      const allies = g.alliesIn(r.id);
      const foes = g.foesIn(r.id);
      const list = allies.concat(foes);
      const placingRegion = this.pending && this.pending.needs.region && !this.vBeat;
      const isAllyDeploy = this.pending && this.pending.card && (this.pending.card.type === 'ally' || this.pending.card.type === 'enchant');
      const hot = placingRegion && (isAllyDeploy ? r.side === 'play' : (r.side === 'play' || foes.length > 0));
      const figs = list.map(u => this._fig(u)).join('');
      return `<div class="region ${r.side === 'enemy' ? 'foe' : 'you'} ${hot ? 'hot' : ''} ${list.length === 0 ? 'empty' : ''}" data-region="${r.id}" style="left:${r.x}%;top:${r.y}%">
        <div class="rl">${esc(r.short)}${list.length ? ` · ${list.length}` : ''}</div>
        <div class="cluster">${figs || ''}</div>
      </div>`;
    },

    _fig(u) {
      const g = this.game; const foe = !u.ownerIdx && u.ownerIdx !== 0;
      const isFoe = !!u.intent; // foes carry an intent
      if (isFoe) {
        const targetable = this.pending && this.pending.needs.enemy && !this.vBeat;
        const dim = this.pending && this.pending.card && this.pending.card.type === 'ally' && !this.vBeat;
        const uc = INTENT_C[u.intent] || '#7bc15a';
        return `<div class="fig ${this.inspect === u.uid ? 'sel' : ''} ${targetable ? 'glow' : ''} ${dim ? 'dim' : ''} ${u.justArrived ? 'arrived' : ''}" data-foe="${u.uid}" style="--uc:${uc};--c:#16210f">
          <div class="intent" style="background:${uc}">${u.intent}</div>${u.frozen ? '<div class="fzicon">❄</div>' : ''}
          <div class="ulab">${esc(u.name)}</div>
          <div class="pips"><span class="pip atk">${u.atk}</span><span class="pip hp">${u.hp}</span></div></div>`;
      }
      // ally
      const targetable = this.pending && this.pending.needs.ally && u.ownerIdx === g.turn && !this.vBeat;
      const dim = this.pending && this.pending.card && this.pending.card.type === 'spell' && this.pending.needs.enemy && !this.vBeat;
      const h = HOUSES[g.players[u.ownerIdx].house];
      const eatk = g._effectiveAtk(u);
      return `<div class="fig ${this.inspect === u.uid ? 'sel' : ''} ${targetable ? 'glow' : ''} ${dim ? 'dim' : ''} ${u.intangible ? 'intangible' : ''}" data-ally="${u.uid}" style="--uc:${h.color};--c:${h.color}33">
        <div class="ulab">${esc(u.name)}</div>
        <div class="pips"><span class="pip atk ${eatk > u.atk ? 'buff' : ''}">${eatk}</span><span class="pip hp">${u.hp}</span></div></div>`;
    },

    _rightRail() {
      const g = this.game; const p = g.players[g.turn]; const h = g.house(p);
      let body;
      const insU = this.inspect != null ? (g._foeByUid(this.inspect) || g._allyByUid(this.inspect)) : null;
      const insC = this.pending && this.pending.card ? this.pending.card : null;
      if (insC) {
        const tags = (insC.tags || []).map(t => `<span>${(TAGS[t] ? TAGS[t] + ' ' : '')}${t}</span>`).join('');
        const stats = insC.type === 'ally' ? `<div class="ins-stats"><span class="pip atk">${insC.atk}</span><span class="pip hp">${insC.hp}</span></div>` : '';
        body = `<div class="ins-top"><div class="ins-art" style="--uc:${h.color}">${insC.type === 'ally' ? '🛡' : insC.type === 'spell' ? '✨' : '🔯'}</div>
          <div><div class="ins-name">${esc(insC.name)}</div><div class="ins-type">${insC.type} · ${insC.cost}⚡</div>${stats}</div></div>
          <div class="ins-ab">${esc(insC.text || '')}</div><div class="ins-flav">${esc(insC.flavor || '')}</div><div class="kw">${tags}</div>`;
      } else if (insU) {
        const isFoe = !!insU.intent; const card = cardById(insU.id);
        const uc = isFoe ? (INTENT_C[insU.intent] || '#7bc15a') : HOUSES[g.players[insU.ownerIdx].house].color;
        const eatk = isFoe ? insU.atk : g._effectiveAtk(insU);
        body = `<div class="ins-top"><div class="ins-art" style="--uc:${uc}">${isFoe ? '☠' : '🛡'}</div>
          <div><div class="ins-name">${esc(insU.name)}</div><div class="ins-type">${isFoe ? 'Dark Army · ' + insU.intent : g.house(g.players[insU.ownerIdx]).name + ' · Ally'}</div>
          <div class="ins-stats"><span class="pip atk">${eatk}</span><span class="pip hp">${insU.hp}/${insU.maxHp}</span></div></div></div>
          <div class="ins-ab">${esc((card && card.text) || (isFoe ? '' : ''))}</div>`;
      } else {
        body = `<div class="ins-empty">Tap a card to inspect & arm it, or tap any figure on the field to study it.</div>`;
      }
      const pw = h.power; const canPower = !p.powerUsed && pw.cost <= p.mana && !this.vBeat;
      return `<div class="rail right">
        <h3>Inspector</h3>
        ${body}
        <div class="divider"></div>
        <h3>${esc(h.name)} — ${esc(h.motto)}</h3>
        <div class="power-card"><div class="pn">⚡ ${esc(pw.name)} · ${pw.cost}</div><div class="pd">${esc(pw.desc)}</div></div>
        <button class="btn power-btn ${this.pending && this.pending.kind === 'power' ? 'sel' : ''}" data-action="power" ${canPower ? '' : 'disabled'}>${p.powerUsed ? 'Power used this turn' : 'Invoke Power'}</button>
        <div class="passive-note"><b>${h.passive.text.split(':')[0]}.</b> ${esc(h.passive.text.replace(/^[^:]+:\s*/, ''))}</div>
      </div>`;
    },

    _tray() {
      const g = this.game; const p = g.players[g.turn]; const h = g.house(p);
      const maxPips = Math.max(p.manaBase || g.cfg.baseMana, p.mana);
      let pips = ''; for (let i = 0; i < maxPips; i++) pips += `<span class="cry ${i < p.mana ? 'on' : ''}"></span>`;
      const cards = p.hand.map(hi => this._card(hi)).join('') || '<span style="color:#778;padding:18px">No cards in hand.</span>';
      const ramp = (p.manaBase || g.cfg.baseMana) < g.cfg.manaMax ? ' ↑' : '';
      return `<div class="tray">
        <div class="pod"><div class="crestico-b">${h.crest}</div>
          <div><div class="pod-nm">${esc(p.name)}<small>${esc(h.name)}</small></div>
            <div class="mana" title="Mana grows each round">${pips}<span class="mnum">${p.mana}${ramp}</span></div>
            <div class="piles">${p.hand.length} hand · ${p.deck.length} deck · ${p.discard.length} discard</div></div></div>
        <div class="hand">${cards}</div>
        <button class="endturn" data-action="end" ${this.vBeat ? 'disabled' : ''}>End Turn ▶<small>Voldemort acts</small></button>
      </div>`;
    },

    _card(hi) {
      const g = this.game; const p = g.players[g.turn]; const c = cardById(hi.id);
      const cost = g.effectiveCost(p, c); const aff = cost <= p.mana;
      const armed = this.pending && this.pending.uid === hi.uid;
      const dim = this.pending && this.pending.kind === 'card' && this.pending.uid !== hi.uid;
      const stats = c.type === 'ally' ? `<div class="cstats"><span class="pip atk">${c.atk}</span><span class="pip hp">${c.hp}</span></div>` : '';
      const type = c.type === 'ally' ? 'Ally' : c.type === 'spell' ? 'Spell' : 'Enchant';
      return `<div class="card t-${c.type} ${armed ? 'armed' : ''} ${dim ? 'dim' : ''} ${aff ? '' : 'poor'}" data-card="${hi.uid}">
        <div class="strip"></div><div class="cost ${cost < c.cost ? 'red' : ''}">${cost}</div>
        <div class="cnm">${esc(c.name)}</div>${stats}
        <div class="ctxt">${esc(c.text || '')}</div><div class="ctag">${type}</div></div>`;
    },

    /* ================= INTERACTION ============================== */
    _onClick(e) {
      const g = this.game;
      const act = e.target.closest('[data-action]'); if (act) return this._action(act.dataset.action);
      const cnt = e.target.closest('[data-count]'); if (cnt) { this.setup.count = +cnt.dataset.count; return this.renderSetup(); }
      const dff = e.target.closest('[data-diff]'); if (dff) { this.setup.difficulty = dff.dataset.diff; return this.renderSetup(); }
      const hc = e.target.closest('[data-house]'); if (hc) { this.setup.players[+hc.dataset.pi].house = hc.dataset.house; return this.renderSetup(); }
      if (!g || g.over || this.vBeat) return;
      const card = e.target.closest('[data-card]'); if (card) return this._pickCard(+card.dataset.card);
      const reg = e.target.closest('[data-region]');
      const foe = e.target.closest('[data-foe]');
      const ally = e.target.closest('[data-ally]');
      if (this.pending) {
        if (foe && this.pending.needs.enemy) return this._execute({ enemyUid: +foe.dataset.foe });
        if (ally && this.pending.needs.ally) return this._execute({ allyUid: +ally.dataset.ally });
        if (reg && this.pending.needs.region) {
          const r = REGIONS.find(x => x.id === reg.dataset.region);
          const allyDeploy = this.pending.card && (this.pending.card.type === 'ally' || this.pending.card.type === 'enchant');
          if (allyDeploy && r.side !== 'play') return;
          return this._execute({ region: reg.dataset.region });
        }
      }
      // no pending → inspect a figure
      if (foe) { this.inspect = +foe.dataset.foe; this.pending = null; return this.renderGame(); }
      if (ally) { this.inspect = +ally.dataset.ally; this.pending = null; return this.renderGame(); }
    },

    _action(a) {
      if (this.vBeat && a !== 'vold-next' && a !== 'vold-skip') return;
      switch (a) {
        case 'to-setup': return this.renderSetup();
        case 'to-title': return this.renderTitle();
        case 'begin': return this.beginGame();
        case 'cancel': this.pending = null; return this.renderGame();
        case 'power': return this._pickPower();
        case 'end': return this._endTurn();
        case 'vold-next': return this._voldNext();
        case 'vold-skip': return this._voldSkip();
        case 'handoff-go': this._hideOverlay(); if (this._handoffThen) this._handoffThen(); return;
        case 'again': return this.renderSetup();
        case 'home': this._hideOverlay(); return this.renderTitle();
      }
    },

    _pickCard(uid) {
      const g = this.game; const p = g.players[g.turn];
      const hi = p.hand.find(h => h.uid === uid); if (!hi) return;
      const c = cardById(hi.id);
      if (this.pending && this.pending.uid === uid) { this.pending = null; return this.renderGame(); }
      this.inspect = null;
      if (g.effectiveCost(p, c) > p.mana) { this.pending = { kind: 'card', uid, card: c, needs: {} }; return this.renderGame(); } // inspect-only (unaffordable)
      const needs = g.needsTargets(c);
      if (needs.enemy && !g.foes.length) { this.pending = { kind: 'card', uid, card: c, needs: {} }; return this._execute({}); }
      if (needs.ally && !g.allies.some(a => a.ownerIdx === g.turn)) { this.pending = { kind: 'card', uid, card: c, needs: {} }; return this._execute({}); }
      if (!needs.region && !needs.enemy && !needs.ally) { this.pending = { kind: 'card', uid, card: c, needs: {} }; return this._execute({}); }
      this.pending = { kind: 'card', uid, card: c, needs }; this.renderGame();
    },
    _pickPower() {
      const g = this.game;
      if (this.pending && this.pending.kind === 'power') { this.pending = null; return this.renderGame(); }
      const p = g.players[g.turn]; if (p.powerUsed || g.house(p).power.cost > p.mana) return;
      const needs = g.powerNeeds(g.turn); this.inspect = null;
      if (needs.enemy && !g.foes.length) { this.pending = { kind: 'power', needs: {} }; return this._execute({}); }
      if (!needs.region && !needs.enemy && !needs.ally) { this.pending = { kind: 'power', needs: {} }; return this._execute({}); }
      this.pending = { kind: 'power', needs }; this.renderGame();
    },
    _execute(target) {
      const g = this.game; const idx = g.turn; const p = this.pending; const opts = {};
      if (target.region) opts.region = target.region;
      if (target.enemyUid != null) opts.enemyUid = target.enemyUid;
      if (target.allyUid != null) opts.allyUid = target.allyUid;
      if (p.kind === 'card') g.playCard(idx, p.uid, opts); else g.useHousePower(idx, opts);
      this.pending = null;
      if (g.over) return this.renderGameOver();
      this.renderGame();
    },

    /* ---- end turn → stepped Voldemort reveal -------------------- */
    _endTurn() {
      const g = this.game; const idx = g.turn; this.pending = null; this.inspect = null; this.freshFrom = g.log.length;
      const res = g.endTurn(idx, { stepped: true });
      if (g.over) return this.renderGameOver();
      if (res.voldemort && res.stepped) return this._voldStart();
      if (g.numPlayers > 1) return this._handoff(g.turn, () => this.renderGame());
      this.renderGame();
    },
    _voldStart() { const g = this.game; g.voldemortBegin(); this._vQueue = g.voldemortStepKeys().slice(); this.vBeat = { isStart: true, key: 'play', title: "Voldemort's Turn", icon: '⚡', flavor: 'The Dark Army stirs beyond the treeline. Watch the assault unfold.', lines: [] }; this.renderGame(); },
    _voldNext() {
      const g = this.game;
      if (this._vQueue && this._vQueue.length) { const key = this._vQueue.shift(); this.vBeat = g.voldemortStep(key); if (g.over) this._vQueue = []; return this.renderGame(); }
      this._voldFinish();
    },
    _voldSkip() { const g = this.game; while (this._vQueue && this._vQueue.length && !g.over) g.voldemortStep(this._vQueue.shift()); this._voldFinish(); },
    _voldFinish() { this.vBeat = null; this._vQueue = []; const g = this.game; g.voldemortFinish(); if (g.over) return this.renderGameOver(); if (g.numPlayers > 1) return this._handoff(g.turn, () => this.renderGame()); this.renderGame(); },
    _voldCaption() {
      const g = this.game; const b = this.vBeat; const keys = g.voldemortStepKeys();
      const done = keys.length - (this._vQueue ? this._vQueue.length : keys.length);
      const dots = keys.map((k, i) => `<span class="vc-dot ${i < done ? 'on' : ''} ${(!b.isStart && b.key === k) ? 'cur' : ''}"></span>`).join('');
      const wards = b.wards ? `<span class="delta ${b.wards < 0 ? 'bad' : 'good'}">🛡 ${b.wards > 0 ? '+' : ''}${b.wards}</span>` : '';
      const morale = b.morale ? `<span class="delta good">🐍 ${b.morale}</span>` : '';
      const lines = (b.lines && b.lines.length) ? b.lines.map(l => `<div class="ln ${l.kind}">${esc(l.msg)}</div>`).join('') : (b.isStart ? '' : '<div class="ln info">…</div>');
      const nextTxt = g.over ? 'See the outcome ▶' : b.isStart ? 'The assault begins ▶' : (this._vQueue && this._vQueue.length) ? 'Continue ▶' : 'Begin your turn ▶';
      const skip = (!g.over && this._vQueue && this._vQueue.length) ? '<button class="btn" data-action="vold-skip">Skip ▶▶</button>' : '';
      return `<div class="vold-caption ${b.isStart ? 'intro' : ''}">
        <div class="vc-head"><span class="vc-icon">${b.icon}</span><div class="vc-titles"><div class="vc-title">${esc(b.title)}</div><div class="vc-flavor">${esc(b.flavor)}</div></div><div class="vc-deltas">${wards}${morale}</div></div>
        <div class="vc-lines">${lines}</div>
        <div class="vc-foot"><div class="vc-dots">${dots}</div><div class="vc-actions">${skip}<button class="btn primary" data-action="vold-next">${nextTxt}</button></div></div>
      </div>`;
    },

    _handoff(idx, then) {
      const g = this.game; const p = g.players[idx]; const h = g.house(p);
      this._showOverlay(`<div class="handoff"><div class="crestico">${h.crest}</div><h2>Pass to ${esc(p.name)}</h2><p>${esc(h.name)} · Hand the device over, then continue.</p><button class="btn primary" data-action="handoff-go">I'm ready ▶</button></div>`);
      this._handoffThen = then;
    },

    renderGameOver() {
      const g = this.game; const win = g.over === 'win'; this.vBeat = null;
      this.renderGame();
      this._showOverlay(`<div class="gameover ${win ? 'win' : 'lose'}"><div class="big">${win ? '🏰✨' : '💀'}</div>
        <h1>${win ? 'Hogwarts Stands!' : 'Hogwarts Has Fallen'}</h1>
        <p>${win ? 'The Dark Army breaks and scatters into the night. The castle endures.' : 'The Wards shatter and darkness pours through the gates.'}</p>
        <div class="stat-row"><div><b>${g.round}</b>rounds</div><div><b>${g.castleHp}</b>Wards left</div><div><b>${g.morale}</b>Morale left</div></div>
        <button class="btn primary" data-action="again">⚔ New Battle</button><button class="btn" data-action="home" style="margin-left:10px">Title</button></div>`);
    },

    _showOverlay(html) { this.overlay.innerHTML = html; this.overlay.classList.remove('hidden'); },
    _hideOverlay() { this.overlay.classList.add('hidden'); this.overlay.innerHTML = ''; },
  };

  document.addEventListener('DOMContentLoaded', () => { $('#overlay').addEventListener('click', e => { const a = e.target.closest('[data-action]'); if (a) UI._action(a.dataset.action); }); });
  global.UI = UI;
})(typeof globalThis !== 'undefined' ? globalThis : this);
