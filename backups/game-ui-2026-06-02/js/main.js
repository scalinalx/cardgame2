/* =====================================================================
 * CONQUEST OF ERATHIA — main.js : bootstrap + title screen
 * ===================================================================== */
(function (global) {
  'use strict';
  const eng = global.HK.engine;

  function el(tag, attrs, ...kids) {
    const e = document.createElement(tag);
    if (attrs) for (const k in attrs) {
      const v = attrs[k];
      if (v == null) continue;
      if (k === 'class') e.className = v;
      else if (k === 'html') e.innerHTML = v;
      else if (k.slice(0, 2) === 'on' && typeof v === 'function') e.addEventListener(k.slice(2).toLowerCase(), v);
      else if (k === 'value') e.value = v;
      else e.setAttribute(k, v);
    }
    for (const c of kids) if (c != null) e.appendChild(typeof c === 'string' ? document.createTextNode(c) : c);
    return e;
  }

  function titleScreen() {
    const overlay = document.getElementById('overlay');
    overlay.className = 'hidden'; overlay.innerHTML = '';
    const screen = document.getElementById('screen');
    screen.innerHTML = '';

    const n1 = el('input', { type: 'text', value: 'Player 1', maxlength: '18' });
    const n2 = el('input', { type: 'text', value: 'Player 2', maxlength: '18' });
    const seed = el('input', { type: 'number', placeholder: 'random', style: 'width:140px' });

    function begin() {
      const opts = { names: [n1.value.trim() || 'Player 1', n2.value.trim() || 'Player 2'] };
      if (seed.value !== '') opts.seed = parseInt(seed.value, 10) | 0;
      const game = new eng.Game(opts);
      global.UI.start(game);
    }

    screen.appendChild(el('div', null,
      el('div', { class: 'title-wrap' },
        el('h1', null, 'Conquest of Erathia'),
        el('div', { class: 'sub' }, 'A Heroes of Might & Magic III engine-builder · 2-player hot-seat')
      ),
      el('div', { class: 'center-box panel' },
        el('h2', null, 'New Game'),
        el('div', { class: 'row', style: 'margin-bottom:14px' },
          (() => { const l = el('label', { class: 'fld' }, 'Player 1 name'); l.appendChild(n1); return l; })(),
          (() => { const l = el('label', { class: 'fld' }, 'Player 2 name'); l.appendChild(n2); return l; })(),
          (() => { const l = el('label', { class: 'fld' }, 'Seed (optional)'); l.appendChild(seed); return l; })()
        ),
        el('button', { class: 'primary', style: 'font-size:18px;padding:12px 28px', onClick: begin }, '⚔️  Begin the Conquest'),
        el('div', { class: 'rules' }, rulesHtml())
      )
    ));
  }

  function rulesHtml() {
    const d = el('details', { style: 'margin-top:18px' });
    d.appendChild(el('summary', { style: 'cursor:pointer;color:var(--gold);font-size:16px' }, 'How to play  ▾'));
    const body = el('div', { style: 'margin-top:10px;line-height:1.55;font-size:14px;color:#ddd3ba' });
    body.innerHTML = `
      <p><b>Goal.</b> Forge the mightier dominion. Score the most <b>Glory (★)</b> when the three tracks of
      conquest — <b>🏰 Realm</b> (towns rising), <b>🔮 Sorcery</b> (the Mage Guilds), and
      <b>🗺️ Frontier</b> (the map cleared) — are all maxed out.</p>
      <p><b>Each week:</b> Astrologers proclaim a boon, then 1) <b>Research</b> — draw cards and buy the ones
      you want (3 Gold each). 2) <b>Actions</b> — lords alternate turns; on your turn take as many actions as
      you like, then <b>End Turn</b> (or <b>Pass</b> to sit out the rest of the week). 3) <b>Income</b> — gain
      Gold equal to your <b>Renown</b> + Gold production, plus all other resource production.</p>
      <p><b>Renown</b> rises by 1 every time you advance a track of conquest — it is both your Gold income and Glory.</p>
      <p><b>Resources:</b> 🪙 Gold pays for anything · 🪵 Wood discounts cards with the <i>Building</i> tag (2 Gold each) ·
      💎 Crystal discounts <i>Magic</i> cards (3 Gold each) · 🪨 Ore arms your host (Forge 2 Ore → 3 Recruits) ·
      ⚗️ Mercury is alchemy (Transmute 2 → 2 of any; channel 8 → Sorcery) · ⚔️ Recruits muster armies to raise <i>Towns</i> (advancing Realm).</p>
      <p><b>Card types:</b> 🟩 <b>Structure</b> (a Town building or creature dwelling — plays and stays, passive) ·
      🟦 <b>Power</b> (a Hero, Artifact or active institution — stays and has an ability or trigger) ·
      🟥 <b>Spell</b> (cast once, then discarded). Cards have <i>tags</i> (Building, Creature, Magic, Dragon, Undead…) that
      fuel combos, discounts and goals — note the 🏛️ Building <i>tag</i> is separate from the Structure <i>type</i>.
      <b>Deeds</b> (claim for 8 Gold) and <b>Honors</b> (fund; scored at the end) are each worth big Glory.</p>
      <p>It's hot-seat: when the device passes to the other lord, a screen hides your hand until they're ready.</p>`;
    d.appendChild(body);
    return d;
  }

  global.MAIN = { titleScreen };
  window.addEventListener('DOMContentLoaded', titleScreen);
})(window);
