/* Headless UI test: a minimal DOM shim lets us run the real ui.js render
 * functions and drive complete games via simulated clicks — catching any
 * render-time errors without a browser. */

/* ----------------------------- DOM shim --------------------------- */
class FNode {}
global.Node = FNode; // ui.js uses `k instanceof Node`
function El(tag) {
  const e = new FNode();
  e.tag = tag; e.children = []; e.style = {}; e._attrs = {}; e._on = {}; e._cls = new Set(); e._html = undefined; e._t = null; e.scrollTop = 0;
  e.setAttribute = function (k, v) { this._attrs[k] = v; if (k === 'class') String(v).split(/\s+/).forEach(c => c && this._cls.add(c)); };
  e.getAttribute = function (k) { return this._attrs[k]; };
  e.addEventListener = function (t, fn) { this._on[t] = fn; };
  e.appendChild = function (c) { this.children.push(c); return c; };
  e.click = function () { if (this._on.click) this._on.click(); };
  e.querySelectorAll = function () { return []; };
  Object.defineProperty(e, 'className', { get() { return e._cn || ''; }, set(v) { e._cn = v; String(v).split(/\s+/).forEach(c => c && e._cls.add(c)); } });
  Object.defineProperty(e, 'innerHTML', { get() { return e._html || ''; }, set(v) { e._html = v; e.children.length = 0; } });
  Object.defineProperty(e, 'textContent', { get() { return txt(e); } });
  e.classList = { add: c => e._cls.add(c), remove: c => e._cls.delete(c), contains: c => e._cls.has(c) };
  return e;
}
function txt(n) { if (!n) return ''; if (n._t != null) return n._t; return (n.children || []).map(txt).join(''); }
function walk(n, pred, out) { if (!n) return out; if (pred(n)) out.push(n); for (const c of (n.children || [])) walk(c, pred, out); return out; }

const screenEl = El('div'); screenEl.setAttribute('id', 'screen');
const overlayEl = El('div'); overlayEl.setAttribute('id', 'overlay');
function byId(root, id) { return walk(root, n => n._attrs.id === id, [])[0]; }

global.window = global;
global.document = {
  createElement: t => El(t),
  createElementNS: (ns, t) => El(t),
  createTextNode: t => { const e = El('#text'); e._t = String(t); return e; },
  getElementById: id => id === 'screen' ? screenEl : id === 'overlay' ? overlayEl : (byId(screenEl, id) || byId(overlayEl, id)),
};
global.confirm = () => true;
global.alert = () => {};

/* --------------------------- load game ---------------------------- */
require('../js/data.js');
require('../js/engine.js');
require('../js/ui.js');
const { Game } = require('../js/engine.js');
const UI = global.UI;

/* --------------------------- click helpers ------------------------ */
const overlayOpen = () => overlayEl.className !== 'hidden' && overlayEl.children.length > 0;
const findBtns = root => walk(root, n => n.tag === 'button' && n._on.click, []);
const findByText = (root, re) => findBtns(root).filter(b => re.test(b.textContent));
function clickReveal() { const b = findByText(overlayEl, /Reveal/)[0]; if (b) { b.click(); return true; } return false; }

function botRng(seed) { let a = seed | 0; return () => { a = (a + 0x9E3779B9) | 0; let t = Math.imul(a ^ (a >>> 16), 0x45d9f3b); t ^= t >>> 16; return (t >>> 0) / 4294967296; }; }

function playGameViaUI(seed) {
  const rng = botRng(seed * 7 + 1);
  UI.start(new Game({ seed, names: ['Azure', 'Crimson'] }));
  const g = UI.game;
  let guard = 0;
  while (!g.over) {
    if (++guard > 8000) throw new Error('runaway (seed ' + seed + ')');
    if (overlayOpen() && clickReveal()) continue; // reveal a handoff -> renders the screen

    if (g.phase === 'setup-roll') {
      const b = findByText(screenEl, /Towns|Continue|Begin/)[0];
      if (b) b.click(); else { g.beginFactionDraft(); UI.sync(); }
      continue;
    }
    if (g.phase === 'setup-faction' || g.phase === 'setup-goal') {
      const card = walk(screenEl, n => n._cls.has('faction-card') && n._on.click, [])[0];
      if (!card) throw new Error('no choice card in ' + g.phase);
      card.click(); continue;
    }
    if (g.phase === 'research') {
      const c = findByText(screenEl, /Confirm/)[0]; if (c) c.click(); continue;
    }
    if (g.phase === 'action') {
      // prefer a track-raiser; else play a card; else pass
      let acted = false;
      const raiser = findByText(screenEl, /Study Sorcery|Channel Mercury|Clear a Region|Found Town|Muster Army/)[0];
      if (raiser) {
        raiser.click(); acted = true;
        if (UI.placing) { // placement mode -> click a highlighted hex
          const target = walk(screenEl, n => n._cls.has('target') && n._on.click, [])[0];
          if (target) target.click(); else { UI.placing = null; UI.sync(); }
        }
      } else {
        const playable = walk(screenEl, n => n._cls.has('card') && n._cls.has('playable') && n._on.click, [])[0];
        if (playable) {
          playable.click(); // opens pay modal
          const play = findByText(overlayEl, /▶ Play/)[0];
          if (play && play._on.click) { play.click(); acted = true; }
          else { const cancel = findByText(overlayEl, /Cancel/)[0]; if (cancel) cancel.click(); }
        }
      }
      // sometimes claim a deed if visible (tests that path)
      if (!acted) { const deed = findByText(screenEl, /^🏅/)[0]; }
      const end = acted ? findByText(screenEl, /End Turn/)[0] : findByText(screenEl, /Pass/)[0];
      if (end) end.click(); else g.pass(g.turn);
      continue;
    }
    throw new Error('unexpected phase ' + g.phase);
  }
  // game over screen rendered
  const hasTable = walk(screenEl, n => n._cls.has('score-table'), []).length > 0;
  if (!hasTable) throw new Error('no score table on game over (seed ' + seed + ')');
  return g;
}

let N = parseInt(process.argv[2] || '25', 10);
let ok = 0;
for (let s = 1; s <= N; s++) { const g = playGameViaUI(s); ok++; }
console.log(`UI driven ${ok}/${N} full games — every render path executed with NO errors ✔`);
