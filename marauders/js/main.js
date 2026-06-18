/* =====================================================================
 * THE MARAUDERS — bootstrap & title   (main.js)
 * ===================================================================== */
(function (root) {
  'use strict';
  const { data, engine, ui } = root.MAR;

  function titleScreen() {
    const app = document.getElementById('app');
    app.innerHTML =
      '<div class="title">' +
      '  <div class="title-inner">' +
      '    <div class="sigil">✦</div>' +
      '    <h1>THE MARAUDERS</h1>' +
      '    <p class="tag">A co-op exploration of a castle that won\'t hold still.</p>' +
      '    <p class="blurb">The dungeons rearrange themselves every night — no two runs are alike. ' +
      'Slip in as a team of students, light the dark, find the House Cup hidden somewhere deep, ' +
      'pocket what treasure you dare, and sneak back out before the castle catches you.</p>' +
      '    <div class="players"><span>Players at the table:</span>' +
      '      <div class="pbtns">' + [1, 2].map(n => '<button class="pn' + (n === 1 ? ' on' : '') + '" data-n="' + n + '">' + n + '</button>').join('') + '</div>' +
      '    </div>' +
      '    <button class="play">Enter the dungeons ▸</button>' +
      '    <p class="hint">Click anywhere to travel · WASD to step · Space ends the turn</p>' +
      '  </div>' +
      '</div>';
    let chosen = 1;
    app.querySelectorAll('.pn').forEach(b => b.onclick = () => { chosen = +b.dataset.n; app.querySelectorAll('.pn').forEach(x => x.classList.toggle('on', x === b)); });
    app.querySelector('.play').onclick = () => newGame(chosen);
  }

  function gameScreen() {
    document.getElementById('app').innerHTML =
      '<div id="topbar" class="bar"></div>' +
      '<div id="stage"><canvas id="board"></canvas>' +
      '  <div id="hintbar" class="hintbar"></div>' +
      '  <canvas id="minimap"></canvas>' +
      '  <div id="toasts"></div>' +
      '</div>' +
      '<div id="botbar" class="bar"></div>' +
      '<div id="overlay" class="hidden"></div>';
  }

  let seenIntro = false;
  function showIntro(scn, cb) {
    if (seenIntro) return cb();
    seenIntro = true;
    const S = data.SPELLS;
    const known = [];
    for (const p of scn.party) for (const s of p.spells) if (known.indexOf(s) < 0) known.push(s);
    const spellRow = known
      .map(id => '<li><span class="g" style="color:' + S[id].color + '">' + S[id].glyph + '</span><b>' + S[id].name + '</b> — ' + S[id].desc + '</li>').join('');
    const ov = document.getElementById('overlay');
    ov.className = 'ov';
    ov.innerHTML =
      '<div class="handoff intro">' +
      '  <div class="crest">🗝️</div>' +
      '  <h2>The Dungeon Run</h2>' +
      '  <p class="goal">The dungeons beneath Hogwarts rearrange themselves every night — this one has never ' +
      'been walked before. Somewhere past the potion stores and forgotten libraries waits the <b>House Cup</b>. ' +
      'Find it, grab what treasure you dare, and slip back out.</p>' +
      '  <div class="how">' +
      '    <p><b>Moving:</b> click anywhere you\'ve seen and your student travels there turn by turn — or step with WASD/arrows. <b>Space</b> ends the turn, <b>1-3</b> cast spells.</p>' +
      '    <p><b>Stay unseen:</b> the <span style="color:#ff9b6b">orange tiles</span> are what the caretaker\'s cat can see. Break her line of sight behind walls and pillars. Caught = −1 ⭐, lose all three and the run is over.</p>' +
      '    <p><b>The heist:</b> the instant you take the Cup the castle <b>wakes</b> — Filch rises and the hunt quickens. The <b>Marauder\'s Map</b> lights a golden trail back to the way out: run it.</p>' +
      '    <p><b>Discover:</b> cracked walls hide secret chambers; locked doors and rubble hide shortcuts. Your map (top-left) fills in as you explore, and the glowing archway home is always marked.</p>' +
      '    <ul class="spelllist">' + spellRow + '</ul>' +
      '  </div>' +
      '  <button id="begin">Light your wand ▸</button>' +
      '</div>';
    document.getElementById('begin').onclick = () => { ov.className = 'hidden'; cb(); };
  }

  function newGame(players) {
    gameScreen();
    // a fresh dungeon every run — the castle never holds still
    const seed = 1 + Math.floor(Math.random() * 0x7fffffff);
    const scn = data.generate(seed);
    showIntro(scn, () => ui.start(engine.create(scn, { seed }), { players: players || 1 }));
  }

  root.MAR.main = { titleScreen, newGame };
  if (typeof window !== 'undefined') window.addEventListener('DOMContentLoaded', titleScreen);

})(typeof window !== 'undefined' ? window : globalThis);
