# Conquest of Erathia — Design Brief: "More Exciting, Less Arithmetic"

*Synthesizes: deep-research pass 1 (TM + expansions + general euro excitement principles),
the noclip HOMM3 Hall-of-Fame transcript, and deep-research pass 2 (per-game analysis of
Brass, Dune Imperium, Ark Nova, Arnak, Gaia, GWT, Concordia, Wingspan/RFTG, 7 Wonders Duel).
**Both research passes complete and merged.** §4 priority list re-ranked with pass-2 evidence.*

> **The problem we're solving (player feedback):** "Easy to get into, but feels like a
> lot of mental arithmetic, and isn't quite exciting/engaging enough."

---

## 0. The reframe that drives everything

**Excitement and arithmetic are DECOUPLED.** (Pass-1 finding, 3-0 verified.)
- What makes deep euros thrilling — agency, the growth-arc "click," interaction, planning
  hooks — is *mechanically separate* from what makes them feel like bookkeeping (tracking
  many resources, per-card conversions, holding passive effects in your head).
- Terraforming Mars proves it: reviewers *love* its engine and *complain* about its math as
  **two different things.** So we don't trade one for the other — **we amplify the fun while
  cutting the math.**

The HOMM3 transcript independently says the same thing from the player side: HOMM3 is "like
a board game but **way better than any board game**" — and the reasons given are *theme, a
contested living map, momentum ("one more turn"), and atmosphere* — **never "deeper math."**

---

## 1. CUT THE ARITHMETIC (load problem, not a fun problem)

All REDUCE load; none reduce depth.

| # | Technique | Source | Maps onto our game |
|---|---|---|---|
| A1 | **Replace spendable/convertible resources with flat standing discounts.** Ares Expedition turned TM's steel/titanium from "stockpile then convert per-card at a rate" into *permanent passive discounts* — deleting a whole layer of per-card math while keeping tag-synergy depth. (3-0; the "loses depth" counter-claim was REFUTED 0-3.) | Pass 1 | **This is our Wood/Crystal (and Ore/Mercury) substitution math exactly.** Players currently compute "how many Wood at ×2 + Gold covers this." Converting Wood/Crystal to *passive discounts on Building/Magic tags* is the single biggest math cut available. |
| A2 | **Externalize ALL state into persistent, visible components** so nothing lives in working memory (Nielsen Norman Group — top-tier UX source). | Pass 1 | We're digital → our superpower. Anything a player computes, the screen should show: net-this-turn preview, next-week income, glow affordable / dim unaffordable cards. The board game *can't*; we can, free. |
| A3 | **Iconography is double-edged** — clean tested icons reduce load; clever-but-opaque ones *increase* it. TM cited *by name* as the icon-soup cautionary tale. | Pass 1 | Our move to real SVG icons is right; risk is adding *more* symbols, not clearer ones. |
| A4 | **Don't expect faster turn structure to fix math.** Ares' 2-player mode: fewer phases → more rounds → *more* to track ("back-alley accountant… grind"). Attack math at the resource/icon layer, not by reshuffling turns. | Pass 1 | Cut the per-turn computation itself; don't just add/relayer systems. |

---

## 2. ADD EXCITEMENT (mostly without adding load)

Ranked for a **2-player** TM-like.

