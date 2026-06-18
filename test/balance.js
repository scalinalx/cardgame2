/* Rough card valuation to flag cost/benefit outliers. Heuristic, not gospel —
 * it just surfaces cards whose cost is far from their estimated value. */
const d = require('../js/data.js');

const GAIN = { gold: 1, recruits: 2, ore: 1.5, wood: 1.5, crystal: 2.5, mercury: 2 };
const PROD = { gold: 5, recruits: 4.5, ore: 3.5, wood: 3.5, crystal: 5, mercury: 4.5 };

function effVal(effects) {
  let v = 0;
  for (const op of (effects || [])) {
    if (op.gain) for (const k in op.gain) v += op.gain[k] * (GAIN[k] || 1);
    if (op.prod) for (const k in op.prod) v += op.prod[k] * (PROD[k] || 4);
    if (op.global) for (const g in op.global) v += op.global[g] * 8;
    if (op.draw) v += op.draw * 3;
    if (op.vpNow) v += op.vpNow * 4.5;
    if (op.attackProd) v += op.attackProd.n * 4;
    if (op.attackRes) v += op.attackRes.n * 1;
    if (op.addTrigger) v += 9;           // engine card
    if (op.addAction) v += 6;            // repeatable ability
    if (op.gainPerTag) v += 4;
    if (op.prodPerTag) v += 6;
    if (op.gainPerTile) v += 4;
    if (op.store != null) v += 0;
  }
  return v;
}
function vpVal(card) {
  const v = card.vp; if (v == null) return 0;
  if (typeof v === 'number') return v * 4.5;
  return 4; // perStore/perTag/perTile ~ variable, assume modest
}
function reqDiscount(card) {
  if (!card.req) return 0;
  let d2 = 0;
  for (const k of ['realmMin', 'sorceryMin', 'frontierMin']) if (card.req[k]) d2 += card.req[k] * 0.8;
  if (card.req.tags) for (const t in card.req.tags) d2 += card.req.tags[t] * 1.5;
  return d2; // gated cards may be priced a bit below raw value
}

const rows = [];
for (const c of d.CARDS) {
  if (c.type === 'event') continue; // spells are one-shot; value model differs
  const val = effVal(c.effects) + vpVal(c) + (c.protect ? 6 : 0);
  const fair = Math.max(0, val - reqDiscount(c)) - 2; // ~2 engine margin
  const diff = c.cost - fair; // negative = underpriced (too good), positive = overpriced
  rows.push({ id: c.id, name: c.name, cost: c.cost, val: +val.toFixed(1), fair: +fair.toFixed(1), diff: +diff.toFixed(1), fac: d.CARD_FACTION[c.id] || '' });
}
rows.sort((a, b) => a.diff - b.diff);
const pad = (s, n) => String(s).padEnd(n);
console.log(pad('CARD', 26) + pad('cost', 6) + pad('value', 7) + pad('fair', 7) + pad('diff', 7) + 'faction');
console.log('--- UNDERPRICED (too strong for cost; diff << 0) ---');
for (const r of rows.filter(r => r.diff <= -5)) console.log(pad(r.name, 26) + pad(r.cost, 6) + pad(r.val, 7) + pad(r.fair, 7) + pad(r.diff, 7) + r.fac);
console.log('--- OVERPRICED (weak for cost; diff >> 0) ---');
for (const r of rows.filter(r => r.diff >= 5)) console.log(pad(r.name, 26) + pad(r.cost, 6) + pad(r.val, 7) + pad(r.fair, 7) + pad(r.diff, 7) + r.fac);
