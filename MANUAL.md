# ⚔️ Conquest of Erathia — Game Manual

*A Heroes of Might & Magic III engine-builder for 2 lords, played hot-seat on one screen.*
*(Mechanics in the spirit of Terraforming Mars; everything else is Erathia.)*

> This manual describes the game **as currently implemented** (`index.html` + `js/*`). It reads
> like a tabletop rulebook. A separate section at the end describes the **UI** — both the live
> look and the prepared "HOMM3 chrome" redesign (`ui-wood.html`).

---

## 1. Overview & Goal

Two rival lords develop the realm of Erathia over a series of **Weeks**. You build an engine of
**Town Buildings, Creature Dwellings, Heroes, Artifacts and Spells**, raise **Towns** and claim
the wild map, and advance three shared tracks of conquest. The lord with the most **Glory (★)**
when the game ends **wins**.

**Two ways the game ENDS** (neither is an automatic win — they only stop the clock):
1. All **three Dominion tracks** are maxed (🏰 Realm 14, 🔮 Sorcery 14, 🗺️ Frontier 9), **or**
2. A lord **completes their Town Wonder** — which then runs one final Week, *then* the game ends.

When triggered, the game finishes the current obligations and **scores**. Most Glory wins
(tiebreak: most Gold). **You can max the tracks and still lose on Glory** — maxing is a timer,
not a victory.

---

## 2. Components (the data)

- **6 Resources:** 🪙 Gold · 🪵 Wood · 🪨 Ore · 💎 Crystal · ⚔️ Recruits · ⚗️ Mercury
- **3 Dominion tracks:** 🏰 **Realm** (max 14) · 🔮 **Sorcery** (max 14) · 🗺️ **Frontier** (max 9)
- **Renown** — starts at 20; rises +1 each time you advance any track. It is **both** your weekly
  Gold income **and** counted as Glory.
- **9 Tags** (drive combos/discounts/goals): building, creature, magic, might, dragon, undead,
  beast, wealth, hero.
- **194 cards**, of three **types** (the colour = behaviour, NOT the same as the Building *tag*):
  - 🟩 **Structure** (78) — a Town building or creature dwelling. Plays and stays; passive.
  - 🟦 **Power** (100) — a **Hero**, **Artifact**, or active institution. Stays; has an ability
    or ongoing trigger. *(82 of these are named heroes; the rest are artifacts/engine cards.)*
  - 🟥 **Spell** (16) — cast once for an effect, then discarded.
- **9 Towns (factions)**, each with a unique start + passive + signature card deck (below).
- **A shared 37-hex Adventure Map.**
- **5 Deeds**, **5 Honors**, **12 Secret Objectives**, **9 Town Wonders**, **16 Adventures (quests)**,
  **13 Astrologer Proclamations**.

---

## 3. The Nine Towns (factions)

Each lord drafts ONE (from 3 offered). Sets starting resources + a passive (and sometimes a
once-per-week ability). Each town also has a **signature deck** of heroes/creatures only it can field.

| Town | Start & Passive |
|---|---|
| **Castle** | 47 Gold, +1 Recruit prod. Building cards cost 2 Gold less. |
| **Rampart** | 40 Gold, 3 Wood, +1 Wood & +1 Recruit prod. Mustering a Town costs only 6 Recruits. |
| **Tower** | 40 Gold, 3 Mercury, +1 Crystal prod. Magic cards −3 Gold. Ability: 1 Mercury → draw a card. |
| **Inferno** | 43 Gold, +1 Mercury prod. Advance Sorcery → gain 2 Gold. |
| **Necropolis** | 38 Gold, 4 Recruits, +1 Recruit prod. Necromancy: discard a card → gain 1 Recruit. |
| **Dungeon** | 44 Gold, 2 Crystal. Dragon & Creature cards −3 Gold. Ability: 4 Gold → 1 Mercury. |
| **Stronghold** | 46 Gold, +1 Ore prod. Creature cards −2 Gold. Play a Might card → gain 3 Gold. |
| **Fortress** | 42 Gold, +1 Ore & +1 Recruit prod. Beast cards −3 Gold; play a Beast → gain 1 Recruit. |
| **Conflux** | 41 Gold, 2 Mercury, +1 Mercury prod. Advance Sorcery → draw a card. |

---

## 4. Setup

1. **Roll the D12** for first player: 1–6 → Player 1, 7–12 → Player 2. (Shown with a golden die.)
2. **Draft Towns:** first player picks 1 of 3 offered Towns; then the other lord.
3. **Draft a Secret Objective:** each lord is offered 2, keeps 1 hidden (worth 6★ if met at game end).
4. **Opening hand:** each lord draws and **buys** cards (3 Gold each) in the first Research step.

---

## 5. A Week (the round)