| # | Technique | Adds load? | Source | Maps onto our game |
|---|---|---|---|---|
| B1 | **Direct, all-affecting interaction + adaptive tension** — the #1 lever for "solitaire / not exciting." TM's Turmoil model: shared events hitting *both* players + a *contested position* they jockey over → "direct competition, opportunities to disrupt." **Trap:** Turmoil added too many phases (→ AP). Winning recipe: **shared-event + contested-position tension, minimal rules, events visible ~3 turns ahead** so players plan instead of freeze. | LOW if done right | Pass 1 + transcript | Our **proclamation** is the perfect existing hook — currently a flat symmetric boon. Make it a **visible-in-advance shared event that rewards/punishes what you've built.** Plus surface the **Deed/Honor races loudly** ("Roland is 1 Magic tag from Archmage"). |
| B2 | **The contested shared MAP as the engine of excitement.** The HOMM3 transcript is ~80% about the adventure map: racing rivals to resources, Pandora's Boxes, obelisks revealing a buried Grail, two-way teleporters → "they can sneak in your back door." Shared-space racing = the #1 low-load excitement lever, *and* it's the most HOMM3 thing there is. | LOW | Transcript | Our hex map is currently quiet personal tile-placement. **Make it a contested adventure:** things worth racing for, first-come-takes-it, map that reveals as you explore. |
| B3 | **Protect & amplify the growth-arc "click."** Core genre hook = weak→powerful, a turn that "finally clicks" ("numbers go up" dopamine). Make a good turn *cascade visibly* (chain triggers, snowball) rather than a row of small separate optimizations. | NO | Pass 1 + transcript ("one more turn") | Our trigger/synergy engine already supports this — make the payoff a visible *crescendo*. |
| B4 | **Multi-turn planning hooks.** Ark Nova's most-praised mechanic = the action "escalator": unused actions get *stronger* the longer you wait → agonize over *when* to fire. Pure anticipation, zero arithmetic. (The "it's the combos" claim was REFUTED 1-2 — it's the *sequencing tension*.) | NO | Pass 1 | A saved-up **Town "ultimate"** or a hero whose ability grows if held — "fire now or wait one more week for the big one?" |
| B5 | **Player-chosen risk (push-your-luck), opt-in.** Transcript's combat tension: "go in overwhelming vs. leave them a chance to flee" — a *chosen* risk that makes stories, not arithmetic. The D12 we roll at setup is currently ceremonial. | LOW | Transcript | Optional gamble on a map fight/quest: Safe (guaranteed) vs. Gamble (D12 + Army, win big / lose troops). Keep Safe always available. |

---

## 3. FIX PACING / FAIRNESS (zero added load)

| # | Technique | Source | Maps onto our game |
|---|---|---|---|
| C1 | **Tune the end-trigger for 2 players.** TM's end conditions don't scale — at 2p the engine "runs 2-3 turns too long" (the part that drags). Stop the game while the engine is still satisfying-but-not-exhausted. | Pass 1 | We have the *exact* structure (fixed track maxes regardless of player count). **Already partly addressed:** Wonder completion now grants a final week then ends. Watch the all-maxed path for the 2p over-run. |
| C2 | **Crisp, dramatic endgame** — TM's endgame felt like "ticking marks off a checklist." Give it a climax. | Pass 1 | Wonder completion is a good climactic seed; lean into it. Avoid the engine idling at the end. |
| C3 | **Gentle catch-up for the trailing player** (acute at 2p — no third party checks a leader). But **don't over-correct** into forced ties (kills the growth-arc joy). Light touch: trailing lord picks first / gets the better event. | Pass 1 | Sustains "I can still win" → the play-again feeling. |

---

## 4. THE HONEST PRIORITY LIST (re-ranked after pass 2)

The path is **NOT more systems** — complexity is the enemy. Both passes converge:
**cut the computation + add STRUCTURAL TENSION (not bigger combos), nothing else.** Pass 2
sharpened *which* tension to add and added two new high-value, 2p-proven levers (converging
endgame, contested board).

**Tier 1 — cut the arithmetic (do regardless):**
1. **A1 — Wood/Crystal (& maybe Ore/Mercury) → passive tag discounts.** Biggest math cut, depth
   preserved (Ares-verified). *Reduces load. 2p: yes.*
2. **A2 — Screen previews/highlights everything computable** (net-this-turn, next-week income,
   glow affordable). Our digital superpower. *Reduces load. 2p: yes.*

