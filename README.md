# Conquest of Erathia — The Card Game

A local, 2-player **hot-seat** card game for one machine. It's an engine-builder in
the spirit of *Terraforming Mars*, with theme, content and mechanics drawn from
*Heroes of Might & Magic III*: rival lords race to develop their realm — raising
**Civilization**, flooding the world with **Arcane** magic, and **Taming the wild
lands** — by playing buildings, creature dwellings, heroes, artifacts and spells.

No installation, no build step, no internet. Pure HTML/CSS/JavaScript.

---

## How to run

**Option A — just open it.** Double-click `index.html` (or drag it into a browser).
It runs straight from `file://`.

**Option B — tiny local server** (only needed if your browser is strict about
`file://`):

```bash
cd cardgame2
python3 -m http.server 8000
# then open http://localhost:8000
```

Best on a desktop browser (Chrome/Firefox/Safari). Designed for two people sharing
one screen — a hand-off screen hides each player's hand when the device passes.

---

## How to play (quick rules)

**Goal.** Score the most **Glory (★)**. The conquest ends after the week in which all
three tracks of dominion are maxed: **🏰 Realm 14** (towns rising), **🔮 Sorcery 14**
(the Mage Guilds), **🗺️ Frontier 9** (the map cleared).

**Setup.** A **D12** is rolled for first player (1–6 → P1, 7–12 → P2). Each lord then
drafts one of **three** offered **Towns** — all nine are present: Castle, Rampart, Tower,
Inferno, Necropolis, Dungeon, Stronghold, Fortress, Conflux — secretly drafts an
objective, and buys cards from an opening hand (3 Gold each).

**Each week:**
0. **Astrologers proclaim** the *Week of the …* — a small, even-handed boon to both lords.
1. **Research** — draw cards, buy the ones you want (3 Gold each).
2. **Actions** — lords alternate turns. On your turn take *as many actions as you like*,
   then **End Turn**, or **Pass** to sit out the rest of the week.
3. **Income** — gain Gold equal to your **Renown** + Gold production, plus every other
   resource's production.

**Renown** rises by 1 each time you advance a track of conquest. It is both your Gold
income *and* counted as Glory (the Terraform-Rating equivalent).