Each Week has three phases:

### 5a. Astrologers' Proclamation
A flavour event — "Astrologers proclaim the Week of the …" — currently a **symmetric boon**
applied equally to both lords (e.g. *Week of the Griffin: each lord gains 2 Recruits*). 13 exist.

### 5b. Research (buy cards)
Each lord (privately, behind a hot-seat hand-off screen) draws cards and **keeps the ones they
buy at 3 Gold each**; the rest are discarded. (Opening Week deals more; later Weeks deal 3 public
+ 1 signature card.)

### 5c. Action phase (alternating turns)
Lords alternate turns. On **your turn** you may take **as many actions as you like**, then
**End Turn** (pass control) or **Pass** (sit out the rest of the Week and collect income).
When **both** lords have passed, the Week ends.

**Actions available on your turn:**
- **Play a card** from hand (pay its cost; Structures/Powers stay, Spells resolve & discard).
- **Adventure Map projects** (place a tile on a hex you choose):
  - **Found Town** (23 Gold) → +1 Realm, +1 Renown, raise a Town (1 VP tile).
  - **Clear a Region** (18 Gold) → +1 Frontier, +2 Gold plunder, flag a Region.
  - **Flag a Mine** (14 Gold) → +1 production of that hex's resource, claim a Mine.
  - **Build Mage Guild** (11 Gold) → +1 Mercury production. *(instant, no tile)*
  - **Study Sorcery** (14 Gold) → +1 Sorcery, +1 Renown. *(instant, no tile)*