**Tier 2 — add ONE structural tension (pick 1–2, not all):**
3. **B2 — make the hex map a CONTESTED shared space** (Brass/Gaia/HOMM3 pattern #2): map rewards
   worth *racing* the rival for, first-come-takes-it, reveal-as-you-explore. The HOMM3 transcript's
   whole thesis + pass-2's strongest cross-game pattern. *Low load. 2p: yes.* **← top excitement pick**
4. **NEW: tighten the ENDGAME into a visible countdown** (Ark Nova converging-markers pattern #3).
   Right now "max all 3 tracks" is an open-ended fade. Consider a **single visible "doom clock"**
   that both players can see closing, so the finish is dramatic. (Wonder→final-week fix already
   nudged this; this is the bigger version.) *No load. 2p: yes.*
5. **B1 — proclamation → visible-ahead SHARED EVENT + loud Deed/Honor races.** Turn the flat
   symmetric boon into an event that rewards/punishes your build, shown ~1–2 weeks ahead so you
   plan not freeze. Surface races ("Roland is 1 tag from Archmage"). *Low load. 2p: yes.*

**Tier 3 — flavour/spike (optional):**
6. **C1/C2 — 2-player end-trigger tuning + climactic ending.** *No load.* (Wonder fix done; watch
   the all-maxed over-run.)
7. **B4 — one "fire now or save it" planning hook** (Ark Nova escalator pattern: a Town ultimate or
   hero whose power grows if held). *No load. 2p: yes.*
8. **B5 — opt-in push-your-luck** on a map fight/quest using the ceremonial D12 (Safe vs Gamble).
   Hidden-info-lite, makes stories. *Low load.*

**What pass 2 says NOT to do:**
- ❌ Don't chase **bigger combos/cascades** as the fix (refuted 0-3) — the *click* matters, but
  tension structures, not combo depth, drive excitement. We already have enough engine; add tension.
- ❌ Don't add **dense iconography** thinking it hides math (refuted) — keep icons few/clean.
- ❌ Don't rely on a **bare VP race track** for tension (refuted 0-3) — a visible race needs
  interaction or hidden info wrapped around it to actually be tense.

> Everything favors **drama over accounting.** When in doubt add tension/interaction/anticipation/
> theme — never another sub-economy. The single highest-leverage move is **#3 (contested map)**:
> it's the most HOMM3 thing, the strongest cross-game pattern, low-load, and 2p-native.

---

## 5. PER-GAME PATTERNS (pass 2 — verified)

> Pass 2 ran 103 agents, 21 sources, 25 claims adversarially verified → **17 confirmed, 8
> refuted**. Confidence note: mostly review-blog tier; the Dune designer diary and Ark Nova rules
> are primary. The refutations are as useful as the confirmations (below).

### Per-game — the single mechanic most credited for excitement

- **Dune: Imperium — commit-before-reveal hidden information** (the signature tension). You
  **deploy agents/cards before combat strength resolves**, so you bluff and read your opponent.
  The designer diary *explicitly* frames combat drama as coming from hidden info, not math.
  Direct interaction (taking a board resource can even *pay* your opponent) — **rebuts the
  "solitaire" feel.** *Load: NO. 2p: YES* (though the *worker-placement* contention specifically
  weakens at 2p — see pitfalls). (3-0)
- **Brass: Birmingham — contested shared board + the two-era reset.** Tension comes from
  **interdependence on one shared network/market** (your builds and the opponent's collide), and
  the **mid-game canal→rail era reset** that wipes the board and re-opens the race — a built-in
  *catch-up + second act* that prevents a runaway and re-energizes the back half. *Load: NO. 2p: YES.*
  (both 3-0)
- **Ark Nova — three things, all verified:**
  1. **The action "escalator" strength track** — unused actions grow stronger; you agonize over
     *when* to fire. A pure **multi-turn-planning / sequencing** tension. (3-0)
  2. **Card sequencing/combos for big payoffs** — playing the right card at the right time chains
     into a large turn (the "click"). (3-0) *(Caveat: see refutation — combos are NOT the
     headline excitement source; the escalator + endgame structure are.)*
  3. **Converging-marker endgame** — the two scoring tracks (Appeal + Conservation) run **toward
     each other from opposite ends**; the game ends when the markers meet/cross, and **the gap
     between them IS the score.** This makes the finish a visible, tightening, dramatic
     countdown rather than an open-ended slog. *Load: NO. 2p: YES.* (3-0)
- **Race for the Galaxy — simultaneous role/phase selection** cuts downtime to near-zero (everyone
  acts in the same phase). *Load: NO. 2p: YES.* (3-0)
- **The universal "engine click"** — the moment your production/combos finally cohere into a big
  turn — is independently confirmed as *the* core engine-builder dopamine hit. **Protect & amplify
  it.** (3-0)
- **7 Wonders Duel** surfaced as the key **2-player** exemplar (sources gathered; the design lesson:
  multiple **simultaneous win paths** — military track, science track, civilian points — each a
  *visible contested race* with its own instant-win threat, so both players are always pressured on
  several fronts at once). *Load: low. 2p: YES (it's the gold-standard 2p euro).* 

### What pass 2 REFUTED (don't chase these)

- ❌ **"Combos/cascades are the source of excitement."** Killed **0-3**. The dopamine is the
  *click*, but reviewers credit **structural tension** (escalator, converging endgame, contested
  board, hidden-info reveal) as the real driver. **Don't over-invest in build-a-bigger-combo;
  invest in tension structures.**
- ❌ **"Dense iconography hides arithmetic elegantly."** Killed (Race for the Galaxy threads, 0-3 /
  1-2). Heavy icon systems impose a *real* recurring decode cost. **Reinforces pass-1 A3: clean,
  few, tested icons — not clever-but-dense ones.**
- ❌ **"Ark Nova's race + endgame keeps it from being anticlimactic"** as a blanket claim (0-3) and
  **"Dune tension = the VP-track race"** (0-3) — i.e. a bare scoring *track* alone isn't the
  tension; the **hidden-info / contested-board structure around it** is. Lesson: a visible race is
  necessary but not sufficient — pair it with interaction or hidden info.

### Cross-game transferable patterns (the throughline)

The recurring engine of excitement across ALL of these is **structural tension**, in 4 reusable shapes:
1. **Hidden info / commit-before-reveal** (Dune) — you act before you know the outcome.
2. **Contested shared space** (Brass network, Gaia leech, the HOMM3 map) — your moves and theirs
   collide on one board.
3. **A tightening, visible endgame** (Ark Nova converging markers, Brass era reset) — the finish is
   a dramatic countdown, not an open fade-out.
4. **Multiple simultaneous contested races** (7 Wonders Duel) — pressure on several fronts at once,
   each with its own threat, so you can never relax.
All four are **low arithmetic** and **all work at 2 players.** None are "add a sub-economy."

---

## Caveats (both passes)
- Sources are mostly review/design-blog tier (good for sentiment, not survey data); strongest
  sourcing: cognitive-load (NN/g + offloading research, pass 1) and the Dune designer diary +
  Ark Nova rules (primary, pass 2).
- Pass 2's auto-synthesis collapsed to 2 findings, but the **verification log holds 17 confirmed +
  8 refuted claims** — §5 above is reconstructed from that log, which is the reliable record.
- Per-2-player tuning of these interaction mechanisms remains an **open question** — every Tier-2/3
  item wants real playtesting to dial in. (Note: Dune's worker-placement contention specifically
  *weakens* at 2p — a caution that contested-resource mechanics need enough scarcity to bite head-to-head.)
- The HOMM3 transcript is an *enthusiast appreciation*, not a mechanics breakdown — used for *what
  feeling to chase*, not balance numbers.

## Source list (both passes)
Pass 1: streamlinedgaming, boardgamesnob, meeplemountain (TM/Ares/Ark Nova), thethoughtfulgamer,
nngroup (UX, primary-ish), frontlinegaming (Turmoil), eriktwice (Ares), lakeshoregamenight.
Pass 2: direwolfdigital Dune designer diary (primary), ryanboardgames (Brass, 7 Wonders Duel),
opinionatedgamers + gideonsgaming + rectorsquid (Ark Nova), meepleit (Dune vs TM), thedicedrop,
anykeytostart + islaythedragon (RFTG iconography — these fed the *refutations*), giantbrain
(7 Wonders Duel), boardgamedesignlab.
