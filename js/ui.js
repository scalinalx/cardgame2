/* =====================================================================
 * CONQUEST OF ERATHIA — ui.js
 * DOM rendering + hot-seat flow: faction draft, secret-objective draft,
 * weekly research, turns with an explicit action panel, the hex adventure
 * map (placement), goals panel, and scoring.
 * ===================================================================== */
(function (global) {
  'use strict';
  const data = global.HK.data;
  const { GLOBALS, RES_INFO, TAG_INFO, MILESTONES, AWARDS, TILE_INFO, TERRAIN_COLORS, WONDER_VP,
    cardById, factionById, goalById } = data;
  const eng = global.HK.engine;
  const { STANDARD } = eng;
  const RES_ORDER = ['gold', 'wood', 'ore', 'crystal', 'recruits', 'mercury'];
  // Wood & Crystal are never spent — they are standing-discount tracks (Sawmill / Mana Vault),
  // shown as a LEVEL with the Gold it shaves off Building / Magic cards, not as a stock.
  const TRACK_RES = { wood: { label: 'Sawmill', tag: 'Building' }, crystal: { label: 'Mana Vault', tag: 'Magic' } };
  const trackRate = k => (k === 'wood' ? eng.SAWMILL_RATE : eng.MANA_RATE);
  const SVGNS = 'http://www.w3.org/2000/svg';

  /* ----------------------------- helpers ---------------------------- */
  function h(tag, attrs, ...kids) {
    const e = document.createElement(tag);
    if (attrs) for (const k in attrs) {
      const v = attrs[k];
      if (v == null || v === false) continue;
      if (k === 'class') e.className = v;
      else if (k === 'html') e.innerHTML = v;
      else if (k === 'style' && typeof v === 'object') Object.assign(e.style, v);
      else if (k.slice(0, 2) === 'on' && typeof v === 'function') e.addEventListener(k.slice(2).toLowerCase(), v);
      else e.setAttribute(k, v);
    }
    append(e, kids);
    return e;
  }
  function append(e, kids) {
    for (const k of kids) {
      if (k == null || k === false) continue;
      if (Array.isArray(k)) append(e, k);
      else if (k instanceof Node) e.appendChild(k);
      else e.appendChild(document.createTextNode(String(k)));
    }
  }
  function s(tag, attrs, ...kids) {
    const e = document.createElementNS(SVGNS, tag);
    if (attrs) for (const k in attrs) {
      const v = attrs[k];
      if (v == null || v === false) continue;
      if (k.slice(0, 2) === 'on' && typeof v === 'function') e.addEventListener(k.slice(2).toLowerCase(), v);
      else e.setAttribute(k, v);
    }
    for (const k of kids) if (k != null && k !== false) e.appendChild(typeof k === 'string' ? document.createTextNode(k) : k);
    return e;
  }
  const $screen = () => document.getElementById('screen');
  const $overlay = () => document.getElementById('overlay');
  function setScreen(node) { const sc = $screen(); sc.innerHTML = ''; sc.appendChild(node); }
  function hideOverlay() { const o = $overlay(); o.className = 'hidden'; o.innerHTML = ''; }
  function showOverlay(node) { const o = $overlay(); o.className = ''; o.innerHTML = ''; o.appendChild(node); }

  const UI = { game: null, shownKey: null, prevTurn: -1, turnSerial: 0, researchSel: {}, placing: null, showOpp: false };

  UI.start = function (game) {
    UI.game = game; UI.shownKey = null; UI.prevTurn = -1; UI.turnSerial = 0; UI.researchSel = {}; UI.placing = null; UI.showOpp = false;
    UI.sync();
  };

  /* -------------------------- flow / handoff ------------------------ */
  function gate(key, idx, title, sub, then) {
    if (UI.shownKey === key) { then(); return; }
    UI.placing = null;
    showHandoff(idx, title, sub, () => { UI.shownKey = key; then(); });
  }
  function showHandoff(idx, title, sub, onReady) {
    UI.showOpp = false; // each new turn, the opponent board starts collapsed
    const node = h('div', { class: 'modal handoff' },
      h('div', { class: 'muted' }, '🛡️  Hot-seat — pass the device'),
      h('div', { class: 'who', style: { color: idx === 0 ? 'var(--p0)' : 'var(--p1)' } }, title),
      h('div', { class: 'muted', style: { fontSize: '18px', marginBottom: '18px' } }, sub),
      h('button', { class: 'primary', style: { fontSize: '18px', padding: '12px 28px' }, onClick: () => { hideOverlay(); onReady(); } }, 'Reveal ▶')
    );
    showOverlay(node);
  }

  UI.sync = function () {
    const g = UI.game; if (!g) return;
    if (g.over) { hideOverlay(); renderGameOver(); return; }
    if (g.phase === 'setup-roll') { UI.prevTurn = -1; hideOverlay(); renderRoll(); return; }
    if (g.phase === 'setup-faction') {
      UI.prevTurn = -1;
      const idx = !g.players[g.starter].faction ? g.starter : (1 - g.starter); // first player drafts first
      gate('fac-' + idx, idx, g.players[idx].name, 'Choose your Town', () => renderFactionChoice(idx));
      return;
    }
    if (g.phase === 'setup-goal') {
      UI.prevTurn = -1;
      const idx = !g.players[g.starter].secretGoal ? g.starter : (1 - g.starter);
      gate('goal-' + idx, idx, g.players[idx].name, 'Draft your secret objective', () => renderGoalChoice(idx));
      return;
    }
    if (g.phase === 'research') {
      UI.prevTurn = -1;
      const idx = !g.players[g.starter].researchDone ? g.starter : (1 - g.starter);
      gate('res-' + g.gen + '-' + idx, idx, g.players[idx].name,
        (g.gen === 1 ? 'Opening hand — buy cards (3 Gold each)' : 'Week ' + g.gen + ' — Research'),
        () => renderResearch(idx));
      return;
    }
    if (g.phase === 'action') {
      if (g.turn !== UI.prevTurn) { UI.turnSerial++; UI.prevTurn = g.turn; }
      gate('act-' + UI.turnSerial, g.turn, g.players[g.turn].name, 'Week ' + g.gen + ' — your turn', () => renderGame());
    }
  };

  /* --------------------------- first-player roll -------------------- */
  function renderRoll() {
    const g = UI.game, roll = g.firstRoll, fp = roll.player;
    setScreen(h('div', { class: 'center-box panel', style: { textAlign: 'center' } },
      h('h2', null, '🎲 Rolling the D12 for First Player'),
      h('p', { class: 'muted' }, '1–6 → ' + g.players[0].name + '   ·   7–12 → ' + g.players[1].name),
      h('div', { class: 'die ' + (fp === 0 ? 'p0' : 'p1') }, String(roll.value)),
      h('div', { style: { fontSize: '22px', margin: '14px 0', color: fp === 0 ? 'var(--p0)' : 'var(--p1)' } }, '⚔️ ' + g.players[fp].name + ' commands the first move!'),
      h('button', { class: 'primary', style: { fontSize: '17px', padding: '12px 26px' }, onClick: () => { g.beginFactionDraft(); UI.sync(); } }, 'To the Towns ▶')
    ));
  }

  /* --------------------------- faction draft ------------------------ */
  function renderFactionChoice(idx) {
    const g = UI.game, p = g.players[idx];
    const grid = h('div', { class: 'faction-grid' });
    for (const fid of g.factionOptions[idx]) {
      const f = factionById(fid);
      const art = factionArtUrl(fid);
      grid.appendChild(h('div', { class: 'faction-card', onClick: () => { g.chooseFaction(idx, fid); UI.sync(); } },
        art ? h('div', { class: 'fac-art', style: { backgroundImage: 'url("' + encodeURI(art) + '")' } }) : null,
        h('h3', null, f.name), h('div', { class: 'blurb' }, f.blurb), h('div', { class: 'desc' }, f.desc)));
    }
    setScreen(h('div', { class: 'center-box panel', style: { maxWidth: '1200px' } },
      h('h2', { style: { color: idx === 0 ? 'var(--p0)' : 'var(--p1)' } }, p.name + ', choose your Town'),
      h('p', { class: 'muted' }, 'Your Town sets your starting resources, a unique advantage, and a deck of signature creatures & heroes only you can recruit.'),
      grid));
  }

  /* ------------------------ secret objective draft ------------------ */
  function renderGoalChoice(idx) {
    const g = UI.game, p = g.players[idx];
    const grid = h('div', { class: 'faction-grid' });
    for (const gid of p.secretOptions) {
      const sg = goalById(gid);
      grid.appendChild(h('div', { class: 'faction-card', onClick: () => { g.chooseSecretGoal(idx, gid); UI.sync(); } },
        h('h3', null, '🤫 ' + sg.name),
        h('div', { class: 'desc' }, sg.desc),
        h('div', { class: 'blurb', style: { color: 'var(--gold)' } }, 'Worth ' + sg.vp + ' Glory if achieved by game end.')));
    }
    setScreen(h('div', { class: 'center-box panel' },
      h('h2', { style: { color: idx === 0 ? 'var(--p0)' : 'var(--p1)' } }, p.name + ', draft your Secret Objective'),
      h('p', { class: 'muted' }, 'Keep it hidden from your rival. If you meet it by the end of the conquest, you score bonus Glory.'),
      grid));
  }

  /* ------------------------------ research -------------------------- */
  function renderResearch(idx) {
    const g = UI.game, p = g.players[idx];
    if (!UI.researchSel[idx]) UI.researchSel[idx] = new Set();
    const sel = UI.researchSel[idx];
    const grid = h('div', { class: 'research-grid' });
    for (const id of p.pendingResearch) {
      const keep = sel.has(id);
      const face = cardFace(id, { playable: false });
      face.classList.add('card');
      if (keep) face.classList.add('keep');
      if (data.CARD_FACTION[id]) face.classList.add('signature');
      face.appendChild(h('div', { class: 'keepmark' }, keep ? '✔ KEEP' : ''));
      face.addEventListener('click', () => { if (sel.has(id)) sel.delete(id); else sel.add(id); renderResearch(idx); });
      grid.appendChild(face);
    }
    const cost = sel.size * eng.RESEARCH_BUY, canBuy = cost <= p.res.gold;
    setScreen(h('div', { class: 'panel', style: { maxWidth: '96vw', margin: '10px auto' } },
      h('h2', { style: { color: idx === 0 ? 'var(--p0)' : 'var(--p1)' } }, p.name + ' (' + factionById(p.faction).name + ') — Research'),
      h('p', { class: 'muted' }, 'Click cards to keep them (3 Gold each). Gold-titled cards are your Town\'s signature units. The rest are discarded.'),
      grid,
      h('div', { class: 'row center', style: { marginTop: '14px' } },
        h('div', null, 'Keeping ', h('b', null, String(sel.size)), ' for ',
          h('b', { style: { color: canBuy ? 'var(--gold)' : 'var(--bad)' } }, cost + ' Gold'), '  ·  You have ' + p.res.gold + ' Gold'),
        h('button', { class: 'primary', disabled: !canBuy, onClick: () => { g.resolveResearch(idx, [...sel]); UI.researchSel[idx] = null; UI.sync(); } }, 'Confirm ▶'))));
  }

  /* ---------------------------- card faces -------------------------- */
  function tagBadges(card) {
    return h('div', { class: 'ctags' }, (card.tags || []).map(t =>
      h('span', { class: 'tag-badge', title: TAG_INFO[t].name }, TAG_INFO[t].icon + ' ' + TAG_INFO[t].name)));
  }
  function vpText(card) {
    const v = card.vp; if (v == null) return null;
    if (typeof v === 'number') return v + ' VP';
    if (v.perStore) return '★/' + v.perStore; if (v.perTag) return '★'; return null;
  }
  function cardKindLabel(card) { return card.type === 'auto' ? 'Structure' : card.type === 'active' ? 'Power' : 'Spell'; }
  // Card art: each card id gets a random image from js/cardimages.js, assigned once and kept
  // for the whole session (stable through a game), re-randomized on page reload.
  const _cardImg = {};
  function cardArtUrl(id) {
    const imgs = (global.HK && global.HK.cardImages) || [];
    if (!imgs.length) return null;
    if (!(id in _cardImg)) _cardImg[id] = imgs[Math.floor(Math.random() * imgs.length)];
    return _cardImg[id];
  }
  // Pick a random image not already taken by another key (so no two share one), stable per session.
  function pickUnique(cache, key, pool) {
    if (key in cache) return cache[key];
    if (!pool || !pool.length) return null;
    const used = new Set(Object.values(cache));
    let free = pool.filter(u => !used.has(u));
    if (!free.length) free = pool; // more keys than images — only then allow a repeat
    cache[key] = free[Math.floor(Math.random() * free.length)];
    return cache[key];
  }
  // Each Wonder (keyed by faction) gets a UNIQUE random image from imgs/wonders/.
  const _wonderImg = {};
  function wonderArtUrl(key) {
    return pickUnique(_wonderImg, key, (global.HK && global.HK.wonderImages) || []);
  }
  // Each Town gets a UNIQUE random image from its ALIGNMENT bucket (good/chaotic/neutral).
  // Uniqueness is scoped per bucket; different alignments use disjoint files, so no cross-collision.
  const _facImg = {};
  function factionArtUrl(fid) {
    const f = factionById(fid);
    const buckets = (global.HK && global.HK.factionImages) || {};
    const pool = (f && buckets[f.align]) || [];
    if (!pool.length) return null;
    if (fid in _facImg) return _facImg[fid];
    // exclude images already used by OTHER factions of the SAME alignment
    const used = new Set();
    for (const k in _facImg) { const of = factionById(k); if (of && of.align === f.align) used.add(_facImg[k]); }
    let free = pool.filter(u => !used.has(u));
    if (!free.length) free = pool;
    _facImg[fid] = free[Math.floor(Math.random() * free.length)];
    return _facImg[fid];
  }

  function cardFace(id, { playable, reason }) {
    const card = cardById(id);
    const fac = data.CARD_FACTION[id];
    const art = cardArtUrl(id);
    return h('div', { class: 'card' + (playable === true ? ' playable' : playable === false ? ' unplayable' : '') },
      art ? h('div', { class: 'cart', style: { backgroundImage: 'url("' + encodeURI(art) + '")' } }) : null,
      h('div', { class: 'chead' }, h('div', { class: 'cname' }, card.name), h('div', { class: 'ccost' }, String(card.cost))),
      h('div', { class: 'ctype ' + card.type }, cardKindLabel(card) + (fac ? ' · ' + factionById(fac).name : '')),
      tagBadges(card),
      h('div', { class: 'ctext' }, card.text || ''),
      card.req ? h('div', { class: 'creq' }, '⚑ ' + reqText(card.req)) : null,
      vpText(card) ? h('div', { class: 'cvp' }, '★ ' + vpText(card)) : null,
      reason ? h('div', { class: 'creq' }, '✖ ' + reason) : null);
  }
  function reqText(r) {
    const parts = [];
    if (r.realmMin != null) parts.push('Realm ' + r.realmMin + '+');
    if (r.sorceryMin != null) parts.push('Sorcery ' + r.sorceryMin + '+');
    if (r.frontierMin != null) parts.push('Frontier ' + r.frontierMin + '+');
    if (r.tags) for (const t in r.tags) parts.push(r.tags[t] + ' ' + TAG_INFO[t].name);
    if (r.prod) for (const k in r.prod) parts.push(r.prod[k] + ' ' + RES_INFO[k].name + ' prod');
    return parts.join(', ');
  }

  /* ----------------------------- scoring est ------------------------ */
  // Committed Glory only — Renown + cards + map tiles + claimed Deeds.
  // Awards and the secret objective are competitive/private and are added at
  // game end, so we keep them OUT of the live number to avoid it jumping when
  // the opponent acts or when turns change.
  function liveGlory(p) {
    const g = UI.game;
    let v = p.renown + p.eventVP + g.mapVP(p);
    for (const e of p.tableau) v += g.cardVP(p, e);
    for (const m of g.milestones) if (m.claimedBy === p.idx) v += 5;
    return v;
  }

  /* ------------------------------ the map --------------------------- */
  function hexPoints(cx, cy, size) {
    const p = [];
    for (let i = 0; i < 6; i++) { const a = Math.PI / 180 * (60 * i - 30); p.push((cx + size * Math.cos(a)).toFixed(1) + ',' + (cy + size * Math.sin(a)).toFixed(1)); }
    return p.join(' ');
  }
  function bonusIcon(b) { if (b.draw) return '🃏'; if (b.gain) return RES_INFO[Object.keys(b.gain)[0]].icon; return '✦'; }
  function bonusResKey(b) { return (b.gain) ? Object.keys(b.gain)[0] : null; }
  // SVG glyph for a resource on the map: <image> coin for gold, <text> emoji else.
  function svgResGlyph(resKey, fallbackEmoji, x, y, size) {
    if (resKey === 'gold') return s('image', { href: 'icons/gold-128.svg', x: x - size / 2, y: y - size / 2, width: size, height: size });
    return s('text', { x, y: y + size * 0.32, 'text-anchor': 'middle', 'font-size': size, class: 'hexhint' }, fallbackEmoji);
  }
  function ownerFill(o) { return o === 0 ? 'rgba(79,143,214,.6)' : 'rgba(199,91,74,.6)'; }
  function ownerStroke(o) { return o === 0 ? '#bcd8ff' : '#ffc9bd'; }

  function renderMap() {
    const g = UI.game, size = 26, placing = UI.placing;
    const pos = {}; let minX = 1e9, minY = 1e9, maxX = -1e9, maxY = -1e9;
    for (const id of g.map.order) {
      const hx = g.map.hexes[id];
      const x = size * Math.sqrt(3) * (hx.q + hx.r / 2), y = size * 1.5 * hx.r;
      pos[id] = { x, y };
      minX = Math.min(minX, x); maxX = Math.max(maxX, x); minY = Math.min(minY, y); maxY = Math.max(maxY, y);
    }
    const pad = size + 8;
    const vbW = (maxX - minX) + 2 * pad, vbH = (maxY - minY) + 2 * pad;
    // Drive the element's aspect-ratio from the actual content box so the hexes
    // fill the centre column with no dead side-margins.
    const svgEl = s('svg', { viewBox: `${minX - pad} ${minY - pad} ${vbW} ${vbH}`, class: 'hexmap', preserveAspectRatio: 'xMidYMid meet', style: `aspect-ratio:${vbW} / ${vbH}` });
    // defs: a top-down light "sheen" gradient + a soft drop-shadow for tile tokens
    const sheen = s('linearGradient', { id: 'sheen', x1: '0', y1: '0', x2: '0', y2: '1' });
    sheen.appendChild(s('stop', { offset: '0%', 'stop-color': '#ffffff', 'stop-opacity': '0.22' }));
    sheen.appendChild(s('stop', { offset: '55%', 'stop-color': '#ffffff', 'stop-opacity': '0' }));
    sheen.appendChild(s('stop', { offset: '100%', 'stop-color': '#000000', 'stop-opacity': '0.20' }));
    const filt = s('filter', { id: 'tok', x: '-40%', y: '-40%', width: '180%', height: '180%' });
    filt.appendChild(s('feDropShadow', { dx: '0', dy: '1.3', stdDeviation: '1.3', 'flood-color': '#000', 'flood-opacity': '0.55' }));
    svgEl.appendChild(s('defs', null, sheen, filt));
    const empties = placing ? new Set(g.emptyHexes()) : null;
    for (const id of g.map.order) {
      const hx = g.map.hexes[id], { x, y } = pos[id], poly = hexPoints(x, y, size), tile = hx.tile;
      const isTarget = !!(placing && empties.has(id));
      const grp = s('g', { class: 'hex' + (isTarget ? ' target' : ''), onClick: isTarget ? (() => { const r = UI.placing.exec(id); if (r && r.ok) { UI.placing = null; UI.sync(); } }) : null });
      grp.appendChild(s('polygon', { points: poly, fill: TERRAIN_COLORS[hx.terrain] || '#444', stroke: '#14121b', 'stroke-width': 1.2, 'stroke-linejoin': 'round' }));
      grp.appendChild(s('polygon', { points: poly, fill: 'url(#sheen)', stroke: 'none', 'pointer-events': 'none' }));
      if (tile) {
        grp.appendChild(s('circle', { cx: x, cy: y, r: size * 0.6, fill: tile.owner === 0 ? '#27496e' : '#6e2c24', stroke: ownerStroke(tile.owner), 'stroke-width': 2.5, filter: 'url(#tok)' }));
        grp.appendChild(s('text', { x, y: y + 7, 'text-anchor': 'middle', 'font-size': 21, class: 'hexicon' }, TILE_INFO[tile.type].icon));
      } else {
        if (hx.mine) {
          grp.appendChild(s('circle', { cx: x, cy: y - 5, r: 9, fill: 'rgba(0,0,0,.30)', stroke: 'rgba(255,255,255,.18)', 'stroke-width': 1, 'pointer-events': 'none' }));
          grp.appendChild(svgResGlyph(hx.mine, RES_INFO[hx.mine].icon, x, y - 5, 14));
        }
        if (hx.bonus) grp.appendChild(svgResGlyph(bonusResKey(hx.bonus), bonusIcon(hx.bonus), x, y + (hx.mine ? 13 : 5), 14));
      }
      if (isTarget) grp.appendChild(s('polygon', { points: poly, class: 'targetring', fill: 'rgba(232,195,74,.16)', stroke: 'var(--gold)', 'stroke-width': 3, 'stroke-linejoin': 'round', 'pointer-events': 'none' }));
      svgEl.appendChild(grp);
    }
    const banner = placing
      ? h('div', { class: 'place-banner' }, '📍 Pick an empty hex for your ', h('b', null, TILE_INFO[placing.tileType].icon + ' ' + TILE_INFO[placing.tileType].name),
        h('button', { class: 'ghost', style: { marginLeft: '10px' }, onClick: () => { UI.placing = null; renderGame(); } }, 'Cancel'))
      : h('div', { class: 'map-legend' },
        '🏰 Town · ⛏️ Mine · 🚩 Region   |   small icon on a hex = ',
        h('b', null, 'mine resource'), ' / one-time bonus.  Mines score +1★ per adjacent Town.');
    return h('div', { class: 'panel mapwrap' }, h('h3', null, '🗺️ The Adventure Map'), svgEl, banner);
  }

  /* Gold renders as the hand-drawn SVG coin (the 🪙 emoji looks like silver). */
  function coinIco() { return h('span', { class: 'coin coin-inline' }); }
  // A cost like "8 [coin]" as an inline node group, usable anywhere h() accepts children.
  function goldCost(n) { return h('span', { class: 'goldcost' }, String(n), coinIco()); }
  // For any resource: SVG coin for gold, emoji glyph otherwise (as a node).
  function resGlyph(k) { return k === 'gold' ? coinIco() : h('span', { class: 'remoji' }, RES_INFO[k].icon); }
  function resCost(n, k) { return h('span', { class: 'goldcost' }, String(n), resGlyph(k)); }
  function resIconNode(k) {
    return k === 'gold' ? h('span', { class: 'coin' }) : h('span', { class: 'remoji' }, RES_INFO[k].icon);
  }

  /* ------------------------------- board ---------------------------- */
  function renderBoard(p, isActive, collapsible) {
    const g = UI.game, f = factionById(p.faction);
    const collapsed = collapsible && !UI.showOpp;
    // The active player's resources are shown in the HUD above the hand.
    // For the opponent board we still show a compact strip (no separate HUD there).
    const resStrip = !isActive ? h('div', { class: 'res-strip' }, RES_ORDER.map(k => {
      if (TRACK_RES[k]) {
        const lvl = p.prod[k] || 0, off = trackRate(k) * lvl;
        return h('div', { class: 'res track', title: TRACK_RES[k].label + ' level ' + lvl + ' — ' + TRACK_RES[k].tag + ' cards cost ' + off + ' Gold less' },
          h('div', { class: 'ricon' }, resIconNode(k)),
          h('div', { class: 'rstock' }, 'L' + lvl),
          h('div', { class: 'rprod' }, off ? '−' + off : '—'));
      }
      const isGold = k === 'gold';
      const gain = isGold ? (p.renown + p.prod.gold) : p.prod[k];
      const tip = isGold
        ? 'Gold — gains ' + gain + '/week (Renown ' + p.renown + ' + Gold production ' + p.prod.gold + ')'
        : RES_INFO[k].name + ' — produces ' + p.prod[k] + '/week';
      return h('div', { class: 'res', title: tip },
        h('div', { class: 'ricon' }, resIconNode(k)),
        h('div', { class: 'rstock' }, String(p.res[k])),
        h('div', { class: 'rprod' + (gain < 0 ? ' neg' : '') }, (gain >= 0 ? '+' : '') + gain));
    })) : null;
    const tagSpans = [];
    for (const t in TAG_INFO) { const n = g.tagCount(p, t); if (n > 0) tagSpans.push(h('span', null, TAG_INFO[t].icon + n)); }
    const showCounters = (p.countersUsed || 0) > 0 || p.tableau.some(e => { const c = cardById(e.id); return c.vp && c.vp.perStore; });
    const tableau = h('div', { class: 'tableau' }, p.tableau.length ? p.tableau.map(e => {
      const card = cardById(e.id), hasAct = e.action && !e.usedAction;
      const actionable = isActive && hasAct && g._canPayCost(p, e.action.cost) && !UI.placing;
      const info = card.name + ' — ' + (card.text || '') + (e.action ? '  ⚡ ' + e.action.desc : '');
      return h('div', {
        class: 'mini t-' + card.type + (e.usedAction ? ' used' : '') + (actionable ? ' actionable' : ' viewable'),
        title: info,
        onClick: actionable ? (() => { g.useCardAction(p.idx, e.uid); UI.sync(); }) : (() => showCardInfo(e.id))
      },
        h('div', { class: 'mname' }, card.name),
        h('div', { class: 'mtags' }, (card.tags || []).map(t => TAG_INFO[t].icon).join('')),
        e.action ? h('div', { class: 'mtext' }, (e.usedAction ? '✔ ' : '⚡ ') + e.action.desc) : null,
        e.store ? h('div', { class: 'mstore' }, '×' + e.store) : null,
        g.cardVP(p, e) ? h('div', { class: 'mvp' }, '★' + g.cardVP(p, e)) : null);
    }) : h('div', { class: 'muted', style: { fontSize: '12px' } }, '(no cards in play yet)'));

    const chevron = collapsible
      ? h('button', { class: 'chev', title: collapsed ? 'Click to reveal opponent board' : 'Hide opponent board', onClick: () => { UI.showOpp = !UI.showOpp; renderGame(); } }, collapsed ? '»' : '«')
      : null;
    return h('div', { class: 'pboard p' + p.idx + (isActive ? ' active' : '') + (collapsed ? ' collapsed' : '') },
      h('div', { class: 'phead' },
        chevron,
        h('div', { class: 'pname' }, p.name + (g.passed[p.idx] ? ' 💤' : '')),
        f ? h('div', { class: 'ptown' }, f.name, qIcon((f.blurb ? f.blurb + '  ' : '') + 'TOWN ABILITY — ' + f.desc)) : null,
        collapsed ? h('div', { class: 'ptown', style: { opacity: .7 } }, '— board hidden —') : null,
        h('div', { class: 'glory', title: 'Glory ★ is your total score so far = Renown + card ★ + map tiles + claimed Deeds (Awards & your Secret are added at game end). Renown is a part of Glory that also = your weekly Gold income; it rises +1 each time you advance a track. They start equal, then diverge as you score.' },
          h('b', null, '★ ' + liveGlory(p) + ' Glory'), h('small', null, 'incl. ' + p.renown + ' Renown'))),
      collapsed ? null : resStrip,
      collapsed ? null : h('div', { class: 'meta-line' },
        tagSpans.length ? h('span', { class: 'tagchips' }, tagSpans) : null,
        h('span', { class: 'tilechips' }, '🏰' + p.tiles.town + ' ⛏️' + p.tiles.mine + ' 🚩' + p.tiles.region),
        showCounters ? h('span', { class: 'counterchip' + ((p.countersUsed || 0) >= eng.COUNTER_BUDGET ? ' full' : ''), title: 'Scoring counters — a shared pool of ' + eng.COUNTER_BUDGET + ' per player across ALL your "store a counter" cards (' + (eng.COUNTER_BUDGET - (p.countersUsed || 0)) + ' left). Each counter scores VP per the card holding it.' }, '🎯 ' + (p.countersUsed || 0) + '/' + eng.COUNTER_BUDGET + ' counters') : null),
      collapsed ? null : h('div', { class: 'tableau-label' }, 'In play (tableau):'),
      collapsed ? null : tableau);
  }

  /* ---------------------------- action panel ------------------------ */
  function actBtn(label, sub, costLabel, enabled, onClick) {
    return h('button', { class: 'act-btn', disabled: !enabled, onClick: enabled ? onClick : null },
      h('span', null, label, sub ? h('small', null, sub) : null),
      costLabel ? h('span', { class: 'cost' }, costLabel) : null);
  }
  function beginPlacement(tileType, exec) { UI.placing = { tileType, exec }; renderGame(); }

  function renderActions() {
    const g = UI.game, idx = g.turn, p = g.players[idx], f = factionById(p.faction);
    const hasHex = g.emptyHexes().length > 0;
    const busy = !!UI.placing;

    // Adventure (map) actions
    const adv = h('div', { class: 'acts' },
      actBtn('🏰 Found Town', 'place a Town → +1 Realm, +Renown, scores Glory', goldCost(STANDARD.settle.cost),
        !busy && hasHex && p.res.gold >= STANDARD.settle.cost, () => beginPlacement('town', hx => g.standardProject(idx, 'settle', hx))),
      actBtn('🚩 Clear a Region', 'place a Region → +1 Frontier, +2 Gold plunder', goldCost(STANDARD.conquer.cost),
        !busy && hasHex && p.res.gold >= STANDARD.conquer.cost, () => beginPlacement('region', hx => g.standardProject(idx, 'conquer', hx))),
      actBtn('⛏️ Flag a Mine', 'place a Mine → +1 production of that hex', goldCost(STANDARD.town.cost),
        !busy && hasHex && p.res.gold >= STANDARD.town.cost, () => beginPlacement('mine', hx => g.standardProject(idx, 'town', hx))),
      actBtn('🔮 Build Mage Guild', '+1 Mercury production', goldCost(STANDARD.mageTower.cost),
        !busy && p.res.gold >= STANDARD.mageTower.cost, () => { g.standardProject(idx, 'mageTower'); UI.sync(); }),
      actBtn('🌟 Study Sorcery', '+1 Sorcery, +Renown', goldCost(STANDARD.channel.cost),
        !busy && p.res.gold >= STANDARD.channel.cost, () => { g.standardProject(idx, 'channel'); UI.sync(); }));

    // Muster / Forge / Channel
    const conv = h('div', { class: 'acts' },
      actBtn('⚔️ Muster Army → Town', 'place a Town → +1 Realm', p.settlementCost + ' ⚔️',
        !busy && hasHex && p.res.recruits >= p.settlementCost, () => beginPlacement('town', hx => g.convertRecruits(idx, hx))),
      actBtn('🔨 Forge', 'spend 2 Ore → gain 3 Recruits', '2 🪨 → 3 ⚔️',
        !busy && p.res.ore >= 2, () => { g.forge(idx); UI.sync(); }),
      actBtn('⚗️ Channel Mercury', '+1 Sorcery, +Renown', '8 ⚗️',
        !busy && p.res.mercury >= 8, () => { g.convertMercury(idx); UI.sync(); }));
    // Alchemy: transmute 2 Mercury into 2 of any resource
    const tmutOk = !busy && p.res.mercury >= 2;
    const transmute = h('div', { class: 'transmute-row' },
      h('span', { class: 'tmut-label' }, '⚗️ Transmute 2 Mercury →'),
      ['gold', 'ore', 'recruits'].map(rk =>
        h('button', { class: 'tmut-btn', disabled: !tmutOk, title: '2 Mercury → 2 ' + RES_INFO[rk].name, onClick: tmutOk ? (() => { g.transmute(idx, rk); UI.sync(); }) : null },
          rk === 'gold' ? h('span', { class: 'coin' }) : RES_INFO[rk].icon)));

    // Abilities (hero/structure + town)
    const abilEls = [];
    if (f && f.action) abilEls.push(actBtn('👑 ' + f.name + ' ability', f.action.desc, '',
      !busy && !p.factionActionUsed && g._canPayCost(p, f.action.cost), () => { g.useFactionAction(idx); UI.sync(); }));
    for (const e of p.tableau) if (e.action) {
      const c = cardById(e.id);
      abilEls.push(actBtn('⚡ ' + c.name, e.usedAction ? 'already used this week' : e.action.desc, '',
        !busy && !e.usedAction && g._canPayCost(p, e.action.cost), () => { g.useCardAction(idx, e.uid); UI.sync(); }));
    }
    if (!abilEls.length) abilEls.push(h('div', { class: 'muted', style: { fontSize: '12px' } }, 'No abilities yet — play Heroes & Powers.'));

    return h('div', { class: 'panel actions-panel' },
      h('h3', null, '⚔️ Your Turn — what you can do'),
      h('div', { class: 'turn-hint' }, 'Play cards from your hand below, take any actions, then ', h('b', null, 'End Turn'), '.'),
      h('div', { class: 'subhead' }, 'Adventure Map'),
      adv,
      h('div', { class: 'subhead' }, 'Muster · Forge · Channel', qIcon('Muster spends Recruits to raise a Town (+Realm). Forge smelts Ore into Recruits. Channel turns 8 Mercury into +1 Sorcery.')),
      conv,
      transmute,
      h('div', { class: 'subhead' }, 'Abilities (once per week)'),
      h('div', { class: 'acts' }, abilEls));
  }

  /* ----------------------------- goals panel ------------------------ */
  // Custom tooltip (the native `title` attribute has a ~0.5s OS-controlled
  // delay) — this shows instantly on hover via CSS.
  function qIcon(text) { return h('span', { class: 'qmark' }, '?', h('span', { class: 'tip' }, text)); }
  const HELP = {
    win: 'Maxing the three tracks does NOT win the game — it is an END TRIGGER. The conquest ends after the week the tracks are maxed, OR one week after a lord completes a Wonder. The winner is whoever holds the most Glory ★ at that point — so you can max the tracks and still lose on Glory. Every track step also grants +1 Renown (your Glory and Gold income).',
    wonder: 'Your Town Wonder — an alternate path to victory. Build its 3 stages in order (each is a turn action with its own cost + requirement and an immediate reward; the last grants a permanent synergy). Finishing it scores ' + (global.HK.data.WONDER_VP) + ' Glory; its powers then run for one final week before the game ends — so the last stage\'s bonus actually pays off, and your rival gets one week to answer.',
    deeds: 'Deeds are public achievements. The first lord to meet a Deed may claim it for 8 Gold; it is worth 5★ at the end. At most 3 Deeds are claimed in a game, so race for them.',
    honors: 'Honors are public titles you pay to fund (cost rises 8 → 14 → 20 Gold). They are judged at game end: the leader in that category scores 5★, the runner-up 2★. At most 3 Honors are funded in a game.',
    quests: 'A shared board of Adventures. On your turn, complete one outright — meet its requirement (tags/tracks you already hold, nothing spent) and pay its cost (often Ore or Mercury) — to take the reward, including any permanent SAGA bonus. The board then refills; rivals race you for them.',
  };
  function renderGoals() {
    const g = UI.game, idx = g.turn, p = g.players[idx];
    // win condition tracks
    const tracks = h('div', { class: 'goal-tracks' }, Object.keys(GLOBALS).map(k => {
      const gg = GLOBALS[k], val = g.params[k], done = val >= gg.max;
      return h('div', { class: 'goal-track' + (done ? ' done' : '') },
        h('span', null, gg.icon + ' ' + gg.name), h('b', null, val + '/' + gg.max + (done ? ' ✓' : '')));
    }));

    // deeds (milestones)
    const miles = h('div', null, MILESTONES.map(m => {
      const st = g.milestones.find(x => x.id === m.id), claimed = st.claimedBy != null;
      const can = !UI.placing && g.milestoneAvailable(p, m.id) && p.res.gold >= eng.MILESTONE_COST;
      return h('div', { class: 'mile-row' },
        h('span', null, '🏅 ' + m.name, qIcon(m.desc + ' — Claim for ' + eng.MILESTONE_COST + ' Gold; worth 5★ at game end.'),
          claimed ? h('span', { class: 'claimed' }, ' — ' + g.players[st.claimedBy].name) : null),
        claimed ? null : h('button', { disabled: !can, onClick: can ? (() => { g.claimMilestone(idx, m.id); UI.sync(); }) : null }, goldCost(eng.MILESTONE_COST)));
    }));

    // honors (awards)
    const fundCost = g.awardFundCost();
    const awards = h('div', null, AWARDS.map(a => {
      const st = g.awards.find(x => x.id === a.id), funded = st.fundedBy != null;
      const me = a.score(g, p), opp = a.score(g, g.other(p));
      const lead = me > opp ? ' (you lead)' : me < opp ? ' (rival leads)' : ' (tied)';
      const can = !UI.placing && g.awardAvailable(a.id) && p.res.gold >= fundCost;
      return h('div', { class: 'award-row' },
        h('span', null, '🏆 ' + a.name, qIcon(a.desc + ' — Fund it (8/14/20 Gold). Game end: leader 5★, runner-up 2★.'),
          funded ? h('span', { class: 'claimed' }, ' — funded') : h('small', { style: { color: '#9aa' } }, lead)),
        funded ? null : h('button', { disabled: !can, onClick: can ? (() => { g.fundAward(idx, a.id); UI.sync(); }) : null }, goldCost(fundCost)));
    }));

    // secret objective (active player only)
    const sg = p.secretGoal ? goalById(p.secretGoal) : null;
    const met = sg && sg.check(g, p);
    const secret = sg ? h('div', { class: 'secret-box' + (met ? ' met' : '') },
      h('div', { class: 'secret-title' }, '🤫 Secret: ' + sg.name + '  (' + sg.vp + '★)'),
      h('div', { class: 'muted', style: { fontSize: '12px' } }, sg.desc),
      h('div', { style: { color: met ? 'var(--good)' : 'var(--bad)', fontSize: '12px', marginTop: '2px' } }, met ? '✓ achieved (so far)' : '✗ not yet')) : null;

    return h('div', { class: 'panel goals-panel' },
      h('h3', null, '🎯 Goals'),
      h('div', { class: 'subhead' }, 'Game-end trigger — the three tracks', qIcon(HELP.win)),
      tracks,
      h('div', { class: 'subhead' }, 'Public · Deeds (claim, 5★ · ' + g.milestonesClaimedCount + '/3)', qIcon(HELP.deeds)),
      miles,
      h('div', { class: 'subhead' }, 'Public · Honors (fund, end 5★/2★ · ' + g.awardsFundedCount + '/3)', qIcon(HELP.honors)),
      awards,
      h('div', { class: 'subhead' }, 'Private', qIcon('Your secret objective, drafted at the start and hidden from your rival. Worth bonus Glory if you meet it by game end.')),
      secret);
  }

  /* ----------------------------- wonder panel ----------------------- */
  // Resource costs with the SVG coin for gold, as inline nodes.
  function costNodes(cost) {
    const out = []; const keys = Object.keys(cost);
    keys.forEach((k, i) => { out.push(resCost(cost[k], k)); if (i < keys.length - 1) out.push(' '); });
    return out;
  }
  function renderWonder() {
    const g = UI.game, idx = g.turn, p = g.players[idx], w = factionById(p.faction).wonder;
    const buildable = g.canBuildWonder(p).ok;
    const rows = w.stages.map((st, i) => {
      const done = p.wonderStage > i, isNext = p.wonderStage === i;
      return h('div', { class: 'wonder-stage' + (done ? ' done' : '') + (isNext ? ' next' : '') },
        h('div', { class: 'ws-head' },
          h('b', null, (done ? '✓ ' : isNext ? '▶ ' : '🔒 ') + (i + 1) + '. ' + st.name),
          (isNext && !UI.placing) ? h('button', { class: 'primary mini-btn', disabled: !buildable, onClick: buildable ? (() => { g.buildWonderStage(idx); UI.sync(); }) : null }, 'Build') : null),
        h('div', { class: 'ws-meta' }, 'Cost ', costNodes(st.cost), (st.req ? '  ·  Needs ' + reqText(st.req) : '')),
        h('div', { class: 'ws-reward' }, '→ ' + st.desc));
    });
    const art = wonderArtUrl(p.faction);
    return h('div', { class: 'panel wonder-panel' },
      art ? h('div', { class: 'wonder-art', style: { backgroundImage: 'url("' + encodeURI(art) + '")' } }) : null,
      h('h3', null, '✦ Your Wonder', qIcon(HELP.wonder)),
      h('div', { class: 'wonder-name' }, w.name + '  (' + WONDER_VP + '★)'),
      h('div', { class: 'muted', style: { fontSize: '12px', marginBottom: '6px' } }, w.blurb + ' Completing it grants its powers for one final week, then ends the game.'),
      rows,
      p.wonderComplete ? h('div', { style: { color: 'var(--good)', marginTop: '6px', fontWeight: '700' } }, '✓ Completed! +' + WONDER_VP + '★ — its power runs one final week, then the conquest ends.') : null);
  }

  /* ----------------------------- quest board ------------------------ */
  function renderQuests() {
    const g = UI.game, idx = g.turn, p = g.players[idx];
    const cards = g.questBoard.map(qid => {
      const q = data.questById(qid), ok = !UI.placing && g.canCompleteQuest(p, q).ok;
      return h('div', { class: 'quest' + (ok ? ' ready' : '') },
        h('div', { class: 'q-head' },
          h('b', null, (data.QUEST_TYPES[q.type] || '') + ' ' + q.name),
          h('button', { class: 'primary mini-btn', disabled: !ok, onClick: ok ? (() => { g.completeQuest(idx, qid); UI.sync(); }) : null }, 'Embark')),
        q.req ? h('div', { class: 'q-req' }, 'Needs ' + reqText(q.req)) : null,
        h('div', { class: 'q-cost' }, 'Pay ', costNodes(q.cost)),
        h('div', { class: 'q-reward' }, '→ ' + q.text));
    });
    return h('div', { class: 'panel quests-panel' },
      h('h3', null, '🧭 Adventures', qIcon(HELP.quests)),
      cards.length ? cards : h('div', { class: 'muted', style: { fontSize: '12px' } }, 'No adventures available.'));
  }

  /* ------------------------------ top bar --------------------------- */
  function renderTop() {
    const g = UI.game;
    const globals = h('div', { class: 'globals' }, Object.keys(GLOBALS).map(k => {
      const gg = GLOBALS[k], val = g.params[k];
      return h('div', { class: 'gparam' },
        h('div', { class: 'lbl' }, gg.icon + ' ' + gg.name),
        h('div', { class: 'bar' }, h('div', { class: 'fill', style: { width: (100 * val / gg.max) + '%' } })),
        h('div', { class: 'val' }, val + ' / ' + gg.max));
    }));
    const cur = g.players[g.turn];
    return h('div', { class: 'topbar' },
      h('div', { class: 'brand' }, '⚔️ Conquest of Erathia'),
      h('div', { class: 'gen' }, 'Week ' + g.gen),
      h('div', { class: 'wincond', title: 'Game ends when all three tracks are maxed OR a Wonder is completed — then the most Glory wins.' }, 'Ends: max all 3 →'),
      globals,
      h('div', { class: 'turnchip', style: { background: g.turn === 0 ? 'var(--p0)' : 'var(--p1)', color: '#fff' } }, cur.name + "'s turn"),
      h('button', { class: 'ghost', onClick: () => showHelp() }, '❔ Help'),
      h('button', { class: 'ghost', onClick: () => { if (confirm('Abandon this game and start over?')) global.MAIN.titleScreen(); } }, '✦ New'));
  }

  /* ------------------------------- game ----------------------------- */
  function renderGame() {
    const g = UI.game, idx = g.turn, p = g.players[idx], busy = !!UI.placing;

    const hand = h('div', { class: 'hand' }, p.hand.map(id => {
      const card = cardById(id), chk = g.canPlay(p, card);
      const face = cardFace(id, { playable: !busy && chk.ok, reason: chk.ok ? null : chk.reason });
      if (!busy) face.addEventListener('click', () => openCardModal(id));
      return face;
    }));
    if (p.hand.length === 0) hand.appendChild(h('div', { class: 'muted' }, 'Your hand is empty.'));

    const actionBar = h('div', { class: 'row', style: { marginTop: '10px', alignItems: 'center' } },
      h('button', { class: 'primary', disabled: busy, onClick: () => { g.endTurn(idx); UI.sync(); } }, 'End Turn ▶'),
      h('button', {
        class: 'danger', disabled: busy, onClick: () => {
          if (confirm(p.name + ', pass for the REST of this week? You collect income and cannot act again until next week.')) { g.pass(idx); UI.sync(); }
        }
      }, '💤 Pass (done this week)'),
      g.canUndo() && !busy ? h('button', { onClick: () => { g.undo(); UI.sync(); } }, '↶ Undo') : null,
      g.passed[1 - idx] ? h('div', { class: 'muted' }, '(' + g.players[1 - idx].name + ' has passed — keep going!)') : null);

    setScreen(h('div', null,
      renderTop(),
      g.proclamation ? h('div', { class: 'proclaim' }, '☄️ Astrologers proclaim the ', h('b', null, g.proclamation.name), ' — ', h('span', { class: 'pquote' }, g.proclamation.text)) : null,
      h('div', { class: 'layout3' },
        h('div', { class: 'col col-left' }, renderActions(), renderQuests()),
        h('div', { class: 'col col-center' },
          renderMap(),
          h('div', { class: 'hand-wrap' },
            h('div', { class: 'hand-head' },
              h('h3', null, '🃏 ' + p.name + "'s Hand  —  " + (busy ? 'finish placing your tile first' : 'click a gold-bordered card to play it')),
              renderResHud(p)),
            hand, actionBar),
          h('div', { class: 'boards2' }, renderBoard(p, true, false), renderBoard(g.players[1 - idx], false, true))),
        h('div', { class: 'col col-right' }, renderWonder(), renderGoals(), renderLog(p)))));
  }

  // Always-visible resource readout pinned by the hand, so you needn't scroll up.
  function renderResHud(p) {
    return h('div', { class: 'res-hud' }, RES_ORDER.map(k => {
      if (TRACK_RES[k]) {
        const lvl = p.prod[k] || 0, off = trackRate(k) * lvl;
        return h('div', { class: 'hud-res track', title: TRACK_RES[k].label + ' level ' + lvl + ' — your ' + TRACK_RES[k].tag + ' cards cost ' + off + ' Gold less' },
          h('span', { class: 'hud-ic' }, resIconNode(k)),
          h('span', { class: 'hud-amt' }, 'L' + lvl),
          h('span', { class: 'hud-prod' }, off ? '−' + off : '—'));
      }
      const isGold = k === 'gold';
      const gain = isGold ? (p.renown + p.prod.gold) : p.prod[k];
      const tip = isGold
        ? 'Gold: you have ' + p.res.gold + ', gaining ' + gain + '/week (Renown ' + p.renown + ' + production ' + p.prod.gold + ')'
        : RES_INFO[k].name + ': you have ' + p.res[k] + ', producing ' + (gain >= 0 ? '+' : '') + gain + '/week';
      return h('div', { class: 'hud-res', title: tip },
        h('span', { class: 'hud-ic' }, resIconNode(k)),
        h('span', { class: 'hud-amt' }, String(p.res[k])),
        h('span', { class: 'hud-prod' + (gain < 0 ? ' neg' : '') }, (gain >= 0 ? '+' : '') + gain));
    }));
  }

  function renderLog(p) {
    const g = UI.game;
    const log = h('div', { id: 'log' }, g.logLines.slice(-50).map(l => h('div', { class: l.startsWith(p.name) ? 'me' : '' }, l)));
    setTimeout(() => { const el = document.getElementById('log'); if (el) el.scrollTop = el.scrollHeight; }, 0);
    return h('div', { class: 'panel' }, h('h3', null, '📜 Chronicle'), log);
  }

  /* ----------------------- play / pay / sell modal ------------------ */
  function openCardModal(id) {
    const g = UI.game, idx = g.turn, p = g.players[idx], card = cardById(id);
    const chk = g.canPlay(p, card);
    const cost = g.effectiveCost(p, card);
    const bd = g.costBreakdown(p, card);
    const playable = chk.ok && p.res.gold >= cost;
    // Cost line: pure Gold now — Wood/Crystal are standing discounts folded into the price.
    const costLine = (bd.parts.length === 0)
      ? h('p', { class: 'muted' }, 'Cost ', goldCost(card.cost))
      : h('p', { class: 'muted' },
          'Base ' + bd.base + ' → ', goldCost(cost),
          '  (' + bd.parts.map(pt => '−' + pt.amt + ' ' + pt.src).join(', ') + ')');
    const node = h('div', { class: 'modal' },
      h('h2', null, card.name),
      h('div', { class: 'row' }, cardFace(id, { playable: null }),
        h('div', { style: { flex: 1, minWidth: '220px' } },
          costLine,
          h('p', null, 'Pay ', h('b', { style: { color: 'var(--gold)' } }, goldCost(cost)),
            '   (you have ', goldCost(p.res.gold), ')'),
          !chk.ok ? h('p', { style: { color: 'var(--bad)' } }, '✖ ' + chk.reason) : null)),
      h('div', { class: 'row', style: { marginTop: '14px', justifyContent: 'flex-end' } },
        h('button', { onClick: hideOverlay }, 'Cancel'),
        h('button', { class: 'danger', onClick: () => { g.sellCard(idx, id); hideOverlay(); UI.sync(); } }, 'Discard for ', goldCost(eng.SELL_PRICE)),
        h('button', { class: 'primary', disabled: !playable, onClick: playable ? (() => { g.playCard(idx, id); hideOverlay(); UI.sync(); }) : null }, '▶ Play')));
    showOverlay(node);
  }

  // Read-only look at a card already in play (click any tableau card).
  function showCardInfo(id) {
    showOverlay(h('div', { class: 'modal', style: { maxWidth: '320px' } },
      cardFace(id, { playable: null }),
      h('div', { class: 'row', style: { justifyContent: 'flex-end', marginTop: '12px' } },
        h('button', { class: 'primary', onClick: hideOverlay }, 'Close'))));
  }

  /* ------------------------------- help ----------------------------- */
  function showHelp() {
    const node = h('div', { class: 'modal', style: { maxWidth: '640px' } },
      h('h2', null, '❔ How to play'),
      h('div', { class: 'help-body', html: `
        <p><b>Goal:</b> the most <b>Glory ★</b>. The conquest ends two ways: all three tracks
        (🏰 Realm 14, 🔮 Sorcery 14, 🗺️ Frontier 9) are maxed, <i>or</i> any lord completes their Town <b>Wonder</b>.</p>
        <p><b>Each week:</b> Astrologers proclaim a boon → <b>Research</b> (buy cards) → <b>Turns</b> (alternate; take
        as many actions as you like, then End Turn / Pass) → <b>Income</b> (Gold = Renown + production, plus all other production).</p>
        <p><b>On your turn you can:</b></p>
        <ul>
          <li><b>Play a card</b> — click a gold-bordered card in your hand.</li>
          <li><b>Adventure Map</b> — Found Town / Clear Region / Flag Mine place a tile on a hex you pick; Build Mage Guild & Study Sorcery are instant.</li>
          <li><b>Embark on Adventures</b> — complete a quest from the shared board (pay its cost, meet its requirement) for rewards & permanent Sagas.</li>
          <li><b>Build your Wonder</b> — raise its 3 stages for rewards; finishing it scores big & ends the game.</li>
          <li><b>Muster</b> (Recruits → Town), <b>Forge</b> (2 Ore → 3 Recruits), <b>Channel</b> (8 Mercury → Sorcery), or <b>Transmute</b> (2 Mercury → 2 of any resource).</li>
          <li><b>Use abilities</b> of your Heroes/Powers and Town; <b>Claim a Deed</b> or <b>Fund an Honor</b>.</li>
        </ul>
        <p><b>Card types:</b> 🟩 <b>Structure</b> (a Town building or creature dwelling — plays and stays, passive) ·
        🟦 <b>Power</b> (a Hero, Artifact or active institution — stays and has an ability or trigger) ·
        🟥 <b>Spell</b> (cast once, then discarded). The 🏛️ <i>Building</i> tag is separate — many Structures and some Powers carry it.</p>
        <p><b>Resources:</b> <img src="icons/gold-128.svg" class="coin-img" alt="Gold"> Gold pays anything · 🪵 Wood discounts cards with the Building tag · 💎 Crystal discounts Magic ·
        🪨 <b>Ore</b> arms your host (the Forge) & funds war quests · ⚗️ <b>Mercury</b> = alchemy (Transmute into anything) & magic quests · ⚔️ Recruits raise Towns.</p>
        <p><b>Map:</b> tiles grant the hex's one-time bonus + 2 Gold per adjacent Region. At the end, Towns score 1★ and
        Mines score 1★ + 1★ per adjacent Town — so cluster your kingdom.</p>
        <p><b>Goals:</b> public = the 3 tracks + Deeds & Honors (compete openly). Private = your secret objective (hidden, bonus Glory).</p>`}),
      h('div', { class: 'row', style: { justifyContent: 'flex-end', marginTop: '12px' } }, h('button', { class: 'primary', onClick: hideOverlay }, 'Got it')));
    showOverlay(node);
  }

  /* ----------------------------- game over -------------------------- */
  function renderGameOver() {
    const g = UI.game, sc = g.finalScores, w = g.winner;
    const rows = [0, 1].map(i => {
      const sg = goalById(g.players[i].secretGoal), s2 = sc[i];
      return h('tr', { class: i === w ? 'winrow' : '' },
        h('td', null, (i === w ? '👑 ' : '') + s2.name + ' (' + factionById(g.players[i].faction).name + ')'),
        h('td', null, String(s2.renown)), h('td', null, String(s2.cards)), h('td', null, String(s2.tiles)),
        h('td', null, String(s2.events)), h('td', null, String(s2.milestones)), h('td', null, String(s2.awards)),
        h('td', { title: sg ? sg.name + ': ' + sg.desc : '' }, s2.secret ? '✓' + s2.secret : '—'),
        h('td', { title: factionById(g.players[i].faction).wonder.name }, s2.wonder ? '✓' + s2.wonder : '—'),
        h('td', { class: 'total' }, String(s2.total)));
    });
    setScreen(h('div', { class: 'center-box panel', style: { maxWidth: '900px' } },
      h('h1', { style: { color: 'var(--gold)', textAlign: 'center' } }, '👑 ' + sc[w].name + ' wins Erathia!'),
      h('p', { class: 'muted', style: { textAlign: 'center' } }, 'Final Glory: ' + sc[w].total + ' after ' + g.gen + ' weeks of conquest.'),
      h('table', { class: 'score-table' },
        h('tr', null, ['Lord', 'Renown', 'Cards', 'Map', 'Spells', 'Deeds', 'Honors', 'Secret', 'Wonder', 'Glory'].map(t => h('th', null, t))),
        rows),
      h('div', { class: 'row', style: { justifyContent: 'center', marginTop: '6px' } },
        h('p', { class: 'muted' }, 'Secret objectives: ' + g.players.map(pl => pl.name + ' — ' + (goalById(pl.secretGoal) ? goalById(pl.secretGoal).name : '?')).join('  ·  '))),
      h('div', { class: 'row center', style: { marginTop: '14px' } }, h('button', { class: 'primary', onClick: () => global.MAIN.titleScreen() }, '✦ New Game'))));
  }

  // Body-level floating tooltip for all .qmark icons — positioned by JS so it
  // is never clipped by a panel/map with overflow. Attached once.
  (function initFloatTip() {
    if (typeof document === 'undefined' || typeof document.addEventListener !== 'function') return;
    const getFT = () => document.getElementById('floattip');
    document.addEventListener('mouseover', (e) => {
      const q = e.target.closest && e.target.closest('.qmark');
      if (!q) return;
      const src = q.querySelector('.tip');
      const ft = getFT();
      if (!src || !ft) return;
      ft.textContent = src.textContent;
      ft.style.display = 'block';
      const r = q.getBoundingClientRect();
      const tw = ft.offsetWidth, th = ft.offsetHeight, M = 8;
      let left = r.right - tw;
      if (left < M) left = M;
      if (left + tw > window.innerWidth - M) left = window.innerWidth - M - tw;
      let top = r.top - th - 8;
      if (top < M) top = r.bottom + 8; // flip below if no room above
      ft.style.left = left + 'px';
      ft.style.top = top + 'px';
    });
    document.addEventListener('mouseout', (e) => {
      if (e.target.closest && e.target.closest('.qmark')) { const ft = getFT(); if (ft) ft.style.display = 'none'; }
    });
    // hide on scroll so a stale bubble doesn't linger over new content
    window.addEventListener('scroll', () => { const ft = getFT(); if (ft) ft.style.display = 'none'; }, true);
  })();

  global.UI = UI;
})(window);
