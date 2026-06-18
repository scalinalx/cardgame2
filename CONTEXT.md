# CONTEXT — Session Handoff (read this first after a compact)

**Project:** *Conquest of Erathia* — a 2-player **hot-seat**, **browser/local** card+hex-map
engine-builder. Mechanics & structure are **Terraforming Mars**; theme/flavour/content are
100% **Heroes of Might & Magic III**. No build step, no dependencies — plain HTML/CSS/vanilla
JS, runs from `file://` or a tiny static server.

**Date context:** work spans 2026-05-31 → 2026-06-03.

---

## 1. How to run / verify

- **Play:** open `index.html` directly (double-click), or `node server.js` → http://localhost:8123
  - ⚠️ The server tends to die between sessions; restart with `node server.js` or
    `nohup node server.js > /tmp/erathia-server.log 2>&1 &`. The user dislikes leaving it running
    (slows their Mac) — **kill it when done** (`pkill -f "node server.js"`; port 8123).
  - Preview tool (`mcp__Claude_Preview__preview_start name="erathia"`) manages its own server on 8123;
    free the port first if our own server is running.
- **Tests (all headless, Node):**
  - `node test/sim.js 1000` — fuzz: 1000 random full games, asserts invariants + undo. (~17–20 weeks avg.)
  - `node test/uitest.js 30` — drives real `ui.js` render code via a DOM shim through full games.
  - `node test/synergy.js` — audits every trigger / "when X then Y" (25 checks).
  - `node test/balance.js` — flags cards whose cost is far from estimated value.
- **Current status:** ALL TESTS GREEN as of last run (sim 1000 ✓, synergy 25/25 ✓, uitest ✓).

---

## 2. File map

```
index.html        the live, playable game (loads js/*, css/styles.css)
cards.html        standalone card gallery (all 194 cards, filters by type/tag/source) — reuses js/data.js
cards-by-function.html  cards grouped by WHAT THEY DO (Increase Gold production, Instant Gold, Action:
                  transform resources, Advance Realm, Ongoing triggers, Attacks, etc.) — a card appears
                  under every effect it has. Standalone, parses each card's effect ops. reuses js/data.js
ui-lab.html       UI THEME SWITCHER mockup — 5 visual concepts, dropdown (static, not wired)
ui-wood.html      FULL "HOMM3 chrome" UI MOCKUP — 8 screens, map-hero + tabbed panel + hand dock
                  (static mockup; the candidate NEW look — see MANUAL.md §"New UI")
server.js         minimal no-dep static server, port 8123
imgs/card images/ user-made card-art (57). Each card gets a RANDOM one per page-load (stable through a
                  game, reshuffles on reload), shown as a banner via cardFace.
imgs/wonders/     wonder art (12) — random per Wonder, banner in the wonder panel (renderWonder).
imgs/factions/    town art grouped by ALIGNMENT via filename prefix good*/chaotic*/neutral* (6/6/7).
                  Each Town shows a random image from ITS alignment bucket (banner on draft picker).
                  Faction alignments (data.js) are now good (Castle/Rampart/Tower) · chaotic (Inferno/
                  Necropolis/Dungeon) · neutral (Stronghold/Fortress/Conflux). `align` is flavor-only,
                  unused elsewhere; HK.factionImages is an OBJECT {good,chaotic,neutral} of paths.
js/cardimages.js  AUTO-GENERATED manifest of all three folders → HK.cardImages / wonderImages /
                  factionImages (file:// can't list a dir). Rebuild after adding art: node tools/genimages.js
tools/genimages.js  regenerates js/cardimages.js from the three imgs/ subfolders.
                  UI helpers cardArtUrl/wonderArtUrl/factionArtUrl assign+cache a random image per key.
icons/gold-128.svg  hand-made SVG gold coin (wired into the live game, replaces 🪙 emoji)
backups/game-ui-2026-06-02/  snapshot of the live game UI (restore point)
js/data.js        ALL game data: resources, tags, tracks, 9 factions, 239 cards, faction-card
                  lists, secret goals, hex-map pools, 9 wonders, 16 quests, 13 proclamations.
                  Heroes are PROCEDURALLY generated from a diverse loadout pool — every hero unique
                  (meaning-deduped vs named heroes). Faction align = good/chaotic/neutral. An
                  "ENGINE-DEPTH EXPANSION" block adds 45 public cards so every function-category has 8+
                  (scaling per-tag/tile, discard engines, map-VP, track-draw, lumber/ore industry).
js/engine.js      pure rules engine (no DOM, Node-requireable). Game class.
js/ui.js          all DOM rendering + hot-seat flow (the live look)
js/main.js        bootstrap + title screen + rules text
test/*.js         sim / uitest / synergy / balance
README.md         player-facing rules (older, still mostly accurate)
DESIGN_BRIEF.md   the "more exciting, less arithmetic" research synthesis (IN PROGRESS)
MANUAL.md         board-game-style rulebook + current vs new UI description
NANO_BANANA_2_PROMPTING.md  PROVEN prompting bible for Google's Nano Banana 2 (= Gemini 3.1 Flash
                  Image, gemini-3.1-flash-image). Feedable to any LLM to build NB2 prompts.
                  From a verified deep-research pass (25/25 claims, 0 refuted, Google first-party).
CARD_ART_PROMPT.md  Canonical Nano Banana 2 card-art prompts (2 registers: environments + characters),
                  rebuilt from REAL HoMM3 reference art the user supplied. Hard rules: no frame, no
                  text, full-bleed, 1K, painted-not-photo. Includes the hard-won do/don't list.
HOMM3_ART_STYLE.md  Accurate HoMM3 visual-style description + drop-in "style tokens" for image gen
                  (pairs with the NB2 guide). Deep-research pass: 19 confirmed / 6 refuted; clearly
                  separates verified facts (extreme-fantasy, Vallejo/Elmore/Morrill, pre-rendered-3D
                  -to-2D) from flagged extrapolation (palette/UI materials).
CONTEXT.md        this file
```

