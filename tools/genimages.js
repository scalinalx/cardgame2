/* Regenerate js/cardimages.js from the imgs/ folders.
   Run after adding/removing art:  node tools/genimages.js
   - imgs/card images/  -> g.HK.cardImages    (random art per card)
   - imgs/wonders/      -> g.HK.wonderImages  (random art per Wonder)
   - imgs/factions/     -> g.HK.factionImages (random art per Town/faction) */
const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..');
const IMG = /\.(png|jpe?g|webp|gif|avif)$/i;
function list(sub) {
  const dir = path.join(root, 'imgs', sub);
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir).filter(f => IMG.test(f)).sort().map(f => 'imgs/' + sub + '/' + f);
}
const cards = list('card images');
const wonders = list('wonders');
// Faction images are grouped by alignment via filename prefix: good* / chaotic* / neutral*.
function listFactionsByAlign() {
  const out = { good: [], chaotic: [], neutral: [] };
  for (const p of list('factions')) {
    const m = /\/(good|chaotic|neutral)/i.exec(p);
    if (m) out[m[1].toLowerCase()].push(p);
  }
  return out;
}
const factions = listFactionsByAlign();
const js = `/* AUTO-GENERATED image manifests. Regenerate after adding images: node tools/genimages.js */
(function (g) {
  g.HK = g.HK || {};
  g.HK.cardImages = ${JSON.stringify(cards)};
  g.HK.wonderImages = ${JSON.stringify(wonders)};
  g.HK.factionImages = ${JSON.stringify(factions)};
  if (typeof module !== "undefined" && module.exports) module.exports = { cardImages: g.HK.cardImages, wonderImages: g.HK.wonderImages, factionImages: g.HK.factionImages };
})(typeof window !== "undefined" ? window : globalThis);
`;
fs.writeFileSync(path.join(root, 'js', 'cardimages.js'), js);
const fc = factions.good.length + factions.chaotic.length + factions.neutral.length;
console.log('wrote js/cardimages.js: ' + cards.length + ' card, ' + wonders.length + ' wonder, ' + fc + ' faction images (good ' + factions.good.length + ' / chaotic ' + factions.chaotic.length + ' / neutral ' + factions.neutral.length + ')');