- **Muster Army → Town** (spend 8 Recruits, or 6 for Rampart) → raise a Town (+1 Realm).
- **Forge** (spend 2 Ore → gain 3 Recruits). *(Ore's identity: arming your host.)*
- **Channel Mercury** (spend 8 Mercury → +1 Sorcery).
- **Transmute** (spend 2 Mercury → 2 of any chosen resource). *(Mercury's identity: alchemy.)*
- **Use abilities** — Hero/Power once-per-week abilities (⚡) and your Town ability.
- **Embark on an Adventure** — complete a face-up quest (below).
- **Build a Wonder stage** (below).
- **Claim a Deed** (8 Gold) / **Fund an Honor** (8/14/20 Gold) — public goals (below).
- **Sell** an unwanted hand card for 2 Gold. **Undo** anything done this turn (until you end it).

### 5d. Income (end of Week, automatic)
Each lord gains: **Gold = Renown + Gold production**, plus the production value of every other
resource. Then the next Week begins (unless an end-trigger fired).

---

## 6. Resources — what each is FOR (each has a distinct role)

- 🪙 **Gold** — pays for anything.
- 🪵 **Wood** — helps pay **Building** cards (worth 2 Gold each toward the cost). *(payment substitution)*
- 💎 **Crystal** — helps pay **Magic** cards (worth 3 Gold each). *(payment substitution)*
- 🪨 **Ore** — **the Forge**: 2 Ore → 3 Recruits (arm your host); funds war Adventures & Wonder stages.
- ⚗️ **Mercury** — **Alchemy**: Transmute 2 → 2 of any resource; Channel 8 → +1 Sorcery; powers magic
  Adventures, Wonders & abilities.
- ⚔️ **Recruits** — muster armies to raise **Towns** (advancing Realm).

> *Design note (open issue A1): Wood & Crystal are currently "substitution math you compute." The
> planned change is to make them flat passive discounts on Building/Magic cards to cut arithmetic.*

---

## 7. The Adventure Map

A single shared map of 37 hexes. Each hex has up to two latent properties shown by small icons:
- **Mine** (a resource icon): you only get it if you **Flag a Mine** there → +1 production of
  that resource, forever.
- **Immediate bonus** (a second icon): a one-time payout that fires when you place **any** tile
  there (Town, Mine, or Region) — e.g. +4 Gold, +2 Recruits, draw a card.

Placing a tile adjacent to a **Region** also yields **+2 Gold plunder per adjacent Region**.

**End-game map scoring:** **Town = 1★**, **Mine = 1★ + 1★ per adjacent Town**, Region = 0★ (Regions
already paid you during play). → Cluster Mines next to Towns.

---

## 8. Adventures (the quest board)

A shared row of **3 face-up Quests** (from a 16-card deck). On your turn, complete one outright:
meet its **requirement** (tags/tracks you already hold — nothing spent) and pay its **cost** (often
Ore or Mercury) → take the reward: resources, Glory, or a permanent **Saga** ("when you do X, gain
Y"). The board refills; rivals race you for the best ones. *(This is the engaging Ore/Mercury sink.)*

---

## 9. Town Wonders (alternate end-game)

Each Town can raise a unique **3-stage Wonder** (e.g. Castle's *Grand Cathedral*, Dungeon's
*Dragon Spire*). Each stage is a turn action with its own escalating **cost + requirement** and an
immediate reward; the **final stage grants a permanent synergy trigger** plus a flat **12 Glory**.

**Completing a Wonder triggers the end-game — but its powers run for ONE more full Week before the
game stops.** (This was recently fixed: previously the game ended the same Week, making the final
"Forever" bonus useless. Now the builder gets to actually run it, and the rival gets one Week to
respond.) If the three tracks are already maxed, that trigger still ends the game that Week.

---

## 10. Goals & Scoring

**Public goals** (compete openly):
- **Deeds** (5 exist: Master Builder, Archmage, Warlord, Conqueror, Magnate, Pathfinder) — first to
  meet one may **claim** it for 8 Gold; worth **5★**. Max 3 claimed per game.
- **Honors** (5: Lord of the Land, Treasurer, Grand Mage, Field Marshal, Master of the Realm) — pay
  to **fund** (8/14/20 Gold by order). Judged at game end: leader **5★**, runner-up **2★**. Max 3 funded.

**Private goal:** your **Secret Objective** (drafted at start, hidden) — **6★** if met at game end.

**Glory (★) = total score** =
Renown + card VP + map tiles (Town/Mine adjacency) + Spell bonuses + claimed Deeds + Honors +
Secret Objective + completed Wonder (12). **Tiebreak: most Gold.**

---

## 11. Hot-seat etiquette

When control passes to the other lord (a new turn, or a research step), a **"pass the device"**
screen hides the previous hand until the next player taps **Reveal**. The opponent's board is
**collapsed by default** on your turn (click the » chevron to peek).

---

# 🖥️ The UI

## A. Current (live) UI — `index.html`

A **full-width 3-column layout**:
- **Left rail:** "Your Turn" action panel (Adventure-map projects, Muster/Forge/Channel, Transmute,
  abilities) + the **Adventures** quest board.
- **Centre:** the **hex Adventure Map** (the hero element, terrain-tinted, owner-coloured tile
  tokens), the **Hand** directly beneath it with a **resource HUD**, then End Turn / Pass / Undo,
  then the player boards (active full; opponent collapsible).
- **Right rail:** **Your Wonder** (3 stages + Build), **Goals** (the 3 tracks as the *end-trigger*,
  Deeds, Honors, your Secret), and the **Chronicle** log.
- **Polish:** instant body-level `?` tooltips (never clipped); a hand-drawn **SVG gold coin**
  (`icons/gold-128.svg`) replacing the silver-looking 🪙 everywhere; dark fantasy-parchment styling.
- **Card types** read **Structure / Power / Spell**; tags shown as colour-tinted chips.

Theme: dark stone + gold + parchment. Functional and clean, but the user finds it a bit
**generic/crowded** and not yet "pulling them in."

## B. Prepared NEW UI — `ui-wood.html` (the "HOMM3 chrome" redesign)

A **static mockup** (sample data, not wired to the engine) the user **likes the direction of**. It
restructures and re-skins toward an authentic HOMM3 adventure-screen feel:
- **Map as the hero** of a focused scene; everything else (Actions / Wonder / Goals / Quests / Log)
  tucked into a **single tabbed command panel** beside it — far less crowded than the 3-rail live UI.
- **Hand sits in a fanned dock** at the bottom like a real card game; cards are large with breathing
  room and clear tag chips.
- **Crimson resource ribbon** (the iconic HOMM3 bottom bar) with gilt-framed icons.
- **Hand-built SVG icon set** (coins, gems, crossed-swords for Recruits, alembic for Mercury, ore
  ingots, wood; the three tracks as engraved jewels) — kills most emoji.
- **8 screens** reachable via a top "SCREEN ▸" nav: Title, D12 Roll, Town Draft, Research, In-Game
  Board, Play-card Modal, Hot-seat Handoff, Game Over.
- Earlier ornate variant (red-leather frame + gold filigree + gem studs) lives in git history of the
  same file; the current version favours focus/decluttering over maximal ornamentation.

**Status:** design candidate only. **Not** ported into the real game. Open decision: whether to
rebuild `index.html`/`css/styles.css` in this style. (`ui-lab.html` holds 5 alternative theme
concepts behind a dropdown if a different direction is wanted.)

---

## C. Where the design is heading

See `DESIGN_BRIEF.md` for the research-backed plan to make the game **more exciting AND less
math-heavy without adding complexity**: cut arithmetic (Wood/Crystal → passive discounts; screen
previews everything), add ONE interactive tension layer (proclamation → visible shared event +
loud Deed/Honor races; contested map), tune the 2-player endgame, and add a "fire now or save it"
planning hook. The guiding rule: **favour drama, interaction, anticipation and theme over more
accounting.**