`js/data.js` and `js/engine.js` are also `require()`-able in Node (that's how tests run).
Both browser globals (`window.HK.data`, `window.HK.engine`, `window.UI`, `window.MAIN`) and
`module.exports` are provided.

---

## 3. What we've built (chronological highlights)

1. **Core game** — TM-style engine reskinned to HOMM3: 6 resources, 3 victory tracks, weeks,
   Renown=income+score, research/buy each week, multi-action turns, milestones/awards, undo.
2. **HOMM3 reskin** — all 9 towns, real HOMM3 resources (Mercury/Ore/etc.), "Weeks" + Astrologer
   **proclamations**, ~100+ HOMM3 cards (creatures, dragons, named heroes, spells, artifacts).
3. **Hex adventure map** — shared 37-hex map; Found Town / Flag Mine / Clear Region place tiles;
   placement bonuses + end-game adjacency VP. Public deck + Town-signature cards. **Secret
   objectives** (drafted at start, hidden, bonus VP). 3-column UI.
4. **More content + Wonders** — 8–9 named heroes per town (82 heroes total), **9 unique 3-stage
   Town Wonders** (alternate end-game, +12 VP each).
5. **Resource identity fix** — Ore = **the Forge** (2 Ore → 3 Recruits), Mercury = **Alchemy**
   (Transmute 2 Mercury → 2 of any). **Quest board** ("Adventures", 16 quests, 3 face-up) — the
   engaging Ore/Mercury sink. Wood/Crystal stayed as *payment substitution* (see open issue A1).
6. **D12 first-player roll**, 3-faction draft (was 2), faction-discount transparency in the modal.
7. **Naming fix** — card TYPE labels renamed: green `auto`→**Structure**, blue `active`→**Power**,
   red `event`→**Spell** (because "Building" the type clashed with the 🏛️ Building *tag*; the tag
   is unchanged and still drives discounts/deeds/wonders).
8. **UI/UX pass** — full-width 3-col layout; bigger hex map; instant body-level `?` tooltips
   (no clipping); collapsible opponent board; resource HUD by the hand; SVG gold coin replacing
   the silver-looking 🪙 emoji EVERYWHERE (board, map, buttons, costs).
9. **Two UI mockups** — `ui-lab.html` (5 themes) and `ui-wood.html` (full HOMM3-chrome redesign:
   ornate red-leather frame, gold filigree, map-as-hero, tabbed command panel, fanned hand dock,
   crimson resource ribbon). **User likes the wood/HOMM3 direction but it's NOT wired into the
   real game yet — it's a static mockup.**
10. **Recent fixes:** Flag-a-Mine cost 25→14; **Wonder completion now grants a final week before
    the game ends** (so the stage-3 "Forever" trigger actually runs) — was useless before.
11. **Research:** 2 deep-research passes on "what makes thematic euros exciting without
    arithmetic" — **BOTH COMPLETE and merged into `DESIGN_BRIEF.md`.** Pass 1 = TM + expansions +
    principles; pass 2 = per-game (Brass, Dune Imperium, Ark Nova, RFTG, 7 Wonders Duel, etc.).
    Plus a parsed noclip HOMM3 transcript. **Net conclusion → DESIGN_BRIEF.md §4:** cut arithmetic
    (Wood/Crystal → passive discounts; screen previews) + add ONE *structural tension* — top pick
    is making the **hex map a contested shared space** (most HOMM3, strongest cross-game pattern,
    low-load, 2p-native); also "tighten the endgame into a visible countdown." NOT bigger combos,
    NOT dense icons, NOT a bare VP race.

---

## 4. OPEN THREADS / next steps (in priority order)

These are *agreed direction, not yet built* — the user's guiding constraint is
**"more exciting AND less arithmetic, WITHOUT adding complexity/systems."**

- **[A1] ✅ DONE (2026-06-04).** Wood = **Sawmill** track, Crystal = **Mana Vault** track —
  Ares-style standing discounts folded into `effectiveCost` (Building/Magic cards cost
  `SAWMILL_RATE`/`MANA_RATE` × level less; both = **2**, named TUNING KNOBS in engine.js).
  `prod.wood`/`prod.crystal` ARE the track levels; the tracks grow only from "+X production"
  sources, never accumulate as stock. Deleted `_subMax`/`defaultPlan`; `_pay` is pure Gold now;
  added `costBreakdown()` for UI transparency. One-time Wood/Crystal **gains & costs** re-pointed
  to Ore (industry) / Mercury (arcane); transmute targets now gold/ore/recruits; proclamations
  Dendroid→+1 Sawmill, Unicorn/Dragon→+1 Mana. UI: play-modal shows a plain breakdown, res-HUD &
  opp-strip render Wood/Crystal as a **level + "−N" discount** (class `.track`). Verified: sim
  1000 ✓, synergy 25/25 ✓, uitest 30/30 ✓, end-to-end discount proof ✓. Decision context:
  user picked "Standing discount track (Ares-style)" over explicit-mixed-costs / 1:1-face-value.
  **Follow-ups (same day):** since Ares-tracks can't be *spent*, Wood/Crystal now GATE content as a
  requirement instead of a cost — `req.prod.wood/crystal` = "Needs Sawmill/Mana Vault N+" (engine
  `_reqOk` relabels those). Applied to Rampart's **World Tree** (Sawmill 1/2/3) and Tower's
  **Celestial Observatory** (Mana Vault 1/2/3) wonders + quests q_manacryst (Mana Vault 1+) &
  q_traderoad (Sawmill 1+). Also: **every completed quest now grants +1 Renown** (`QUEST_RENOWN`
  knob in engine.js, added in `completeQuest`) so adventures always build your legend.
- **[A2] Screen previews everything computable** (net-this-turn, next-week income, glow
  affordable cards). Digital superpower. *Reduces load.*
- **[B1/B2] ONE interactive tension layer:** make the proclamation a *visible-ahead shared event*
  that rewards/punishes your build + surface Deed/Honor **races** loudly; and/or make the hex map
  a *contested adventure* (race rivals to map rewards). *Low load, works at 2p.*
- **[C1] 2-player end-trigger tuning** so the all-maxed path doesn't over-run (~2 turns too long).
- **[B4] One "fire now or save it" planning hook** (Town ultimate / growing hero).
- **Known balance flags** (from `test/balance.js`): Sanctuary of the Grail underpriced (intentional
  capstone); a few engine cards the linear model under-rates.
- **Decision pending:** whether to rebuild the real game UI in the `ui-wood.html` HOMM3-chrome style.
- **More resource SVG icons** — user added `gold-128.svg`; if they add wood/ore/crystal/recruits/
  mercury as `name-128.svg`, wire them in the same way (helpers already exist in ui.js).

---

## 5. User preferences / working style (important)

- Hates approval prompts — `WebFetch` + `WebSearch` are allowlisted in `.claude/settings.local.json`.
- Wants the server KILLED when not actively verifying (perf).
- Strongly anti-complexity: **rejects suggestions that add systems/math**; wants fun via theme,
  interaction, drama, atmosphere — not more accounting. Pushes back hard and is usually right.
- Cares a lot about UI feel ("pull me in," not generic/crowded), real art over emoji, HOMM3 vibe.
- Verify changes (run the tests; check the browser when UI changes) before claiming done.
- Always answer the "why/how does this work" questions precisely from the CODE, not memory.