**Resources** (HOMM3's own — each with a distinct role, no two are clones)
- 🪙 **Gold** — pays for anything.
- 🪵 **Wood** — discounts *Building* cards (worth 2 Gold each toward their cost).
- 💎 **Crystal** — discounts *Magic* cards (worth 3 Gold each toward their cost).
- 🪨 **Ore** — *the Forge*: smelt 2 Ore → 3 Recruits to arm your host; funds war Adventures & Wonder stages.
- ⚗️ **Mercury** — *Alchemy*: Transmute 2 Mercury → 2 of **any** resource (the wildcard); Channel 8 → Sorcery; powers magic Adventures, Wonders & abilities.
- ⚔️ **Recruits** — muster armies to raise **Towns** (each advances Realm).

**Actions on your turn** (all laid out in the always-visible **action panel**)
- Play a card (a 🟩 Structure, 🟦 Power, or 🟥 Spell).
- Use a Hero/Power **ability** (⚡ on a card in play) or your **Town ability**.
- **Adventure Map** — Found Town / Clear Region / Flag Mine place a tile on a **hex you
  pick**; Build Mage Guild & Study Sorcery are instant.
- **Embark on an Adventure** — complete a quest from the shared face-up board.
- **Build a Wonder stage**; **Forge** (2 Ore → 3 Recruits); **Transmute** (2 Mercury → 2 of any).
- **Conversions**: 8 (or 6) Recruits → Town (Realm); 8 Mercury → Sorcery.
- **Claim a Deed** (8 Gold, 5★ — only 3 per game) or **Fund an Honor** (8/14/20 Gold;
  scored at the end, 5★ leader / 2★ runner-up).
- **Sell** an unwanted card for 2 Gold; **↶ Undo** anything done this turn.

**Adventures (the quest board).** A shared, face-up row of **3 Quests**. On your turn you
complete one outright: meet its requirement (tags/tracks you *already hold* — nothing
spent) and pay its cost (often **Ore** or **Mercury**), then take the reward — resources,
Glory, or a permanent **Saga** (an ongoing "when you do X, gain Y" bonus). The board
refills and rivals race you for the best ones. *Recover the Sword of Hellfire — pay 4
Mercury → Saga: when you play a Magic card, gain 2 Gold.*

**The hex adventure map.** A single shared map of hexes. Placing a tile grants that
hex's one-time bonus plus **2 Gold per adjacent Region**. Some hexes are **mines** —
flag one for +1 production of that resource. At the end, **Towns score 1★** and
**Mines score 1★ + 1★ per adjacent Town**, so cluster your kingdom.

**Cards: public pool + Town-signature.** Everyone draws from a shared common deck;
each Town *also* has its own signature creatures & heroes (Archangels for Castle, Black
Dragons for Dungeon, Liches for Necropolis…) that only it can recruit.

**Goals.**
- **Public** — the 3 conquest tracks (shared win condition) plus the competitive
  **Deeds** & **Honors**.
- **Private** — at the start each lord secretly **drafts one objective** (e.g. *Dragonlord*,
  *Necromancer*, *Emperor*); meeting it by game end is worth bonus Glory.

**Town Wonders — an alternate way to win.** Each Town can raise a unique 3-stage
**Wonder** (Castle's Grand Cathedral, Tower's Celestial Observatory, the Dragon Spire…).
Each stage is a turn action with its own cost + requirement and an immediate reward;
the final stage grants a permanent synergy + a flat **12 Glory** (identical for every
Wonder) and **ends the game** — once any Wonder is finished, the conquest ends after
both lords pass. So you can race the three tracks *or* race your Wonder.

**Heroes.** Each Town has its own roster of ~9 named HOMM3 heroes (Crag Hack, Solmyr,
Sandro, Mutare, Tazar…) — faction-locked **Powers** with once-per-week abilities or
passives.

**Card types** (the coloured label = how a card *behaves*; not to be confused with the 🏛️
Building *tag*):
- 🟩 **Structure** — a Town building or creature dwelling. Plays its effect and stays; passive.
- 🟦 **Power** — a Hero, Artifact or active institution. Stays in play and has an ability or
  ongoing trigger you interact with.
- 🟥 **Spell** — cast once for an effect, then discarded.

**Scoring (Glory):** Renown + card ★ + map (Towns/Mines adjacency) + spell bonuses +
Deeds (5★) + Honors + Secret Objective + Wonder (12★). Tiebreaker: most Gold.

---

## Project layout

```
index.html        — page shell, loads the scripts (classic <script>, no bundler)
css/styles.css    — fantasy parchment/stone theme
js/data.js        — resources, tags, factions, cards, milestones, awards (data + effect vocabulary)
js/engine.js      — pure rules engine (no DOM); also runnable under Node
js/ui.js          — DOM rendering + hot-seat turn/hand-off flow
js/main.js        — title screen + bootstrap
test/sim.js       — headless fuzz test: plays many random full games, checks invariants
```

The engine is deliberately DOM-free and data-driven, so it can be exercised without a
browser.

## Testing

```bash
node test/sim.js 1000     # play 1000 random complete games, assert invariants
node test/uitest.js 50    # drive 50 full games through the real UI (headless DOM)
node test/synergy.js      # audit every trigger / "when X then Y" synergy
node test/balance.js      # flag cards whose cost is far from their value
```

It verifies resources never go negative, parameters stay in range, undo restores
state exactly, and every game reaches a valid finish with computed scores.

## Notes / scope

- The adventure map is abstracted into tile counters (towns founded / mines flagged /
  regions cleared) rather than a hex board — the focus is the card/economy engine.
- Spells resolve once and are discarded; Structures (Town buildings & creature dwellings)
  and Powers (Heroes, Artifacts & active institutions) stay in play.
- Astrologer proclamations are flavour layered on TM's generation structure: each
  weekly boon is symmetric (applied equally to both lords), so balance is untouched.
- Want a specific HOMM3 creature, hero, spell or Town added? Cards live as plain
  data objects in `js/data.js` using a small effect vocabulary documented at the top
  of that file — easy to extend.
